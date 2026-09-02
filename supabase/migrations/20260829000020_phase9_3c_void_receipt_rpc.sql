-- ==============================================================================
-- Migration: 20260829000020_phase9_3c_void_receipt_rpc.sql
-- Phase 9-3C Step 2C: Void Receipt RPC Implementation
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.void_receipt(
    p_receipt_id uuid,
    p_void_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_auth_uid uuid;
    v_user_id uuid;
    v_clean_reason text;
    v_receipt RECORD;
    v_handover RECORD;
    v_result jsonb;
BEGIN
    -- 1. Authentication
    v_calling_auth_uid := auth.uid();
    IF v_calling_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Input Validation
    IF p_receipt_id IS NULL THEN
        RAISE EXCEPTION 'Receipt ID is required';
    END IF;

    v_clean_reason := TRIM(COALESCE(p_void_reason, ''));
    IF LENGTH(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid void reason of at least 3 characters is required';
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

    -- 4. Lock and Validate Receipt (Row-Level Concurrency Protection)
    SELECT * INTO v_receipt
    FROM public.receipts
    WHERE id = p_receipt_id
    FOR UPDATE;

    IF v_receipt.id IS NULL THEN
        RAISE EXCEPTION 'Receipt not found';
    END IF;

    -- 5. Authorization: Enforce Secretary/Admin of the receipt's organization
    IF NOT public.is_organization_admin(v_receipt.organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of this organization';
    END IF;

    -- 6. Validate Receipt Collectible State
    IF v_receipt.status = 'voided' OR v_receipt.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Receipt is already voided';
    END IF;

    IF v_receipt.status = 'cancelled' OR v_receipt.cancelled_at IS NOT NULL THEN
        RAISE EXCEPTION 'Receipt is already cancelled';
    END IF;

    IF v_receipt.status NOT IN ('issued', 'valid') THEN
        RAISE EXCEPTION 'Receipt is not in a collectible state';
    END IF;

    -- 7. Handover Safety Boundary Protection
    -- Check if the session's handover is submitted or verified
    IF v_receipt.collection_session_id IS NOT NULL THEN
        SELECT id, status INTO v_handover
        FROM public.collection_handovers
        WHERE collection_session_id = v_receipt.collection_session_id
          AND status IN ('submitted', 'verified')
        LIMIT 1;

        IF v_handover.id IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot void receipt: The associated collection session handover is % (finalized/in review). Voiding is only permitted for pre-handover receipts.', v_handover.status;
        END IF;
    END IF;

    -- 8. Atomic Mutation & Audit Trail
    UPDATE public.receipts
    SET
        status = 'voided',
        void_reason = v_clean_reason,
        voided_at = NOW(),
        voided_by = v_user_id,
        cancellation_reason = v_clean_reason,
        cancelled_at = NOW(),
        cancelled_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_receipt_id;

    -- 9. Return Result
    v_result := jsonb_build_object(
        'success', true,
        'receipt_id', v_receipt.id,
        'receipt_number', v_receipt.receipt_number,
        'amount', v_receipt.amount,
        'payment_mode', v_receipt.payment_mode,
        'status', 'voided',
        'void_reason', v_clean_reason,
        'voided_at', NOW(),
        'voided_by', v_user_id
    );

    RETURN v_result;
END;
$$;

-- Privileges
REVOKE ALL ON FUNCTION public.void_receipt(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_receipt(uuid, text) TO authenticated;
