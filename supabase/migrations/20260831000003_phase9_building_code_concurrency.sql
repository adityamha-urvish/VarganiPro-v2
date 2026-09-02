-- ==============================================================================
-- Migration: 20260831000003_phase9_building_code_concurrency.sql
-- Phase 9: Concurrency-Safe Building Code Generation Retry Loop for create_building RPC
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_building(
    p_organization_id uuid,
    p_name text,
    p_code text DEFAULT NULL,
    p_area_name text DEFAULT NULL,
    p_wing text DEFAULT NULL,
    p_total_floors integer DEFAULT NULL,
    p_flats_per_floor integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_building_id uuid;
    v_code text;
    v_slug text;
    v_seq integer;
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    -- Deterministic admin verification for target organization
    IF NOT public.is_organization_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only organization administrators can create buildings';
    END IF;

    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Building name is required';
    END IF;

    -- 1. Database-Authoritative Initial Code Generation
    IF p_code IS NOT NULL AND TRIM(p_code) <> '' THEN
        v_code := TRIM(p_code);
    ELSE
        -- Base slug from Latin alphanumeric characters of building name, or 'BLD' for Unicode/Marathi names
        v_slug := UPPER(SUBSTRING(REGEXP_REPLACE(TRIM(p_name), '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 6));
        IF v_slug IS NULL OR v_slug = '' THEN
            v_slug := 'BLD';
        END IF;

        -- Deterministic sequence counter per organization
        SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
        FROM public.buildings
        WHERE organization_id = p_organization_id;

        v_code := 'BLD-' || v_slug || '-' || v_seq::text;

        -- Uniqueness collision-avoidance check against existing committed rows
        WHILE EXISTS (
            SELECT 1 FROM public.buildings
            WHERE organization_id = p_organization_id AND code = v_code
        ) LOOP
            v_seq := v_seq + 1;
            v_code := 'BLD-' || v_slug || '-' || v_seq::text || '-' || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4);
        END LOOP;
    END IF;

    -- 2. Concurrency-Safe Insert Loop (Handles Simultaneous Concurrent Creation Races)
    LOOP
        BEGIN
            INSERT INTO public.buildings (
                organization_id,
                name,
                code,
                area_name,
                wing,
                total_floors,
                flats_per_floor,
                created_at
            )
            VALUES (
                p_organization_id,
                TRIM(p_name),
                v_code,
                NULLIF(TRIM(p_area_name), ''),
                NULLIF(TRIM(p_wing), ''),
                p_total_floors,
                p_flats_per_floor,
                NOW()
            )
            RETURNING id INTO v_new_building_id;

            -- Successful insertion: break loop
            EXIT;
        EXCEPTION
            WHEN unique_violation THEN
                -- If caller explicitly supplied a duplicate code, bubble up standard error
                IF p_code IS NOT NULL AND TRIM(p_code) <> '' THEN
                    RAISE;
                END IF;

                -- If code was auto-generated, resolve concurrency race by generating unique suffix and retrying
                v_code := 'BLD-' || v_slug || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::text, 4, '0') || '-' || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4);
        END;
    END LOOP;

    v_result := jsonb_build_object(
        'success', true,
        'building_id', v_new_building_id,
        'organization_id', p_organization_id,
        'name', TRIM(p_name),
        'code', v_code
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_building(uuid, text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_building(uuid, text, text, text, text, integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_building(uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon;
