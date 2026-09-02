-- ==============================================================================
-- Migration: 20260829000019_phase9_3c_update_test_void_helper.sql
-- ==============================================================================

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
        cancellation_reason = COALESCE(p_void_reason, 'Voided in test'),
        cancelled_at = NOW(),
        voided_at = NOW()
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object('success', true, 'receipt_id', p_receipt_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_mark_receipt_voided(uuid, text) TO authenticated;
