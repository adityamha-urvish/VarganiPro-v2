// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { drainAllPendingSyncQueues, setupAutoSync } from "./receipt-sync";
import * as offlineDb from "./offline-db";

describe("Receipt Multi-Queue Sync & AutoSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drainAllPendingSyncQueues queries pending receipts for owner and processes books", async () => {
    const mockPendingReceipts: any[] = [
      {
        clientReceiptId: "r1",
        receiptBookId: "book-A",
        syncStatus: "pending",
        receiptNumber: 1,
        amount: 500,
        paymentMode: "cash",
      },
    ];

    const getPendingSpy = vi.spyOn(offlineDb, "getPendingReceiptsForOwner").mockResolvedValue(mockPendingReceipts);
    vi.spyOn(offlineDb, "getLocalReceipts").mockResolvedValue(mockPendingReceipts);
    vi.spyOn(offlineDb, "updateLocalReceiptSyncState").mockResolvedValue(undefined as any);

    await drainAllPendingSyncQueues("user-1");

    expect(getPendingSpy).toHaveBeenCalledWith("user-1");
  });

  it("setupAutoSync binds window online event and unbinds on cleanup", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const cleanup = setupAutoSync("book-1", "user-1");

    expect(addEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));

    cleanup();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });
});
