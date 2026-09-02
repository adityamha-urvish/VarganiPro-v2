-- ==============================================================================
-- Migration: 20260829000008_phase9_3b_safe_building_trigger.sql
-- Phase 9-3B: Safe NULL handling in validate_building_area trigger function
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.validate_building_area()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only validate area ownership if area_id is explicitly provided
  IF NEW.area_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.areas
      WHERE id = NEW.area_id
        AND organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Building and Area must belong to the same organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
