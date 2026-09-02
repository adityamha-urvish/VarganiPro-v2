-- ==============================================================================
-- Migration: 20260829000025_phase9_3c_inspect_constraints.sql
-- Temporary inspector function for constraint definitions
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.inspect_table_constraints(p_table_name text)
RETURNS TABLE (
    constraint_name name,
    constraint_type char,
    definition text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        conname,
        contype,
        pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = p_table_name;
$$;

GRANT EXECUTE ON FUNCTION public.inspect_table_constraints(text) TO authenticated;
