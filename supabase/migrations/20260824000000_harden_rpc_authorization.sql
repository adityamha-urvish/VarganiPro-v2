-- Step 8C: Targeted RPC Authorization Hardening
-- Hardens checkout_receipt_book() and issue_receipt() to verify that the authenticated
-- caller's active volunteer identity strictly matches v_session.volunteer_id.

-- ==============================================================================
-- 1. checkout_receipt_book
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

  -- 4. HARDENING CHECK: Verify that the authenticated user owns this collection session
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

  -- 7. Update receipt book status to checked_out and associate with session
  UPDATE public.receipt_books
  SET
    status = 'checked_out',
    checked_out_session_id = v_session.id,
    checked_out_by = v_calling_volunteer_id,
    checked_out_at = NOW(),
    updated_at = NOW()
  WHERE id = v_book.id;

  -- 8. Link receipt book to collection session
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


-- ==============================================================================
-- 2. issue_receipt
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.issue_receipt(
  p_collection_session_id UUID,
  p_receipt_book_id UUID,
  p_receipt_number INTEGER,
  p_donor_name TEXT,
  p_donor_mobile TEXT,
  p_amount NUMERIC,
  p_payment_mode TEXT,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_client_receipt_id UUID DEFAULT NULL,
  p_property_id UUID DEFAULT NULL,
  p_offline_created_at TIMESTAMPTZ DEFAULT NULL
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
  v_existing_receipt RECORD;
  v_new_receipt_id UUID;
  v_result JSONB;
BEGIN
  -- 1. Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Verify idempotency via client_receipt_id if provided
  IF p_client_receipt_id IS NOT NULL THEN
    SELECT *
    INTO v_existing_receipt
    FROM public.receipts
    WHERE client_receipt_id = p_client_receipt_id;

    IF v_existing_receipt.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_exists', true,
        'receipt_id', v_existing_receipt.id,
        'receipt_number', v_existing_receipt.receipt_number,
        'client_receipt_id', v_existing_receipt.client_receipt_id
      );
    END IF;
  END IF;

  -- 3. Resolve caller active volunteer identity
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

  -- 4. Lock and validate collection session
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

  -- 5. HARDENING CHECK: Verify authenticated volunteer owns this collection session
  IF v_session.volunteer_id <> v_calling_volunteer_id THEN
    RAISE EXCEPTION 'Unauthorized: Authenticated volunteer does not own this collection session';
  END IF;

  -- 6. Lock and validate receipt book
  SELECT *
  INTO v_book
  FROM public.receipt_books
  WHERE id = p_receipt_book_id
  FOR UPDATE;

  IF v_book.id IS NULL THEN
    RAISE EXCEPTION 'Receipt book not found';
  END IF;

  IF v_book.organization_id <> v_session.organization_id THEN
    RAISE EXCEPTION 'Receipt book organization mismatch';
  END IF;

  IF v_book.event_id <> v_session.event_id THEN
    RAISE EXCEPTION 'Receipt book event mismatch';
  END IF;

  -- Check that receipt book is checked out to this session and volunteer
  IF v_book.checked_out_session_id <> v_session.id OR v_book.checked_out_by <> v_session.volunteer_id THEN
    RAISE EXCEPTION 'Receipt book is not checked out to this collection session and volunteer';
  END IF;

  -- Validate receipt number range
  IF p_receipt_number < v_book.start_number OR p_receipt_number > v_book.end_number THEN
    RAISE EXCEPTION 'Receipt number % is outside the valid book range (% - %)',
      p_receipt_number, v_book.start_number, v_book.end_number;
  END IF;

  -- Check for duplicate receipt number in this book
  IF EXISTS (
    SELECT 1
    FROM public.receipts
    WHERE receipt_book_id = v_book.id
      AND receipt_number = p_receipt_number
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'sync_status', 'conflict',
      'reason', 'receipt_number_mismatch',
      'message', format('Receipt number %s is already registered in receipt book %s', p_receipt_number, v_book.book_number)
    );
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- Validate donor name
  IF p_donor_name IS NULL OR TRIM(p_donor_name) = '' THEN
    RAISE EXCEPTION 'Donor name is required';
  END IF;

  -- 7. Insert receipt
  INSERT INTO public.receipts (
    organization_id,
    event_id,
    collection_session_id,
    receipt_book_id,
    volunteer_id,
    property_id,
    receipt_number,
    donor_name,
    donor_mobile,
    amount,
    payment_mode,
    payment_reference,
    notes,
    client_receipt_id,
    offline_created_at,
    created_at,
    updated_at
  )
  VALUES (
    v_session.organization_id,
    v_session.event_id,
    v_session.id,
    v_book.id,
    v_calling_volunteer_id,
    p_property_id,
    p_receipt_number,
    TRIM(p_donor_name),
    NULLIF(TRIM(p_donor_mobile), ''),
    p_amount,
    p_payment_mode,
    NULLIF(TRIM(p_payment_reference), ''),
    NULLIF(TRIM(p_notes), ''),
    p_client_receipt_id,
    COALESCE(p_offline_created_at, NOW()),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_receipt_id;

  -- 8. Advance receipt book current number
  UPDATE public.receipt_books
  SET
    current_number = GREATEST(COALESCE(current_number, start_number), p_receipt_number + 1),
    updated_at = NOW()
  WHERE id = v_book.id;

  v_result := jsonb_build_object(
    'success', true,
    'receipt_id', v_new_receipt_id,
    'receipt_number', p_receipt_number,
    'client_receipt_id', p_client_receipt_id
  );

  RETURN v_result;
END;
$$;
