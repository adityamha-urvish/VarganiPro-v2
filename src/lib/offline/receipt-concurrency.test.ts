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
  getBookState,
  getLocalReceipt,
  saveBookState,
} from "./offline-db";
import { createLocalReceipt } from "./receipt-store";
import { syncNextReceipt } from "./receipt-sync";

const baseBookState = {
  receiptBookId: "book-concurrency",
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "session-1",
  volunteerId: "vol-1",
  ownerUserId: "user-1",
  bookNumber: "BOOK-C",
  prefix: "VP-",
  startNumber: 40,
  endNumber: 100,
  nextLocalNumber: 42,
  updatedAt: "2026-08-24T00:00:00.000Z",
};

const inputData = {
  receiptBookId: "book-concurrency",
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "session-1",
  volunteerId: "vol-1",
  ownerUserId: "user-1",
  propertyId: null,
  donorName: "Donor",
  donorMobile: "9876543210",
  amount: 500,
  paymentMode: "cash" as const,
  paymentReference: null,
  notes: null,
};

describe("Step 8B — Receipt Number Concurrency & Conflict Characterization", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    await saveBookState(baseBookState);
  });

  it("TEST 2 & TEST 3 — Concurrent & Sequential local allocation: guarantees unique sequential numbers", async () => {
    // Run two receipt allocations concurrently
    const [first, second] = await Promise.all([
      createLocalReceipt(inputData),
      createLocalReceipt(inputData),
    ]);

    // Must NEVER allocate the same receipt number
    expect(first.receiptNumber).not.toBe(second.receiptNumber);

    const allocatedNumbers = [first.receiptNumber, second.receiptNumber].sort(
      (a, b) => a - b
    );
    expect(allocatedNumbers).toEqual([42, 43]);

    // Next sequential allocation receives 44
    const third = await createLocalReceipt(inputData);
    expect(third.receiptNumber).toBe(44);

    const updatedBookState = await getBookState("book-concurrency");
    expect(updatedBookState?.nextLocalNumber).toBe(45);
  });

  it("TEST 4 — Successful sync: local receipt transitions to synced on server acceptance", async () => {
    const receipt = await createLocalReceipt(inputData);
    expect(receipt.syncStatus).toBe("pending");

    rpcMock.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const result = await syncNextReceipt("book-concurrency");
    expect(result?.success).toBe(true);
    expect(result?.conflict).toBe(false);

    const stored = await getLocalReceipt(receipt.clientReceiptId);
    expect(stored?.syncStatus).toBe("synced");
  });

  it("TEST 5 — Duplicate server number: transitions to conflict without silent renumbering", async () => {
    const receipt = await createLocalReceipt(inputData);
    const originalNumber = receipt.receiptNumber;

    // Server returns receipt_number_mismatch conflict
    rpcMock.mockResolvedValueOnce({
      data: {
        sync_status: "conflict",
        reason: "receipt_number_mismatch",
        message: "Receipt number 42 already registered on server",
      },
      error: null,
    });

    const result = await syncNextReceipt("book-concurrency");
    expect(result?.success).toBe(false);
    expect(result?.conflict).toBe(true);

    const stored = await getLocalReceipt(receipt.clientReceiptId);
    expect(stored?.syncStatus).toBe("conflict");
    // CRITICAL: Receipt number MUST NOT be silently altered
    expect(stored?.receiptNumber).toBe(originalNumber);
  });

  it("TEST 6 — Transient sync failure: preserves pending status for subsequent retries", async () => {
    const receipt = await createLocalReceipt(inputData);

    // Network drop or HTTP 500 error from Supabase RPC
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "503 Service Unavailable" },
    });

    const result = await syncNextReceipt("book-concurrency");
    expect(result?.success).toBe(false);
    expect(result?.conflict).toBe(false);

    const stored = await getLocalReceipt(receipt.clientReceiptId);
    expect(stored?.syncStatus).toBe("pending");
    expect(stored?.lastSyncError).toBe("503 Service Unavailable");
    expect(stored?.syncAttempts).toBe(1);
  });
});
