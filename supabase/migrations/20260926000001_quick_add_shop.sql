-- ==============================================================================
-- Migration: 20260926000001_quick_add_shop.sql
-- Volunteer-safe Commercial Shop Creation RPC with Organization/Event Authorization
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.quick_add_shop(
    p_organization_id uuid,
    p_shop_name text,
    p_owner_name text DEFAULT NULL,
    p_contact_mobile text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_shop text;
    v_clean_owner text;
    v_clean_mobile text;
    v_existing_prop RECORD;
    v_new_prop_id uuid;
    v_is_admin boolean;
    v_is_volunteer boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    v_clean_shop := TRIM(COALESCE(p_shop_name, ''));
    IF v_clean_shop = '' THEN
        RAISE EXCEPTION 'Shop name is required';
    END IF;

    v_clean_owner := NULLIF(TRIM(COALESCE(p_owner_name, '')), '');
    v_clean_mobile := NULLIF(TRIM(COALESCE(p_contact_mobile, '')), '');

    -- Authorization check: Organization Admin OR Active Volunteer in Organization
    v_is_admin := public.is_organization_admin(p_organization_id);

    SELECT EXISTS (
        SELECT 1
        FROM public.volunteers v
        JOIN public.users u ON u.id = v.user_id
        WHERE u.auth_user_id = auth.uid()
          AND u.is_active = true
          AND v.organization_id = p_organization_id
          AND v.status = 'active'
    ) INTO v_is_volunteer;

    IF NOT v_is_admin AND NOT v_is_volunteer THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer in this organization';
    END IF;

    -- Check if commercial shop already exists in this organization
    SELECT id, owner_name, contact_mobile INTO v_existing_prop
    FROM public.properties
    WHERE organization_id = p_organization_id
      AND property_type = 'commercial'
      AND LOWER(TRIM(COALESCE(shop_name, ''))) = LOWER(v_clean_shop)
    LIMIT 1;

    IF v_existing_prop.id IS NOT NULL THEN
        IF (v_clean_owner IS NOT NULL AND v_existing_prop.owner_name IS NULL)
           OR (v_clean_mobile IS NOT NULL AND v_existing_prop.contact_mobile IS NULL) THEN
            UPDATE public.properties
            SET owner_name = COALESCE(v_existing_prop.owner_name, v_clean_owner),
                contact_mobile = COALESCE(v_existing_prop.contact_mobile, v_clean_mobile)
            WHERE id = v_existing_prop.id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'property_id', v_existing_prop.id,
            'is_existing', true,
            'shop_name', v_clean_shop
        );
    END IF;

    INSERT INTO public.properties (
        organization_id,
        building_id,
        property_number,
        unit_number,
        flat_number,
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
        v_clean_owner,
        v_clean_mobile,
        true,
        NOW()
    )
    RETURNING id INTO v_new_prop_id;

    RETURN jsonb_build_object(
        'success', true,
        'property_id', v_new_prop_id,
        'is_existing', false,
        'shop_name', v_clean_shop
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quick_add_shop(uuid, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.quick_add_shop(uuid, text, text, text) FROM PUBLIC, anon;
