-- ==============================================================================
-- Migration: 20260829000016_phase9_3c_volunteer_financial_ledger_rpc.sql
-- Phase 9-3C Step 2B: Volunteer Financial Ledger RPC
-- ==============================================================================

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
    -- Valid receipts aggregated by volunteer for this event
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
          AND status = 'valid'
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
            COALESCE(lh.latest_status, 'none') AS latest_handover_status
        FROM public.volunteers v
        LEFT JOIN vol_receipts vr ON vr.volunteer_id = v.id
        LEFT JOIN vol_handovers vh ON vh.volunteer_id = v.id
        LEFT JOIN latest_handovers lh ON lh.volunteer_id = v.id
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

-- Explicit privilege lockdown
REVOKE ALL ON FUNCTION public.get_volunteer_financial_ledger(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_volunteer_financial_ledger(uuid) TO authenticated;
