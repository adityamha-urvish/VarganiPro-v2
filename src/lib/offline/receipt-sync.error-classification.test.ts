// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, rpcMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
    rpc: rpcMock,
  },
}));

import {
  saveBookState,
  saveLocalReceipt,
  getLocalReceipt,
  type LocalReceipt,
} from "./offline-db";
import { syncNextReceipt, classifySyncError } from "./receipt-sync";

const baseReceipt: LocalReceipt = {
  clientReceiptId: "c2222222-3333-4444-5555-666666666666",
  organizationId: "o1111111-2222-3333-4444-555555555555",
  eventId: "e1111111-2222-3333-4444-555555555555",
  collectionSessionId: "s1111111-2222-3333-4444-555555555555",
  receiptBookId: "b2222222-3333-4444-5555-666666666666",
  volunteerId: "v1111111-2222-3333-4444-555555555555",
  ownerUserId: "u1111111-2222-3333-4444-555555555555",
  propertyId: null,
  receiptNumber: 201,
  donorName: "Test Error Donor",
  donorMobile: "9876543210",
  amount: 500,
  paymentMode: "cash",
  paymentReference: null,
  notes: null,
  offlineCreatedAt: "2026-09-22T00:00:00.000Z",
  syncStatus: "pending",
  syncAttempts: 0,
  lastSyncAttemptAt: null,
  lastSyncError: null,
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

describe("P0 Remediation: Error Classification & Bounded Retries", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1111111-2222-3333-4444-555555555555" } },
      error: null,
    });

    await saveBookState({
      receiptBookId: "b2222222-3333-4444-5555-666666666666",
      organizationId: "o1111111-2222-3333-4444-555555555555",
      eventId: "e1111111-2222-3333-4444-555555555555",
      collectionSessionId: "s1111111-2222-3333-4444-555555555555",
      volunteerId: "v1111111-2222-3333-4444-555555555555",
      ownerUserId: "u1111111-2222-3333-4444-555555555555",
      bookNumber: "BOOK-ERR-1",
      prefix: "VP-",
      startNumber: 200,
      endNumber: 300,
      nextLocalNumber: 202,
      updatedAt: "2026-09-22T00:00:00.000Z",
    });
  });

  describe("classifySyncError function", () => {
    it("identifies PostgreSQL 22P02 invalid UUID syntax as permanent", () => {
      const result = classifySyncError({
        code: "22P02",
        message: 'invalid input syntax for type uuid: ""',
      });
      expect(result.isPermanent).toBe(true);
      expect(result.code).toBe("22P02");
    });

    it("identifies PostgreSQL 23503 foreign key violation as permanent", () => {
      const result = classifySyncError({
        code: "23503",
        message: 'insert or update on table "receipts" violates foreign key constraint',
      });
      expect(result.isPermanent).toBe(true);
    });

    it("identifies business validation exceptions as permanent", () => {
      expect(classifySyncError({ message: "Receipt number 50 is outside valid range (1 - 20)" }).isPermanent).toBe(true);
      expect(classifySyncError({ message: "Amount must be greater than zero" }).isPermanent).toBe(true);
      expect(classifySyncError({ message: "Donor name is required" }).isPermanent).toBe(true);
      expect(classifySyncError({ message: "Unauthorized: Authenticated volunteer does not own this collection session" }).isPermanent).toBe(true);
    });

    it("identifies transient network and server 503/502/timeout errors as retryable", () => {
      expect(classifySyncError({ message: "Network unavailable" }).isPermanent).toBe(false);
      expect(classifySyncError({ message: "Failed to fetch" }).isPermanent).toBe(false);
      expect(classifySyncError({ message: "503 Service Unavailable" }).isPermanent).toBe(false);
      expect(classifySyncError({ message: "504 Gateway Timeout" }).isPermanent).toBe(false);
    });
  });

  describe("syncNextReceipt permanent vs transient status transitions", () => {
    it("transitions receipt to 'failed' on permanent Postgres 22P02 error, preventing infinite retry", async () => {
      const receipt: LocalReceipt = {
        ...baseReceipt,
        clientReceiptId: "c2222222-0000-0000-0000-000000000001",
        receiptNumber: 201,
      };
      await saveLocalReceipt(receipt);

      rpcMock.mockResolvedValueOnce({
        data: null,
        error: {
          code: "22P02",
          message: 'invalid input syntax for type uuid: ""',
        },
      });

      const result = await syncNextReceipt("b2222222-3333-4444-5555-666666666666");
      expect(result?.success).toBe(false);

      const stored = await getLocalReceipt("c2222222-0000-0000-0000-000000000001");
      expect(stored?.syncStatus).toBe("failed");
      expect(stored?.lastSyncError).toContain("invalid input syntax for type uuid");
      expect(stored?.syncAttempts).toBe(1);

      // Subsequent syncNextReceipt should NOT pick up 'failed' receipts
      const nextAttempt = await syncNextReceipt("b2222222-3333-4444-5555-666666666666");
      expect(nextAttempt).toBe(null);
    });

    it("transitions receipt to 'pending' on transient network error, allowing future retry", async () => {
      const receipt: LocalReceipt = {
        ...baseReceipt,
        clientReceiptId: "c2222222-0000-0000-0000-000000000002",
        receiptNumber: 202,
      };
      await saveLocalReceipt(receipt);

      rpcMock.mockResolvedValueOnce({
        data: null,
        error: {
          message: "Failed to fetch",
        },
      });

      const result = await syncNextReceipt("b2222222-3333-4444-5555-666666666666");
      expect(result?.success).toBe(false);

      const stored = await getLocalReceipt("c2222222-0000-0000-0000-000000000002");
      expect(stored?.syncStatus).toBe("pending");
      expect(stored?.lastSyncError).toBe("Failed to fetch");
      expect(stored?.syncAttempts).toBe(1);
    });
  });
});
