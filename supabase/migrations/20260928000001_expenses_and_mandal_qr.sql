-- ==============================================================================
-- Migration: 20260928000001_expenses_and_mandal_qr.sql
-- Gate B: Festival Expenses Management and Mandal UPI QR Configuration
-- ==============================================================================

-- 1. ADD MANDAL / EVENT UPI CONFIGURATION COLUMNS TO EVENTS TABLE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'upi_id'
    ) THEN
        ALTER TABLE public.events ADD COLUMN upi_id text DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'upi_name'
    ) THEN
        ALTER TABLE public.events ADD COLUMN upi_name text DEFAULT NULL;
    END IF;
END $$;

-- 2. CREATE MINIMAL EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title text NOT NULL,
    amount numeric(12, 2) NOT NULL,
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_expense_title_len CHECK (LENGTH(TRIM(title)) >= 2),
    CONSTRAINT chk_expense_amount_pos CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_expenses_event ON public.expenses (event_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON public.expenses (organization_id);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies if any
DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;

-- SELECT: Organization Admin or Active Volunteer in Organization
CREATE POLICY "expenses_select_policy" ON public.expenses
    FOR SELECT
    TO authenticated
    USING (
        public.is_organization_admin(organization_id)
        OR EXISTS (
            SELECT 1 FROM public.volunteers v
            JOIN public.users u ON u.id = v.user_id
            WHERE u.auth_user_id = auth.uid()
              AND u.is_active = true
              AND v.organization_id = expenses.organization_id
              AND v.status = 'active'
        )
    );

-- INSERT: Organization Admin or Active Volunteer in Organization
CREATE POLICY "expenses_insert_policy" ON public.expenses
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_organization_admin(organization_id)
        OR EXISTS (
            SELECT 1 FROM public.volunteers v
            JOIN public.users u ON u.id = v.user_id
            WHERE u.auth_user_id = auth.uid()
              AND u.is_active = true
              AND v.organization_id = expenses.organization_id
              AND v.status = 'active'
        )
    );

-- UPDATE: Strictly Organization Admin ONLY
CREATE POLICY "expenses_update_policy" ON public.expenses
    FOR UPDATE
    TO authenticated
    USING (
        public.is_organization_admin(organization_id)
    )
    WITH CHECK (
        public.is_organization_admin(organization_id)
    );

-- DELETE: Strictly Organization Admin ONLY
CREATE POLICY "expenses_delete_policy" ON public.expenses
    FOR DELETE
    TO authenticated
    USING (
        public.is_organization_admin(organization_id)
    );

-- 4. RPC: CREATE EXPENSE (Volunteer or Admin)
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

GRANT EXECUTE ON FUNCTION public.create_expense(uuid, text, numeric, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_expense(uuid, text, numeric, date) FROM PUBLIC, anon;

-- 5. RPC: UPDATE EXPENSE (Admin Only)
CREATE OR REPLACE FUNCTION public.update_expense(
    p_expense_id uuid,
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
    v_expense RECORD;
    v_is_admin boolean;
    v_date date;
BEGIN
    -- 1. Authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_expense_id IS NULL THEN
        RAISE EXCEPTION 'Expense ID is required';
    END IF;

    v_clean_title := TRIM(COALESCE(p_title, ''));
    IF LENGTH(v_clean_title) < 2 THEN
        RAISE EXCEPTION 'Expense title must be at least 2 characters';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero';
    END IF;

    v_date := COALESCE(p_expense_date, CURRENT_DATE);

    -- 2. Fetch Expense
    SELECT id, organization_id, event_id INTO v_expense
    FROM public.expenses
    WHERE id = p_expense_id;

    IF v_expense.id IS NULL THEN
        RAISE EXCEPTION 'Expense record not found';
    END IF;

    -- 3. Authorize: Admin ONLY
    v_is_admin := public.is_organization_admin(v_expense.organization_id);
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organization administrators can modify expenses';
    END IF;

    -- 4. Update Expense Record
    UPDATE public.expenses
    SET
        title = v_clean_title,
        amount = p_amount,
        expense_date = v_date,
        updated_at = NOW()
    WHERE id = p_expense_id;

    RETURN jsonb_build_object(
        'success', true,
        'expense_id', p_expense_id,
        'title', v_clean_title,
        'amount', p_amount,
        'expense_date', v_date
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_expense(uuid, text, numeric, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_expense(uuid, text, numeric, date) FROM PUBLIC, anon;

-- 6. RPC: GET EVENT EXPENSES (Volunteer or Admin)
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
            ) ORDER BY e.expense_date DESC, e.created_at DESC
        ),
        '[]'::jsonb
    )
    INTO v_expenses
    FROM public.expenses e
    LEFT JOIN public.users u ON u.id = e.created_by
    WHERE e.event_id = p_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'total_amount', v_total,
        'today_amount', v_today_total,
        'count', v_count,
        'expenses', v_expenses
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_expenses(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_event_expenses(uuid) FROM PUBLIC, anon;

-- 7. RPC: UPDATE EVENT UPI CONFIG (Admin Only)
CREATE OR REPLACE FUNCTION public.update_event_upi_config(
    p_event_id uuid,
    p_upi_id text,
    p_upi_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event RECORD;
    v_clean_upi text;
    v_clean_name text;
    v_is_admin boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    v_clean_upi := NULLIF(TRIM(COALESCE(p_upi_id, '')), '');
    v_clean_name := NULLIF(TRIM(COALESCE(p_upi_name, '')), '');

    -- Validate Event
    SELECT id, organization_id, is_active INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- Authorize: Admin ONLY
    v_is_admin := public.is_organization_admin(v_event.organization_id);
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organization administrators can configure Mandal UPI';
    END IF;

    -- Update Event
    UPDATE public.events
    SET
        upi_id = v_clean_upi,
        upi_name = v_clean_name
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'upi_id', v_clean_upi,
        'upi_name', v_clean_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_event_upi_config(uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_event_upi_config(uuid, text, text) FROM PUBLIC, anon;
