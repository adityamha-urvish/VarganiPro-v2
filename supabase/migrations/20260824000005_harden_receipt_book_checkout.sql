-- Step 8E-6: Harden Receipt Book Status Constraint & Checkout Authorization
-- 1. Updates receipt_books_status_check to include 'checked_out' alongside all live statuses:
--    'available', 'assigned', 'checked_out', 'exhausted', 'closed', 'cancelled'
-- 2. Hardens checkout_receipt_book() so that an assigned book can only be checked out by its assigned volunteer
-- 3. Rejects assigned books with NULL assigned_volunteer_id

-- ==============================================================================
-- 1. Update receipt_books_status_check constraint
-- ==============================================================================

ALTER TABLE public.receipt_books
  DROP CONSTRAINT IF EXISTS receipt_books_status_check;

ALTER TABLE public.receipt_books
  ADD CONSTRAINT receipt_books_status_check
  CHECK (
    status IN (
      'available',
      'assigned',
      'checked_out',
      'exhausted',
      'closed',
      'cancelled'
    )
  );


-- ==============================================================================
-- 2. Harden checkout_receipt_book RPC
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.checkout_receipt_book(
  p_receipt_book_id UUID,
  p_collection_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_calling_user_id UUID;
  v_calling_volunteer_id UUID;
  v_session RECORD;
  v_book RECORD;
  v_result JSONB;
BEGIN
  -- 1. Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Verify caller has an active application user and resolve active volunteer ID
  SELECT u.id, v.id
  INTO v_calling_user_id, v_calling_volunteer_id
  FROM public.volunteers v
  JOIN public.users u ON u.id = v.user_id
  WHERE u.auth_user_id = auth.uid()
    AND u.is_active = true
    AND v.status = 'active'
  LIMIT 1;

  IF v_calling_user_id IS NULL OR v_calling_volunteer_id IS NULL THEN
    RAISE EXCEPTION 'Active volunteer profile not found for authenticated user';
  END IF;

  -- 3. Lock and retrieve collection session
  SELECT *
  INTO v_session
  FROM public.collection_sessions
  WHERE id = p_collection_session_id
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Collection session not found';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Collection session is not open';
  END IF;

  -- 4. Verify that the authenticated user owns this collection session
  IF v_session.volunteer_id <> v_calling_volunteer_id THEN
    RAISE EXCEPTION 'Unauthorized: Authenticated volunteer does not own this collection session';
  END IF;

  -- 5. Verify organization membership
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = v_session.organization_id
      AND user_id = v_calling_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of the organization';
  END IF;

  -- 6. Lock and retrieve receipt book
  SELECT *
  INTO v_book
  FROM public.receipt_books
  WHERE id = p_receipt_book_id
  FOR UPDATE;

  IF v_book.id IS NULL THEN
    RAISE EXCEPTION 'Receipt book not found';
  END IF;

  IF v_book.organization_id <> v_session.organization_id THEN
    RAISE EXCEPTION 'Receipt book does not belong to session organization';
  END IF;

  IF v_book.event_id <> v_session.event_id THEN
    RAISE EXCEPTION 'Receipt book does not belong to session event';
  END IF;

  IF v_book.status <> 'available' AND v_book.status <> 'assigned' THEN
    RAISE EXCEPTION 'Receipt book is not available for checkout (current status: %)', v_book.status;
  END IF;

  -- 7. HARDENING CHECK: If the receipt book is assigned, verify it is assigned to the calling volunteer
  -- and reject assigned books with NULL assigned_volunteer_id
  IF v_book.status = 'assigned' THEN
    IF v_book.assigned_volunteer_id IS NULL OR v_book.assigned_volunteer_id <> v_calling_volunteer_id THEN
      RAISE EXCEPTION 'Receipt book is assigned to another volunteer';
    END IF;
  END IF;

  -- 8. Update receipt book status to checked_out and associate with session
  UPDATE public.receipt_books
  SET
    status = 'checked_out',
    checked_out_session_id = v_session.id,
    checked_out_by = v_calling_volunteer_id,
    checked_out_at = NOW(),
    updated_at = NOW()
  WHERE id = v_book.id;

  -- 9. Link receipt book to collection session
  UPDATE public.collection_sessions
  SET
    receipt_book_id = v_book.id,
    updated_at = NOW()
  WHERE id = v_session.id;

  v_result := jsonb_build_object(
    'success', true,
    'receipt_book_id', v_book.id,
    'collection_session_id', v_session.id,
    'book_number', v_book.book_number,
    'prefix', v_book.prefix,
    'start_number', v_book.start_number,
    'end_number', v_book.end_number,
    'current_number', COALESCE(v_book.current_number, v_book.start_number)
  );

  RETURN v_result;
END;
$$;
