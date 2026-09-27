-- ==============================================================================
-- Migration: 20260928000002_fix_expenses_rpc_user_lookup.sql
-- Fix: Robust user lookup in create_expense and get_event_expenses RPCs
-- ==============================================================================

-- 1. RPC: CREATE EXPENSE (Volunteer or Admin)
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
    SELECT id, organization_id, is_active INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF v_event.id IS NULL OR NOT v_event.is_active THEN
        RAISE EXCEPTION 'Event not found or is inactive';
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

    -- 4. Authorize: Admin or Active Volunteer in Organization
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

    -- 5. Insert Expense Record with authoritative audit stamps
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
        'title', v_clean_title,
        'amount', p_amount,
        'expense_date', v_date
    );
END;
$$;

-- 2. RPC: GET EVENT EXPENSES (Volunteer or Admin)
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
    SELECT id, organization_id, is_active INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- 3. Validate User & Membership
    SELECT id INTO v_user_id
    FROM public.users
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
      AND is_active = true
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Active user identity not found';
    END IF;

    v_is_admin := public.is_organization_admin(v_event.organization_id);

    SELECT EXISTS (
        SELECT 1
        FROM public.volunteers v
        WHERE v.user_id = v_user_id
          AND v.organization_id = v_event.organization_id
          AND v.status = 'active'
    ) INTO v_is_volunteer;

    IF NOT v_is_admin AND NOT v_is_volunteer THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer in this organization';
    END IF;

    -- 4. Calculate Aggregates
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

    -- 5. Fetch Expense Items
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', e.id,
                'title', e.title,
                'amount', e.amount,
                'expense_date', e.expense_date,
                'created_by', e.created_by,
                'created_by_name', COALESCE(u.name, 'Member'),
                'created_at', e.created_at,
                'updated_at', e.updated_at
            )
            ORDER BY e.expense_date DESC, e.created_at DESC
        ),
        '[]'::jsonb
    )
    INTO v_expenses
    FROM public.expenses e
    LEFT JOIN public.users u ON u.id = e.created_by
    WHERE e.event_id = p_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'total_amount', v_total,
        'today_amount', v_today_total,
        'count', v_count,
        'expenses', v_expenses
    );
END;
$$;
