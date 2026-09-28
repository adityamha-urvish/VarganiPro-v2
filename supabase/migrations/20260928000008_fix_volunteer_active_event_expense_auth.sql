-- ==============================================================================
-- Migration: 20260928000008_fix_volunteer_active_event_expense_auth.sql
-- Fix volunteer active event expense authorization & provide atomic event activation.
-- 1. Volunteers belong to the Organization (Mandal).
-- 2. Events belong to the Organization and own sessions, receipts, and expenses.
-- 3. Active volunteers of an organization are authorized to record/view expenses
--    for any active event belonging to their organization without requiring an
--    assigned receipt book or collection session in that event.
-- 4. Organization ID is resolved authoritatively from the event row.
-- 5. Atomic set_active_event RPC enforces single active event per organization.
-- ==============================================================================

-- 1. RLS Policies on public.expenses
DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
CREATE POLICY "expenses_select_policy" ON public.expenses
    FOR SELECT
    TO authenticated
    USING (
        public.is_organization_admin(organization_id)
        OR EXISTS (
            SELECT 1 FROM public.volunteers v
            JOIN public.users u ON (u.auth_user_id = auth.uid() OR u.id = auth.uid())
            WHERE u.is_active = true
              AND v.user_id = u.id
              AND v.organization_id = expenses.organization_id
              AND v.status = 'active'
        )
    );

DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
CREATE POLICY "expenses_insert_policy" ON public.expenses
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_organization_admin(organization_id)
        OR EXISTS (
            SELECT 1 FROM public.volunteers v
            JOIN public.users u ON (u.auth_user_id = auth.uid() OR u.id = auth.uid())
            WHERE u.is_active = true
              AND v.user_id = u.id
              AND v.organization_id = expenses.organization_id
              AND v.status = 'active'
        )
    );

-- 2. RPC: create_expense
CREATE OR REPLACE FUNCTION public.create_expense(
    p_event_id uuid,
    p_title text,
    p_amount numeric,
    p_expense_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_title text;
    v_event RECORD;
    v_user RECORD;
    v_is_admin boolean;
    v_is_volunteer boolean;
    v_new_id uuid;
    v_date date;
BEGIN
    -- 1. Authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    v_clean_title := TRIM(COALESCE(p_title, ''));
    IF LENGTH(v_clean_title) < 2 THEN
        RAISE EXCEPTION 'Expense title must be at least 2 characters';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero';
    END IF;

    v_date := COALESCE(p_expense_date, CURRENT_DATE);

    -- 2. Validate Event
    SELECT id, organization_id, is_active, status INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF NOT v_event.is_active THEN
        RAISE EXCEPTION 'Event is inactive';
    END IF;

    -- 3. Validate User Identity
    SELECT id, is_active INTO v_user
    FROM public.users
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
      AND is_active = true
    LIMIT 1;

    IF v_user.id IS NULL THEN
        RAISE EXCEPTION 'Active user identity not found';
    END IF;

    -- 4. Authorize: Admin (org-wide) OR Active Volunteer for this Organization
    v_is_admin := public.is_organization_admin(v_event.organization_id);

    SELECT EXISTS (
        SELECT 1
        FROM public.volunteers v
        WHERE v.user_id = v_user.id
          AND v.organization_id = v_event.organization_id
          AND v.status = 'active'
    ) INTO v_is_volunteer;

    IF NOT v_is_admin AND NOT v_is_volunteer THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer for this organization';
    END IF;

    -- 5. Insert Expense Record with authoritative event-resolved organization_id
    INSERT INTO public.expenses (
        organization_id,
        event_id,
        title,
        amount,
        expense_date,
        created_by,
        created_at,
        updated_at
    )
    VALUES (
        v_event.organization_id,
        v_event.id,
        v_clean_title,
        p_amount,
        v_date,
        v_user.id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true,
        'expense_id', v_new_id,
        'organization_id', v_event.organization_id,
        'event_id', v_event.id,
        'title', v_clean_title,
        'amount', p_amount,
        'expense_date', v_date
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_expense(uuid, text, numeric, date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_expense(uuid, text, numeric, date) FROM PUBLIC, anon;

-- 3. RPC: get_event_expenses
CREATE OR REPLACE FUNCTION public.get_event_expenses(
    p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event RECORD;
    v_is_admin boolean;
    v_is_volunteer boolean;
    v_user_id uuid;
    v_expenses jsonb;
    v_total numeric;
    v_today_total numeric;
    v_count integer;
BEGIN
    -- 1. Authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    -- 2. Validate Event
    SELECT id, organization_id, is_active, status INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- 3. Validate User Identity
    SELECT id INTO v_user_id
    FROM public.users
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
      AND is_active = true
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Active user identity not found';
    END IF;

    -- 4. Authorize: Admin (org-wide) OR Active Volunteer for this Organization
    v_is_admin := public.is_organization_admin(v_event.organization_id);

    SELECT EXISTS (
        SELECT 1
        FROM public.volunteers v
        WHERE v.user_id = v_user_id
          AND v.organization_id = v_event.organization_id
          AND v.status = 'active'
    ) INTO v_is_volunteer;

    IF NOT v_is_admin AND NOT v_is_volunteer THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer for this organization';
    END IF;

    -- 5. Fetch Expenses and calculate aggregates
    SELECT
        COALESCE(SUM(amount), 0),
        COALESCE(SUM(CASE WHEN expense_date = CURRENT_DATE THEN amount ELSE 0 END), 0),
        COUNT(*)
    INTO
        v_total,
        v_today_total,
        v_count
    FROM public.expenses
    WHERE event_id = p_event_id;

    SELECT
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', e.id,
                'title', e.title,
                'amount', e.amount,
                'expense_date', e.expense_date,
                'created_by', e.created_by,
                'created_by_name', COALESCE(u.name, 'Admin'),
                'created_at', e.created_at,
                'updated_at', e.updated_at
            ) ORDER BY e.expense_date DESC, e.created_at DESC
        ), '[]'::jsonb)
    INTO v_expenses
    FROM public.expenses e
    LEFT JOIN public.users u ON u.id = e.created_by
    WHERE e.event_id = p_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'expenses', v_expenses,
        'total_amount', v_total,
        'today_amount', v_today_total,
        'count', v_count,
        'expense_count', v_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_expenses(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_event_expenses(uuid) FROM PUBLIC, anon;

-- 4. RPC: set_active_event (Admin Only - Atomic Event Activation)
CREATE OR REPLACE FUNCTION public.set_active_event(
    p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event RECORD;
    v_is_admin boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    SELECT id, organization_id INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    v_is_admin := public.is_organization_admin(v_event.organization_id);
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organization administrators can change active event';
    END IF;

    -- Deactivate other events in same organization
    UPDATE public.events
    SET is_active = false, updated_at = NOW()
    WHERE organization_id = v_event.organization_id
      AND id != v_event.id
      AND is_active = true;

    -- Activate target event
    UPDATE public.events
    SET is_active = true, updated_at = NOW()
    WHERE id = v_event.id;

    RETURN jsonb_build_object(
        'success', true,
        'active_event_id', v_event.id,
        'organization_id', v_event.organization_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_event(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_active_event(uuid) FROM PUBLIC, anon;
