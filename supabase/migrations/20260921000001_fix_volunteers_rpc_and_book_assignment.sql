-- ==============================================================================
-- Migration: 20260921000001_fix_volunteers_rpc_and_book_assignment.sql
-- Fix get_organization_volunteers return type mismatch and add assign_receipt_book RPC
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fix get_organization_volunteers (Explicit ::text Casts for Type Safety)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_organization_volunteers(
    p_organization_id uuid
)
RETURNS TABLE (
    volunteer_id uuid,
    user_id uuid,
    full_name text,
    mobile text,
    status text,
    must_change_pin boolean,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    IF NOT public.is_organization_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of this organization';
    END IF;

    RETURN QUERY
    SELECT
        v.id AS volunteer_id,
        u.id AS user_id,
        u.name::text AS full_name,
        u.mobile::text AS mobile,
        v.status::text AS status,
        COALESCE(u.must_change_pin, false) AS must_change_pin,
        v.created_at AS created_at
    FROM public.volunteers v
    JOIN public.users u ON u.id = v.user_id
    WHERE v.organization_id = p_organization_id
    ORDER BY u.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_volunteers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_volunteers(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_organization_volunteers(uuid) FROM PUBLIC, anon;


-- ------------------------------------------------------------------------------
-- 2. Fix get_organization_receipt_books (Join users for assigned_volunteer_name)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_organization_receipt_books(
    p_organization_id uuid,
    p_event_id uuid DEFAULT NULL
)
RETURNS TABLE (
    receipt_book_id uuid,
    organization_id uuid,
    event_id uuid,
    book_number text,
    prefix text,
    start_number integer,
    end_number integer,
    current_number integer,
    status text,
    assigned_volunteer_id uuid,
    assigned_volunteer_name text,
    checked_out_session_id uuid,
    checked_out_at timestamptz,
    total_receipts_issued bigint,
    total_amount_collected numeric,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT public.is_organization_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of this organization';
    END IF;

    RETURN QUERY
    SELECT
        rb.id AS receipt_book_id,
        rb.organization_id,
        rb.event_id,
        rb.book_number::text AS book_number,
        rb.prefix::text AS prefix,
        rb.start_number,
        rb.end_number,
        rb.current_number,
        rb.status::text AS status,
        rb.assigned_volunteer_id,
        u.name::text AS assigned_volunteer_name,
        rb.checked_out_session_id,
        rb.checked_out_at,
        COUNT(r.id) FILTER (WHERE r.status != 'voided') AS total_receipts_issued,
        COALESCE(SUM(r.amount) FILTER (WHERE r.status != 'voided'), 0) AS total_amount_collected,
        rb.created_at
    FROM public.receipt_books rb
    LEFT JOIN public.volunteers v ON v.id = COALESCE(rb.checked_out_by, rb.assigned_volunteer_id)
    LEFT JOIN public.users u ON u.id = v.user_id
    LEFT JOIN public.receipts r ON r.receipt_book_id = rb.id
    WHERE rb.organization_id = p_organization_id
      AND (p_event_id IS NULL OR rb.event_id = p_event_id)
    GROUP BY rb.id, u.name
    ORDER BY rb.created_at DESC, rb.book_number ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_receipt_books(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_receipt_books(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_organization_receipt_books(uuid, uuid) FROM PUBLIC, anon;


-- ------------------------------------------------------------------------------
-- 3. RPC: assign_receipt_book (Admin Book-to-Volunteer Assignment)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_receipt_book(
    p_receipt_book_id uuid,
    p_volunteer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_book record;
    v_volunteer_exists boolean;
    v_new_status text;
BEGIN
    -- 1. Authentication Check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_receipt_book_id IS NULL THEN
        RAISE EXCEPTION 'Receipt book ID is required';
    END IF;

    -- 2. Fetch Receipt Book
    SELECT * INTO v_book
    FROM public.receipt_books
    WHERE id = p_receipt_book_id
    FOR UPDATE;

    IF v_book.id IS NULL THEN
        RAISE EXCEPTION 'Receipt book not found';
    END IF;

    -- 3. Verify Caller is Administrator of this organization
    IF NOT public.is_organization_admin(v_book.organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of this organization';
    END IF;

    -- 4. Status Check: can only assign/unassign if status is 'available' or 'assigned'
    IF v_book.status NOT IN ('available', 'assigned') THEN
        RAISE EXCEPTION 'Cannot reassign receipt book with status "%"', v_book.status;
    END IF;

    -- 5. If assigning a volunteer, verify they belong to same organization
    IF p_volunteer_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.volunteers
            WHERE id = p_volunteer_id
              AND organization_id = v_book.organization_id
              AND status = 'active'
        ) INTO v_volunteer_exists;

        IF NOT v_volunteer_exists THEN
            RAISE EXCEPTION 'Active volunteer not found in this organization';
        END IF;

        v_new_status := 'assigned';
    ELSE
        v_new_status := 'available';
    END IF;

    -- 6. Update Receipt Book
    UPDATE public.receipt_books
    SET
        assigned_volunteer_id = p_volunteer_id,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_receipt_book_id;

    RETURN jsonb_build_object(
        'success', true,
        'receipt_book_id', p_receipt_book_id,
        'assigned_volunteer_id', p_volunteer_id,
        'status', v_new_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_receipt_book(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_receipt_book(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.assign_receipt_book(uuid, uuid) FROM PUBLIC, anon;
