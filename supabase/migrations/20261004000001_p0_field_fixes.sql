-- ==============================================================================
-- Migration: 20261004000001_p0_field_fixes.sql
-- 
-- P0 Field Production Fixes:
-- 1. update_property: Admin-only property editing (unit, floor, owner, mobile, shop name)
-- 2. checkout_receipt_book: Safe multi-book switching within active collection session
-- 3. complete_collection_session: Multi-book session completion & release
-- ==============================================================================

-- ==============================================================================
-- 1. update_property (Admin-Only Property & Resident Details Editing)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_property(
    p_property_id uuid,
    p_unit_number text DEFAULT NULL,
    p_floor_number integer DEFAULT NULL,
    p_owner_name text DEFAULT NULL,
    p_contact_mobile text DEFAULT NULL,
    p_shop_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prop RECORD;
    v_is_admin boolean;
    v_clean_unit text;
    v_clean_owner text;
    v_clean_mobile text;
    v_clean_shop text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_property_id IS NULL THEN
        RAISE EXCEPTION 'Property ID is required';
    END IF;

    -- Lock and retrieve property
    SELECT * INTO v_prop
    FROM public.properties
    WHERE id = p_property_id
    FOR UPDATE;

    IF v_prop.id IS NULL THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    -- Verify caller is organization admin
    v_is_admin := public.is_organization_admin(v_prop.organization_id);
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organization administrators can edit properties';
    END IF;

    v_clean_unit := NULLIF(TRIM(COALESCE(p_unit_number, '')), '');
    v_clean_owner := NULLIF(TRIM(COALESCE(p_owner_name, '')), '');
    v_clean_mobile := NULLIF(TRIM(COALESCE(p_contact_mobile, '')), '');
    v_clean_shop := NULLIF(TRIM(COALESCE(p_shop_name, '')), '');

    IF v_prop.property_type = 'commercial' OR v_clean_shop IS NOT NULL THEN
        UPDATE public.properties
        SET
            shop_name = COALESCE(v_clean_shop, shop_name),
            property_number = COALESCE(v_clean_shop, property_number),
            owner_name = v_clean_owner,
            contact_mobile = v_clean_mobile,
            updated_at = NOW()
        WHERE id = v_prop.id;
    ELSE
        UPDATE public.properties
        SET
            unit_number = COALESCE(v_clean_unit, unit_number),
            flat_number = COALESCE(v_clean_unit, flat_number),
            property_number = COALESCE(v_clean_unit, property_number),
            floor_number = p_floor_number,
            owner_name = v_clean_owner,
            contact_mobile = v_clean_mobile,
            updated_at = NOW()
        WHERE id = v_prop.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'property_id', v_prop.id,
        'unit_number', COALESCE(v_clean_unit, v_prop.unit_number),
        'floor_number', COALESCE(p_floor_number, v_prop.floor_number),
        'owner_name', v_clean_owner,
        'contact_mobile', v_clean_mobile,
        'shop_name', COALESCE(v_clean_shop, v_prop.shop_name)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_property(uuid, text, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_property(uuid, text, integer, text, text, text) TO authenticated, service_role;


-- ==============================================================================
-- 2. checkout_receipt_book (Multi-Book Session Switching)
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
    v_prev_book RECORD;
    v_prev_status TEXT;
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

    -- 6. If session currently has another receipt book checked out, release previous book cleanly
    IF v_session.receipt_book_id IS NOT NULL AND v_session.receipt_book_id <> p_receipt_book_id THEN
        SELECT * INTO v_prev_book
        FROM public.receipt_books
        WHERE id = v_session.receipt_book_id
        FOR UPDATE;

        IF v_prev_book.id IS NOT NULL THEN
            IF v_prev_book.current_number > v_prev_book.end_number THEN
                v_prev_status := 'exhausted';
            ELSIF v_prev_book.assigned_volunteer_id IS NOT NULL THEN
                v_prev_status := 'assigned';
            ELSE
                v_prev_status := 'available';
            END IF;

            UPDATE public.receipt_books
            SET
                status = v_prev_status,
                checked_out_session_id = NULL,
                checked_out_by = NULL,
                updated_at = NOW()
            WHERE id = v_prev_book.id;
        END IF;
    END IF;

    -- 7. Lock and retrieve target receipt book
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

    -- Verify assignment to calling volunteer if assigned
    IF v_book.status = 'assigned' THEN
        IF v_book.assigned_volunteer_id IS NULL OR v_book.assigned_volunteer_id <> v_calling_volunteer_id THEN
            RAISE EXCEPTION 'Receipt book is assigned to another volunteer';
        END IF;
    END IF;

    -- 8. Update target receipt book status to checked_out and associate with session
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
-- 3. complete_collection_session (Multi-Book Session Release & Totals)
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

    -- 5. Calculate session totals across ALL receipts in this collection session
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

    -- 7. Release all receipt books associated or checked out for this session
    FOR v_book IN
        SELECT * FROM public.receipt_books
        WHERE checked_out_session_id = v_session.id
           OR id = v_session.receipt_book_id
        FOR UPDATE
    LOOP
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
    END LOOP;

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
