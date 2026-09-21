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
import { syncNextReceipt, drainSyncQueue } from "./receipt-sync";

const baseReceipt: LocalReceipt = {
  clientReceiptId: "c3333333-4444-5555-6666-777777777777",
  organizationId: "o1111111-2222-3333-4444-555555555555",
  eventId: "e1111111-2222-3333-4444-555555555555",
  collectionSessionId: "s1111111-2222-3333-4444-555555555555",
  receiptBookId: "b3333333-4444-5555-6666-777777777777",
  volunteerId: "v1111111-2222-3333-4444-555555555555",
  ownerUserId: "u1111111-2222-3333-4444-555555555555",
  propertyId: null,
  receiptNumber: 301,
  donorName: "Test Mutex Donor",
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

describe("P0 Remediation: Single-Flight Mutex & Concurrency Safety", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1111111-2222-3333-4444-555555555555" } },
      error: null,
    });

    await saveBookState({
      receiptBookId: "b3333333-4444-5555-6666-777777777777",
      organizationId: "o1111111-2222-3333-4444-555555555555",
      eventId: "e1111111-2222-3333-4444-555555555555",
      collectionSessionId: "s1111111-2222-3333-4444-555555555555",
      volunteerId: "v1111111-2222-3333-4444-555555555555",
      ownerUserId: "u1111111-2222-3333-4444-555555555555",
      bookNumber: "BOOK-MUTEX-1",
      prefix: "VP-",
      startNumber: 300,
      endNumber: 400,
      nextLocalNumber: 303,
      updatedAt: "2026-09-22T00:00:00.000Z",
    });
  });

  it("coalesces concurrent syncNextReceipt calls into a single RPC execution", async () => {
    await saveLocalReceipt({
      ...baseReceipt,
      clientReceiptId: "c3333333-0000-0000-0000-000000000001",
      receiptNumber: 301,
    });

    rpcMock.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return {
        data: { success: true, receipt_id: "r3333333-0000-0000-0000-000000000001" },
        error: null,
      };
    });

    // Launch 3 simultaneous syncNextReceipt calls
    const [res1, res2, res3] = await Promise.all([
      syncNextReceipt("b3333333-4444-5555-6666-777777777777"),
      syncNextReceipt("b3333333-4444-5555-6666-777777777777"),
      syncNextReceipt("b3333333-4444-5555-6666-777777777777"),
    ]);

    // Exactly 1 RPC call should be performed
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(res1?.success).toBe(true);
    expect(res2?.success).toBe(true);
    expect(res3?.success).toBe(true);

    const stored = await getLocalReceipt("c3333333-0000-0000-0000-000000000001");
    expect(stored?.syncStatus).toBe("synced");
  });

  it("coalesces concurrent drainSyncQueue calls safely without double-syncing", async () => {
    await saveLocalReceipt({
      ...baseReceipt,
      clientReceiptId: "c3333333-0000-0000-0000-000000000002",
      receiptNumber: 302,
    });

    rpcMock.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return {
        data: { success: true, receipt_id: "r3333333-0000-0000-0000-000000000002" },
        error: null,
      };
    });

    await Promise.all([
      drainSyncQueue("b3333333-4444-5555-6666-777777777777"),
      drainSyncQueue("b3333333-4444-5555-6666-777777777777"),
    ]);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const stored = await getLocalReceipt("c3333333-0000-0000-0000-000000000002");
    expect(stored?.syncStatus).toBe("synced");
  });
});
