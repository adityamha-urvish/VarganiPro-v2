-- Step 8E-8: Harden sync_offline_receipt Property Boundary & Concurrent Idempotency
-- 1. Validates that p_property_id (if provided) belongs to the session's organization
-- 2. Gracefully handles concurrent unique_violation on client_receipt_id, returning already_exists without swallowing unrelated unique violations

CREATE OR REPLACE FUNCTION public.sync_offline_receipt(
    p_collection_session_id uuid,
    p_property_id uuid,
    p_receipt_number integer,
    p_donor_name text,
    p_donor_mobile text,
    p_amount numeric,
    p_payment_mode text,
    p_payment_reference text DEFAULT NULL::text,
    p_notes text DEFAULT NULL::text,
    p_client_receipt_id uuid DEFAULT NULL::uuid,
    p_offline_created_at timestamptz DEFAULT NULL::timestamptz
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
    v_existing_receipt RECORD;
    v_new_receipt_id uuid;
    v_result jsonb;
BEGIN
    -- 1. Verify caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Check client-receipt-id idempotency
    IF p_client_receipt_id IS NOT NULL THEN
        SELECT * INTO v_existing_receipt
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

    -- 3. Resolve calling user & active volunteer identity
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

    -- 5. Session ownership verification
    IF v_session.volunteer_id <> v_calling_volunteer_id THEN
        RAISE EXCEPTION 'Unauthorized: Authenticated volunteer does not own this collection session';
    END IF;

    -- 6. Lock and validate receipt book derived from session
    SELECT * INTO v_book
    FROM public.receipt_books
    WHERE id = v_session.receipt_book_id
    FOR UPDATE;

    IF v_book.id IS NULL THEN
        RAISE EXCEPTION 'Receipt book not found for session';
    END IF;

    -- 7. Validate receipt number range
    IF p_receipt_number < v_book.start_number OR p_receipt_number > v_book.end_number THEN
        RAISE EXCEPTION 'Receipt number % is outside valid range (% - %)',
            p_receipt_number, v_book.start_number, v_book.end_number;
    END IF;

    -- 8. Duplicate receipt number conflict check
    IF EXISTS (
        SELECT 1 FROM public.receipts
        WHERE receipt_book_id = v_book.id
          AND receipt_number = p_receipt_number
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'sync_status', 'conflict',
            'reason', 'receipt_number_mismatch',
            'message', format('Receipt number %s already registered in book %s', p_receipt_number, v_book.book_number)
        );
    END IF;

    -- 9. Field validation
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero';
    END IF;

    IF p_donor_name IS NULL OR TRIM(p_donor_name) = '' THEN
        RAISE EXCEPTION 'Donor name is required';
    END IF;

    -- 10. Property organization boundary validation (if property is provided)
    IF p_property_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.properties
            WHERE id = p_property_id
              AND organization_id = v_session.organization_id
        ) THEN
            RAISE EXCEPTION 'Property not found in your organization';
        END IF;
    END IF;

    -- 11. Insert receipt row with nested unique_violation handling for concurrent client_receipt_id races
    BEGIN
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
    EXCEPTION
        WHEN unique_violation THEN
            -- Check if the unique violation was caused by a concurrent client_receipt_id collision
            IF p_client_receipt_id IS NOT NULL THEN
                SELECT * INTO v_existing_receipt
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

            -- Re-raise if the unique violation was for another constraint (e.g. receipts_book_number_unique)
            RAISE;
    END;

    -- 12. Advance book counter monotonically
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
