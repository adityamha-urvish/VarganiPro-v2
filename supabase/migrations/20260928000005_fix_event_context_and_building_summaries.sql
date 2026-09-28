-- ==============================================================================
-- Migration: 20260928000005_fix_event_context_and_building_summaries.sql
-- 1. Support custom/festival event name in register_mandal_and_admin
-- 2. Fix user auth lookup in get_event_building_summaries and get_building_properties_progress
-- 3. Fix active event context authorization for volunteer expense creation & viewing
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: register_mandal_and_admin with customizable festival / event name
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_mandal_and_admin(
    p_mandal_name text,
    p_admin_name text,
    p_mobile text,
    p_pin text,
    p_event_name text DEFAULT 'Ganesh Utsav 2026'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_mandal text;
    v_clean_admin text;
    v_clean_mobile text;
    v_clean_pin text;
    v_clean_event_name text;
    v_clean_event_code text;
    v_pin_hash text;
    v_org_id uuid;
    v_user_id uuid;
    v_event_id uuid;
    v_vol_id uuid;
    v_vol_code text;
BEGIN
    v_clean_mandal := TRIM(COALESCE(p_mandal_name, ''));
    v_clean_admin := TRIM(COALESCE(p_admin_name, ''));
    v_clean_mobile := TRIM(COALESCE(p_mobile, ''));
    v_clean_pin := TRIM(COALESCE(p_pin, ''));
    v_clean_event_name := TRIM(COALESCE(p_event_name, ''));

    IF LENGTH(v_clean_mandal) < 3 THEN
        RAISE EXCEPTION 'Mandal name must be at least 3 characters';
    END IF;

    IF LENGTH(v_clean_admin) < 2 THEN
        RAISE EXCEPTION 'Admin name must be at least 2 characters';
    END IF;

    IF NOT (v_clean_mobile ~ '^\d{10}$') THEN
        RAISE EXCEPTION 'Enter a valid 10-digit mobile number';
    END IF;

    IF NOT (v_clean_pin ~ '^\d{4}$') THEN
        RAISE EXCEPTION 'PIN must be exactly 4 digits';
    END IF;

    IF LENGTH(v_clean_event_name) < 2 THEN
        v_clean_event_name := 'Ganesh Utsav 2026';
    END IF;

    -- Generate a clean uppercase event code (e.g. NAVRATRI-26, GU-2026)
    v_clean_event_code := UPPER(REGEXP_REPLACE(v_clean_event_name, '[^a-zA-Z0-9]', '', 'g'));
    IF LENGTH(v_clean_event_code) < 3 THEN
        v_clean_event_code := 'UTSAV-2026';
    END IF;
    v_clean_event_code := SUBSTRING(v_clean_event_code FROM 1 FOR 16);

    -- 1. Create Organization (Mandal / Trust)
    INSERT INTO public.organizations (name, created_at, updated_at)
    VALUES (v_clean_mandal, NOW(), NOW())
    RETURNING id INTO v_org_id;

    -- 2. Hash PIN with bcrypt
    v_pin_hash := extensions.crypt(v_clean_pin, extensions.gen_salt('bf', 10));

    -- 3. Check if User identity already exists globally
    SELECT id INTO v_user_id
    FROM public.users
    WHERE mobile = v_clean_mobile
    LIMIT 1;

    IF v_user_id IS NULL THEN
        -- Create New Admin User
        INSERT INTO public.users (
            name,
            mobile,
            pin_hash,
            role,
            is_active,
            must_change_pin,
            created_at,
            updated_at
        )
        VALUES (
            v_clean_admin,
            v_clean_mobile,
            v_pin_hash,
            'admin',
            true,
            false,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_user_id;
    ELSE
        -- Existing User: Upgrade/Update role and PIN
        UPDATE public.users
        SET
            name = v_clean_admin,
            pin_hash = v_pin_hash,
            role = 'admin',
            is_active = true,
            must_change_pin = false,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- 4. Create Organization Member link (Role: admin)
    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = v_org_id AND user_id = v_user_id
    ) THEN
        INSERT INTO public.organization_members (
            organization_id,
            user_id,
            role,
            created_at
        )
        VALUES (
            v_org_id,
            v_user_id,
            'admin',
            NOW()
        );
    ELSE
        UPDATE public.organization_members
        SET role = 'admin'
        WHERE organization_id = v_org_id AND user_id = v_user_id;
    END IF;

    -- 5. Create or Update Volunteer Record (Admin also serves as a volunteer)
    SELECT id INTO v_vol_id
    FROM public.volunteers
    WHERE organization_id = v_org_id AND user_id = v_user_id
    LIMIT 1;

    IF v_vol_id IS NULL THEN
        v_vol_code := 'VOL-' || SUBSTRING(v_clean_mobile FROM 7 FOR 4);
        INSERT INTO public.volunteers (
            organization_id,
            user_id,
            name,
            mobile,
            volunteer_code,
            status,
            created_at,
            updated_at
        )
        VALUES (
            v_org_id,
            v_user_id,
            v_clean_admin,
            v_clean_mobile,
            v_vol_code,
            'active',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_vol_id;
    ELSE
        UPDATE public.volunteers
        SET
            name = v_clean_admin,
            mobile = v_clean_mobile,
            status = 'active'
        WHERE organization_id = v_org_id AND user_id = v_user_id;
    END IF;

    -- 6. Create First Festival Event with chosen festival name
    INSERT INTO public.events (
        organization_id,
        name,
        code,
        start_date,
        end_date,
        status,
        is_active,
        created_at
    )
    VALUES (
        v_org_id,
        v_clean_event_name,
        v_clean_event_code,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        'active',
        true,
        NOW()
    )
    RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', v_org_id,
        'user_id', v_user_id,
        'event_id', v_event_id,
        'mandal_name', v_clean_mandal,
        'event_name', v_clean_event_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_mandal_and_admin(text, text, text, text, text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.register_mandal_and_admin(text, text, text, text, text) FROM PUBLIC;

-- ------------------------------------------------------------------------------
-- 2. RPC: get_event_building_summaries (Fixed Auth User Lookup & Volunteer Org Check)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_event_building_summaries(
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
    v_result jsonb;
BEGIN
    -- 1. Caller authentication
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

    -- 3. Validate Calling User is an ACTIVE member or volunteer of the event's organization
    SELECT u.id INTO v_calling_user_id
    FROM public.users u
    WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
      AND u.is_active = true
      AND (
          EXISTS (
              SELECT 1 FROM public.organization_members om
              WHERE om.user_id = u.id AND om.organization_id = v_event.organization_id
          )
          OR EXISTS (
              SELECT 1 FROM public.volunteers v
              WHERE v.user_id = u.id AND v.organization_id = v_event.organization_id AND v.status = 'active'
          )
          OR public.is_organization_admin(v_event.organization_id)
      )
    LIMIT 1;

    IF v_calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not an active member of this organization';
    END IF;

    -- 4. Aggregate progress safely
    -- Step A: Pre-aggregate ACTIVE receipts per property (Excluding voided & cancelled receipts)
    WITH property_receipts AS (
        SELECT
            r.property_id,
            COUNT(r.id) AS receipt_count,
            SUM(r.amount) AS total_collected_amount,
            MAX(r.created_at) AS last_receipt_at,
            ARRAY_AGG(r.receipt_number ORDER BY r.receipt_number DESC) AS receipt_numbers
        FROM public.receipts r
        WHERE r.event_id = p_event_id
          AND r.property_id IS NOT NULL
          AND r.status IN ('valid', 'issued')
          AND r.voided_at IS NULL
          AND r.cancelled_at IS NULL
        GROUP BY r.property_id
    ),
    -- Step B: Aggregate active follow-ups per property for this event
    property_follow_ups AS (
        SELECT
            f.property_id,
            f.status,
            f.reason,
            f.follow_up_time,
            f.created_at AS follow_up_at
        FROM public.collection_follow_ups f
        WHERE f.event_id = p_event_id
    ),
    -- Step C: Determine distinct status per property in this organization
    property_statuses AS (
        SELECT
            p.id AS property_id,
            p.building_id,
            CASE
                WHEN pr.property_id IS NOT NULL THEN 'collected'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' AND pfu.reason = 'refused' THEN 'refused'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' THEN 'pending'
                ELSE 'unvisited'
            END AS calculated_status,
            COALESCE(pr.total_collected_amount, 0) AS total_collected_amount,
            pr.last_receipt_at
        FROM public.properties p
        LEFT JOIN property_receipts pr ON pr.property_id = p.id
        LEFT JOIN property_follow_ups pfu ON pfu.property_id = p.id
        WHERE p.organization_id = v_event.organization_id
          AND p.is_active = true
    ),
    -- Step D: Aggregate per-building metrics (Only for properties that belong to a building)
    building_metrics AS (
        SELECT
            ps.building_id,
            COUNT(ps.property_id) AS total_units,
            COUNT(ps.property_id) FILTER (WHERE ps.calculated_status = 'collected') AS collected_units,
            COUNT(ps.property_id) FILTER (WHERE ps.calculated_status = 'pending') AS pending_units,
            COUNT(ps.property_id) FILTER (WHERE ps.calculated_status = 'refused') AS refused_units,
            COUNT(ps.property_id) FILTER (WHERE ps.calculated_status = 'unvisited') AS unvisited_units,
            SUM(ps.total_collected_amount) AS total_amount,
            MAX(ps.last_receipt_at) AS last_receipt_at
        FROM property_statuses ps
        WHERE ps.building_id IS NOT NULL
        GROUP BY ps.building_id
    )
    -- Step E: Assemble JSON output sorted cleanly
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'building_id', b.id,
                'name', b.name,
                'building_code', b.building_code,
                'wing', b.wing,
                'total_floors', b.total_floors,
                'units_per_floor', b.units_per_floor,
                'display_order', b.display_order,
                'total_units', COALESCE(bm.total_units, 0),
                'collected_units', COALESCE(bm.collected_units, 0),
                'pending_units', COALESCE(bm.pending_units, 0),
                'refused_units', COALESCE(bm.refused_units, 0),
                'unvisited_units', COALESCE(bm.unvisited_units, 0),
                'total_amount', COALESCE(bm.total_amount, 0),
                'completion_percentage', CASE
                    WHEN COALESCE(bm.total_units, 0) = 0 THEN 0
                    ELSE ROUND((COALESCE(bm.collected_units, 0)::numeric / bm.total_units::numeric) * 100, 1)
                END,
                'last_receipt_at', bm.last_receipt_at
            )
            ORDER BY b.display_order ASC, b.name ASC
        ),
        '[]'::jsonb
    ) INTO v_result
    FROM public.buildings b
    LEFT JOIN building_metrics bm ON bm.building_id = b.id
    WHERE b.organization_id = v_event.organization_id
      AND b.is_active = true;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_building_summaries(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_event_building_summaries(uuid) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 3. RPC: get_building_properties_progress (Fixed Auth User Lookup & Volunteer Org Check)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_building_properties_progress(
    p_event_id uuid,
    p_building_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id uuid;
    v_event RECORD;
    v_building RECORD;
    v_result jsonb;
BEGIN
    -- 1. Caller authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL OR p_building_id IS NULL THEN
        RAISE EXCEPTION 'Event ID and Building ID are required';
    END IF;

    -- 2. Validate Event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive';
    END IF;

    -- 3. Validate Calling User is an ACTIVE member or volunteer of the event's organization
    SELECT u.id INTO v_calling_user_id
    FROM public.users u
    WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
      AND u.is_active = true
      AND (
          EXISTS (
              SELECT 1 FROM public.organization_members om
              WHERE om.user_id = u.id AND om.organization_id = v_event.organization_id
          )
          OR EXISTS (
              SELECT 1 FROM public.volunteers v
              WHERE v.user_id = u.id AND v.organization_id = v_event.organization_id AND v.status = 'active'
          )
          OR public.is_organization_admin(v_event.organization_id)
      )
    LIMIT 1;

    IF v_calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not an active member of this organization';
    END IF;

    -- 4. Validate Building belongs to the exact same organization
    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = p_building_id
      AND organization_id = v_event.organization_id;

    IF v_building.id IS NULL THEN
        RAISE EXCEPTION 'Building not found in this organization';
    END IF;

    -- 5. Safe per-property receipt and follow-up aggregation for this building (Excluding voided & cancelled receipts)
    WITH property_receipts AS (
        SELECT
            r.property_id,
            COUNT(r.id) AS receipt_count,
            SUM(r.amount) AS total_collected_amount,
            MAX(r.created_at) AS last_receipt_at,
            (ARRAY_AGG(r.receipt_number ORDER BY r.receipt_number DESC))[1] AS latest_receipt_number
        FROM public.receipts r
        WHERE r.event_id = p_event_id
          AND r.property_id IS NOT NULL
          AND r.status IN ('valid', 'issued')
          AND r.voided_at IS NULL
          AND r.cancelled_at IS NULL
        GROUP BY r.property_id
    ),
    property_follow_ups AS (
        SELECT
            f.property_id,
            f.status,
            f.reason,
            f.follow_up_time,
            f.notes,
            f.created_at AS follow_up_at
        FROM public.collection_follow_ups f
        WHERE f.event_id = p_event_id
    ),
    property_list AS (
        SELECT
            p.id AS property_id,
            p.building_id,
            p.floor_number,
            p.flat_number,
            p.unit_number,
            p.property_type,
            p.owner_name,
            p.contact_mobile,
            p.display_order,
            COALESCE(pr.receipt_count, 0) AS receipt_count,
            COALESCE(pr.total_collected_amount, 0) AS total_collected_amount,
            pr.last_receipt_at,
            pr.latest_receipt_number,
            pfu.status AS follow_up_status,
            pfu.reason AS follow_up_reason,
            pfu.follow_up_time,
            pfu.notes AS follow_up_notes,
            CASE
                WHEN pr.property_id IS NOT NULL THEN 'collected'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' AND pfu.reason = 'refused' THEN 'refused'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' THEN 'pending'
                ELSE 'unvisited'
            END AS calculated_status
        FROM public.properties p
        LEFT JOIN property_receipts pr ON pr.property_id = p.id
        LEFT JOIN property_follow_ups pfu ON pfu.property_id = p.id
        WHERE p.building_id = p_building_id
          AND p.organization_id = v_event.organization_id
          AND p.is_active = true
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'property_id', pl.property_id,
                'building_id', pl.building_id,
                'floor_number', pl.floor_number,
                'flat_number', pl.flat_number,
                'unit_number', pl.unit_number,
                'property_type', pl.property_type,
                'owner_name', pl.owner_name,
                'contact_mobile', pl.contact_mobile,
                'display_order', pl.display_order,
                'status', pl.calculated_status,
                'receipt_count', pl.receipt_count,
                'total_collected_amount', pl.total_collected_amount,
                'last_receipt_at', pl.last_receipt_at,
                'latest_receipt_number', pl.latest_receipt_number,
                'follow_up_status', pl.follow_up_status,
                'follow_up_reason', pl.follow_up_reason,
                'follow_up_time', pl.follow_up_time,
                'follow_up_notes', pl.follow_up_notes
            )
            ORDER BY pl.floor_number ASC, pl.display_order ASC, pl.flat_number ASC
        ),
        '[]'::jsonb
    ) INTO v_result
    FROM property_list pl;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_building_properties_progress(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_building_properties_progress(uuid, uuid) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 4. RLS & RPC: Volunteer Active Event Context for Expenses
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
CREATE POLICY "expenses_select_policy" ON public.expenses
    FOR SELECT
    TO authenticated
    USING (
        public.is_organization_admin(organization_id)
        OR EXISTS (
            SELECT 1 FROM public.volunteers v
            JOIN public.users u ON (u.auth_user_id = auth.uid() OR u.id = auth.uid())
            JOIN public.events e ON e.id = expenses.event_id
            WHERE u.is_active = true
              AND v.user_id = u.id
              AND v.organization_id = expenses.organization_id
              AND v.status = 'active'
              AND (
                (e.is_active = true AND COALESCE(e.status, 'active') = 'active')
                OR EXISTS (
                    SELECT 1 FROM public.collection_sessions cs
                    WHERE cs.volunteer_id = v.id
                      AND cs.event_id = expenses.event_id
                      AND cs.status IN ('open', 'completed')
                )
                OR EXISTS (
                    SELECT 1 FROM public.receipt_books rb
                    WHERE rb.assigned_volunteer_id = v.id
                      AND rb.event_id = expenses.event_id
                )
              )
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
            JOIN public.events e ON e.id = expenses.event_id
            WHERE u.is_active = true
              AND v.user_id = u.id
              AND v.organization_id = expenses.organization_id
              AND v.status = 'active'
              AND (
                (e.is_active = true AND COALESCE(e.status, 'active') = 'active')
                OR EXISTS (
                    SELECT 1 FROM public.collection_sessions cs
                    WHERE cs.volunteer_id = v.id
                      AND cs.event_id = expenses.event_id
                      AND cs.status IN ('open', 'completed')
                )
                OR EXISTS (
                    SELECT 1 FROM public.receipt_books rb
                    WHERE rb.assigned_volunteer_id = v.id
                      AND rb.event_id = expenses.event_id
                )
              )
        )
    );

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
    v_is_event_volunteer boolean;
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

    -- 4. Authorize: Admin (org-wide) OR Active Volunteer for the active event context
    v_is_admin := public.is_organization_admin(v_event.organization_id);

    SELECT EXISTS (
        SELECT 1
        FROM public.volunteers v
        WHERE v.user_id = v_user.id
          AND v.organization_id = v_event.organization_id
          AND v.status = 'active'
          AND (
            (v_event.is_active = true AND COALESCE(v_event.status, 'active') = 'active')
            OR EXISTS (
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
    ) INTO v_is_event_volunteer;

    IF NOT v_is_admin AND NOT v_is_event_volunteer THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer in this event session context';
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
    v_is_event_volunteer boolean;
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
          AND (
            (v_event.is_active = true AND COALESCE(v_event.status, 'active') = 'active')
            OR EXISTS (
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
    ) INTO v_is_event_volunteer;

    IF NOT v_is_admin AND NOT v_is_event_volunteer THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer in this event session context';
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
    ) INTO v_expenses
    FROM public.expenses e
    LEFT JOIN public.users u ON u.id = e.created_by
    WHERE e.event_id = p_event_id;

    RETURN jsonb_build_object(
        'total_amount', v_total,
        'today_amount', v_today_total,
        'expense_count', v_count,
        'expenses', v_expenses
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_expenses(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_event_expenses(uuid) FROM PUBLIC, anon;
