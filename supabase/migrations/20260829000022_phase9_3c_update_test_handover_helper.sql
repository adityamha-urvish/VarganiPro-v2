-- ==============================================================================
-- Migration: 20260829000022_phase9_3c_update_test_handover_helper.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_complete_session_and_create_handover(
    p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_handover_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Complete session
    UPDATE public.collection_sessions
    SET status = 'completed', ended_at = NOW()
    WHERE id = p_session_id
    RETURNING * INTO v_session;

    -- Create Handover in submitted state
    INSERT INTO public.collection_handovers (
        organization_id,
        event_id,
        collection_session_id,
        volunteer_id,
        expected_cash_amount,
        expected_cheque_amount,
        actual_cash_amount,
        actual_cheque_amount,
        status,
        submitted_at,
        created_at,
        updated_at
    )
    VALUES (
        v_session.organization_id,
        v_session.event_id,
        v_session.id,
        v_session.volunteer_id,
        1000,
        0,
        1000,
        0,
        'submitted',
        NOW(),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_handover_id;

    RETURN jsonb_build_object('success', true, 'handover_id', v_handover_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_complete_session_and_create_handover(uuid) TO authenticated;
