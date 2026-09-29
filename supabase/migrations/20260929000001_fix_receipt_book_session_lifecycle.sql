-- ==============================================================================
-- Migration: 20260929000001_fix_receipt_book_session_lifecycle.sql
-- 
-- 1. Updates complete_collection_session() to release the receipt book on session completion:
--    - If current_number > end_number -> status = 'exhausted'
--    - Else if assigned_volunteer_id IS NOT NULL -> status = 'assigned'
--    - Else -> status = 'available'
--    - Always clears checked_out_session_id and checked_out_by.
-- 2. Hardens start_collection_session() and checkout_receipt_book() to reject exhausted books.
-- 3. Performs targeted production data repair for Book BK-02 (caece695-0650-4786-8d8d-d8a51989e82f).
-- ==============================================================================

-- ==============================================================================
-- 1. complete_collection_session
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.complete_collection_session(
    p_collection_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id uuid;
    v_calling_volunteer_id uuid;
    v_session RECORD;
    v_book RECORD;
    v_receipt_count integer := 0;
    v_total_amount numeric := 0;
    v_cash_amount numeric := 0;
    v_upi_amount numeric := 0;
    v_cheque_amount numeric := 0;
    v_bank_transfer_amount numeric := 0;
    v_new_book_status text;
    v_result jsonb;
BEGIN
    -- 1. Verify caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Resolve calling user & active volunteer identity
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

    -- 3. Lock and validate collection session
    SELECT * INTO v_session
    FROM public.collection_sessions
    WHERE id = p_collection_session_id
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Collection session not found';
    END IF;

    IF v_session.status <> 'open' THEN
        RAISE EXCEPTION 'Collection session is not open (status: %)', v_session.status;
    END IF;

    -- 4. Session ownership verification
    IF v_session.volunteer_id <> v_calling_volunteer_id THEN
        RAISE EXCEPTION 'Unauthorized: Authenticated volunteer does not own this collection session';
    END IF;

    -- 5. Calculate session totals from receipts
    SELECT
        COUNT(*)::integer,
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_mode = 'upi' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_mode = 'cheque' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_mode = 'bank_transfer' THEN amount ELSE 0 END), 0)
    INTO
        v_receipt_count,
        v_total_amount,
        v_cash_amount,
        v_upi_amount,
        v_cheque_amount,
        v_bank_transfer_amount
    FROM public.receipts
    WHERE collection_session_id = v_session.id
      AND status <> 'cancelled';

    -- 6. Update collection session status to completed
    UPDATE public.collection_sessions
    SET
        status = 'completed',
        ended_at = NOW(),
        updated_at = NOW()
    WHERE id = v_session.id;

    -- 7. Release receipt book if associated with this session
    IF v_session.receipt_book_id IS NOT NULL THEN
        SELECT * INTO v_book
        FROM public.receipt_books
        WHERE id = v_session.receipt_book_id
        FOR UPDATE;

        IF v_book.id IS NOT NULL THEN
            IF v_book.current_number > v_book.end_number THEN
                v_new_book_status := 'exhausted';
            ELSIF v_book.assigned_volunteer_id IS NOT NULL THEN
                v_new_book_status := 'assigned';
            ELSE
                v_new_book_status := 'available';
            END IF;

            UPDATE public.receipt_books
            SET
                status = v_new_book_status,
                checked_out_session_id = NULL,
                checked_out_by = NULL,
                updated_at = NOW()
            WHERE id = v_book.id;
        END IF;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'session_id', v_session.id,
        'status', 'completed',
        'ended_at', NOW(),
        'receipt_count', v_receipt_count,
        'total_amount', v_total_amount,
        'cash_amount', v_cash_amount,
        'upi_amount', v_upi_amount,
        'cheque_amount', v_cheque_amount,
        'bank_transfer_amount', v_bank_transfer_amount
    );

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_collection_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_collection_session(uuid) TO authenticated, service_role;


