// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from "vitest";
import "fake-indexeddb/auto";

import {
  saveLocalReceipt,
  getLocalReceipts,
  getLocalReceiptsForSession,
  type LocalReceipt,
} from "@/lib/offline/offline-db";
import { calculateReceiptAggregates } from "../utils/receipt-aggregates";

function createMockReceipt(overrides: Partial<LocalReceipt>): LocalReceipt {
  return {
    clientReceiptId: overrides.clientReceiptId || `receipt-${Math.random()}`,
    organizationId: overrides.organizationId || "org-1",
    eventId: overrides.eventId || "event-1",
    collectionSessionId: overrides.collectionSessionId || "session-1",
    receiptBookId: overrides.receiptBookId || "book-1",
    volunteerId: overrides.volunteerId || "vol-1",
    propertyId: overrides.propertyId || null,
    receiptNumber: overrides.receiptNumber || 101,
    donorName: overrides.donorName || "Donor Test",
    donorMobile: overrides.donorMobile || "9876543210",
    amount: overrides.amount ?? 500,
    paymentMode: overrides.paymentMode || "cash",
    paymentReference: overrides.paymentReference || null,
    notes: overrides.notes || null,
    offlineCreatedAt: overrides.offlineCreatedAt || "2026-09-29T12:00:00Z",
    syncStatus: overrides.syncStatus || "synced",
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    createdAt: overrides.createdAt || "2026-09-29T12:00:00Z",
    updatedAt: overrides.updatedAt || "2026-09-29T12:00:00Z",
    status: overrides.status || "issued",
  };
}

