// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveLocalReceipt,
  getLocalReceipt,
  getPendingReceiptsForOwner,
  type LocalReceipt,
} from "./offline-db";
import {
  drainAllPendingSyncQueues,
  setupAutoSync,
} from "./receipt-sync";
import { supabase } from "@/supabase/client";
import "fake-indexeddb/auto";

describe("Real Sync Runtime E2E: Multi-Book Offline -> Online Synchronization", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("Step 1-8: Offline Creation -> Multi-Queue Detection -> Online Trigger -> Synced State -> Idempotency", async () => {
    // 1. Simulate Offline State
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    });

    const receiptA: LocalReceipt = {
      clientReceiptId: "cr-book-A-001",
      organizationId: "org-test-1",
      eventId: "event-test-1",
      collectionSessionId: "session-A-1",
      receiptBookId: "book-A",
      volunteerId: "vol-1",
      ownerUserId: "user-1",
      propertyId: "prop-101",
      receiptNumber: 1,
      donorName: "Ramesh Sharma",
      donorMobile: "9822011111",
      amount: 1001,
      paymentMode: "cash",
      paymentReference: null,
      notes: "Offline donation for Ganpati Utsav",
      offlineCreatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: "pending",
      syncAttempts: 0,
      lastSyncAttemptAt: null,
      lastSyncError: null,
    };

    const receiptB: LocalReceipt = {
      clientReceiptId: "cr-book-B-101",
      organizationId: "org-test-1",
      eventId: "event-test-1",
      collectionSessionId: "session-B-1",
      receiptBookId: "book-B",
      volunteerId: "vol-1",
      ownerUserId: "user-1",
      propertyId: null,
      receiptNumber: 101,
      donorName: "Sunita Kulkarni",
      donorMobile: "9822022222",
      amount: 501,
      paymentMode: "upi",
      paymentReference: "UPI998877",
      notes: "General receipt from Book B",
      offlineCreatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: "pending",
      syncAttempts: 0,
      lastSyncAttemptAt: null,
      lastSyncError: null,
    };

    // 2. Save both offline receipts to IndexedDB
    await saveLocalReceipt(receiptA);
    await saveLocalReceipt(receiptB);

    // 3. Verify both exist in IndexedDB and are strictly pending with 0 sync attempts
    const storedA = await getLocalReceipt("cr-book-A-001");
    const storedB = await getLocalReceipt("cr-book-B-101");

    expect(storedA).not.toBeNull();
    expect(storedA?.syncStatus).toBe("pending");
    expect(storedA?.syncAttempts).toBe(0);

    expect(storedB).not.toBeNull();
    expect(storedB?.syncStatus).toBe("pending");
    expect(storedB?.syncAttempts).toBe(0);

    // Verify getPendingReceiptsForOwner finds both receipts across the two distinct books
    const pendingListBefore = await getPendingReceiptsForOwner("user-1");
    expect(pendingListBefore.length).toBe(2);
    expect(pendingListBefore.map((r) => r.receiptBookId).sort()).toEqual(["book-A", "book-B"]);

    // 4. Mock Supabase RPC create_receipt
    const rpcMock = vi.spyOn(supabase, "rpc").mockImplementation(((method: string, args: any) => {
      if (method === "sync_offline_receipt" || method === "create_receipt" || method === "create_receipt_v2") {
        return Promise.resolve({
          data: {
            success: true,
            already_exists: false,
            receipt_number: args.p_receipt_number,
            next_receipt_number: args.p_receipt_number + 1,
            server_created_at: new Date().toISOString(),
          },
          error: null,
        } as any);
      }
      return Promise.resolve({ data: null, error: null } as any);
    }) as any);

    // 5. Restore Network Connection
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });

    // Setup auto-sync listener
    let syncCallbackCount = 0;
    const cleanupAutoSync = setupAutoSync(undefined, "user-1", () => {
      syncCallbackCount++;
    });

    // 6. Trigger Online Event / Drain
    await drainAllPendingSyncQueues("user-1");

    // 7. Verify both receipts were synchronized via Supabase RPC
    expect(rpcMock).toHaveBeenCalledTimes(2);

    const syncedA = await getLocalReceipt("cr-book-A-001");
    const syncedB = await getLocalReceipt("cr-book-B-101");

    expect(syncedA?.syncStatus).toBe("synced");
    expect(syncedA?.syncAttempts).toBe(1);
    expect(syncedA?.lastSyncError).toBeNull();

    expect(syncedB?.syncStatus).toBe("synced");
    expect(syncedB?.syncAttempts).toBe(1);
    expect(syncedB?.lastSyncError).toBeNull();

    // Verify pending queue is now empty
    const pendingListAfter = await getPendingReceiptsForOwner("user-1");
    expect(pendingListAfter.length).toBe(0);

    // 8. Test Idempotency: Running drainAllPendingSyncQueues again should do nothing
    await drainAllPendingSyncQueues("user-1");
    expect(rpcMock).toHaveBeenCalledTimes(2); // Still 2, no extra RPC calls!

    cleanupAutoSync();
  });
});
