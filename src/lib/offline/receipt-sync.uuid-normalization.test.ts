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
import { syncNextReceipt, normalizeUUID } from "./receipt-sync";

const baseReceipt: LocalReceipt = {
  clientReceiptId: "c1111111-2222-3333-4444-555555555555",
  organizationId: "o1111111-2222-3333-4444-555555555555",
  eventId: "e1111111-2222-3333-4444-555555555555",
  collectionSessionId: "s1111111-2222-3333-4444-555555555555",
  receiptBookId: "b1111111-2222-3333-4444-555555555555",
  volunteerId: "v1111111-2222-3333-4444-555555555555",
  ownerUserId: "u1111111-2222-3333-4444-555555555555",
  propertyId: null,
  receiptNumber: 101,
  donorName: "Test Donor",
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

describe("P0 Remediation: UUID Normalization & Empty-String Handling", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1111111-2222-3333-4444-555555555555" } },
      error: null,
    });

    await saveBookState({
      receiptBookId: "b1111111-2222-3333-4444-555555555555",
      organizationId: "o1111111-2222-3333-4444-555555555555",
      eventId: "e1111111-2222-3333-4444-555555555555",
      collectionSessionId: "s1111111-2222-3333-4444-555555555555",
      volunteerId: "v1111111-2222-3333-4444-555555555555",
      ownerUserId: "u1111111-2222-3333-4444-555555555555",
      bookNumber: "BOOK-NORM-1",
      prefix: "VP-",
      startNumber: 100,
      endNumber: 200,
      nextLocalNumber: 102,
      updatedAt: "2026-09-22T00:00:00.000Z",
    });
  });

  it("normalizeUUID correctly transforms empty/whitespace strings to null and trims valid values", () => {
    expect(normalizeUUID("")).toBe(null);
    expect(normalizeUUID("   ")).toBe(null);
    expect(normalizeUUID(null)).toBe(null);
    expect(normalizeUUID(undefined)).toBe(null);
    expect(normalizeUUID("  11111111-2222-3333-4444-555555555555  ")).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("sends p_property_id = null to RPC when receipt propertyId is empty string ''", async () => {
    const emptyPropReceipt: LocalReceipt = {
      ...baseReceipt,
      clientReceiptId: "c1111111-0000-0000-0000-000000000001",
      receiptNumber: 101,
      propertyId: "" as unknown as string,
    };

    await saveLocalReceipt(emptyPropReceipt);

    rpcMock.mockResolvedValueOnce({
      data: { success: true, receipt_id: "r1111111-0000-0000-0000-000000000001" },
      error: null,
    });

    const result = await syncNextReceipt("b1111111-2222-3333-4444-555555555555");
    expect(result?.success).toBe(true);

    expect(rpcMock).toHaveBeenCalledWith(
      "sync_offline_receipt",
      expect.objectContaining({
        p_property_id: null,
      })
    );

    const stored = await getLocalReceipt("c1111111-0000-0000-0000-000000000001");
    expect(stored?.syncStatus).toBe("synced");
  });

  it("sends p_property_id = null to RPC when receipt propertyId is whitespace only '   '", async () => {
    const whitespacePropReceipt: LocalReceipt = {
      ...baseReceipt,
      clientReceiptId: "c1111111-0000-0000-0000-000000000002",
      receiptNumber: 102,
      propertyId: "   " as unknown as string,
    };

    await saveLocalReceipt(whitespacePropReceipt);

    rpcMock.mockResolvedValueOnce({
      data: { success: true, receipt_id: "r1111111-0000-0000-0000-000000000002" },
      error: null,
    });

    const result = await syncNextReceipt("b1111111-2222-3333-4444-555555555555");
    expect(result?.success).toBe(true);

    expect(rpcMock).toHaveBeenCalledWith(
      "sync_offline_receipt",
      expect.objectContaining({
        p_property_id: null,
      })
    );
  });

  it("passes exact trimmed UUID to RPC when receipt propertyId is a valid UUID", async () => {
    const validPropReceipt: LocalReceipt = {
      ...baseReceipt,
      clientReceiptId: "c1111111-0000-0000-0000-000000000003",
      receiptNumber: 103,
      propertyId: "p9999999-8888-7777-6666-555555555555",
    };

    await saveLocalReceipt(validPropReceipt);

    rpcMock.mockResolvedValueOnce({
      data: { success: true, receipt_id: "r1111111-0000-0000-0000-000000000003" },
      error: null,
    });

    const result = await syncNextReceipt("b1111111-2222-3333-4444-555555555555");
    expect(result?.success).toBe(true);

    expect(rpcMock).toHaveBeenCalledWith(
      "sync_offline_receipt",
      expect.objectContaining({
        p_property_id: "p9999999-8888-7777-6666-555555555555",
      })
    );
  });
});
