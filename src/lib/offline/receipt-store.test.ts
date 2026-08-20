import { describe, expect, it } from "vitest";

import {
  getBookState,
  getLocalReceipts,
  saveBookState,
  saveLocalReceipt,
  type LocalReceipt,
} from "./offline-db";
import { createLocalReceipt } from "./receipt-store";

const bookState = {
  receiptBookId: "book-1",
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "session-1",
  volunteerId: "volunteer-1",
  bookNumber: "BOOK-1",
  prefix: "VP-",
  startNumber: 100,
  endNumber: 101,
  nextLocalNumber: 100,
  updatedAt: "2026-08-21T00:00:00.000Z",
};

const receiptInput = {
  receiptBookId: "book-1",
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "session-1",
  volunteerId: "volunteer-1",
  propertyId: null,
  donorName: "Ada Donor",
  donorMobile: "9876543210",
  amount: 250,
  paymentMode: "cash" as const,
  paymentReference: null,
  notes: null,
};

function existingReceipt(receiptNumber: number): LocalReceipt {
  return {
    clientReceiptId: `existing-${receiptNumber}`,
    ...receiptInput,
    receiptNumber,
    offlineCreatedAt: "2026-08-21T00:00:00.000Z",
    syncStatus: "pending",
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };
}

describe("createLocalReceipt", () => {
  it("assigns sequential receipt numbers and advances the local counter", async () => {
    await saveBookState(bookState);

    const first = await createLocalReceipt(receiptInput);
    const second = await createLocalReceipt(receiptInput);

    expect(first.receiptNumber).toBe(100);
    expect(second.receiptNumber).toBe(101);
    expect(first.syncStatus).toBe("pending");
    expect((await getBookState("book-1"))?.nextLocalNumber).toBe(102);
  });

  it("does not advance the counter when the atomic receipt write is rejected", async () => {
    await saveBookState(bookState);
    await saveLocalReceipt(existingReceipt(100));

    await expect(createLocalReceipt(receiptInput)).rejects.toThrow();

    expect((await getBookState("book-1"))?.nextLocalNumber).toBe(100);
    expect(await getLocalReceipts("book-1")).toHaveLength(1);
  });

  it("does not issue a receipt beyond the assigned book range", async () => {
    await saveBookState({ ...bookState, nextLocalNumber: 102 });

    await expect(createLocalReceipt(receiptInput)).rejects.toThrow(
      "Receipt book has no more available receipt numbers."
    );

    expect(await getLocalReceipts("book-1")).toHaveLength(0);
    expect((await getBookState("book-1"))?.nextLocalNumber).toBe(102);
  });
});
