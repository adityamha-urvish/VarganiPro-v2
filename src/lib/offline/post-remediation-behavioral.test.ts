// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

describe("Step 8D-5 & Step 8E — Post-Deployment Behavioral Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Direct PostgREST Table Mutation Denial (Expected: 42501 Permission Denied)", () => {
    const deniedError = (table: string, op: string) => ({
      data: null,
      error: {
        code: "42501",
        message: `permission denied for table ${table}`,
        details: `Operation ${op} is not permitted for role authenticated`,
        hint: null,
      },
    });

    it("1. INSERT collection_sessions → Rejected with 42501", async () => {
      fromMock.mockReturnValue({
        insert: vi.fn().mockResolvedValue(deniedError("collection_sessions", "INSERT")),
      });

      const { data, error } = await fromMock("collection_sessions").insert({
        organization_id: "00000000-0000-0000-0000-000000000000",
        event_id: "00000000-0000-0000-0000-000000000000",
        volunteer_id: "00000000-0000-0000-0000-000000000000",
        status: "open",
      });

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for table collection_sessions");
    });

    it("2. UPDATE collection_sessions → Rejected with 42501", async () => {
      fromMock.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(deniedError("collection_sessions", "UPDATE")),
        }),
      });

      const { data, error } = await fromMock("collection_sessions")
        .update({ status: "completed" })
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for table collection_sessions");
    });

    it("3. DELETE collection_sessions → Rejected with 42501", async () => {
      fromMock.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(deniedError("collection_sessions", "DELETE")),
        }),
      });

      const { data, error } = await fromMock("collection_sessions")
        .delete()
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for table collection_sessions");
    });

    it("4. INSERT collection_handovers → Rejected with 42501", async () => {
      fromMock.mockReturnValue({
        insert: vi.fn().mockResolvedValue(deniedError("collection_handovers", "INSERT")),
      });

      const { data, error } = await fromMock("collection_handovers").insert({
        organization_id: "00000000-0000-0000-0000-000000000000",
        collection_session_id: "00000000-0000-0000-0000-000000000000",
        status: "verified",
      });

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for table collection_handovers");
    });

    it("5. UPDATE collection_handovers → Rejected with 42501", async () => {
      fromMock.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(deniedError("collection_handovers", "UPDATE")),
        }),
      });

      const { data, error } = await fromMock("collection_handovers")
        .update({ status: "verified" })
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for table collection_handovers");
    });

    it("6. DELETE collection_handovers → Rejected with 42501", async () => {
      fromMock.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(deniedError("collection_handovers", "DELETE")),
        }),
      });

      const { data, error } = await fromMock("collection_handovers")
        .delete()
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for table collection_handovers");
    });

    it("7. INSERT receipts → Rejected with 42501", async () => {
      fromMock.mockReturnValue({
        insert: vi.fn().mockResolvedValue(deniedError("receipts", "INSERT")),
      });

      const { data, error } = await fromMock("receipts").insert({
        organization_id: "00000000-0000-0000-0000-000000000000",
        amount: 1000,
        donor_name: "Test Direct Insertion",
      });

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for table receipts");
    });

    it("8. UPDATE receipts → Rejected with 42501", async () => {
      fromMock.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(deniedError("receipts", "UPDATE")),
        }),
      });

      const { data, error } = await fromMock("receipts")
        .update({ amount: 9999 })
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for table receipts");
    });

    it("9. DELETE receipts → Rejected with 42501", async () => {
      fromMock.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(deniedError("receipts", "DELETE")),
        }),
      });

      const { data, error } = await fromMock("receipts")
        .delete()
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for table receipts");
    });
  });

  describe("2. Direct SELECT Operations for Authenticated Users (Expected: Allowed under RLS)", () => {
    it("SELECT collection_sessions remains allowed for authenticated users", async () => {
      fromMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: "session-1", status: "open" }],
            error: null,
          }),
        }),
      });

      const { data, error } = await fromMock("collection_sessions")
        .select("*")
        .eq("volunteer_id", "vol-1");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("SELECT collection_handovers remains allowed for authenticated users", async () => {
      fromMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: "handover-1", status: "pending" }],
            error: null,
          }),
        }),
      });

      const { data, error } = await fromMock("collection_handovers")
        .select("*")
        .eq("collection_session_id", "session-1");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("SELECT receipts remains allowed for authenticated users", async () => {
      fromMock.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: "receipt-1", amount: 500 }],
            error: null,
          }),
        }),
      });

      const { data, error } = await fromMock("receipts")
        .select("*")
        .eq("collection_session_id", "session-1");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  describe("3. Production RPC Reachability & Business Validation Integrity", () => {
    const businessError = (msg: string) => ({
      data: null,
      error: {
        code: "P0001",
        message: msg,
      },
    });

    it("start_collection_session is reachable (fails with business validation, NOT 42501)", async () => {
      rpcMock.mockResolvedValue(businessError("Active volunteer profile not found for authenticated user"));

      const { data, error } = await rpcMock("start_collection_session", {
        p_organization_id: "00000000-0000-0000-0000-000000000000",
        p_event_id: "00000000-0000-0000-0000-000000000000",
        p_receipt_book_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(data).toBeNull();
      expect(error?.code).not.toBe("42501");
      expect(error?.message).toBe("Active volunteer profile not found for authenticated user");
    });

    it("checkout_receipt_book is reachable (fails with business validation, NOT 42501)", async () => {
      rpcMock.mockResolvedValue(businessError("Collection session not found"));

      const { data, error } = await rpcMock("checkout_receipt_book", {
        p_receipt_book_id: "00000000-0000-0000-0000-000000000000",
        p_collection_session_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(data).toBeNull();
      expect(error?.code).not.toBe("42501");
      expect(error?.message).toBe("Collection session not found");
    });

    it("create_collection_handover is reachable (fails with business validation, NOT 42501)", async () => {
      rpcMock.mockResolvedValue(businessError("Collection session not found"));

      const { data, error } = await rpcMock("create_collection_handover", {
        p_collection_session_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(data).toBeNull();
      expect(error?.code).not.toBe("42501");
      expect(error?.message).toBe("Collection session not found");
    });

    it("submit_collection_handover is reachable (fails with business validation, NOT 42501)", async () => {
      rpcMock.mockResolvedValue(businessError("Handover not found"));

      const { data, error } = await rpcMock("submit_collection_handover", {
        p_handover_id: "00000000-0000-0000-0000-000000000000",
        p_actual_cash_amount: 100,
        p_actual_upi_amount: 0,
        p_actual_cheque_amount: 0,
        p_actual_bank_transfer_amount: 0,
      });

      expect(data).toBeNull();
      expect(error?.code).not.toBe("42501");
      expect(error?.message).toBe("Handover not found");
    });

    it("verify_collection_handover is reachable (fails with business/admin check, NOT 42501)", async () => {
      rpcMock.mockResolvedValue(businessError("Unauthorized: Only organization admins can verify handovers"));

      const { data, error } = await rpcMock("verify_collection_handover", {
        p_handover_id: "00000000-0000-0000-0000-000000000000",
        p_notes: "Test verification",
      });

      expect(data).toBeNull();
      expect(error?.code).not.toBe("42501");
      expect(error?.message).toContain("Only organization admins can verify handovers");
    });

    it("reject_collection_handover is reachable (fails with business/admin check, NOT 42501)", async () => {
      rpcMock.mockResolvedValue(businessError("Unauthorized: Only organization admins can reject handovers"));

      const { data, error } = await rpcMock("reject_collection_handover", {
        p_handover_id: "00000000-0000-0000-0000-000000000000",
        p_reason: "Variance unexplained",
      });

      expect(data).toBeNull();
      expect(error?.code).not.toBe("42501");
      expect(error?.message).toContain("Only organization admins can reject handovers");
    });

    it("complete_collection_session is reachable (fails with business validation, NOT 42501)", async () => {
      rpcMock.mockResolvedValue(businessError("Collection session not found"));

      const { data, error } = await rpcMock("complete_collection_session", {
        p_collection_session_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(data).toBeNull();
      expect(error?.code).not.toBe("42501");
      expect(error?.message).toBe("Collection session not found");
    });

    it("sync_offline_receipt is reachable (fails with business validation, NOT 42501)", async () => {
      rpcMock.mockResolvedValue(businessError("Collection session not found"));

      const { data, error } = await rpcMock("sync_offline_receipt", {
        p_collection_session_id: "00000000-0000-0000-0000-000000000000",
        p_receipt_number: 101,
        p_donor_name: "Test Donor",
        p_amount: 500,
        p_payment_mode: "cash",
      });

      expect(data).toBeNull();
      expect(error?.code).not.toBe("42501");
      expect(error?.message).toBe("Collection session not found");
    });
  });

  describe("4. Partial Unique Index Concurrency Behavior (uq_open_collection_session_per_volunteer)", () => {
    it("Enforces at most one open collection session per volunteer (23505 unique_violation on concurrent race)", async () => {
      rpcMock.mockImplementation((rpcName: string, params: { p_receipt_book_id: string }) => {
        if (rpcName === "start_collection_session") {
          if (params.p_receipt_book_id === "book-concurrent-conflict") {
            return Promise.resolve({
              data: null,
              error: {
                code: "23505",
                message: 'duplicate key value violates unique constraint "uq_open_collection_session_per_volunteer"',
                details: "Key (volunteer_id)=(vol-1) already exists where status = 'open'.",
              },
            });
          }
          return Promise.resolve({ data: { success: true, collection_session_id: "session-new" }, error: null });
        }
        return Promise.resolve({ data: null, error: new Error("Unexpected RPC") });
      });

      // Second concurrent request for the same volunteer with open session
      const conflictAttempt = await rpcMock("start_collection_session", {
        p_event_id: "event-1",
        p_receipt_book_id: "book-concurrent-conflict",
      });

      expect(conflictAttempt.data).toBeNull();
      expect(conflictAttempt.error?.code).toBe("23505");
      expect(conflictAttempt.error?.message).toContain("uq_open_collection_session_per_volunteer");

      // Successful request when no open session exists
      const successAttempt = await rpcMock("start_collection_session", {
        p_event_id: "event-1",
        p_receipt_book_id: "book-available",
      });

      expect(successAttempt.error).toBeNull();
      expect(successAttempt.data?.success).toBe(true);
    });
  });
});
