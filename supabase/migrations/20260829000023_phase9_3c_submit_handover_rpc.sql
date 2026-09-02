-- ==============================================================================
-- Migration: 20260829000023_phase9_3c_submit_handover_rpc.sql
-- Phase 9-3C Step 2D: Updated submit_collection_handover RPC
-- ==============================================================================

-- Drop any previous overload to ensure exactly ONE public signature
DROP FUNCTION IF EXISTS public.submit_collection_handover(uuid, numeric, numeric, numeric, numeric, text);
DROP FUNCTION IF EXISTS public.submit_collection_handover(uuid, numeric, numeric, numeric, numeric, text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.submit_collection_handover(
    p_handover_id uuid,
    p_actual_cash_amount numeric DEFAULT 0,
    p_actual_upi_amount numeric DEFAULT 0,
    p_actual_cheque_amount numeric DEFAULT 0,
    p_actual_bank_transfer_amount numeric DEFAULT 0,
    p_notes text DEFAULT NULL,
    p_authorized_expense_amount numeric DEFAULT 0,
    p_authorized_expense_note text DEFAULT NULL,
    p_discrepancy_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_auth_uid uuid;
    v_user_id uuid;
    v_calling_volunteer RECORD;
    v_is_admin boolean := false;
    v_handover RECORD;
    v_session RECORD;
    v_expected RECORD;
    v_expected_physical numeric(12,2);
    v_expected_digital numeric(12,2);
    v_actual_physical numeric(12,2);
    v_actual_digital numeric(12,2);
    v_accounted_physical numeric(12,2);
    v_difference numeric(12,2);
    v_discrepancy_type text;
    v_result jsonb;
BEGIN
    -- 1. Authentication
    v_calling_auth_uid := auth.uid();
    IF v_calling_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Input Validation
    IF p_handover_id IS NULL THEN
        RAISE EXCEPTION 'Handover ID is required';
    END IF;

    IF p_actual_cash_amount < 0 OR p_actual_cheque_amount < 0 OR p_actual_upi_amount < 0 OR p_actual_bank_transfer_amount < 0 THEN
        RAISE EXCEPTION 'Actual handover amounts cannot be negative.';
    END IF;

    IF p_authorized_expense_amount < 0 THEN
        RAISE EXCEPTION 'Authorized expense amount cannot be negative.';
    END IF;

    IF p_authorized_expense_amount > 0 AND (p_authorized_expense_note IS NULL OR LENGTH(TRIM(p_authorized_expense_note)) < 3) THEN
        RAISE EXCEPTION 'A note of at least 3 characters is required when recording an authorized expense.';
    END IF;

    -- 3. Resolve Calling User
    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_user_id = v_calling_auth_uid
      AND is_active = true
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Active user profile not found for authenticated caller';
    END IF;

    -- 4. Lock and Retrieve Collection Handover
    SELECT * INTO v_handover
    FROM public.collection_handovers
    WHERE id = p_handover_id
    FOR UPDATE;

    IF v_handover.id IS NULL THEN
        RAISE EXCEPTION 'Collection handover not found.';
    END IF;

    -- 5. Lock and Retrieve Associated Collection Session
    SELECT * INTO v_session
    FROM public.collection_sessions
    WHERE id = v_handover.collection_session_id
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Associated collection session not found.';
    END IF;

    -- 6. Authorization Verification
    -- Check if caller is Administrator of the organization
    v_is_admin := public.is_organization_admin(v_handover.organization_id);

    -- Check if caller is the volunteer owning the collection session
    SELECT * INTO v_calling_volunteer
    FROM public.volunteers
    WHERE user_id = v_user_id
      AND organization_id = v_handover.organization_id
      AND status = 'active'
    LIMIT 1;

    IF NOT v_is_admin THEN
        IF v_calling_volunteer.id IS NULL OR v_calling_volunteer.id <> v_session.volunteer_id THEN
            RAISE EXCEPTION 'Unauthorized: You can only submit handovers for your own collection sessions.';
        END IF;
    END IF;

    -- 7. Handover State Machine & Immutability Protection
    IF v_handover.status = 'verified' THEN
        RAISE EXCEPTION 'Cannot modify or resubmit an already verified handover.';
    END IF;

    IF v_handover.status = 'submitted' THEN
        RAISE EXCEPTION 'This handover has already been submitted and is awaiting verification.';
    END IF;

    IF v_handover.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot submit a cancelled handover.';
    END IF;

    -- 8. Authoritative Server-Side Expected Amounts Calculation
    -- Derived strictly from canonical collectible receipts in this collection session
    SELECT
        COUNT(*)::integer AS receipt_count,
        COALESCE(SUM(amount), 0)::numeric(12,2) AS total_amount,
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cash'), 0)::numeric(12,2) AS cash_amount,
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cheque'), 0)::numeric(12,2) AS cheque_amount,
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'upi'), 0)::numeric(12,2) AS upi_amount,
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'bank_transfer'), 0)::numeric(12,2) AS bank_transfer_amount
    INTO v_expected
    FROM public.receipts
    WHERE collection_session_id = v_session.id
      AND status IN ('valid', 'issued')
      AND voided_at IS NULL
      AND cancelled_at IS NULL;

    v_expected_physical := v_expected.cash_amount + v_expected.cheque_amount;
    v_expected_digital := v_expected.upi_amount + v_expected.bank_transfer_amount;

    -- Expense Upper Bound Validation
    IF p_authorized_expense_amount > v_expected_physical THEN
        RAISE EXCEPTION 'Authorized expense (₹%) cannot exceed the physical collection amount of this session (₹%).',
            p_authorized_expense_amount, v_expected_physical;
    END IF;

    -- 9. Physical Custody Reconciliation & Discrepancy Analysis
    v_actual_physical := p_actual_cash_amount + p_actual_cheque_amount;
    v_actual_digital := p_actual_upi_amount + p_actual_bank_transfer_amount;
    v_accounted_physical := v_actual_physical + p_authorized_expense_amount;
    v_difference := v_accounted_physical - v_expected_physical;

    IF v_difference = 0 THEN
        v_discrepancy_type := 'exact_match';
    ELSIF v_difference < 0 THEN
        v_discrepancy_type := 'shortage';
    ELSE
        v_discrepancy_type := 'excess';
    END IF;

    -- 10. Atomic Handover Record Mutation
    UPDATE public.collection_handovers
    SET
        expected_receipt_count = v_expected.receipt_count,
        expected_total_amount = v_expected.total_amount,
        expected_cash_amount = v_expected.cash_amount,
        expected_cheque_amount = v_expected.cheque_amount,
        expected_upi_amount = v_expected.upi_amount,
        expected_bank_transfer_amount = v_expected.bank_transfer_amount,
        actual_cash_amount = p_actual_cash_amount,
        actual_cheque_amount = p_actual_cheque_amount,
        actual_upi_amount = p_actual_upi_amount,
        actual_bank_transfer_amount = p_actual_bank_transfer_amount,
        authorized_expense_amount = p_authorized_expense_amount,
        authorized_expense_note = NULLIF(TRIM(p_authorized_expense_note), ''),
        discrepancy_reason = COALESCE(NULLIF(TRIM(p_discrepancy_reason), ''), v_discrepancy_type),
        notes = NULLIF(TRIM(p_notes), ''),
        status = 'submitted',
        submitted_at = NOW(),
        submitted_by = v_user_id,
        rejection_reason = NULL,
        updated_at = NOW()
    WHERE id = p_handover_id;

    -- 11. Return Response
    v_result := jsonb_build_object(
        'success', true,
        'handover_id', v_handover.id,
        'collection_session_id', v_session.id,
        'status', 'submitted',
        'expected_total', v_expected.total_amount,
        'expected_physical', v_expected_physical,
        'expected_digital', v_expected_digital,
        'actual_physical', v_actual_physical,
        'actual_digital', v_actual_digital,
        'authorized_expense', p_authorized_expense_amount,
        'difference', v_difference,
        'discrepancy_type', v_discrepancy_type
    );

    RETURN v_result;
END;
$$;

-- Explicit privilege lockdown
REVOKE ALL ON FUNCTION public.submit_collection_handover(uuid, numeric, numeric, numeric, numeric, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_collection_handover(uuid, numeric, numeric, numeric, numeric, text, numeric, text, text) TO authenticated;
