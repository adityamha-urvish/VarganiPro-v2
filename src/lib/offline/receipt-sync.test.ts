import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/supabase/client", () => ({
  supabase: { rpc },
}));

import {
  getLocalReceipt,
  saveLocalReceipt,
  type LocalReceipt,
} from "./offline-db";
import { syncNextReceipt } from "./receipt-sync";

function receipt(
  receiptNumber: number,
  syncStatus: LocalReceipt["syncStatus"]
): LocalReceipt {
  return {
    clientReceiptId: `client-${receiptNumber}`,
    organizationId: "org-1",
    eventId: "event-1",
    collectionSessionId: "session-1",
    receiptBookId: "book-1",
    volunteerId: "volunteer-1",
    propertyId: null,
    receiptNumber,
    donorName: "Ada Donor",
    donorMobile: null,
    amount: 250,
    paymentMode: "cash",
    paymentReference: null,
    notes: null,
    offlineCreatedAt: "2026-08-21T00:00:00.000Z",
    syncStatus,
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };
}

describe("syncNextReceipt", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("retries the lowest-numbered conflict before later pending receipts", async () => {
    await saveLocalReceipt(receipt(104, "pending"));
    await saveLocalReceipt(receipt(102, "pending"));
    await saveLocalReceipt(receipt(101, "conflict"));
    await saveLocalReceipt(receipt(100, "synced"));
    rpc.mockResolvedValue({
      data: { sync_status: "conflict", reason: "receipt_number_mismatch" },
      error: null,
    });

    const result = await syncNextReceipt("book-1");

    expect(rpc).toHaveBeenCalledWith(
      "sync_offline_receipt",
      expect.objectContaining({
        p_receipt_number: 101,
        p_client_receipt_id: "client-101",
      })
    );
    expect(result).toMatchObject({ success: false, conflict: true });
    expect((await getLocalReceipt("client-101"))?.syncStatus).toBe("conflict");
    expect((await getLocalReceipt("client-101"))?.syncAttempts).toBe(1);
  });

  it("treats an already-existing server receipt as an idempotent success", async () => {
    await saveLocalReceipt(receipt(100, "pending"));
    rpc.mockResolvedValue({
      data: { success: true, already_exists: true },
      error: null,
    });

    const result = await syncNextReceipt("book-1");

    expect(result).toMatchObject({
      success: true,
      alreadyExists: true,
      conflict: false,
    });
    expect((await getLocalReceipt("client-100"))?.syncStatus).toBe("synced");
  });

  it("returns a failed network sync to pending with the error preserved", async () => {
    await saveLocalReceipt(receipt(100, "pending"));
    rpc.mockResolvedValue({ data: null, error: new Error("Network unavailable") });

    const result = await syncNextReceipt("book-1");

    expect(result).toMatchObject({ success: false, conflict: false });
    expect(await getLocalReceipt("client-100")).toMatchObject({
      syncStatus: "pending",
      syncAttempts: 1,
      lastSyncError: "Network unavailable",
    });
  });
});
