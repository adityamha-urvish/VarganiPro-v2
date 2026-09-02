-- ==============================================================================
-- Migration: 20260829000011_phase9_3b_buildings_area_nullable.sql
-- Phase 9-3B: Make area_id nullable on buildings table
-- ==============================================================================

ALTER TABLE public.buildings
  ALTER COLUMN area_id DROP NOT NULL;
