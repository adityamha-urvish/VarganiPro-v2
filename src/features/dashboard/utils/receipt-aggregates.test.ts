import { describe, expect, it } from "vitest";
import type { LocalReceipt } from "@/lib/offline/offline-db";
import {
  calculateReceiptAggregates,
  calculateTodayPersonalAggregates,
  isTodayIST,
} from "./receipt-aggregates";

function createMockReceipt(overrides: Partial<LocalReceipt> = {}): LocalReceipt {
  const timestamp = overrides.createdAt || overrides.offlineCreatedAt || new Date().toISOString();
  return {
    clientReceiptId: "mock-client-id",
    organizationId: "org-1",
    eventId: "event-1",
    collectionSessionId: "session-1",
    receiptBookId: "book-1",
    volunteerId: "vol-1",
    propertyId: null,
    receiptNumber: 101,
    donorName: "John Doe",
    donorMobile: "9876543210",
    amount: 100,
    paymentMode: "cash",
    paymentReference: null,
    notes: null,
    offlineCreatedAt: timestamp,
    syncStatus: "synced",
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("calculateReceiptAggregates", () => {
  it("handles an empty receipt list", () => {
    const result = calculateReceiptAggregates([]);

    expect(result.issuedReceipts).toEqual([]);
    expect(result.pendingReceipts).toEqual([]);
    expect(result.conflictReceipts).toEqual([]);
    expect(result.totalAmount).toBe(0);
    expect(result.cashAmount).toBe(0);
    expect(result.upiAmount).toBe(0);
    expect(result.chequeAmount).toBe(0);
    expect(result.bankTransferAmount).toBe(0);
  });

  it("handles a single synced cash receipt", () => {
    const receipt = createMockReceipt({
      amount: 250,
      paymentMode: "cash",
      syncStatus: "synced",
    });

    const result = calculateReceiptAggregates([receipt]);

    expect(result.issuedReceipts).toHaveLength(1);
    expect(result.pendingReceipts).toHaveLength(0);
    expect(result.conflictReceipts).toHaveLength(0);
    expect(result.totalAmount).toBe(250);
    expect(result.cashAmount).toBe(250);
    expect(result.upiAmount).toBe(0);
    expect(result.chequeAmount).toBe(0);
    expect(result.bankTransferAmount).toBe(0);
  });

  it("calculates multiple synced receipts across all four payment modes", () => {
    const receipts: LocalReceipt[] = [
      createMockReceipt({ amount: 100, paymentMode: "cash", syncStatus: "synced" }),
      createMockReceipt({ amount: 200, paymentMode: "upi", syncStatus: "synced" }),
      createMockReceipt({ amount: 300, paymentMode: "cheque", syncStatus: "synced" }),
      createMockReceipt({ amount: 400, paymentMode: "bank_transfer", syncStatus: "synced" }),
      createMockReceipt({ amount: 50, paymentMode: "cash", syncStatus: "synced" }),
    ];

    const result = calculateReceiptAggregates(receipts);

    expect(result.issuedReceipts).toHaveLength(5);
    expect(result.pendingReceipts).toHaveLength(0);
    expect(result.conflictReceipts).toHaveLength(0);
    expect(result.totalAmount).toBe(1050);
    expect(result.cashAmount).toBe(150);
    expect(result.upiAmount).toBe(200);
    expect(result.chequeAmount).toBe(300);
    expect(result.bankTransferAmount).toBe(400);
  });

  it("handles a pending receipt without adding to synced totals", () => {
    const pendingReceipt = createMockReceipt({
      amount: 500,
      paymentMode: "cash",
      syncStatus: "pending",
    });

    const result = calculateReceiptAggregates([pendingReceipt]);

    expect(result.issuedReceipts).toHaveLength(0);
    expect(result.pendingReceipts).toEqual([pendingReceipt]);
    expect(result.conflictReceipts).toHaveLength(0);
    expect(result.totalAmount).toBe(0);
    expect(result.cashAmount).toBe(0);
    expect(result.upiAmount).toBe(0);
    expect(result.chequeAmount).toBe(0);
    expect(result.bankTransferAmount).toBe(0);
  });

  it("handles a conflict receipt without adding to synced totals", () => {
    const conflictReceipt = createMockReceipt({
      amount: 750,
      paymentMode: "upi",
      syncStatus: "conflict",
    });

    const result = calculateReceiptAggregates([conflictReceipt]);

    expect(result.issuedReceipts).toHaveLength(0);
    expect(result.pendingReceipts).toHaveLength(0);
    expect(result.conflictReceipts).toEqual([conflictReceipt]);
    expect(result.totalAmount).toBe(0);
    expect(result.cashAmount).toBe(0);
    expect(result.upiAmount).toBe(0);
    expect(result.chequeAmount).toBe(0);
    expect(result.bankTransferAmount).toBe(0);
  });

  it("treats syncing receipts as pending receipts", () => {
    const syncingReceipt = createMockReceipt({
      amount: 350,
      paymentMode: "cheque",
      syncStatus: "syncing",
    });

    const result = calculateReceiptAggregates([syncingReceipt]);

    expect(result.issuedReceipts).toHaveLength(0);
    expect(result.pendingReceipts).toEqual([syncingReceipt]);
    expect(result.conflictReceipts).toHaveLength(0);
    expect(result.totalAmount).toBe(0);
    expect(result.cashAmount).toBe(0);
  });

  it("handles a combination of synced, pending, conflict, and syncing receipts", () => {
    const syncedCash = createMockReceipt({ amount: 100, paymentMode: "cash", syncStatus: "synced" });
    const syncedUpi = createMockReceipt({ amount: 200, paymentMode: "upi", syncStatus: "synced" });
    const pendingReceipt = createMockReceipt({ amount: 500, paymentMode: "cash", syncStatus: "pending" });
    const syncingReceipt = createMockReceipt({ amount: 300, paymentMode: "upi", syncStatus: "syncing" });
    const conflictReceipt = createMockReceipt({ amount: 400, paymentMode: "cheque", syncStatus: "conflict" });

    const receipts = [syncedCash, syncedUpi, pendingReceipt, syncingReceipt, conflictReceipt];
    const result = calculateReceiptAggregates(receipts);

    expect(result.issuedReceipts).toEqual([syncedCash, syncedUpi]);
    expect(result.pendingReceipts).toEqual([pendingReceipt, syncingReceipt]);
    expect(result.conflictReceipts).toEqual([conflictReceipt]);
    expect(result.totalAmount).toBe(300);
    expect(result.cashAmount).toBe(100);
    expect(result.upiAmount).toBe(200);
    expect(result.chequeAmount).toBe(0);
    expect(result.bankTransferAmount).toBe(0);
  });

  it("correctly handles zero-value synced receipts", () => {
    const zeroReceipt = createMockReceipt({
      amount: 0,
      paymentMode: "cash",
      syncStatus: "synced",
    });

    const result = calculateReceiptAggregates([zeroReceipt]);

    expect(result.issuedReceipts).toHaveLength(1);
    expect(result.totalAmount).toBe(0);
    expect(result.cashAmount).toBe(0);
  });
});

describe("isTodayIST", () => {
  it("returns true for timestamps matching today in Asia/Kolkata", () => {
    expect(isTodayIST(new Date().toISOString())).toBe(true);
  });

  it("returns false for yesterday and null/invalid dates", () => {
    const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(isTodayIST(yesterday)).toBe(false);
    expect(isTodayIST(null)).toBe(false);
    expect(isTodayIST("invalid-date")).toBe(false);
  });
});

describe("calculateTodayPersonalAggregates", () => {
  it("aggregates receipts created today including pending and syncing, excluding voided", () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const receipts: LocalReceipt[] = [
      createMockReceipt({ amount: 500, paymentMode: "cash", syncStatus: "synced", createdAt: now, offlineCreatedAt: now }),
      createMockReceipt({ amount: 300, paymentMode: "upi", syncStatus: "pending", createdAt: now, offlineCreatedAt: now }),
      createMockReceipt({ amount: 200, paymentMode: "cash", syncStatus: "syncing", createdAt: now, offlineCreatedAt: now }),
      createMockReceipt({ amount: 1000, paymentMode: "cash", syncStatus: "synced", createdAt: old, offlineCreatedAt: old }), // Yesterday
      createMockReceipt({ amount: 800, paymentMode: "cash", syncStatus: "synced", createdAt: now, offlineCreatedAt: now, status: "voided" as any }), // Voided
    ];

    const result = calculateTodayPersonalAggregates(receipts);

    expect(result.todayCount).toBe(3);
    expect(result.todayTotal).toBe(1000); // 500 + 300 + 200
    expect(result.todayCash).toBe(700);   // 500 + 200
    expect(result.todayUpi).toBe(300);    // 300
    expect(result.pendingSyncCount).toBe(2); // 1 pending + 1 syncing
  });
});
