// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { LastCreatedReceiptCard } from "./last-created-receipt-card";
import type { LocalReceipt } from "@/lib/offline/offline-db";
import * as pavtiImageService from "@/features/pavti/services/pavti-image.service";

// Mock pavti-image.service
vi.mock("@/features/pavti/services/pavti-image.service", async () => {
  const actual = await vi.importActual<typeof pavtiImageService>(
    "@/features/pavti/services/pavti-image.service"
  );
  return {
    ...actual,
    renderPavtiToFile: vi.fn().mockImplementation((_config, _receipt, filename) => {
      const file = new File(["mock-jpeg-bytes"], filename, { type: "image/jpeg" });
      return Promise.resolve(file);
    }),
    downloadImageBlob: vi.fn(),
  };
});

describe("LastCreatedReceiptCard — Web Share Level 2 & Caching Tests", () => {
  const mockReceiptA = {
    clientReceiptId: "rec-uuid-101",
    receiptNumber: 101,
    amount: 501,
    paymentMode: "cash",
    donorName: "Anand Shinde",
    donorMobile: "9820123456",
    organizationId: "org-1",
    receiptBookId: "book-1",
    syncStatus: "pending",
    createdAt: "2026-08-30T10:00:00.000Z",
    updatedAt: "2026-08-30T10:00:00.000Z",
  } as unknown as LocalReceipt;

  const mockReceiptB = {
    clientReceiptId: "rec-uuid-102",
    receiptNumber: 102,
    amount: 1001,
    paymentMode: "upi",
    donorName: "Vikas Patil",
    donorMobile: "9820987654",
    organizationId: "org-1",
    receiptBookId: "book-1",
    syncStatus: "pending",
    createdAt: "2026-08-30T10:05:00.000Z",
    updatedAt: "2026-08-30T10:05:00.000Z",
  } as unknown as LocalReceipt;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("1. renders receipt confirmation immediately without blocking", () => {
    render(
      <LastCreatedReceiptCard
        receipt={mockReceiptA}
        onViewReceipt={vi.fn()}
        onPrintReceipt={vi.fn()}
      />
    );

    expect(screen.getByText("Receipt created")).toBeTruthy();
    expect(screen.getByText("#101")).toBeTruthy();
    expect(screen.getByText(/Anand Shinde — ₹501\.00/)).toBeTruthy();
  });

  it("2. asynchronously generates Pavti File in background and enables WhatsApp button", async () => {
    render(
      <LastCreatedReceiptCard
        receipt={mockReceiptA}
        onViewReceipt={vi.fn()}
        onPrintReceipt={vi.fn()}
      />
    );

    const waBtn = await screen.findByRole("button", { name: /WhatsApp/i });
    expect(waBtn).toBeTruthy();
    await waitFor(() => {
      expect((waBtn as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("3. invokes navigator.share with generated File when Web Share is supported", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    navigator.share = shareMock;
    navigator.canShare = vi.fn().mockReturnValue(true);

    render(
      <LastCreatedReceiptCard
        receipt={mockReceiptA}
        onViewReceipt={vi.fn()}
        onPrintReceipt={vi.fn()}
      />
    );

    const waBtn = await screen.findByRole("button", { name: /WhatsApp/i });
    await waitFor(() => expect((waBtn as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(waBtn);

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          files: [expect.any(File)],
          title: "वर्गणी पावती",
        })
      );
    });
  });

  it("4. opens desktop fallback modal when Web Share is unsupported", async () => {
    navigator.canShare = vi.fn().mockReturnValue(false);

    render(
      <LastCreatedReceiptCard
        receipt={mockReceiptA}
        onViewReceipt={vi.fn()}
        onPrintReceipt={vi.fn()}
      />
    );

    const waBtn = await screen.findByRole("button", { name: /WhatsApp/i });
    await waitFor(() => expect((waBtn as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(waBtn);

    expect(await screen.findByText(/डेस्कटॉप सूचना/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /पावती JPG डाउनलोड करा/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /WhatsApp Chat उघडा/i })).toBeTruthy();
  });

  it("5. strictly isolates cached File by receipt ID so Receipt A cache is not used for Receipt B", async () => {
    const { rerender } = render(
      <LastCreatedReceiptCard
        receipt={mockReceiptA}
        onViewReceipt={vi.fn()}
        onPrintReceipt={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(pavtiImageService.renderPavtiToFile).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ clientReceiptId: "rec-uuid-101" }),
        "Vargani-Pavti-VP-101.jpg"
      );
    });

    // Rerender with Receipt B
    rerender(
      <LastCreatedReceiptCard
        receipt={mockReceiptB}
        onViewReceipt={vi.fn()}
        onPrintReceipt={vi.fn()}
      />
    );

    expect(screen.getByText("#102")).toBeTruthy();
    expect(screen.getByText(/Vikas Patil — ₹1001\.00/)).toBeTruthy();

    await waitFor(() => {
      expect(pavtiImageService.renderPavtiToFile).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ clientReceiptId: "rec-uuid-102" }),
        "Vargani-Pavti-VP-102.jpg"
      );
    });
  });

  it("6. handles AbortError silently without showing error banner", async () => {
    const abortError = new DOMException("The share operation was aborted", "AbortError");
    navigator.share = vi.fn().mockRejectedValue(abortError);
    navigator.canShare = vi.fn().mockReturnValue(true);

    render(
      <LastCreatedReceiptCard
        receipt={mockReceiptA}
        onViewReceipt={vi.fn()}
        onPrintReceipt={vi.fn()}
      />
    );

    const waBtn = await screen.findByRole("button", { name: /WhatsApp/i });
    await waitFor(() => expect((waBtn as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(waBtn);

    // Should not show any red error banner
    expect(screen.queryByText(/शेअर करताना त्रुटी आली/)).toBeNull();
  });

  it("7. handles background generation error gracefully without breaking receipt display", async () => {
    vi.mocked(pavtiImageService.renderPavtiToFile).mockRejectedValueOnce(
      new Error("Offscreen canvas render failure")
    );

    render(
      <LastCreatedReceiptCard
        receipt={mockReceiptA}
        onViewReceipt={vi.fn()}
        onPrintReceipt={vi.fn()}
      />
    );

    // Receipt details must still be visible and valid
    expect(screen.getByText("#101")).toBeTruthy();
    expect(screen.getByText(/Anand Shinde/)).toBeTruthy();

    expect(await screen.findByText(/पावती सुरक्षितपणे जतन झाली आहे/i)).toBeTruthy();
  });
});
