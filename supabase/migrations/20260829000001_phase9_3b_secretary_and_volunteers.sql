-- ==============================================================================
-- Migration: 20260829000001_phase9_3b_secretary_and_volunteers.sql
-- Phase 9-3B: Secretary Foundation, Self-Service Mandal Onboarding & Secure Volunteer Provisioning
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Enhancements (Additive & Non-destructive)
-- ------------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS must_change_pin boolean DEFAULT false;

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_note text DEFAULT NULL;

-- ------------------------------------------------------------------------------
-- 2. RPC: register_mandal_and_admin (Public / Unauthenticated Mandal Onboarding)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_mandal_and_admin(
    p_mandal_name text,
    p_admin_name text,
    p_mobile text,
    p_pin text
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
    v_pin_hash text;
    v_org_id uuid;
    v_user_id uuid;
    v_event_id uuid;
BEGIN
    -- 1. Strict input sanitation and format validation
    v_clean_mandal := TRIM(COALESCE(p_mandal_name, ''));
    v_clean_admin := TRIM(COALESCE(p_admin_name, ''));
    v_clean_mobile := TRIM(COALESCE(p_mobile, ''));
    v_clean_pin := TRIM(COALESCE(p_pin, ''));

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

    -- 2. Server-side bcrypt hash using pgcrypto
    v_pin_hash := extensions.crypt(v_clean_pin, extensions.gen_salt('bf', 10));

    -- 3. Create Organization
    INSERT INTO public.organizations (
        name,
        created_at
    )
    VALUES (
        v_clean_mandal,
        NOW()
    )
    RETURNING id INTO v_org_id;

    -- 4. Create or reuse User identity
    SELECT id INTO v_user_id
    FROM public.users
    WHERE mobile = v_clean_mobile
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Existing identity: update name, pin_hash and ensure active
        UPDATE public.users
        SET
            name = v_clean_admin,
            pin_hash = v_pin_hash,
            role = 'admin',
            is_active = true,
            must_change_pin = false
        WHERE id = v_user_id;
    ELSE
        -- New user identity
        INSERT INTO public.users (
            name,
            mobile,
            pin_hash,
            role,
            is_active,
            must_change_pin,
            created_at
        )
        VALUES (
            v_clean_admin,
            v_clean_mobile,
            v_pin_hash,
            'admin',
            true,
            false,
            NOW()
        )
        RETURNING id INTO v_user_id;
    END IF;

    -- 5. Link User as Organization Admin
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
    )
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = 'admin';

    -- 6. Link User as Active Volunteer in the new organization
    INSERT INTO public.volunteers (
        organization_id,
        user_id,
        status,
        created_at
    )
    VALUES (
        v_org_id,
        v_user_id,
        'active',
        NOW()
    )
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET status = 'active';

    -- 7. Create First Festival Event
    INSERT INTO public.events (
        organization_id,
        name,
        code,
        is_active,
        created_at
    )
    VALUES (
        v_org_id,
        'Ganesh Utsav 2026',
        'UTSAV-2026',
        true,
        NOW()
    )
    RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', v_org_id,
        'user_id', v_user_id,
        'event_id', v_event_id,
        'mandal_name', v_clean_mandal
    );
END;
$$;

