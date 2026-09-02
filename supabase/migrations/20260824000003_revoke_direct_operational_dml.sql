-- Step 8D-4: Revoke Direct Table-Level DML on Operational Tables
-- Prevents authenticated and anon clients from bypassing SECURITY DEFINER RPCs
-- via direct PostgREST INSERT, UPDATE, or DELETE operations.
-- SELECT privileges and existing RLS policies remain in place.

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.collection_sessions
FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.collection_handovers
FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.receipts
FROM PUBLIC, anon, authenticated;
