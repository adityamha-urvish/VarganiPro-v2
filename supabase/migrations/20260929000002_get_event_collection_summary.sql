-- ==============================================================================
-- Migration: 20260929000002_get_event_collection_summary.sql
-- Lightweight, volunteer-authorized, event-scoped aggregate collection summary RPC.
-- 1. Derives organization from the event server-side (no caller-supplied org ID).
-- 2. Authorizes Organization Admin for their organization.
-- 3. Authorizes Active Volunteers of the organization for active events.
-- 4. Denies inactive volunteers, inactive/expired events, cross-org events, and anon.
-- 5. Returns aggregate financial metrics across all valid/issued receipts (excluding voided/cancelled).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_event_collection_summary(
    p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id uuid;
    v_event RECORD;
    v_is_admin boolean := false;
    v_is_volunteer boolean := false;
    v_result jsonb;
BEGIN
    -- 1. Deny anonymous callers
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    -- 2. Validate Event & Derive Organization Server-Side
    SELECT id, organization_id, is_active, status INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- 3. Resolve Calling User Identity
    SELECT id INTO v_calling_user_id
    FROM public.users
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
      AND is_active = true
    LIMIT 1;

    IF v_calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Active user profile not found';
    END IF;

    -- 4. Authorization Verification
    -- A. Admin of the event's organization
    v_is_admin := public.is_organization_admin(v_event.organization_id);

    -- B. Active Volunteer for this specific event context (assigned receipt book or collection session)
    IF NOT v_is_admin THEN
        IF NOT v_event.is_active OR COALESCE(v_event.status, 'active') <> 'active' THEN
            RAISE EXCEPTION 'Unauthorized: Event is inactive or expired';
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM public.volunteers v
            WHERE v.user_id = v_calling_user_id
              AND v.organization_id = v_event.organization_id
              AND v.status = 'active'
              AND (
                  EXISTS (
                      SELECT 1
                      FROM public.collection_sessions cs
                      WHERE cs.volunteer_id = v.id
                        AND cs.event_id = v_event.id
                        AND cs.status IN ('open', 'completed')
                  )
                  OR EXISTS (
                      SELECT 1
                      FROM public.receipt_books rb
                      WHERE rb.assigned_volunteer_id = v.id
                        AND rb.event_id = v_event.id
                  )
              )
        ) INTO v_is_volunteer;

        IF NOT v_is_volunteer THEN
            RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer for this event context';
        END IF;
    END IF;

    -- 5. Calculate Aggregate Financial Metrics across all valid receipts
    -- (Includes Admin + all Volunteers + all Physical Books + Residential Flats + Shops + General)
    -- (Excludes voided, cancelled, and inactive receipts)
    WITH valid_receipts AS (
        SELECT
            amount,
            payment_mode
        FROM public.receipts
        WHERE event_id = p_event_id
          AND organization_id = v_event.organization_id
          AND status IN ('valid', 'issued')
          AND voided_at IS NULL
          AND cancelled_at IS NULL
    )
    SELECT jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'organization_id', v_event.organization_id,
        'total_amount', COALESCE(SUM(amount)::numeric(12,2), 0.00),
        'cash_amount', COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cash')::numeric(12,2), 0.00),
        'upi_amount', COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'upi')::numeric(12,2), 0.00),
        'cheque_amount', COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cheque')::numeric(12,2), 0.00),
        'bank_transfer_amount', COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'bank_transfer')::numeric(12,2), 0.00),
        'receipt_count', COUNT(*)::integer
    ) INTO v_result
    FROM valid_receipts;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_collection_summary(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_event_collection_summary(uuid) FROM PUBLIC, anon;
