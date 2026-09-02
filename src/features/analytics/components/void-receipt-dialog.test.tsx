// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { VoidReceiptDialog, type VoidReceiptTarget } from "./void-receipt-dialog";
import * as analyticsService from "../services/analytics.service";

const mockReceipt: VoidReceiptTarget = {
  id: "receipt-101",
  clientReceiptId: "client-rec-101",
  receiptNumber: 1042,
  amount: 501,
  donorName: "Rahul Shinde",
  donorMobile: "9820112233",
  paymentMode: "cash",
  unitNumber: "101",
  status: "issued",
};

describe("VoidReceiptDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("1. renders nothing when isOpen is false", () => {
    const { container } = render(
      <VoidReceiptDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        isOpen={false}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("2. renders receipt snapshot details and consequences warning when open", () => {
    render(
      <VoidReceiptDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText("ही पावती रद्द करायची आहे? (Void Receipt)")).toBeTruthy();
    expect(screen.getByText(/VP-1042/)).toBeTruthy();
    expect(screen.getByText("₹501")).toBeTruthy();
    expect(screen.getByText(/Rahul Shinde/)).toBeTruthy();
    expect(screen.getByText(/101/)).toBeTruthy();
    expect(screen.getByText(/cash/i)).toBeTruthy();
    expect(
      screen.getByText(/ही पावती वसुलीच्या एकूण रकमेतून वगळली जाईल/)
    ).toBeTruthy();
  });

  it("3. validates reason: disables confirm button when empty, whitespace, or < 3 chars", () => {
    render(
      <VoidReceiptDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole("button", {
      name: /पावती रद्द करा \(Confirm Void\)/i,
    });
    const reasonInput = screen.getByLabelText(/रद्द करण्याचे कारण/i);

    // Initial empty state -> disabled
    expect(submitBtn).toHaveProperty("disabled", true);

    // Whitespace only -> disabled
    fireEvent.change(reasonInput, { target: { value: "   " } });
    expect(submitBtn).toHaveProperty("disabled", true);

    // 1-2 characters -> disabled
    fireEvent.change(reasonInput, { target: { value: "ab" } });
    expect(submitBtn).toHaveProperty("disabled", true);
    expect(screen.getByText(/किमान ३ अक्षरे कारण लिहा \(2\/3\)/)).toBeTruthy();

    // 3+ characters -> enabled
    fireEvent.change(reasonInput, { target: { value: "Wrong amount entered" } });
    expect(submitBtn).toHaveProperty("disabled", false);
  });

  it("4. calls voidReceipt exactly once on submit, handles loading, and fires onSuccess callback", async () => {
    const voidReceiptSpy = vi
      .spyOn(analyticsService, "voidReceipt")
      .mockResolvedValueOnce({
        success: true,
        receipt_id: "receipt-101",
        receipt_number: 1042,
        amount: 501,
        payment_mode: "cash",
        status: "voided",
        void_reason: "Wrong amount entered",
        voided_at: "2026-08-29T10:00:00Z",
        voided_by: "admin-1",
      });

    const onSuccessMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <VoidReceiptDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        isOpen={true}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
      />
    );

    const reasonInput = screen.getByLabelText(/रद्द करण्याचे कारण/i);
    fireEvent.change(reasonInput, { target: { value: "Wrong amount entered" } });

    const submitBtn = screen.getByRole("button", {
      name: /पावती रद्द करा \(Confirm Void\)/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(voidReceiptSpy).toHaveBeenCalledTimes(1);
      expect(voidReceiptSpy).toHaveBeenCalledWith(
        "receipt-101",
        "Wrong amount entered"
      );
    });

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  it("5. displays human-readable error when backend rejects due to submitted/verified handover", async () => {
    vi.spyOn(analyticsService, "voidReceipt").mockRejectedValueOnce(
      new Error(
        "हा हिशोब आधीच जमा/पडताळला गेला आहे. ही पावती आता रद्द करता येणार नाही."
      )
    );

    render(
      <VoidReceiptDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const reasonInput = screen.getByLabelText(/रद्द करण्याचे कारण/i);
    fireEvent.change(reasonInput, { target: { value: "Donor requested cancellation" } });

    const submitBtn = screen.getByRole("button", {
      name: /पावती रद्द करा \(Confirm Void\)/i,
    });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(
        /हा हिशोब आधीच जमा\/पडताळला गेला आहे. ही पावती आता रद्द करता येणार नाही./
      )
    ).toBeTruthy();
  });

  it("6. blocks void submission when offline and does NOT call RPC", async () => {
    const voidReceiptSpy = vi.spyOn(analyticsService, "voidReceipt");

    // Simulate offline
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });

    render(
      <VoidReceiptDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const reasonInput = screen.getByLabelText(/रद्द करण्याचे कारण/i);
    fireEvent.change(reasonInput, { target: { value: "Donor cancellation" } });

    const submitBtn = screen.getByRole("button", {
      name: /पावती रद्द करा \(Confirm Void\)/i,
    });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/इंटरनेट कनेक्शन आवश्यक आहे/)
    ).toBeTruthy();
    expect(voidReceiptSpy).not.toHaveBeenCalled();

    // Restore onLine
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      configurable: true,
    });
  });

  it("7. prevents double submission when clicked multiple times in rapid succession", async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    const voidReceiptSpy = vi
      .spyOn(analyticsService, "voidReceipt")
      .mockReturnValueOnce(pendingPromise as any);

    render(
      <VoidReceiptDialog
        receipt={mockReceipt}
        receiptPrefix="VP-"
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const reasonInput = screen.getByLabelText(/रद्द करण्याचे कारण/i);
    fireEvent.change(reasonInput, { target: { value: "Duplicate click test" } });

    const submitBtn = screen.getByRole("button", {
      name: /पावती रद्द करा \(Confirm Void\)/i,
    });

    // Rapid double click
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(voidReceiptSpy).toHaveBeenCalledTimes(1);

    // Resolve RPC
    resolvePromise!({
      success: true,
      receipt_id: "receipt-101",
      receipt_number: 1042,
      amount: 501,
      payment_mode: "cash",
      status: "voided",
      void_reason: "Duplicate click test",
      voided_at: "2026-08-29T10:00:00Z",
      voided_by: "admin-1",
    });
  });
});
