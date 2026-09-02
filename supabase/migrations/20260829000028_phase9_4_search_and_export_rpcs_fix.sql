-- ==============================================================================
-- Migration: 20260829000028_phase9_4_search_and_export_rpcs_fix.sql
-- Phase 9-4 Step 4A: Global Receipt Search & Campaign Export RPCs (Corrected Column Join)
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
    v_calling_volunteer RECORD;
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
        SELECT * INTO v_calling_volunteer
        FROM public.volunteers
        WHERE user_id = v_user_id
          AND organization_id = v_event.organization_id
          AND status = 'active'
        LIMIT 1;

        IF v_calling_volunteer.id IS NULL THEN
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
              OR r.volunteer_id = v_calling_volunteer.id
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


-- ------------------------------------------------------------------------------
-- 2. RPC: get_campaign_export_data (Secretary/Admin Only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_campaign_export_data(
    p_event_id uuid,
    p_export_type text DEFAULT 'donations',
    p_limit integer DEFAULT 200,
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
    v_limit integer;
    v_offset integer;
    v_total_count integer := 0;
    v_data jsonb := '[]'::jsonb;
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

    -- 3. Resolve and Validate Event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive';
    END IF;

    -- 4. Authorization: Strictly Secretary / Admin Only
    IF NOT public.is_organization_admin(v_event.organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Campaign export is restricted to administrators only';
    END IF;

    -- 5. Bounded Pagination
    v_limit := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
    v_offset := GREATEST(COALESCE(p_offset, 0), 0);

    -- 6. Generate Export Data by Type
    IF p_export_type = 'donations' THEN
        -- Full Donations Ledger (includes voided receipts with explicit void metadata)
        WITH donations_cte AS (
            SELECT
                r.id,
                r.receipt_number,
                COALESCE(rb.prefix, 'VP-') AS receipt_prefix,
                COALESCE(rb.book_number, '—') AS book_number,
                r.amount,
                r.payment_mode,
                COALESCE(r.payment_reference, '') AS payment_reference,
                r.donor_name,
                COALESCE(r.donor_mobile, '') AS donor_mobile,
                COALESCE(p.property_type, '') AS property_type,
                COALESCE(p.unit_number, '') AS unit_number,
                COALESCE(b.name, '') AS building_name,
                COALESCE(b.wing, '') AS building_wing,
                COALESCE(v.name, '—') AS volunteer_name,
                CASE
                    WHEN r.status = 'voided' OR r.voided_at IS NOT NULL THEN 'VOIDED'
                    WHEN r.status = 'cancelled' OR r.cancelled_at IS NOT NULL THEN 'CANCELLED'
                    ELSE 'VALID'
                END AS export_status,
                COALESCE(r.void_reason, '') AS void_reason,
                r.voided_at,
                COALESCE(vu.name, '') AS voided_by_name,
                COALESCE(r.notes, '') AS notes,
                r.created_at
            FROM public.receipts r
            LEFT JOIN public.receipt_books rb ON rb.id = r.receipt_book_id
            LEFT JOIN public.volunteers v ON v.id = r.volunteer_id
            LEFT JOIN public.properties p ON p.id = r.property_id
            LEFT JOIN public.buildings b ON b.id = p.building_id
            LEFT JOIN public.users vu ON vu.id = r.voided_by
            WHERE r.event_id = p_event_id
              AND r.organization_id = v_event.organization_id
        )
        SELECT
            COUNT(*)::integer,
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'receipt_number', d.receipt_number,
                            'receipt_code', d.receipt_prefix || d.receipt_number::text,
                            'book_number', d.book_number,
                            'amount', d.amount,
                            'payment_mode', d.payment_mode,
                            'payment_reference', d.payment_reference,
                            'donor_name', d.donor_name,
                            'donor_mobile', d.donor_mobile,
                            'property_type', d.property_type,
                            'unit_number', d.unit_number,
                            'building_name', d.building_name,
                            'building_wing', d.building_wing,
                            'volunteer_name', d.volunteer_name,
                            'status', d.export_status,
                            'void_reason', d.void_reason,
                            'voided_at', d.voided_at,
                            'voided_by_name', d.voided_by_name,
                            'notes', d.notes,
                            'created_at', d.created_at
                        )
                        ORDER BY d.receipt_number ASC
                    )
                    FROM (
                        SELECT *
                        FROM donations_cte
                        ORDER BY receipt_number ASC
                        LIMIT v_limit
                        OFFSET v_offset
                    ) d
                ),
                '[]'::jsonb
            )
        INTO v_total_count, v_data
        FROM donations_cte;

    ELSIF p_export_type = 'daily_summary' THEN
        -- Daily Cash & Handover Treasury Summary
        WITH daily_cte AS (
            SELECT
                DATE(r.created_at AT TIME ZONE 'Asia/Kolkata') AS collection_date,
                COUNT(*) FILTER (WHERE r.status IN ('valid', 'issued') AND r.voided_at IS NULL AND r.cancelled_at IS NULL)::integer AS receipt_count,
                COALESCE(SUM(r.amount) FILTER (WHERE r.status IN ('valid', 'issued') AND r.voided_at IS NULL AND r.cancelled_at IS NULL), 0)::numeric(12,2) AS total_collected,
                COALESCE(SUM(r.amount) FILTER (WHERE r.status IN ('valid', 'issued') AND r.voided_at IS NULL AND r.cancelled_at IS NULL AND r.payment_mode = 'cash'), 0)::numeric(12,2) AS cash_collected,
                COALESCE(SUM(r.amount) FILTER (WHERE r.status IN ('valid', 'issued') AND r.voided_at IS NULL AND r.cancelled_at IS NULL AND r.payment_mode = 'cheque'), 0)::numeric(12,2) AS cheque_collected,
                COALESCE(SUM(r.amount) FILTER (WHERE r.status IN ('valid', 'issued') AND r.voided_at IS NULL AND r.cancelled_at IS NULL AND r.payment_mode = 'upi'), 0)::numeric(12,2) AS upi_collected,
                COALESCE(SUM(r.amount) FILTER (WHERE r.status IN ('valid', 'issued') AND r.voided_at IS NULL AND r.cancelled_at IS NULL AND r.payment_mode = 'bank_transfer'), 0)::numeric(12,2) AS bank_transfer_collected,
                COUNT(*) FILTER (WHERE r.status = 'voided' OR r.voided_at IS NOT NULL)::integer AS voided_receipt_count,
                COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'voided' OR r.voided_at IS NOT NULL), 0)::numeric(12,2) AS voided_amount
            FROM public.receipts r
            WHERE r.event_id = p_event_id
              AND r.organization_id = v_event.organization_id
            GROUP BY DATE(r.created_at AT TIME ZONE 'Asia/Kolkata')
        )
        SELECT
            COUNT(*)::integer,
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'collection_date', dy.collection_date::text,
                            'receipt_count', dy.receipt_count,
                            'total_collected', dy.total_collected,
                            'cash_collected', dy.cash_collected,
                            'cheque_collected', dy.cheque_collected,
                            'upi_collected', dy.upi_collected,
                            'bank_transfer_collected', dy.bank_transfer_collected,
                            'voided_receipt_count', dy.voided_receipt_count,
                            'voided_amount', dy.voided_amount
                        )
                        ORDER BY dy.collection_date DESC
                    )
                    FROM (
                        SELECT *
                        FROM daily_cte
                        ORDER BY collection_date DESC
                        LIMIT v_limit
                        OFFSET v_offset
                    ) dy
                ),
                '[]'::jsonb
            )
        INTO v_total_count, v_data
        FROM daily_cte;

    ELSIF p_export_type = 'penetration' THEN
        -- Property & Building Penetration Summary
        WITH penetration_cte AS (
            SELECT
                b.id AS building_id,
                b.name AS building_name,
                COALESCE(b.wing, '') AS wing,
                COALESCE(b.area_name, '') AS area_name,
                COUNT(p.id)::integer AS total_units,
                COUNT(p.id) FILTER (WHERE pfu.status = 'collected' OR pr.property_id IS NOT NULL)::integer AS collected_units,
                COUNT(p.id) FILTER (WHERE pfu.status = 'pending' AND (pfu.reason IS NULL OR pfu.reason <> 'refused') AND pr.property_id IS NULL)::integer AS pending_units,
                COUNT(p.id) FILTER (WHERE pfu.status = 'refused' OR pfu.reason = 'refused')::integer AS refused_units,
                COUNT(p.id) FILTER (WHERE pfu.id IS NULL AND pr.property_id IS NULL)::integer AS not_visited_units,
                COALESCE(SUM(pr.total_amount), 0)::numeric(12,2) AS total_amount_collected
            FROM public.buildings b
            LEFT JOIN public.properties p ON p.building_id = b.id
            LEFT JOIN (
                SELECT
                    property_id,
                    SUM(amount) AS total_amount
                FROM public.receipts
                WHERE event_id = p_event_id
                  AND status IN ('valid', 'issued')
                  AND voided_at IS NULL
                  AND cancelled_at IS NULL
                  AND property_id IS NOT NULL
                GROUP BY property_id
            ) pr ON pr.property_id = p.id
            LEFT JOIN (
                SELECT DISTINCT ON (property_id)
                    id,
                    property_id,
                    status,
                    reason
                FROM public.collection_follow_ups
                WHERE event_id = p_event_id
                ORDER BY property_id, created_at DESC
            ) pfu ON pfu.property_id = p.id
            WHERE b.organization_id = v_event.organization_id
            GROUP BY b.id, b.name, b.wing, b.area_name
        )
        SELECT
            COUNT(*)::integer,
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'building_name', pn.building_name,
                            'wing', pn.wing,
                            'area_name', pn.area_name,
                            'total_units', pn.total_units,
                            'collected_units', pn.collected_units,
                            'pending_units', pn.pending_units,
                            'refused_units', pn.refused_units,
                            'not_visited_units', pn.not_visited_units,
                            'total_amount_collected', pn.total_amount_collected
                        )
                        ORDER BY pn.building_name ASC, pn.wing ASC
                    )
                    FROM (
                        SELECT *
                        FROM penetration_cte
                        ORDER BY building_name ASC, wing ASC
                        LIMIT v_limit
                        OFFSET v_offset
                    ) pn
                ),
                '[]'::jsonb
            )
        INTO v_total_count, v_data
        FROM penetration_cte;

    ELSE
        RAISE EXCEPTION 'Invalid export type: %. Must be donations, daily_summary, or penetration.', p_export_type;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'organization_id', v_event.organization_id,
        'export_type', p_export_type,
        'total_count', COALESCE(v_total_count, 0),
        'limit', v_limit,
        'offset', v_offset,
        'has_more', (v_offset + jsonb_array_length(COALESCE(v_data, '[]'::jsonb))) < COALESCE(v_total_count, 0),
        'data', COALESCE(v_data, '[]'::jsonb)
    );

    RETURN v_result;
END;
$$;

-- Privilege Lockdown
REVOKE ALL ON FUNCTION public.get_campaign_export_data(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_export_data(uuid, text, integer, integer) TO authenticated;
