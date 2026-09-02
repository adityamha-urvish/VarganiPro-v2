-- ==============================================================================
-- Migration: 20260829000010_phase9_3b_drop_building_area_check.sql
-- Phase 9-3B: Drop any trigger raising Building and Area check
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT t.tgname, c.relname, n.nspname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE p.prosrc ILIKE '%Building and Area%'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I CASCADE;', r.tgname, r.nspname, r.relname);
    END LOOP;
END $$;
