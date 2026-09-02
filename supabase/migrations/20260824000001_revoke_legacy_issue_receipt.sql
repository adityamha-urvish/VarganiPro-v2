-- Step 8C Final Remediation: Revoke EXECUTE on legacy public.issue_receipt() overloads
-- The production client exclusively uses sync_offline_receipt().
-- Revoking public execution on both exact issue_receipt() overloads closes the bypass vector
-- while preserving the underlying database schema.

REVOKE EXECUTE ON FUNCTION public.issue_receipt(
  UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ
) FROM authenticated, anon;

REVOKE EXECUTE ON FUNCTION public.issue_receipt(
  UUID, UUID, INTEGER, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ
) FROM authenticated, anon;
