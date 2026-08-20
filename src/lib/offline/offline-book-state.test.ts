import { describe, expect, it } from "vitest";

import {
  getBookState,
  getLocalReceipts,
  mergeOfflineBookState,
  saveBookState,
  saveLocalReceipt,
  type LocalReceipt,
} from "./offline-db";
import { createLocalReceipt } from "./receipt-store";

const baseBookState = {
  receiptBookId: "book-1",
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "session-1",
  volunteerId: "volunteer-1",
  bookNumber: "BOOK-1",
  prefix: "VP-",
  startNumber: 100,
  endNumber: 199,
  nextLocalNumber: 101,
  updatedAt: "2026-08-21T00:00:00.000Z",
};

function localReceipt(receiptNumber: number): LocalReceipt {
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
    syncStatus: "pending",
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };
}

describe("mergeOfflineBookState", () => {
  it("uses the server next number for a fresh book", async () => {
    const merged = await mergeOfflineBookState(baseBookState);

    expect(merged.nextLocalNumber).toBe(101);
    expect((await getBookState("book-1"))?.nextLocalNumber).toBe(101);
  });

  it("preserves the locally advanced counter after one unsynced receipt", async () => {
    await saveBookState({ ...baseBookState, nextLocalNumber: 102 });
    await saveLocalReceipt(localReceipt(101));

    const merged = await mergeOfflineBookState(baseBookState);

    expect(merged.nextLocalNumber).toBe(102);
  });

  it("uses the highest of multiple local receipt numbers", async () => {
    await saveBookState({ ...baseBookState, nextLocalNumber: 103 });
    await saveLocalReceipt(localReceipt(101));
    await saveLocalReceipt(localReceipt(102));

    const merged = await mergeOfflineBookState(baseBookState);

    expect(merged.nextLocalNumber).toBe(103);
  });

  it("advances local state when the server is ahead", async () => {
    await saveBookState({ ...baseBookState, nextLocalNumber: 102 });
    await saveLocalReceipt(localReceipt(101));

    const merged = await mergeOfflineBookState({
      ...baseBookState,
      nextLocalNumber: 105,
    });

    expect(merged.nextLocalNumber).toBe(105);
  });

  it("does not move local state backwards when the server is behind", async () => {
    await saveBookState({ ...baseBookState, nextLocalNumber: 104 });

    const merged = await mergeOfflineBookState(baseBookState);

    expect(merged.nextLocalNumber).toBe(104);
  });

  it("repairs stale metadata from an existing local receipt", async () => {
    await saveBookState(baseBookState);
    await saveLocalReceipt(localReceipt(101));

    const merged = await mergeOfflineBookState(baseBookState);

    expect(merged.nextLocalNumber).toBe(102);
  });

  it("selects a new number instead of duplicating an existing local receipt", async () => {
    await saveBookState(baseBookState);
    await saveLocalReceipt(localReceipt(101));
    await mergeOfflineBookState(baseBookState);

    const created = await createLocalReceipt({
      receiptBookId: "book-1",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "volunteer-1",
      propertyId: null,
      donorName: "Grace Donor",
      donorMobile: null,
      amount: 300,
      paymentMode: "upi",
      paymentReference: "ref-1",
      notes: null,
    });

    expect(created.receiptNumber).toBe(102);
    expect((await getLocalReceipts("book-1")).map((receipt) => receipt.receiptNumber)).toEqual([
      102,
      101,
    ]);
  });
});
