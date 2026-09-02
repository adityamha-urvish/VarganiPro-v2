-- ==============================================================================
-- Migration: 20260829000017_phase9_3c_fix_receipt_eligibility.sql
-- Phase 9-3C: Align Canonical Receipt Eligibility Predicate in Step 2A & 2B RPCs
-- ==============================================================================

-- 1. Update public.get_secretary_overview_metrics
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
    -- Canonical Valid receipts for this event (supports both 'issued' and 'valid', excludes 'voided' and 'cancelled')
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
          AND status IN ('valid', 'issued')
          AND voided_at IS NULL
          AND cancelled_at IS NULL
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
                COALESCE(vcc.total_cash, 0) + COALESCE(vcc.total_cheque, 0) - 
                COALESCE(vh.handed_cash, 0) - COALESCE(vh.handed_cheque, 0) - 
                COALESCE(vh.verified_expenses, 0)
            ) AS outstanding_physical_held
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
            COALESCE(SUM(actual_cash_amount + actual_cheque_amount) FILTER (WHERE status = 'verified'), 0)::numeric(12,2) AS treasury_physical_received,
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
            'treasury_cash_received', (SELECT treasury_physical_received FROM handover_metrics),
            'total_authorized_expenses', (SELECT total_authorized_expenses FROM handover_metrics),
            'total_physical_cash_held', COALESCE((SELECT SUM(outstanding_physical_held)::numeric(12,2) FROM volunteer_balances), 0.00),
            'volunteers_holding_cash_count', COALESCE((SELECT COUNT(*)::integer FROM volunteer_balances WHERE outstanding_physical_held > 0), 0)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 2. Update public.get_volunteer_financial_ledger
