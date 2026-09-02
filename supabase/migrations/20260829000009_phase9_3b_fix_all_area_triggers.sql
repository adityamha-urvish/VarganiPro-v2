-- ==============================================================================
-- Migration: 20260829000009_phase9_3b_fix_all_area_triggers.sql
-- Phase 9-3B: Fix any trigger/function checking building area
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tgname, relname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'buildings'
          AND NOT tgisinternal
    ) LOOP
        RAISE NOTICE 'Trigger on buildings: %', r.tgname;
    END LOOP;
END $$;

-- Drop obsolete area triggers on buildings if they enforce area_id
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN (
        SELECT tgname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'buildings'
          AND tgname ILIKE '%area%'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.buildings;', t_name);
    END LOOP;
END $$;