-- ==============================================================================
-- 2. start_collection_session
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.start_collection_session(
    p_event_id uuid,
    p_receipt_book_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id uuid;
    v_calling_volunteer_id uuid;
    v_organization_id uuid;
    v_event RECORD;
    v_book RECORD;
    v_existing_open_session RECORD;
    v_session_id uuid;
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT u.id, v.id, v.organization_id
    INTO v_calling_user_id, v_calling_volunteer_id, v_organization_id
    FROM public.volunteers v
    JOIN public.users u ON u.id = v.user_id
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active = true
      AND v.status = 'active'
    LIMIT 1;

    IF v_calling_user_id IS NULL OR v_calling_volunteer_id IS NULL THEN
        RAISE EXCEPTION 'Active volunteer profile not found for authenticated user';
    END IF;

    SELECT id INTO v_existing_open_session
    FROM public.collection_sessions
    WHERE volunteer_id = v_calling_volunteer_id
      AND status = 'open'
    LIMIT 1;

    IF v_existing_open_session.id IS NOT NULL THEN
        RAISE EXCEPTION 'Volunteer already has an active open collection session';
    END IF;

    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND organization_id = v_organization_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive in your organization';
    END IF;

    SELECT * INTO v_book
    FROM public.receipt_books
    WHERE id = p_receipt_book_id
      AND organization_id = v_organization_id
      AND event_id = p_event_id
    FOR UPDATE;

    IF v_book.id IS NULL THEN
        RAISE EXCEPTION 'Receipt book not found for this event and organization';
    END IF;

    IF v_book.status <> 'available' AND v_book.status <> 'assigned' THEN
        RAISE EXCEPTION 'Receipt book is not available for collection (status: %)', v_book.status;
    END IF;

    IF v_book.current_number > v_book.end_number THEN
        RAISE EXCEPTION 'Receipt book is exhausted (range % - %, current %)', v_book.start_number, v_book.end_number, v_book.current_number;
    END IF;

    IF v_book.status = 'assigned' THEN
        IF v_book.assigned_volunteer_id IS NULL
           OR v_book.assigned_volunteer_id <> v_calling_volunteer_id THEN
            RAISE EXCEPTION 'Receipt book is assigned to another volunteer';
        END IF;
    END IF;

    INSERT INTO public.collection_sessions (
        organization_id,
        event_id,
        volunteer_id,
        receipt_book_id,
        status,
        started_at,
        created_at,
        updated_at
    )
    VALUES (
        v_organization_id,
        p_event_id,
        v_calling_volunteer_id,
        p_receipt_book_id,
        'open',
        NOW(),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_session_id;

    UPDATE public.receipt_books
    SET
        status = 'checked_out',
        checked_out_session_id = v_session_id,
        checked_out_by = v_calling_volunteer_id,
        checked_out_at = NOW(),
        updated_at = NOW()
    WHERE id = v_book.id;

    v_result := jsonb_build_object(
        'success', true,
        'collection_session_id', v_session_id,
        'receipt_book_id', v_book.id,
        'book_number', v_book.book_number,
        'prefix', v_book.prefix,
        'start_number', v_book.start_number,
        'end_number', v_book.end_number,
        'current_number', COALESCE(v_book.current_number, v_book.start_number)
    );

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.start_collection_session(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_collection_session(uuid, uuid) TO authenticated, service_role;


-- ==============================================================================
-- 3. checkout_receipt_book
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

  IF v_book.current_number > v_book.end_number THEN
    RAISE EXCEPTION 'Receipt book is exhausted (range % - %, current %)', v_book.start_number, v_book.end_number, v_book.current_number;
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

REVOKE ALL ON FUNCTION public.checkout_receipt_book(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_receipt_book(uuid, uuid) TO authenticated, service_role;


-- ==============================================================================
-- 4. Targeted Production Data Repair for BK-02
-- ==============================================================================

UPDATE public.receipt_books
SET
  status = 'assigned',
  checked_out_session_id = NULL,
  checked_out_by = NULL,
  updated_at = NOW()
WHERE id = 'caece695-0650-4786-8d8d-d8a51989e82f'
  AND organization_id = '29c8b967-11aa-4c56-8d6c-c0105114768e'
  AND status = 'checked_out';
