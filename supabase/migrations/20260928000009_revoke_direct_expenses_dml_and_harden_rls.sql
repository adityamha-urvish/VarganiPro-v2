-- ==============================================================================
-- Migration: 20260928000009_revoke_direct_expenses_dml_and_harden_rls.sql
-- Production Security Hardening: Revoke direct PostgREST DML on public.expenses
-- and enforce event-organization integrity in RLS insert policy.
--
-- 1. Operational Security Pattern (Phase 8 parity):
--    Revoke direct INSERT, UPDATE, DELETE on public.expenses from PUBLIC, anon,
--    and authenticated roles to force all mutations through SECURITY DEFINER RPCs
--    (public.create_expense, public.update_expense).
-- 2. Preserve service_role full DML and authenticated SELECT.
-- 3. Defense-in-depth RLS hardening:
--    expenses_insert_policy enforces that expenses.event_id and expenses.organization_id
--    belong to the same event row, and non-admin volunteers can only insert against
--    events where is_active = true.
-- 4. Defense-in-depth update & delete RLS policies restricted to organization admins.
-- ==============================================================================

-- 1. Revoke Direct Table-Level DML on Operational Table public.expenses
REVOKE INSERT, UPDATE, DELETE
ON TABLE public.expenses
FROM PUBLIC, anon, authenticated;

-- 2. Grant explicit SELECT to authenticated and ALL to service_role
GRANT SELECT ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;

-- 3. Defense-in-Depth: Hardened RLS Policies on public.expenses
DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
CREATE POLICY "expenses_insert_policy" ON public.expenses
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = expenses.event_id
              AND e.organization_id = expenses.organization_id
              AND (
                  public.is_organization_admin(expenses.organization_id)
                  OR (
                      e.is_active = true
                      AND EXISTS (
                          SELECT 1 FROM public.volunteers v
                          JOIN public.users u ON (u.auth_user_id = auth.uid() OR u.id = auth.uid())
                          WHERE u.is_active = true
                            AND v.user_id = u.id
                            AND v.organization_id = expenses.organization_id
                            AND v.status = 'active'
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
CREATE POLICY "expenses_update_policy" ON public.expenses
    FOR UPDATE
    TO authenticated
    USING (
        public.is_organization_admin(organization_id)
    )
    WITH CHECK (
        public.is_organization_admin(organization_id)
    );

DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;
CREATE POLICY "expenses_delete_policy" ON public.expenses
    FOR DELETE
    TO authenticated
    USING (
        public.is_organization_admin(organization_id)
    );