CREATE OR REPLACE FUNCTION public.get_volunteer_financial_ledger(
    p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event RECORD;
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

    -- 4. Aggregate Volunteer Financial Ledger
    WITH
    -- Canonical Valid receipts for this event (supports both 'issued' and 'valid', excludes 'voided' and 'cancelled')
    vol_receipts AS (
        SELECT
            volunteer_id,
            COUNT(*)::integer AS receipt_count,
            COALESCE(SUM(amount), 0)::numeric(12,2) AS total_collected,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cash'), 0)::numeric(12,2) AS cash_collected,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cheque'), 0)::numeric(12,2) AS cheque_collected,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'upi'), 0)::numeric(12,2) AS upi_collected,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'bank_transfer'), 0)::numeric(12,2) AS bank_transfer_collected,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode IN ('cash', 'cheque')), 0)::numeric(12,2) AS physical_collected,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode IN ('upi', 'bank_transfer')), 0)::numeric(12,2) AS digital_settled
        FROM public.receipts
        WHERE event_id = p_event_id
          AND status IN ('valid', 'issued')
          AND voided_at IS NULL
          AND cancelled_at IS NULL
        GROUP BY volunteer_id
    ),
    -- Handover statistics aggregated by volunteer for this event
    vol_handovers AS (
        SELECT
            volunteer_id,
            COALESCE(SUM(actual_cash_amount + actual_cheque_amount) FILTER (WHERE status = 'verified'), 0)::numeric(12,2) AS verified_handed_over,
            COALESCE(SUM(authorized_expense_amount) FILTER (WHERE status = 'verified'), 0)::numeric(12,2) AS verified_expenses,
            COUNT(*) FILTER (WHERE status = 'submitted')::integer AS pending_handover_count,
            COALESCE(SUM(expected_physical_amount) FILTER (WHERE status = 'submitted'), 0)::numeric(12,2) AS pending_handover_amount
        FROM public.collection_handovers
        WHERE event_id = p_event_id
        GROUP BY volunteer_id
    ),
    -- Latest handover status per volunteer
    latest_handovers AS (
        SELECT DISTINCT ON (volunteer_id)
            volunteer_id,
            status AS latest_status,
            created_at AS latest_created_at
        FROM public.collection_handovers
        WHERE event_id = p_event_id
        ORDER BY volunteer_id, created_at DESC
    ),
    -- Per-volunteer computed rows
    volunteer_rows AS (
        SELECT
            v.id AS volunteer_id,
            v.name,
            v.mobile,
            v.status,
            COALESCE(vr.receipt_count, 0)::integer AS receipt_count,
            COALESCE(vr.total_collected, 0.00)::numeric(12,2) AS total_collected,
            COALESCE(vr.cash_collected, 0.00)::numeric(12,2) AS cash_collected,
            COALESCE(vr.cheque_collected, 0.00)::numeric(12,2) AS cheque_collected,
            COALESCE(vr.upi_collected, 0.00)::numeric(12,2) AS upi_collected,
            COALESCE(vr.bank_transfer_collected, 0.00)::numeric(12,2) AS bank_transfer_collected,
            COALESCE(vr.physical_collected, 0.00)::numeric(12,2) AS physical_collected,
            COALESCE(vr.digital_settled, 0.00)::numeric(12,2) AS digital_settled,
            COALESCE(vh.verified_handed_over, 0.00)::numeric(12,2) AS verified_handed_over,
            COALESCE(vh.verified_expenses, 0.00)::numeric(12,2) AS verified_expenses,
            GREATEST(0,
                COALESCE(vr.physical_collected, 0.00) - 
                COALESCE(vh.verified_handed_over, 0.00) - 
                COALESCE(vh.verified_expenses, 0.00)
            )::numeric(12,2) AS outstanding_physical_held,
            COALESCE(vh.pending_handover_count, 0)::integer AS pending_handover_count,
            COALESCE(vh.pending_handover_amount, 0.00)::numeric(12,2) AS pending_handover_amount,
            COALESCE(lh.latest_handover_status, 'none') AS latest_handover_status
        FROM public.volunteers v
        LEFT JOIN vol_receipts vr ON vr.volunteer_id = v.id
        LEFT JOIN vol_handovers vh ON vh.volunteer_id = v.id
        LEFT JOIN (
            SELECT volunteer_id, latest_status AS latest_handover_status FROM latest_handovers
        ) lh ON lh.volunteer_id = v.id
        WHERE v.organization_id = v_event.organization_id
    )
    SELECT jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'organization_id', v_event.organization_id,
        'summary', jsonb_build_object(
            'total_volunteers', (SELECT COUNT(*)::integer FROM volunteer_rows),
            'active_volunteers', (SELECT COUNT(*) FILTER (WHERE status = 'active')::integer FROM volunteer_rows),
            'total_receipt_count', COALESCE((SELECT SUM(receipt_count)::integer FROM volunteer_rows), 0),
            'grand_total_collected', COALESCE((SELECT SUM(total_collected)::numeric(12,2) FROM volunteer_rows), 0.00),
            'total_physical_collected', COALESCE((SELECT SUM(physical_collected)::numeric(12,2) FROM volunteer_rows), 0.00),
            'total_digital_settled', COALESCE((SELECT SUM(digital_settled)::numeric(12,2) FROM volunteer_rows), 0.00),
            'total_verified_handed_over', COALESCE((SELECT SUM(verified_handed_over)::numeric(12,2) FROM volunteer_rows), 0.00),
            'total_verified_expenses', COALESCE((SELECT SUM(verified_expenses)::numeric(12,2) FROM volunteer_rows), 0.00),
            'total_outstanding_physical_held', COALESCE((SELECT SUM(outstanding_physical_held)::numeric(12,2) FROM volunteer_rows), 0.00),
            'volunteers_holding_cash_count', COALESCE((SELECT COUNT(*) FILTER (WHERE outstanding_physical_held > 0)::integer FROM volunteer_rows), 0)
        ),
        'volunteers', COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'volunteer_id', r.volunteer_id,
                    'name', r.name,
                    'mobile', r.mobile,
                    'status', r.status,
                    'receipt_count', r.receipt_count,
                    'total_collected', r.total_collected,
                    'cash_collected', r.cash_collected,
                    'cheque_collected', r.cheque_collected,
                    'upi_collected', r.upi_collected,
                    'bank_transfer_collected', r.bank_transfer_collected,
                    'physical_collected', r.physical_collected,
                    'digital_settled', r.digital_settled,
                    'verified_handed_over', r.verified_handed_over,
                    'verified_expenses', r.verified_expenses,
                    'outstanding_physical_held', r.outstanding_physical_held,
                    'pending_handover_count', r.pending_handover_count,
                    'pending_handover_amount', r.pending_handover_amount,
                    'latest_handover_status', r.latest_handover_status
                ) ORDER BY r.name ASC
            ) FROM volunteer_rows r),
            '[]'::jsonb
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Privileges
REVOKE ALL ON FUNCTION public.get_secretary_overview_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_secretary_overview_metrics(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_volunteer_financial_ledger(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_volunteer_financial_ledger(uuid) TO authenticated;

-- Test-only helper for non-zero void verification prior to Step 2C
CREATE OR REPLACE FUNCTION public.test_mark_receipt_voided(
    p_receipt_id uuid,
    p_void_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.receipts
    SET
        status = 'voided',
        void_reason = COALESCE(p_void_reason, 'Voided in test'),
        voided_at = NOW()
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object('success', true, 'receipt_id', p_receipt_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_mark_receipt_voided(uuid, text) TO authenticated;
