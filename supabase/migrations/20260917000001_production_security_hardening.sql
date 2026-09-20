-- ==============================================================================
-- Migration: 20260917000001_production_security_hardening.sql
-- Production Security Hardening Gate 2
-- 1. Explicit deny policy on private.login_attempts
-- 2. Harden public.set_updated_at search_path & revoke direct execute
-- 3. Revoke direct execute on internal database trigger functions
-- 4. Drop unused test and debug helper functions
-- 5. Revoke anon/PUBLIC execute from authenticated & admin RPCs
-- 6. Preserve and reaffirm explicit execute for anonymous endpoints
-- ==============================================================================

-- ==============================================================================
-- 1. private.login_attempts: Explicit Deny Policy
-- ==============================================================================
DROP POLICY IF EXISTS "Deny all client access to login attempts" ON private.login_attempts;
CREATE POLICY "Deny all client access to login attempts"
ON private.login_attempts
FOR ALL
TO public
USING (false);

-- ==============================================================================
-- 2. public.set_updated_at: Harden Search Path & Revoke Direct Execution
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- ==============================================================================
-- 3. Trigger Functions: Revoke Direct Execution
-- ==============================================================================
REVOKE ALL ON FUNCTION public.validate_building_area() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_business_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_collection_session_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_receipt_book_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_receipt_relationships() FROM PUBLIC, anon, authenticated;

-- ==============================================================================
-- 4. Drop Unused Test & Debug Functions
-- ==============================================================================
DROP FUNCTION IF EXISTS public.test_mark_receipt_voided(uuid, text);
DROP FUNCTION IF EXISTS public.test_complete_session_and_create_handover(uuid);
DROP FUNCTION IF EXISTS public.test_create_pending_handover(uuid);
DROP FUNCTION IF EXISTS public.inspect_table_constraints(text);

-- ==============================================================================
-- 5. Authenticated & Admin RPC Permissions
-- ==============================================================================

-- A. Revoke from PUBLIC and anon
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_organization_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_self_pin(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.checkout_receipt_book(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_collection_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_offline_receipt(uuid, uuid, integer, text, text, numeric, text, text, text, uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_collection_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_collection_handover(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_collection_handover(uuid, numeric, numeric, numeric, numeric, text, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_collection_follow_up(uuid, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quick_add_flat(uuid, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_building(uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_property(uuid, text, uuid, text, text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_receipt_book(uuid, uuid, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_organization_receipt_books(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provision_volunteer(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_volunteer_pin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_volunteer_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_organization_volunteers(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_secretary_overview_metrics(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_volunteer_financial_ledger(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_organization_receipts(uuid, text, text, text, uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_campaign_export_data(uuid, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_event_building_summaries(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_building_properties_progress(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_collection_handover(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_collection_handover(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_receipt(uuid, text) FROM PUBLIC, anon;

-- B. Explicitly grant to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_organization_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_self_pin(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checkout_receipt_book(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_collection_session(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_offline_receipt(uuid, uuid, integer, text, text, numeric, text, text, text, uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_collection_session(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_collection_handover(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_collection_handover(uuid, numeric, numeric, numeric, numeric, text, numeric, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_collection_follow_up(uuid, uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.quick_add_flat(uuid, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_building(uuid, text, text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_property(uuid, text, uuid, text, text, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_receipt_book(uuid, uuid, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_organization_receipt_books(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provision_volunteer(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_volunteer_pin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_volunteer_status(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_organization_volunteers(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_secretary_overview_metrics(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_volunteer_financial_ledger(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_organization_receipts(uuid, text, text, text, uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_export_data(uuid, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_building_summaries(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_building_properties_progress(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_collection_handover(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_collection_handover(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.void_receipt(uuid, text) TO authenticated, service_role;

-- ==============================================================================
-- 6. Preserve Anonymous Functions
-- ==============================================================================
GRANT EXECUTE ON FUNCTION public.register_mandal_and_admin(text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.login_rate_limit(text, text, text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.register_mandal_and_admin(text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.login_rate_limit(text, text, text) FROM PUBLIC;
