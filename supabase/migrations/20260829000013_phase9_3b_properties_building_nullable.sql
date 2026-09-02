-- ==============================================================================
-- Migration: 20260829000013_phase9_3b_properties_building_nullable.sql
-- Phase 9-3B: Make building_id nullable on properties table for standalone commercial shops
-- ==============================================================================

ALTER TABLE public.properties
  ALTER COLUMN building_id DROP NOT NULL;
