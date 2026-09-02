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
  getLocalReceipt,
  getLocalReceipts,
  getPendingReceiptsForOwner,
  saveBookState,
} from "./offline-db";
import { createLocalReceipt } from "./receipt-store";
import { syncNextReceipt } from "./receipt-sync";

const baseBookState = {
  receiptBookId: "book-shared",
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "session-1",
  volunteerId: "vol-1",
  bookNumber: "BOOK-SHARED",
  prefix: "VP-",
  startNumber: 1,
  endNumber: 100,
  nextLocalNumber: 1,
  updatedAt: "2026-08-24T00:00:00.000Z",
};

describe("Step 8A: Shared-Device Offline Safety & Ownership Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1 — Offline ownership isolation: User B must not receive User A's receipts", async () => {
    // User A authenticated
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    await saveBookState(baseBookState);

    const receiptA = await createLocalReceipt({
      receiptBookId: "book-shared",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "vol-1",
      propertyId: null,
      donorName: "Donor A",
      donorMobile: "9876543210",
      amount: 501,
      paymentMode: "cash",
      paymentReference: null,
      notes: "User A collection",
    });

    expect(receiptA.ownerUserId).toBe("user-a");

    // User A can see their own receipt
    const receiptsForA = await getLocalReceipts("book-shared");
    expect(receiptsForA.some((r) => r.clientReceiptId === receiptA.clientReceiptId)).toBe(true);

    // User B becomes the authenticated user on the same device
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-b" } },
      error: null,
    });

    // User B queries the same receipt book
    const receiptsForB = await getLocalReceipts("book-shared");
    expect(receiptsForB.some((r) => r.clientReceiptId === receiptA.clientReceiptId)).toBe(false);
  });

  it("Test 5 — User B cannot synchronize User A's receipts", async () => {
    // User A authenticated and creates a pending receipt
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    await saveBookState({ ...baseBookState, nextLocalNumber: 10 });

    const receiptA = await createLocalReceipt({
      receiptBookId: "book-shared",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "vol-1",
      propertyId: null,
      donorName: "Donor of User A",
      donorMobile: "9876543210",
      amount: 1100,
      paymentMode: "cash",
      paymentReference: null,
      notes: "Pending sync from User A",
    });

    expect(receiptA.syncStatus).toBe("pending");

    // User A logs out and User B logs in
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-b" } },
      error: null,
    });

    // User B triggers sync for the shared book
    const syncResult = await syncNextReceipt("book-shared");

    // B has no pending receipts in their own queue, so syncNextReceipt returns null
    expect(syncResult).toBeNull();
    // RPC is not called for User A's receipt while User B is active
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("Test 6 — User A returns: A's pending receipt becomes available again and can be synchronized", async () => {
    // User A authenticated
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    await saveBookState({ ...baseBookState, nextLocalNumber: 20 });

    const receiptA = await createLocalReceipt({
      receiptBookId: "book-shared",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "vol-1",
      propertyId: null,
      donorName: "Donor of User A returning",
      donorMobile: "9876543210",
      amount: 2100,
      paymentMode: "upi",
      paymentReference: "UPI-123",
      notes: "Sync upon return",
    });

    // User B uses the device
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-b" } },
      error: null,
    });
    expect(await getLocalReceipts("book-shared")).toHaveLength(0);

    // User A logs back in
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    const receiptsAAfterLogin = await getLocalReceipts("book-shared");
    expect(receiptsAAfterLogin.some((r) => r.clientReceiptId === receiptA.clientReceiptId)).toBe(true);

    // User A can synchronize their pending receipt
    rpcMock.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const syncResult = await syncNextReceipt("book-shared");
    expect(syncResult?.success).toBe(true);
    expect(syncResult?.receipt.clientReceiptId).toBe(receiptA.clientReceiptId);

    const updated = await getLocalReceipt(receiptA.clientReceiptId);
    expect(updated?.syncStatus).toBe("synced");
  });

  it("getPendingReceiptsForOwner returns only pending receipts matching the target user", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    await saveBookState({ ...baseBookState, nextLocalNumber: 30 });

    await createLocalReceipt({
      receiptBookId: "book-shared",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "vol-1",
      propertyId: null,
      donorName: "Donor for Pending Check",
      donorMobile: "9876543210",
      amount: 300,
      paymentMode: "cash",
      paymentReference: null,
      notes: null,
    });

    const pendingForA = await getPendingReceiptsForOwner("user-a");
    expect(pendingForA.length).toBeGreaterThan(0);

    const pendingForB = await getPendingReceiptsForOwner("user-b");
    expect(pendingForB).toHaveLength(0);
  });
});
