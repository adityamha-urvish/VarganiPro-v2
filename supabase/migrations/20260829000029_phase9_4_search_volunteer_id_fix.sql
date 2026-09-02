-- ==============================================================================
-- Migration: 20260829000029_phase9_4_search_volunteer_id_fix.sql
-- Phase 9-4 Step 4A: Global Receipt Search & Campaign Export RPCs (Use scalar volunteer_id)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: search_organization_receipts
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_organization_receipts(
    p_event_id uuid,
    p_query text DEFAULT NULL,
    p_payment_mode text DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_volunteer_id uuid DEFAULT NULL,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_auth_uid uuid;
    v_user_id uuid;
    v_event RECORD;
    v_is_admin boolean := false;
    v_calling_volunteer_id uuid := NULL;
    v_clean_query text;
    v_limit integer;
    v_offset integer;
    v_total_count integer := 0;
    v_receipts jsonb := '[]'::jsonb;
    v_result jsonb;
BEGIN
    -- 1. Authentication
    v_calling_auth_uid := auth.uid();
    IF v_calling_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    -- 2. Resolve Calling User
    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_user_id = v_calling_auth_uid
      AND is_active = true
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Active user profile not found for authenticated caller';
    END IF;

    -- 3. Resolve and Validate Event (Server-side Organization Resolution)
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive';
    END IF;

    -- 4. Role Authorization & Scoping
    v_is_admin := public.is_organization_admin(v_event.organization_id);

    IF NOT v_is_admin THEN
        -- Caller must be an active volunteer in this organization
        SELECT id INTO v_calling_volunteer_id
        FROM public.volunteers
        WHERE user_id = v_user_id
          AND organization_id = v_event.organization_id
          AND status = 'active'
        LIMIT 1;

        IF v_calling_volunteer_id IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer of this organization';
        END IF;
    END IF;

    -- 5. Bounded Pagination & Query Normalization
    v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
    v_offset := GREATEST(COALESCE(p_offset, 0), 0);
    v_clean_query := NULLIF(TRIM(p_query), '');

    -- 6. Filtered Query Execution
    WITH filtered_receipts AS (
        SELECT
            r.id,
            r.receipt_number,
            COALESCE(rb.prefix, 'VP-') AS receipt_prefix,
            COALESCE(rb.book_number, '—') AS book_number,
            r.amount,
            r.payment_mode,
            r.payment_reference,
            r.donor_name,
            r.donor_mobile,
            r.property_id,
            p.property_type,
            p.unit_number,
            b.name AS building_name,
            b.wing AS building_wing,
            r.volunteer_id,
            v.name AS volunteer_name,
            r.collection_session_id,
            r.status,
            r.void_reason,
            r.voided_at,
            vu.name AS voided_by_name,
            r.notes,
            r.created_at
        FROM public.receipts r
        LEFT JOIN public.receipt_books rb ON rb.id = r.receipt_book_id
        LEFT JOIN public.volunteers v ON v.id = r.volunteer_id
        LEFT JOIN public.properties p ON p.id = r.property_id
        LEFT JOIN public.buildings b ON b.id = p.building_id
        LEFT JOIN public.users vu ON vu.id = r.voided_by
        WHERE r.event_id = p_event_id
          AND r.organization_id = v_event.organization_id
          -- Volunteer scope enforcement: volunteer can ONLY search own receipts
          AND (
              v_is_admin = true
              OR r.volunteer_id = v_calling_volunteer_id
          )
          -- Optional volunteer filter (Admin only)
          AND (
              p_volunteer_id IS NULL
              OR NOT v_is_admin
              OR r.volunteer_id = p_volunteer_id
          )
          -- Payment Mode filter
          AND (
              p_payment_mode IS NULL
              OR p_payment_mode = 'all'
              OR r.payment_mode = p_payment_mode
          )
          -- Status filter
          AND (
              p_status IS NULL
              OR p_status = 'all'
              OR (
                  p_status IN ('active', 'valid', 'issued')
                  AND r.status IN ('valid', 'issued')
                  AND r.voided_at IS NULL
                  AND r.cancelled_at IS NULL
              )
              OR (
                  p_status = 'voided'
                  AND (r.status = 'voided' OR r.voided_at IS NOT NULL)
              )
              OR (
                  p_status = 'cancelled'
                  AND (r.status = 'cancelled' OR r.cancelled_at IS NOT NULL)
              )
          )
          -- Multi-criteria text search
          AND (
              v_clean_query IS NULL
              OR r.donor_name ILIKE '%' || v_clean_query || '%'
              OR r.donor_mobile ILIKE '%' || v_clean_query || '%'
              OR r.receipt_number::text ILIKE '%' || v_clean_query || '%'
              OR (COALESCE(rb.prefix, 'VP-') || r.receipt_number::text) ILIKE '%' || v_clean_query || '%'
              OR p.unit_number ILIKE '%' || v_clean_query || '%'
              OR b.name ILIKE '%' || v_clean_query || '%'
          )
    )
    SELECT
        COUNT(*)::integer,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', fr.id,
                        'receipt_number', fr.receipt_number,
                        'receipt_prefix', fr.receipt_prefix,
                        'book_number', fr.book_number,
                        'amount', fr.amount,
                        'payment_mode', fr.payment_mode,
                        'payment_reference', fr.payment_reference,
                        'donor_name', fr.donor_name,
                        'donor_mobile', fr.donor_mobile,
                        'property_id', fr.property_id,
                        'property_type', fr.property_type,
                        'unit_number', fr.unit_number,
                        'building_name', fr.building_name,
                        'building_wing', fr.building_wing,
                        'volunteer_id', fr.volunteer_id,
                        'volunteer_name', fr.volunteer_name,
                        'collection_session_id', fr.collection_session_id,
                        'status', fr.status,
                        'void_reason', fr.void_reason,
                        'voided_at', fr.voided_at,
                        'voided_by_name', fr.voided_by_name,
                        'notes', fr.notes,
                        'created_at', fr.created_at
                    )
                    ORDER BY fr.receipt_number DESC
                )
                FROM (
                    SELECT *
                    FROM filtered_receipts
                    ORDER BY receipt_number DESC
                    LIMIT v_limit
                    OFFSET v_offset
                ) fr
            ),
            '[]'::jsonb
        )
    INTO v_total_count, v_receipts
    FROM filtered_receipts;

    v_result := jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'organization_id', v_event.organization_id,
        'is_admin', v_is_admin,
        'total_count', COALESCE(v_total_count, 0),
        'limit', v_limit,
        'offset', v_offset,
        'has_more', (v_offset + jsonb_array_length(COALESCE(v_receipts, '[]'::jsonb))) < COALESCE(v_total_count, 0),
        'receipts', COALESCE(v_receipts, '[]'::jsonb)
    );

    RETURN v_result;
END;
$$;

-- Privilege Lockdown
REVOKE ALL ON FUNCTION public.search_organization_receipts(uuid, text, text, text, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_organization_receipts(uuid, text, text, text, uuid, integer, integer) TO authenticated;
