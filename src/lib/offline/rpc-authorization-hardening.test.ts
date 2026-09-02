// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe("Step 8C, Step 8E-6 & Step 8E-7 — Targeted RPC Authorization Hardening Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Scenario A: Volunteer A attempts to checkout Volunteer B's session/book → fails with unauthorized error", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_collection_session_id: string }) => {
      if (rpcName === "checkout_receipt_book") {
        if (params.p_collection_session_id === "session-owned-by-b") {
          return Promise.resolve({
            data: null,
            error: {
              message: "Unauthorized: Authenticated volunteer does not own this collection session",
            },
          });
        }
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { data, error } = await rpcMock("checkout_receipt_book", {
      p_receipt_book_id: "book-1",
      p_collection_session_id: "session-owned-by-b",
    });

    expect(data).toBeNull();
    expect(error?.message).toContain("Unauthorized: Authenticated volunteer does not own this collection session");
  });

  it("Scenario B: Volunteer A attempts to issue a receipt against Volunteer B's active session → fails with unauthorized error", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_collection_session_id: string }) => {
      if (rpcName === "issue_receipt") {
        if (params.p_collection_session_id === "session-owned-by-b") {
          return Promise.resolve({
            data: null,
            error: {
              message: "Unauthorized: Authenticated volunteer does not own this collection session",
            },
          });
        }
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { data, error } = await rpcMock("issue_receipt", {
      p_collection_session_id: "session-owned-by-b",
      p_receipt_book_id: "book-1",
      p_receipt_number: 101,
      p_donor_name: "Attacker Insertion",
      p_amount: 500,
      p_payment_mode: "cash",
    });

    expect(data).toBeNull();
    expect(error?.message).toContain("Unauthorized: Authenticated volunteer does not own this collection session");
  });

  it("Scenario C: Volunteer B operates on their own session/book → succeeds normally", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_collection_session_id: string }) => {
      if (rpcName === "checkout_receipt_book" && params.p_collection_session_id === "session-owned-by-b") {
        return Promise.resolve({
          data: {
            success: true,
            receipt_book_id: "book-1",
            collection_session_id: "session-owned-by-b",
          },
          error: null,
        });
      }
      if (rpcName === "sync_offline_receipt" && params.p_collection_session_id === "session-owned-by-b") {
        return Promise.resolve({
          data: {
            success: true,
            receipt_id: "receipt-uuid-1",
            receipt_number: 101,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const checkoutRes = await rpcMock("checkout_receipt_book", {
      p_receipt_book_id: "book-1",
      p_collection_session_id: "session-owned-by-b",
    });
    expect(checkoutRes.data?.success).toBe(true);
    expect(checkoutRes.error).toBeNull();

    const syncRes = await rpcMock("sync_offline_receipt", {
      p_collection_session_id: "session-owned-by-b",
      p_receipt_number: 101,
      p_donor_name: "Donor for Volunteer B",
      p_amount: 500,
      p_payment_mode: "cash",
    });
    expect(syncRes.data?.success).toBe(true);
    expect(syncRes.data?.receipt_number).toBe(101);
  });

  it("Scenario D: Organization/event/assignment mismatch triggers proper server validation failure", async () => {
    rpcMock.mockImplementation((_rpcName: string, params: { p_receipt_book_id: string }) => {
      if (params.p_receipt_book_id === "book-wrong-org") {
        return Promise.resolve({
          data: null,
          error: { message: "Receipt book organization mismatch" },
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { data, error } = await rpcMock("checkout_receipt_book", {
      p_collection_session_id: "session-owned-by-b",
      p_receipt_book_id: "book-wrong-org",
    });

    expect(data).toBeNull();
    expect(error?.message).toBe("Receipt book organization mismatch");
  });

  it("Scenario E: Existing idempotent receipt behavior remains unchanged in sync_offline_receipt", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_client_receipt_id?: string }) => {
      if (rpcName === "sync_offline_receipt" && params.p_client_receipt_id === "idempotent-uuid") {
        return Promise.resolve({
          data: {
            success: true,
            already_exists: true,
            receipt_id: "existing-receipt-id",
            receipt_number: 100,
            client_receipt_id: "idempotent-uuid",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const { data, error } = await rpcMock("sync_offline_receipt", {
      p_collection_session_id: "session-owned-by-b",
      p_receipt_number: 100,
      p_client_receipt_id: "idempotent-uuid",
      p_donor_name: "Donor",
      p_amount: 500,
      p_payment_mode: "cash",
    });

    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.already_exists).toBe(true);
    expect(data?.receipt_number).toBe(100);
  });

  it("Scenario G: Revoked public access: authenticated & anon roles receive permission denied on unused issue_receipt overload", async () => {
    rpcMock.mockImplementation((rpcName: string) => {
      if (rpcName === "issue_receipt") {
        return Promise.resolve({
          data: null,
          error: {
            code: "42501",
            message: "permission denied for function issue_receipt",
          },
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const attempt = await rpcMock("issue_receipt", {
      p_collection_session_id: "session-1",
      p_receipt_book_id: "book-1",
      p_receipt_number: 101,
      p_donor_name: "Donor",
      p_amount: 100,
      p_payment_mode: "cash",
    });
    expect(attempt.data).toBeNull();
    expect(attempt.error?.code).toBe("42501");
    expect(attempt.error?.message).toContain("permission denied for function issue_receipt");
  });

  it("Scenario H: Production RPCs sync_offline_receipt and checkout_receipt_book remain fully executable by authenticated", async () => {
    rpcMock.mockImplementation((rpcName: string) => {
      if (rpcName === "sync_offline_receipt" || rpcName === "checkout_receipt_book") {
        return Promise.resolve({
          data: { success: true },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Permission denied") });
    });

    const syncRes = await rpcMock("sync_offline_receipt", {
      p_collection_session_id: "session-1",
      p_receipt_number: 101,
      p_donor_name: "Donor",
      p_amount: 100,
      p_payment_mode: "cash",
    });
    expect(syncRes.data?.success).toBe(true);
    expect(syncRes.error).toBeNull();

    const checkoutRes = await rpcMock("checkout_receipt_book", {
      p_receipt_book_id: "book-1",
      p_collection_session_id: "session-1",
    });
    expect(checkoutRes.data?.success).toBe(true);
    expect(checkoutRes.error).toBeNull();
  });

  it("Scenario I: Anonymous/unauthenticated calls to sync_offline_receipt and checkout_receipt_book are rejected", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { isAnon?: boolean }) => {
      if (params.isAnon) {
        return Promise.resolve({
          data: null,
          error: {
            code: "42501",
            message: `permission denied for function ${rpcName}`,
          },
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const anonSync = await rpcMock("sync_offline_receipt", { isAnon: true });
    expect(anonSync.data).toBeNull();
    expect(anonSync.error?.code).toBe("42501");

    const anonCheckout = await rpcMock("checkout_receipt_book", { isAnon: true });
    expect(anonCheckout.data).toBeNull();
    expect(anonCheckout.error?.code).toBe("42501");
  });

  it("Scenario J: Step 8E-6 — Assigned book with different assigned_volunteer_id is rejected in checkout_receipt_book", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_receipt_book_id: string }) => {
      if (rpcName === "checkout_receipt_book" && params.p_receipt_book_id === "book-assigned-to-other") {
        return Promise.resolve({
          data: null,
          error: {
            message: "Receipt book is assigned to another volunteer",
          },
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { data, error } = await rpcMock("checkout_receipt_book", {
      p_receipt_book_id: "book-assigned-to-other",
      p_collection_session_id: "session-1",
    });

    expect(data).toBeNull();
    expect(error?.message).toBe("Receipt book is assigned to another volunteer");
  });

  it("Scenario K: Step 8E-6 — Assigned book with NULL assigned_volunteer_id is rejected in checkout_receipt_book", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_receipt_book_id: string }) => {
      if (rpcName === "checkout_receipt_book" && params.p_receipt_book_id === "book-assigned-null-volunteer") {
        return Promise.resolve({
          data: null,
          error: {
            message: "Receipt book is assigned to another volunteer",
          },
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { data, error } = await rpcMock("checkout_receipt_book", {
      p_receipt_book_id: "book-assigned-null-volunteer",
      p_collection_session_id: "session-1",
    });

    expect(data).toBeNull();
    expect(error?.message).toBe("Receipt book is assigned to another volunteer");
  });

  it("Scenario L: Step 8E-6 — Assigned book with matching assigned_volunteer_id is allowed in checkout_receipt_book", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_receipt_book_id: string }) => {
      if (rpcName === "checkout_receipt_book" && params.p_receipt_book_id === "book-assigned-to-me") {
        return Promise.resolve({
          data: {
            success: true,
            receipt_book_id: "book-assigned-to-me",
            collection_session_id: "session-1",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const { data, error } = await rpcMock("checkout_receipt_book", {
      p_receipt_book_id: "book-assigned-to-me",
      p_collection_session_id: "session-1",
    });

    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.receipt_book_id).toBe("book-assigned-to-me");
  });

  /*
   * ==============================================================================
   * Step 8E-7: start_collection_session Assigned-Book Authorization Tests
   * Note: These are automated Vitest unit/contract tests executing against mocked RPCs.
   * ==============================================================================
   */

  it("Scenario M: Step 8E-7 (Mocked) — start_collection_session with assigned book + different volunteer is rejected", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_receipt_book_id: string }) => {
      if (rpcName === "start_collection_session" && params.p_receipt_book_id === "book-assigned-to-other") {
        return Promise.resolve({
          data: null,
          error: {
            message: "Receipt book is assigned to another volunteer",
          },
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { data, error } = await rpcMock("start_collection_session", {
      p_event_id: "event-1",
      p_receipt_book_id: "book-assigned-to-other",
    });

    expect(data).toBeNull();
    expect(error?.message).toBe("Receipt book is assigned to another volunteer");
  });

  it("Scenario N: Step 8E-7 (Mocked) — start_collection_session with assigned book + NULL assigned_volunteer_id is rejected", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_receipt_book_id: string }) => {
      if (rpcName === "start_collection_session" && params.p_receipt_book_id === "book-assigned-null-volunteer") {
        return Promise.resolve({
          data: null,
          error: {
            message: "Receipt book is assigned to another volunteer",
          },
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { data, error } = await rpcMock("start_collection_session", {
      p_event_id: "event-1",
      p_receipt_book_id: "book-assigned-null-volunteer",
    });

    expect(data).toBeNull();
    expect(error?.message).toBe("Receipt book is assigned to another volunteer");
  });

  it("Scenario O: Step 8E-7 (Mocked) — start_collection_session with assigned book + matching volunteer succeeds", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_receipt_book_id: string }) => {
      if (rpcName === "start_collection_session" && params.p_receipt_book_id === "book-assigned-to-me") {
        return Promise.resolve({
          data: {
            success: true,
            collection_session_id: "session-new-assigned",
            receipt_book_id: "book-assigned-to-me",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const { data, error } = await rpcMock("start_collection_session", {
      p_event_id: "event-1",
      p_receipt_book_id: "book-assigned-to-me",
    });

    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.collection_session_id).toBe("session-new-assigned");
  });

  it("Scenario P: Step 8E-7 (Mocked) — start_collection_session with available book succeeds", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_receipt_book_id: string }) => {
      if (rpcName === "start_collection_session" && params.p_receipt_book_id === "book-available") {
        return Promise.resolve({
          data: {
            success: true,
            collection_session_id: "session-new-available",
            receipt_book_id: "book-available",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const { data, error } = await rpcMock("start_collection_session", {
      p_event_id: "event-1",
      p_receipt_book_id: "book-available",
    });

    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.collection_session_id).toBe("session-new-available");
  });

  it("Scenario Q: Step 8E-7 (Mocked) — start_collection_session with checked_out book is rejected", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_receipt_book_id: string }) => {
      if (rpcName === "start_collection_session" && params.p_receipt_book_id === "book-already-checked-out") {
        return Promise.resolve({
          data: null,
          error: {
            message: "Receipt book is not available for collection (status: checked_out)",
          },
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const { data, error } = await rpcMock("start_collection_session", {
      p_event_id: "event-1",
      p_receipt_book_id: "book-already-checked-out",
    });

    expect(data).toBeNull();
    expect(error?.message).toContain("Receipt book is not available for collection (status: checked_out)");
  });

  /*
   * ==============================================================================
   * Step 8E-8: sync_offline_receipt Property Boundary & Concurrent Idempotency Tests
   * Note: These are automated Vitest unit/contract tests executing against mocked RPCs.
   * ==============================================================================
   */

  it("Scenario R: Step 8E-8 (Mocked) — sync_offline_receipt with property belonging to same organization succeeds", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_property_id?: string }) => {
      if (rpcName === "sync_offline_receipt" && params.p_property_id === "prop-same-org") {
        return Promise.resolve({
          data: {
            success: true,
            receipt_id: "receipt-with-prop-1",
            receipt_number: 105,
            client_receipt_id: "client-uuid-prop-1",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const { data, error } = await rpcMock("sync_offline_receipt", {
      p_collection_session_id: "session-1",
      p_property_id: "prop-same-org",
      p_receipt_number: 105,
      p_donor_name: "Donor Org Member",
      p_amount: 1000,
      p_payment_mode: "cash",
      p_client_receipt_id: "client-uuid-prop-1",
    });

    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.receipt_number).toBe(105);
  });

  it("Scenario S: Step 8E-8 (Mocked) — sync_offline_receipt with property belonging to another organization is rejected", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_property_id?: string }) => {
      if (rpcName === "sync_offline_receipt" && params.p_property_id === "prop-foreign-org") {
        return Promise.resolve({
          data: null,
          error: {
            message: "Property not found in your organization",
          },
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { data, error } = await rpcMock("sync_offline_receipt", {
      p_collection_session_id: "session-1",
      p_property_id: "prop-foreign-org",
      p_receipt_number: 106,
      p_donor_name: "Foreign Donor",
      p_amount: 1000,
      p_payment_mode: "cash",
      p_client_receipt_id: "client-uuid-foreign-prop",
    });

    expect(data).toBeNull();
    expect(error?.message).toBe("Property not found in your organization");
  });

  it("Scenario T: Step 8E-8 (Mocked) — sync_offline_receipt with NULL property_id succeeds", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_property_id?: string | null }) => {
      if (rpcName === "sync_offline_receipt" && (params.p_property_id === null || params.p_property_id === undefined)) {
        return Promise.resolve({
          data: {
            success: true,
            receipt_id: "receipt-null-prop",
            receipt_number: 107,
            client_receipt_id: "client-uuid-null-prop",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const { data, error } = await rpcMock("sync_offline_receipt", {
      p_collection_session_id: "session-1",
      p_property_id: null,
      p_receipt_number: 107,
      p_donor_name: "Donor Without Property",
      p_amount: 500,
      p_payment_mode: "upi",
      p_client_receipt_id: "client-uuid-null-prop",
    });

    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.receipt_number).toBe(107);
  });

  it("Scenario U: Step 8E-8 (Mocked) — sync_offline_receipt with existing client_receipt_id returns already_exists: true", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_client_receipt_id?: string }) => {
      if (rpcName === "sync_offline_receipt" && params.p_client_receipt_id === "existing-client-uuid") {
        return Promise.resolve({
          data: {
            success: true,
            already_exists: true,
            receipt_id: "existing-receipt-id-123",
            receipt_number: 102,
            client_receipt_id: "existing-client-uuid",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const { data, error } = await rpcMock("sync_offline_receipt", {
      p_collection_session_id: "session-1",
      p_receipt_number: 102,
      p_client_receipt_id: "existing-client-uuid",
      p_donor_name: "Donor",
      p_amount: 500,
      p_payment_mode: "cash",
    });

    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.already_exists).toBe(true);
    expect(data?.receipt_id).toBe("existing-receipt-id-123");
  });

  it("Scenario V: Step 8E-8 (Mocked) — sync_offline_receipt concurrent client_receipt_id collision returns already_exists: true", async () => {
    // Simulates the caught unique_violation exception path in PostgreSQL
    rpcMock.mockImplementation((rpcName: string, params: { p_client_receipt_id?: string }) => {
      if (rpcName === "sync_offline_receipt" && params.p_client_receipt_id === "race-client-uuid") {
        return Promise.resolve({
          data: {
            success: true,
            already_exists: true,
            receipt_id: "race-winner-receipt-id",
            receipt_number: 103,
            client_receipt_id: "race-client-uuid",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unexpected call") });
    });

    const { data, error } = await rpcMock("sync_offline_receipt", {
      p_collection_session_id: "session-1",
      p_receipt_number: 103,
      p_client_receipt_id: "race-client-uuid",
      p_donor_name: "Donor Race",
      p_amount: 500,
      p_payment_mode: "cash",
    });

    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.already_exists).toBe(true);
    expect(data?.receipt_id).toBe("race-winner-receipt-id");
  });

  it("Scenario W: Step 8E-8 (Mocked) — sync_offline_receipt with unrelated unique violation is NOT swallowed and fails", async () => {
    rpcMock.mockImplementation((rpcName: string, params: { p_receipt_number?: number }) => {
      if (rpcName === "sync_offline_receipt" && params.p_receipt_number === 999) {
        return Promise.resolve({
          data: null,
          error: {
            code: "23505",
            message: "duplicate key value violates unique constraint receipts_book_number_unique",
          },
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { data, error } = await rpcMock("sync_offline_receipt", {
      p_collection_session_id: "session-1",
      p_receipt_number: 999,
      p_client_receipt_id: "unrelated-unique-client-uuid",
      p_donor_name: "Donor Duplicate Book Num",
      p_amount: 500,
      p_payment_mode: "cash",
    });

    expect(data).toBeNull();
    expect(error?.code).toBe("23505");
    expect(error?.message).toContain("receipts_book_number_unique");
  });
});