-- Explicit public/anon grant for public signup only
GRANT EXECUTE ON FUNCTION public.register_mandal_and_admin(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.register_mandal_and_admin(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_mandal_and_admin(text, text, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.register_mandal_and_admin(text, text, text, text) FROM PUBLIC;

-- ------------------------------------------------------------------------------
-- 3. RPC: provision_volunteer (Admin Scoped, Server-Side PIN Generation)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_volunteer(
    p_organization_id uuid,
    p_full_name text,
    p_mobile text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_name text;
    v_clean_mobile text;
    v_user_id uuid;
    v_volunteer_id uuid;
    v_temp_pin text := NULL;
    v_pin_hash text;
    v_is_new_user boolean := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    -- Assert Caller is Administrator of target organization
    IF NOT public.is_organization_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of this organization';
    END IF;

    v_clean_name := TRIM(COALESCE(p_full_name, ''));
    v_clean_mobile := TRIM(COALESCE(p_mobile, ''));

    IF LENGTH(v_clean_name) < 2 THEN
        RAISE EXCEPTION 'Volunteer name must be at least 2 characters';
    END IF;

    IF NOT (v_clean_mobile ~ '^\d{10}$') THEN
        RAISE EXCEPTION 'Enter a valid 10-digit mobile number';
    END IF;

    -- Check if User identity already exists globally
    SELECT id INTO v_user_id
    FROM public.users
    WHERE mobile = v_clean_mobile
    LIMIT 1;

    IF v_user_id IS NULL THEN
        -- NEW USER: Generate cryptographically random 4-digit PIN (1000..9999)
        v_is_new_user := true;
        v_temp_pin := (floor(random() * 9000) + 1000)::text;
        v_pin_hash := extensions.crypt(v_temp_pin, extensions.gen_salt('bf', 10));

        INSERT INTO public.users (
            name,
            mobile,
            pin_hash,
            role,
            is_active,
            must_change_pin,
            created_at
        )
        VALUES (
            v_clean_name,
            v_clean_mobile,
            v_pin_hash,
            'volunteer',
            true,
            true,
            NOW()
        )
        RETURNING id INTO v_user_id;
    ELSE
        -- EXISTING USER: User preserves existing secret PIN
        v_is_new_user := false;
        v_temp_pin := NULL;
    END IF;

    -- Link User into Organization Members
    INSERT INTO public.organization_members (
        organization_id,
        user_id,
        role,
        created_at
    )
    VALUES (
        p_organization_id,
        v_user_id,
        'volunteer',
        NOW()
    )
    ON CONFLICT (organization_id, user_id)
    DO NOTHING;

    -- Create or Reactivate Volunteer record
    INSERT INTO public.volunteers (
        organization_id,
        user_id,
        status,
        created_at
    )
    VALUES (
        p_organization_id,
        v_user_id,
        'active',
        NOW()
    )
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET status = 'active'
    RETURNING id INTO v_volunteer_id;

    RETURN jsonb_build_object(
        'success', true,
        'volunteer_id', v_volunteer_id,
        'user_id', v_user_id,
        'is_new_user', v_is_new_user,
        'temporary_pin', v_temp_pin
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_volunteer(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_volunteer(uuid, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.provision_volunteer(uuid, text, text) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 4. RPC: reset_volunteer_pin (Admin Scoped, Target-Entity IDOR Protected)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_volunteer_pin(
    p_volunteer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_target_org_id uuid;
    v_target_user_id uuid;
    v_temp_pin text;
    v_pin_hash text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_volunteer_id IS NULL THEN
        RAISE EXCEPTION 'Volunteer ID is required';
    END IF;

    -- 1. Target-Entity Scoped Authorization (Resolve Org from target record itself)
    SELECT organization_id, user_id INTO v_target_org_id, v_target_user_id
    FROM public.volunteers
    WHERE id = p_volunteer_id;

    IF v_target_org_id IS NULL THEN
        RAISE EXCEPTION 'Volunteer not found';
    END IF;

    -- 2. Verify Caller is Administrator of that target organization
    IF NOT public.is_organization_admin(v_target_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of the target organization';
    END IF;

    -- 3. Generate server-side random 4-digit temporary PIN
    v_temp_pin := (floor(random() * 9000) + 1000)::text;
    v_pin_hash := extensions.crypt(v_temp_pin, extensions.gen_salt('bf', 10));

    -- 4. Update user record with new temporary PIN and force rotation on next login
    UPDATE public.users
    SET
        pin_hash = v_pin_hash,
        must_change_pin = true,
        is_active = true
    WHERE id = v_target_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'volunteer_id', p_volunteer_id,
        'user_id', v_target_user_id,
        'temporary_pin', v_temp_pin
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_volunteer_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_volunteer_pin(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reset_volunteer_pin(uuid) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 5. RPC: set_volunteer_status (Admin Scoped, Target-Entity IDOR Protected)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_volunteer_status(
    p_volunteer_id uuid,
    p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_org_id uuid;
    v_target_user_id uuid;
    v_clean_status text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_volunteer_id IS NULL THEN
        RAISE EXCEPTION 'Volunteer ID is required';
    END IF;

    v_clean_status := LOWER(TRIM(COALESCE(p_status, '')));
    IF v_clean_status NOT IN ('active', 'inactive') THEN
        RAISE EXCEPTION 'Invalid status. Must be active or inactive';
    END IF;

    -- 1. Target-Entity Scoped Authorization
    SELECT organization_id, user_id INTO v_target_org_id, v_target_user_id
    FROM public.volunteers
    WHERE id = p_volunteer_id;

    IF v_target_org_id IS NULL THEN
        RAISE EXCEPTION 'Volunteer not found';
    END IF;

    -- 2. Verify Caller is Admin of target organization
    IF NOT public.is_organization_admin(v_target_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of the target organization';
    END IF;

    -- 3. Update volunteer status
    UPDATE public.volunteers
    SET
        status = v_clean_status
    WHERE id = p_volunteer_id;

    IF v_clean_status = 'inactive' THEN
        -- If inactive, check if user has other active organizations
        IF NOT EXISTS (
            SELECT 1
            FROM public.volunteers
            WHERE user_id = v_target_user_id
              AND status = 'active'
              AND id <> p_volunteer_id
        ) THEN
            UPDATE public.users
            SET is_active = false
            WHERE id = v_target_user_id;
        END IF;
    ELSIF v_clean_status = 'active' THEN
        UPDATE public.users
        SET is_active = true
        WHERE id = v_target_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'volunteer_id', p_volunteer_id,
        'status', v_clean_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_volunteer_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_volunteer_status(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.set_volunteer_status(uuid, text) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 6. RPC: change_self_pin (Self-Service User PIN Rotation)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_self_pin(
    p_old_pin text,
    p_new_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_calling_user RECORD;
    v_clean_old text;
    v_clean_new text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_clean_old := TRIM(COALESCE(p_old_pin, ''));
    v_clean_new := TRIM(COALESCE(p_new_pin, ''));

    IF NOT (v_clean_new ~ '^\d{4}$') THEN
        RAISE EXCEPTION 'New PIN must be exactly 4 digits';
    END IF;

    -- Lookup user via authenticated session auth_user_id
    SELECT * INTO v_calling_user
    FROM public.users
    WHERE auth_user_id = auth.uid()
      AND is_active = true;

    IF v_calling_user.id IS NULL THEN
        RAISE EXCEPTION 'Active user profile not found';
    END IF;

    -- Verify current/old PIN if previously set
    IF v_calling_user.pin_hash IS NOT NULL AND v_calling_user.pin_hash <> '' THEN
        IF v_calling_user.pin_hash <> extensions.crypt(v_clean_old, v_calling_user.pin_hash) THEN
            RAISE EXCEPTION 'Current PIN is incorrect';
        END IF;
    END IF;

    -- Update to new secret PIN and clear must_change_pin flag
    UPDATE public.users
    SET
        pin_hash = extensions.crypt(v_clean_new, extensions.gen_salt('bf', 10)),
        must_change_pin = false
    WHERE id = v_calling_user.id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_calling_user.id,
        'must_change_pin', false
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_self_pin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_self_pin(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.change_self_pin(text, text) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 7. RPC: get_organization_volunteers (Admin Scoped Roster Query)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_organization_volunteers(
    p_organization_id uuid
)
RETURNS TABLE (
    volunteer_id uuid,
    user_id uuid,
    full_name text,
    mobile text,
    status text,
    must_change_pin boolean,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    IF NOT public.is_organization_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of this organization';
    END IF;

    RETURN QUERY
    SELECT
        v.id AS volunteer_id,
        u.id AS user_id,
        u.name AS full_name,
        u.mobile AS mobile,
        v.status AS status,
        COALESCE(u.must_change_pin, false) AS must_change_pin,
        v.created_at AS created_at
    FROM public.volunteers v
    JOIN public.users u ON u.id = v.user_id
    WHERE v.organization_id = p_organization_id
    ORDER BY u.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_volunteers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_volunteers(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_organization_volunteers(uuid) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 8. RPC: quick_add_flat (Volunteer Corridor Quick Add)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quick_add_flat(
    p_building_id uuid,
    p_unit_number text,
    p_floor_number integer DEFAULT NULL,
    p_owner_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_building RECORD;
    v_clean_unit text;
    v_existing_prop_id uuid;
    v_new_prop_id uuid;
    v_calling_user_id uuid;
    v_calling_vol_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_building_id IS NULL THEN
        RAISE EXCEPTION 'Building ID is required';
    END IF;

    v_clean_unit := TRIM(COALESCE(p_unit_number, ''));
    IF v_clean_unit = '' THEN
        RAISE EXCEPTION 'Unit number is required';
    END IF;

    -- Lookup target building and its organization
    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = p_building_id;

    IF v_building.id IS NULL THEN
        RAISE EXCEPTION 'Building not found';
    END IF;

    -- Verify caller is active volunteer in building's organization
    SELECT u.id, v.id INTO v_calling_user_id, v_calling_vol_id
    FROM public.volunteers v
    JOIN public.users u ON u.id = v.user_id
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active = true
      AND v.organization_id = v_building.organization_id
      AND v.status = 'active'
    LIMIT 1;

    IF v_calling_user_id IS NULL OR v_calling_vol_id IS NULL THEN
        RAISE EXCEPTION 'Active volunteer profile not found for this organization';
    END IF;

    -- Check if property already exists
    SELECT id INTO v_existing_prop_id
    FROM public.properties
    WHERE organization_id = v_building.organization_id
      AND building_id = p_building_id
      AND (unit_number = v_clean_unit OR flat_number = v_clean_unit)
    LIMIT 1;

    IF v_existing_prop_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'property_id', v_existing_prop_id,
            'is_existing', true,
            'unit_number', v_clean_unit
        );
    END IF;

    INSERT INTO public.properties (
        organization_id,
        building_id,
        unit_number,
        flat_number,
        property_type,
        floor_number,
        owner_name,
        is_active,
        created_at
    )
    VALUES (
        v_building.organization_id,
        p_building_id,
        v_clean_unit,
        v_clean_unit,
        'residential',
        p_floor_number,
        NULLIF(TRIM(p_owner_name), ''),
        true,
        NOW()
    )
    RETURNING id INTO v_new_prop_id;

    RETURN jsonb_build_object(
        'success', true,
        'property_id', v_new_prop_id,
        'is_existing', false,
        'unit_number', v_clean_unit
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quick_add_flat(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quick_add_flat(uuid, text, integer, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.quick_add_flat(uuid, text, integer, text) FROM PUBLIC, anon;
