-- ==============================================================================
-- Migration: 20260829000012_phase9_3b_property_number.sql
-- Phase 9-3B: Populate property_number in create_property and quick_add_flat
-- ==============================================================================

-- 1. quick_add_flat
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
      AND (unit_number = v_clean_unit OR flat_number = v_clean_unit OR property_number = v_clean_unit)
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
        property_number,
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

-- 2. Update create_property to populate property_number
CREATE OR REPLACE FUNCTION public.create_property(
    p_organization_id uuid,
    p_property_type text,
    p_building_id uuid DEFAULT NULL,
    p_unit_number text DEFAULT NULL,
    p_shop_name text DEFAULT NULL,
    p_owner_name text DEFAULT NULL,
    p_contact_mobile text DEFAULT NULL,
    p_floor_number integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_building RECORD;
    v_new_property_id uuid;
    v_clean_type text;
    v_clean_unit text;
    v_clean_shop text;
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    IF NOT public.is_organization_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only organization administrators can create properties';
    END IF;

    v_clean_type := LOWER(TRIM(COALESCE(p_property_type, 'residential')));
    v_clean_unit := NULLIF(TRIM(p_unit_number), '');
    v_clean_shop := NULLIF(TRIM(p_shop_name), '');

    IF v_clean_type NOT IN ('residential', 'commercial') THEN
        RAISE EXCEPTION 'Invalid property type: %. Must be residential or commercial', p_property_type;
    END IF;

    IF v_clean_type = 'residential' THEN
        IF p_building_id IS NULL THEN
            RAISE EXCEPTION 'Building is required for residential properties';
        END IF;

        IF v_clean_unit IS NULL THEN
            RAISE EXCEPTION 'Unit number is required for residential properties';
        END IF;

        IF v_clean_shop IS NOT NULL THEN
            RAISE EXCEPTION 'Shop name must be null for residential properties';
        END IF;

        SELECT * INTO v_building
        FROM public.buildings
        WHERE id = p_building_id
          AND organization_id = p_organization_id;

        IF v_building.id IS NULL THEN
            RAISE EXCEPTION 'Building not found in the specified organization';
        END IF;

        INSERT INTO public.properties (
            organization_id,
            building_id,
            property_number,
            flat_number,
            unit_number,
            shop_name,
            property_type,
            floor_number,
            owner_name,
            contact_mobile,
            is_active,
            created_at
        )
        VALUES (
            p_organization_id,
            p_building_id,
            v_clean_unit,
            v_clean_unit,
            v_clean_unit,
            NULL,
            'residential',
            p_floor_number,
            NULLIF(TRIM(p_owner_name), ''),
            NULLIF(TRIM(p_contact_mobile), ''),
            true,
            NOW()
        )
        RETURNING id INTO v_new_property_id;

    ELSIF v_clean_type = 'commercial' THEN
        IF p_building_id IS NOT NULL THEN
            RAISE EXCEPTION 'Building must be null for commercial shops';
        END IF;

        IF v_clean_shop IS NULL THEN
            RAISE EXCEPTION 'Shop name is required for commercial shops';
        END IF;

        IF v_clean_unit IS NOT NULL THEN
            RAISE EXCEPTION 'Unit number must be null for commercial shops';
        END IF;

        INSERT INTO public.properties (
            organization_id,
            building_id,
            property_number,
            flat_number,
            unit_number,
            shop_name,
            property_type,
            floor_number,
            owner_name,
            contact_mobile,
            is_active,
            created_at
        )
        VALUES (
            p_organization_id,
            NULL,
            v_clean_shop,
            NULL,
            NULL,
            v_clean_shop,
            'commercial',
            NULL,
            NULLIF(TRIM(p_owner_name), ''),
            NULLIF(TRIM(p_contact_mobile), ''),
            true,
            NOW()
        )
        RETURNING id INTO v_new_property_id;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'property_id', v_new_property_id,
        'organization_id', p_organization_id,
        'property_type', v_clean_type,
        'unit_number', v_clean_unit,
        'shop_name', v_clean_shop
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_property(uuid, text, uuid, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_property(uuid, text, uuid, text, text, text, text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_property(uuid, text, uuid, text, text, text, text, integer) FROM PUBLIC, anon;
