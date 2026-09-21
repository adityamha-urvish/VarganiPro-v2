// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ReceiptPreviewDialog } from "./receipt-preview-dialog";
import type { LocalReceipt } from "@/lib/offline/offline-db";

describe("ReceiptPreviewDialog Resilience", () => {
  afterEach(() => {
    cleanup();
  });

  const minimalReceipt: LocalReceipt = {
    clientReceiptId: "cr-101",
    organizationId: "org-1",
    eventId: "event-1",
    collectionSessionId: "session-1",
    receiptBookId: "book-1",
    volunteerId: "vol-1",
    receiptNumber: 42,
    donorName: "Anand Deshmukh",
    donorMobile: "9876543210",
    amount: 1001,
    paymentMode: "cash",
    paymentReference: null,
    propertyId: null,
    notes: null,
    syncStatus: "pending",
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    offlineCreatedAt: "2026-09-21T10:30:00.000Z",
    createdAt: "2026-09-21T10:30:00.000Z",
    updatedAt: "2026-09-21T10:30:00.000Z",
    ownerUserId: "user-1",
  };

  it("renders properly without throwing error when receipt has only offlineCreatedAt and no createdAt", () => {
    const noCreatedAtReceipt: LocalReceipt = {
      ...minimalReceipt,
      createdAt: undefined as any,
    };

    render(
      <ReceiptPreviewDialog
        receipt={noCreatedAtReceipt}
        receiptPrefix="VP-"
        bookNumber="BOOK-01"
        onClose={() => {}}
        onPrint={() => {}}
      />
    );

    expect(screen.getByText("Receipt Details")).toBeTruthy();
    expect(screen.getAllByText("Anand Deshmukh").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1,001|1001/).length).toBeGreaterThan(0);
  });

  it("handles receipt with no date at all gracefully without crashing", () => {
    const noDateReceipt: LocalReceipt = {
      ...minimalReceipt,
      offlineCreatedAt: undefined as any,
      createdAt: undefined as any,
      updatedAt: undefined as any,
    };

    render(
      <ReceiptPreviewDialog
        receipt={noDateReceipt}
        receiptPrefix="VP-"
        bookNumber="BOOK-01"
        onClose={() => {}}
        onPrint={() => {}}
      />
    );

    expect(screen.getByText("Receipt Details")).toBeTruthy();
    expect(screen.getAllByText("Anand Deshmukh").length).toBeGreaterThan(0);
  });

  it("handles receipt with custom/missing donor name gracefully", () => {
    const anonymousReceipt: LocalReceipt = {
      ...minimalReceipt,
      donorName: "",
      donorMobile: null,
    };

    render(
      <ReceiptPreviewDialog
        receipt={anonymousReceipt}
        receiptPrefix="VP-"
        bookNumber="BOOK-01"
        onClose={() => {}}
        onPrint={() => {}}
      />
    );

    expect(screen.getByText("Receipt Details")).toBeTruthy();
    expect(screen.getAllByText(/देणगीदार \/ Donor/i).length).toBeGreaterThan(0);
  });
});