describe("Session-Scoped Summary & Book Lifecycle Isolation", () => {
  beforeEach(async () => {
    // Clean IndexedDB state before each test
    const dbs = await indexedDB.databases();
    for (const dbInfo of dbs) {
      if (dbInfo.name) {
        indexedDB.deleteDatabase(dbInfo.name);
      }
    }
  });

  it("Requirement A: Reused book across sessions strictly partitions summary totals", async () => {
    // Book BK-02 is reused across Session A and Session B
    const bookId = "caece695-0650-4786-8d8d-d8a51989e82f"; // BK-02
    const sessionA = "c5e5d3bb-f0d1-4123-98cb-a7ae66db0fe9"; // Session A (Completed)
    const sessionB = "9a661957-3770-4298-bbc5-678524fa2fa5"; // Session B (Open)

    // Session A: 20 receipts (101 to 120), totaling ₹11,106
    for (let i = 101; i <= 120; i++) {
      const amount = i === 120 ? 1606 : 500; // sums to 11,106
      const r = createMockReceipt({
        clientReceiptId: `rec-${i}`,
        receiptBookId: bookId,
        collectionSessionId: sessionA,
        receiptNumber: i,
        amount,
        status: "issued",
      });
      await saveLocalReceipt(r);
    }

    // Session B: 17 receipts (121 to 137), totaling ₹15,622
    for (let i = 121; i <= 137; i++) {
      const amount = i === 137 ? 1222 : 900; // sums to 15,622
      const r = createMockReceipt({
        clientReceiptId: `rec-${i}`,
        receiptBookId: bookId,
        collectionSessionId: sessionB,
        receiptNumber: i,
        amount,
        status: "issued",
      });
      await saveLocalReceipt(r);
    }

    // 1. Session B Summary: must ONLY return 17 receipts and ₹15,622 (NOT 37 receipts or ₹26,728)
    const sessionBLocal = await getLocalReceiptsForSession(sessionB);
    expect(sessionBLocal).toHaveLength(17);
    const sessionBAggregates = calculateReceiptAggregates(sessionBLocal);
    expect(sessionBAggregates.issuedReceipts).toHaveLength(17);
    expect(sessionBAggregates.totalAmount).toBe(15622);

    // Verify Session B does NOT contain any receipt from 101 to 120
    const sessionBNumbers = sessionBLocal.map((r) => r.receiptNumber);
    for (let n = 101; n <= 120; n++) {
      expect(sessionBNumbers).not.toContain(n);
    }
    for (let n = 121; n <= 137; n++) {
      expect(sessionBNumbers).toContain(n);
    }

    // 2. Session A Summary: must strictly return 20 receipts and ₹11,106
    const sessionALocal = await getLocalReceiptsForSession(sessionA);
    expect(sessionALocal).toHaveLength(20);
    const sessionAAggregates = calculateReceiptAggregates(sessionALocal);
    expect(sessionAAggregates.issuedReceipts).toHaveLength(20);
    expect(sessionAAggregates.totalAmount).toBe(11106);
  });

  it("Requirement B: Multi-book in same session aggregates across all books in that session", async () => {
    const sessionS = "session-multi-book-S";
    const book1 = "book-bk01-exhausted";
    const book2 = "book-bk02-continuation";

    // Book 1: receipts 192 to 200 (9 receipts, ₹500 each = ₹4,500)
    for (let i = 192; i <= 200; i++) {
      await saveLocalReceipt(
        createMockReceipt({
          clientReceiptId: `rec-${i}`,
          receiptBookId: book1,
          collectionSessionId: sessionS,
          receiptNumber: i,
          amount: 500,
          status: "issued",
        })
      );
    }

    // Book 2: receipts 201 to 210 (10 receipts, ₹500 each = ₹5,000)
    for (let i = 201; i <= 210; i++) {
      await saveLocalReceipt(
        createMockReceipt({
          clientReceiptId: `rec-${i}`,
          receiptBookId: book2,
          collectionSessionId: sessionS,
          receiptNumber: i,
          amount: 500,
          status: "issued",
        })
      );
    }

    // Session S summary must include all 19 receipts from both books totaling ₹9,500
    const sessionReceipts = await getLocalReceiptsForSession(sessionS);
    expect(sessionReceipts).toHaveLength(19);

    const aggregates = calculateReceiptAggregates(sessionReceipts);
    expect(aggregates.issuedReceipts).toHaveLength(19);
    expect(aggregates.totalAmount).toBe(9500);

    const numbers = sessionReceipts.map((r) => r.receiptNumber);
    expect(numbers).toContain(192);
    expect(numbers).toContain(200);
    expect(numbers).toContain(201);
    expect(numbers).toContain(210);
  });

  it("Requirement C: Physical book-level history remains book-scoped and returns all receipts", async () => {
    const bookId = "caece695-0650-4786-8d8d-d8a51989e82f";
    const sessionA = "c5e5d3bb-f0d1-4123-98cb-a7ae66db0fe9";
    const sessionB = "9a661957-3770-4298-bbc5-678524fa2fa5";

    // Save 20 receipts in Session A
    for (let i = 101; i <= 120; i++) {
      await saveLocalReceipt(
        createMockReceipt({
          clientReceiptId: `rec-${i}`,
          receiptBookId: bookId,
          collectionSessionId: sessionA,
          receiptNumber: i,
          amount: 500,
        })
      );
    }

    // Save 17 receipts in Session B
    for (let i = 121; i <= 137; i++) {
      await saveLocalReceipt(
        createMockReceipt({
          clientReceiptId: `rec-${i}`,
          receiptBookId: bookId,
          collectionSessionId: sessionB,
          receiptNumber: i,
          amount: 500,
        })
      );
    }

    // Book-level history for BK-02 MUST return all 37 receipts (101 to 137)
    const bookReceipts = await getLocalReceipts(bookId);
    expect(bookReceipts).toHaveLength(37);
    expect(bookReceipts[0].receiptNumber).toBe(137);
    expect(bookReceipts[36].receiptNumber).toBe(101);
  });

  it("Requirement F & G: Fallback filter works safely on store without byCollectionSession index", async () => {
    const sessionA = "sess-fallback-A";
    const sessionB = "sess-fallback-B";

    await saveLocalReceipt(
      createMockReceipt({
        clientReceiptId: "fb-1",
        collectionSessionId: sessionA,
        receiptNumber: 1,
        amount: 100,
      })
    );
    await saveLocalReceipt(
      createMockReceipt({
        clientReceiptId: "fb-2",
        collectionSessionId: sessionB,
        receiptNumber: 2,
        amount: 200,
      })
    );

    // Query for session A returns only fb-1
    const resA = await getLocalReceiptsForSession(sessionA);
    expect(resA).toHaveLength(1);
    expect(resA[0].clientReceiptId).toBe("fb-1");

    // Query for session B returns only fb-2
    const resB = await getLocalReceiptsForSession(sessionB);
    expect(resB).toHaveLength(1);
    expect(resB[0].clientReceiptId).toBe("fb-2");
  });
});
