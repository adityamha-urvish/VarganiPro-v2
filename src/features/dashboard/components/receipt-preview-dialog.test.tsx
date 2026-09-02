// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReceiptPreviewDialog } from "./receipt-preview-dialog";
import type { LocalReceipt } from "@/lib/offline/offline-db";

const mockReceipt: LocalReceipt = {
  clientReceiptId: "rec-test-1",
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "session-1",
  receiptBookId: "book-1",
  volunteerId: "vol-1",
  propertyId: null,
  receiptNumber: 1042,
  donorName: "Sanjay Raut",
  donorMobile: "9820556677",
  amount: 501,
  paymentMode: "cash",
  paymentReference: null,
  notes: "Building collection",
  offlineCreatedAt: "2026-08-29T10:00:00Z",
  syncStatus: "synced",
  syncAttempts: 1,
  lastSyncAttemptAt: "2026-08-29T10:01:00Z",
  lastSyncError: null,
  createdAt: "2026-08-29T10:00:00Z",
  updatedAt: "2026-08-29T10:00:00Z",
};

describe("ReceiptPreviewDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("1. does NOT show Void action when user is volunteer (isAdmin = false)", () => {
    render(
      <ReceiptPreviewDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        bookNumber="BK-01"
        isAdmin={false}
        onClose={vi.fn()}
        onPrint={vi.fn()}
      />
    );

    expect(screen.getAllByText(/VP-1042/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Print")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Void/i })).toBeNull();
  });

  it("2. renders Void button when user is Secretary/Admin (isAdmin = true)", () => {
    render(
      <ReceiptPreviewDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        bookNumber="BK-01"
        isAdmin={true}
        onClose={vi.fn()}
        onPrint={vi.fn()}
      />
    );

    const voidBtn = screen.getByRole("button", {
      name: /पावती रद्द करा \(Void\)/i,
    });
    expect(voidBtn).toBeTruthy();
  });

  it("3. opens confirmation dialog when Void button is clicked", () => {
    render(
      <ReceiptPreviewDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        bookNumber="BK-01"
        isAdmin={true}
        onClose={vi.fn()}
        onPrint={vi.fn()}
      />
    );

    const voidBtn = screen.getByRole("button", {
      name: /पावती रद्द करा \(Void\)/i,
    });
    fireEvent.click(voidBtn);

    expect(
      screen.getByText("ही पावती रद्द करायची आहे? (Void Receipt)")
    ).toBeTruthy();
    expect(
      screen.getByText(/ही पावती वसुलीच्या एकूण रकमेतून वगळली जाईल/)
    ).toBeTruthy();
  });

  it("4. displays VOIDED watermark and audit block when receipt is already voided", () => {
    const voidedReceipt = {
      ...mockReceipt,
      status: "voided",
      voidReason: "Donor cheque bounced",
      voidedAt: "2026-08-29T11:00:00Z",
    };

    render(
      <ReceiptPreviewDialog
        receipt={voidedReceipt}
        receiptPrefix="VP-"
        bookNumber="BK-01"
        isAdmin={true}
        onClose={vi.fn()}
        onPrint={vi.fn()}
      />
    );

    expect(screen.getByText("रद्द (VOIDED)")).toBeTruthy();
    expect(screen.getByText(/Donor cheque bounced/)).toBeTruthy();
    expect(screen.getByText("VOIDED")).toBeTruthy(); // watermark
    // Void button should not be shown for already-voided receipt
    expect(screen.queryByRole("button", { name: /पावती रद्द करा \(Void\)/i })).toBeNull();
  });

  it("5. renders active WhatsApp button for synced receipt and opens message preview", () => {
    render(
      <ReceiptPreviewDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        bookNumber="BK-01"
        isAdmin={false}
        onClose={vi.fn()}
        onPrint={vi.fn()}
      />
    );

    const waBtn = screen.getByRole("button", { name: /WhatsApp/i });
    expect(waBtn).toBeTruthy();
    expect((waBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(waBtn);

    // Verify WhatsApp message preview modal opens
    expect(screen.getByText(/WhatsApp पावती संदेश/)).toBeTruthy();
    expect(screen.getByText(/\+919820556677/)).toBeTruthy();
    expect(screen.getByText(/देणगीदार \/ Donor:\* Sanjay Raut/)).toBeTruthy();
    expect(screen.getByText(/रक्कम \/ Amount:\* ₹501\.00/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /WhatsApp उघडा/i })).toBeTruthy();
  });

  it("6. disables WhatsApp button and shows tooltip when receipt is not yet synced", () => {
    const unsyncedReceipt = {
      ...mockReceipt,
      syncStatus: "pending" as const,
    };

    render(
      <ReceiptPreviewDialog
        receipt={unsyncedReceipt}
        receiptPrefix="VP-"
        bookNumber="BK-01"
        isAdmin={false}
        onClose={vi.fn()}
        onPrint={vi.fn()}
      />
    );

    const waBtn = screen.getByRole("button", { name: /WhatsApp/i });
    expect((waBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Sync झाल्यावर उपलब्ध होईल/)).toBeTruthy();
  });

  it("7. disables WhatsApp button when receipt is voided", () => {
    const voidedReceipt = {
      ...mockReceipt,
      status: "voided",
      voidedAt: "2026-08-30T10:00:00Z",
    };

    render(
      <ReceiptPreviewDialog
        receipt={voidedReceipt}
        receiptPrefix="VP-"
        bookNumber="BK-01"
        isAdmin={true}
        onClose={vi.fn()}
        onPrint={vi.fn()}
      />
    );

    const waBtn = screen.getByRole("button", { name: /WhatsApp/i });
    expect((waBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("8. renders JPG download button", () => {
    render(
      <ReceiptPreviewDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        bookNumber="BK-01"
        isAdmin={false}
        onClose={vi.fn()}
        onPrint={vi.fn()}
      />
    );

    const jpgBtn = screen.getByRole("button", { name: /पावती JPG/i });
    expect(jpgBtn).toBeTruthy();
  });
});
