-- ==============================================================================
-- Migration: 20260829000007_phase9_3b_buildings_area.sql
-- Phase 9-3B: Ensure area_name column exists on buildings table
-- ==============================================================================

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS area_name text DEFAULT NULL;
