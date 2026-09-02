-- ==============================================================================
-- Migration: 20260829000015_phase9_3c_secretary_overview_rpc.sql
-- Phase 9-3C Step 2A: Secretary Overview Metrics RPC
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_secretary_overview_metrics(
    p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event RECORD;
    v_today_start timestamptz;
    v_today_end timestamptz;
    v_result jsonb;
BEGIN
    -- 1. Authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    -- 2. Validate Event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive';
    END IF;

    -- 3. Authorize Secretary / Admin for this organization
    IF NOT public.is_organization_admin(v_event.organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of this organization';
    END IF;

    -- 4. Time boundaries for today's collection (Local midnight to midnight)
    v_today_start := date_trunc('day', NOW());
    v_today_end := v_today_start + interval '1 day';

    -- 5. Aggregate metrics via CTEs
    WITH
    -- Valid receipts for this event
    event_valid_receipts AS (
        SELECT
            id,
            amount,
            payment_mode,
            volunteer_id,
            property_id,
            created_at
        FROM public.receipts
        WHERE event_id = p_event_id
          AND status = 'valid'
    ),
    -- Today's collection slice
    today_receipts AS (
        SELECT *
        FROM event_valid_receipts
        WHERE created_at >= v_today_start
          AND created_at < v_today_end
    ),
    -- Door-to-Door Residential Property Progress (Duplicate-Safe)
    property_receipts AS (
        SELECT
            r.property_id,
            COUNT(r.id) AS receipt_count
        FROM event_valid_receipts r
        WHERE r.property_id IS NOT NULL
        GROUP BY r.property_id
    ),
    property_follow_ups AS (
        SELECT
            f.property_id,
            f.status,
            f.reason
        FROM public.collection_follow_ups f
        WHERE f.event_id = p_event_id
    ),
    distinct_residential_properties AS (
        SELECT
            p.id AS property_id,
            CASE
                WHEN pr.property_id IS NOT NULL THEN 'collected'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' AND pfu.reason = 'refused' THEN 'refused'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' THEN 'pending'
                ELSE 'not_visited'
            END AS status
        FROM public.properties p
        LEFT JOIN property_receipts pr ON pr.property_id = p.id
        LEFT JOIN property_follow_ups pfu ON pfu.property_id = p.id
        WHERE p.organization_id = v_event.organization_id
          AND p.building_id IS NOT NULL
          AND p.is_active = true
    ),
    property_progress_summary AS (
        SELECT
            COUNT(*)::integer AS total_residential_units,
            COUNT(*) FILTER (WHERE status = 'collected')::integer AS collected_count,
            COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending_count,
            COUNT(*) FILTER (WHERE status = 'refused')::integer AS refused_count,
            COUNT(*) FILTER (WHERE status = 'not_visited')::integer AS not_visited_count
        FROM distinct_residential_properties
    ),
    -- Volunteer Cash Custody Balances
    vol_cash_collected AS (
        SELECT
            volunteer_id,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cash'), 0) AS total_cash,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cheque'), 0) AS total_cheque
        FROM event_valid_receipts
        GROUP BY volunteer_id
    ),
    vol_cash_verified_handovers AS (
        SELECT
            volunteer_id,
            COALESCE(SUM(actual_cash_amount), 0) AS handed_cash,
            COALESCE(SUM(actual_cheque_amount), 0) AS handed_cheque,
            COALESCE(SUM(authorized_expense_amount), 0) AS verified_expenses
        FROM public.collection_handovers
        WHERE event_id = p_event_id
          AND status = 'verified'
        GROUP BY volunteer_id
    ),
    volunteer_balances AS (
        SELECT
            v.id AS volunteer_id,
            GREATEST(0,
                COALESCE(vcc.total_cash, 0) - COALESCE(vh.handed_cash, 0) - COALESCE(vh.verified_expenses, 0)
            ) AS outstanding_cash_held
        FROM public.volunteers v
        LEFT JOIN vol_cash_collected vcc ON vcc.volunteer_id = v.id
        LEFT JOIN vol_cash_verified_handovers vh ON vh.volunteer_id = v.id
        WHERE v.organization_id = v_event.organization_id
    ),
    -- Treasury & Handover stats
    handover_metrics AS (
        SELECT
            COUNT(*) FILTER (WHERE status = 'submitted')::integer AS pending_handover_count,
            COALESCE(SUM(expected_physical_amount) FILTER (WHERE status = 'submitted'), 0)::numeric(12,2) AS pending_handover_amount,
            COALESCE(SUM(actual_cash_amount) FILTER (WHERE status = 'verified'), 0)::numeric(12,2) AS treasury_cash_received,
            COALESCE(SUM(authorized_expense_amount) FILTER (WHERE status = 'verified'), 0)::numeric(12,2) AS total_authorized_expenses
        FROM public.collection_handovers
        WHERE event_id = p_event_id
    )
    SELECT jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'organization_id', v_event.organization_id,
        'today', jsonb_build_object(
            'receipt_count', (SELECT COUNT(*)::integer FROM today_receipts),
            'total_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts), 0.00),
            'cash_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts WHERE payment_mode = 'cash'), 0.00),
            'upi_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts WHERE payment_mode = 'upi'), 0.00),
            'cheque_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts WHERE payment_mode = 'cheque'), 0.00),
            'bank_transfer_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts WHERE payment_mode = 'bank_transfer'), 0.00)
        ),
        'festival_total', jsonb_build_object(
            'receipt_count', (SELECT COUNT(*)::integer FROM event_valid_receipts),
            'total_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts), 0.00),
            'cash_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts WHERE payment_mode = 'cash'), 0.00),
            'upi_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts WHERE payment_mode = 'upi'), 0.00),
            'cheque_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts WHERE payment_mode = 'cheque'), 0.00),
            'bank_transfer_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts WHERE payment_mode = 'bank_transfer'), 0.00)
        ),
        'property_progress', (
            SELECT jsonb_build_object(
                'total_residential_units', total_residential_units,
                'collected_count', collected_count,
                'pending_count', pending_count,
                'refused_count', refused_count,
                'not_visited_count', not_visited_count,
                'completion_percentage', CASE 
                    WHEN total_residential_units > 0 THEN 
                        ROUND(((collected_count::numeric / total_residential_units::numeric) * 100), 2)
                    ELSE 0.00 
                END
            ) FROM property_progress_summary
        ),
        'treasury', jsonb_build_object(
            'pending_handover_count', (SELECT pending_handover_count FROM handover_metrics),
            'pending_handover_amount', (SELECT pending_handover_amount FROM handover_metrics),
            'treasury_cash_received', (SELECT treasury_cash_received FROM handover_metrics),
            'total_authorized_expenses', (SELECT total_authorized_expenses FROM handover_metrics),
            'total_physical_cash_held', COALESCE((SELECT SUM(outstanding_cash_held)::numeric(12,2) FROM volunteer_balances), 0.00),
            'volunteers_holding_cash_count', COALESCE((SELECT COUNT(*)::integer FROM volunteer_balances WHERE outstanding_cash_held > 0), 0)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Explicit privilege lockdown
REVOKE ALL ON FUNCTION public.get_secretary_overview_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_secretary_overview_metrics(uuid) TO authenticated;
