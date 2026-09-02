-- Step 8C: PUBLIC Privilege Hardening & Explicit Role Grants
-- 1. Revoke default PUBLIC, anon, and authenticated execution on the unused receipt-number issue_receipt overload
REVOKE EXECUTE ON FUNCTION public.issue_receipt(
  UUID, UUID, INTEGER, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

-- 2. Revoke PUBLIC and anon execution on sync_offline_receipt
REVOKE EXECUTE ON FUNCTION public.sync_offline_receipt(
  UUID, UUID, INTEGER, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ
) FROM PUBLIC, anon;

-- 3. Explicitly grant EXECUTE on sync_offline_receipt to authenticated role
GRANT EXECUTE ON FUNCTION public.sync_offline_receipt(
  UUID, UUID, INTEGER, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ
) TO authenticated;

-- 4. Ensure checkout_receipt_book has PUBLIC and anon revoked, and authenticated explicitly granted
REVOKE EXECUTE ON FUNCTION public.checkout_receipt_book(
  UUID, UUID
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.checkout_receipt_book(
  UUID, UUID
) TO authenticated;
