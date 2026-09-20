-- ==============================================================================
-- Migration: 20260916000001_phase2k_create_receipt_book_rpc.sql
-- Phase 2K-2: Secretary Receipt Book Creation & Management RPCs
-- ==============================================================================

-- 1. RPC: create_receipt_book (Admin Scoped)
CREATE OR REPLACE FUNCTION public.create_receipt_book(
    p_organization_id uuid,
    p_event_id uuid,
    p_book_number text,
    p_prefix text,
    p_start_number integer,
    p_end_number integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_book_number text;
    v_clean_prefix text;
    v_book_id uuid;
    v_conflict_book record;
BEGIN
    -- 1. Authentication Check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Organization & Event ID Checks
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    -- 3. Authorization Check: Caller MUST be administrator of target organization
    IF NOT public.is_organization_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of this organization';
    END IF;

    -- 4. Verify Event belongs to Organization
    IF NOT EXISTS (
        SELECT 1 FROM public.events
        WHERE id = p_event_id AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Event does not belong to the specified organization';
    END IF;

    -- 5. Field Clean & Normalization
    v_clean_book_number := TRIM(COALESCE(p_book_number, ''));
    v_clean_prefix := TRIM(COALESCE(p_prefix, 'VP-'));
    IF v_clean_prefix = '' THEN
        v_clean_prefix := 'VP-';
    END IF;

    -- 6. Value Validations
    IF LENGTH(v_clean_book_number) < 1 THEN
        RAISE EXCEPTION 'Book number / identifier is required';
    END IF;

    IF p_start_number IS NULL OR p_start_number < 1 THEN
        RAISE EXCEPTION 'Start receipt number must be greater than or equal to 1';
    END IF;

    IF p_end_number IS NULL OR p_end_number < p_start_number THEN
        RAISE EXCEPTION 'End receipt number must be greater than start receipt number';
    END IF;

    IF (p_end_number - p_start_number + 1) > 1000 THEN
        RAISE EXCEPTION 'Receipt book capacity cannot exceed 1000 receipts per book';
    END IF;

    -- 7. Check for duplicate Book Number within the same Event
    IF EXISTS (
        SELECT 1 FROM public.receipt_books
        WHERE organization_id = p_organization_id
          AND event_id = p_event_id
          AND LOWER(TRIM(book_number)) = LOWER(v_clean_book_number)
    ) THEN
        RAISE EXCEPTION 'A receipt book with identifier "%" already exists for this event', v_clean_book_number;
    END IF;

    -- 8. Check for Overlapping Receipt Number Range with Same Prefix within Event
    SELECT id, book_number, prefix, start_number, end_number
    INTO v_conflict_book
    FROM public.receipt_books
    WHERE organization_id = p_organization_id
      AND event_id = p_event_id
      AND LOWER(TRIM(prefix)) = LOWER(v_clean_prefix)
      AND (p_start_number <= end_number AND p_end_number >= start_number)
    LIMIT 1;

    IF v_conflict_book.id IS NOT NULL THEN
        RAISE EXCEPTION 'Receipt range (% - %) overlaps with existing Book "%" (% - %)',
            p_start_number, p_end_number,
            v_conflict_book.book_number,
            v_conflict_book.start_number,
            v_conflict_book.end_number;
    END IF;

    -- 9. Insert Receipt Book
    INSERT INTO public.receipt_books (
        organization_id,
        event_id,
        book_number,
        prefix,
        start_number,
        end_number,
        current_number,
        status,
        created_at,
        updated_at
    )
    VALUES (
        p_organization_id,
        p_event_id,
        v_clean_book_number,
        v_clean_prefix,
        p_start_number,
        p_end_number,
        p_start_number,
        'available',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_book_id;

    RETURN jsonb_build_object(
        'success', true,
        'receipt_book_id', v_book_id,
        'book_number', v_clean_book_number,
        'prefix', v_clean_prefix,
        'start_number', p_start_number,
        'end_number', p_end_number,
        'current_number', p_start_number,
        'status', 'available'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_receipt_book(uuid, uuid, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_receipt_book(uuid, uuid, text, text, integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_receipt_book(uuid, uuid, text, text, integer, integer) FROM PUBLIC, anon;


-- 2. RPC: get_organization_receipt_books (Admin Scoped Overview)
CREATE OR REPLACE FUNCTION public.get_organization_receipt_books(
    p_organization_id uuid,
    p_event_id uuid
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
        rb.book_number,
        rb.prefix,
        rb.start_number,
        rb.end_number,
        rb.current_number,
        rb.status,
        rb.assigned_volunteer_id,
        v.name AS assigned_volunteer_name,
        rb.checked_out_session_id,
        rb.checked_out_at,
        COUNT(r.id) FILTER (WHERE r.status != 'voided') AS total_receipts_issued,
        COALESCE(SUM(r.amount) FILTER (WHERE r.status != 'voided'), 0) AS total_amount_collected,
        rb.created_at
    FROM public.receipt_books rb
    LEFT JOIN public.volunteers v ON v.id = COALESCE(rb.checked_out_by, rb.assigned_volunteer_id)
    LEFT JOIN public.receipts r ON r.receipt_book_id = rb.id
    WHERE rb.organization_id = p_organization_id
      AND (p_event_id IS NULL OR rb.event_id = p_event_id)
    GROUP BY rb.id, v.name
    ORDER BY rb.created_at DESC, rb.book_number ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_receipt_books(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_receipt_books(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_organization_receipt_books(uuid, uuid) FROM PUBLIC, anon;
