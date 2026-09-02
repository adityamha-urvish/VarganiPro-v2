// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { VolunteerHandoverForm } from "./volunteer-handover-form";
import type { VolunteerHandoverData } from "@/features/dashboard/hooks/use-volunteer-handover";

const mockPendingHandover: VolunteerHandoverData = {
  id: "handover-123",
  receiptCount: 3,
  totalAmount: 3500,
  cashAmount: 1000,
  chequeAmount: 500,
  upiAmount: 2000,
  bankTransferAmount: 0,
  expectedPhysicalAmount: 1500,
  expectedDigitalAmount: 2000,
  actualCashAmount: 0,
  actualChequeAmount: 0,
  actualUpiAmount: 0,
  actualBankTransferAmount: 0,
  authorizedExpenseAmount: 0,
  authorizedExpenseNote: null,
  discrepancyReason: null,
  rejectionReason: null,
  status: "pending",
  notes: null,
};

describe("VolunteerHandoverForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("1. renders actual cash/cheque fields cleanly", () => {
    render(
      <VolunteerHandoverForm
        handover={mockPendingHandover}
        creatingHandover={false}
        submittingHandover={false}
        actualCashAmount=""
        actualChequeAmount=""
        authorizedExpenseAmount=""
        authorizedExpenseNote=""
        discrepancyReason=""
        handoverNotes=""
        handoverError={null}
        handoverMessage={null}
        onCreateHandover={vi.fn()}
        onSubmitHandover={vi.fn()}
        onActualCashAmountChange={vi.fn()}
        onActualChequeAmountChange={vi.fn()}
        onAuthorizedExpenseAmountChange={vi.fn()}
        onAuthorizedExpenseNoteChange={vi.fn()}
        onDiscrepancyReasonChange={vi.fn()}
        onHandoverNotesChange={vi.fn()}
      />
    );

    expect(
      screen.getByLabelText(/मोजलेली रोख रक्कम \(Cash Counted\)/i)
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/चेक रक्कम \(Cheques Counted\)/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/खर्च झाला का\? \(Any Collection Expenses\?\)/i)
    ).toBeTruthy();
  });

  it("2. expected physical amount is NOT visible before actual count entry (No Anchoring)", () => {
    render(
      <VolunteerHandoverForm
        handover={mockPendingHandover}
        creatingHandover={false}
        submittingHandover={false}
        actualCashAmount=""
        actualChequeAmount=""
        authorizedExpenseAmount=""
        authorizedExpenseNote=""
        discrepancyReason=""
        handoverNotes=""
        handoverError={null}
        handoverMessage={null}
        onCreateHandover={vi.fn()}
        onSubmitHandover={vi.fn()}
        onActualCashAmountChange={vi.fn()}
        onActualChequeAmountChange={vi.fn()}
        onAuthorizedExpenseAmountChange={vi.fn()}
        onAuthorizedExpenseNoteChange={vi.fn()}
        onDiscrepancyReasonChange={vi.fn()}
        onHandoverNotesChange={vi.fn()}
      />
    );

    // The ₹1,500 target must NOT be visible before reviewing
    expect(
      screen.queryByText(/सिस्टममधील अपेक्षित रोख\/चेक/)
    ).toBeNull();
  });

  it("3. reveals reconciliation math after clicking review button", () => {
    render(
      <VolunteerHandoverForm
        handover={mockPendingHandover}
        creatingHandover={false}
        submittingHandover={false}
        actualCashAmount="1000"
        actualChequeAmount="500"
        authorizedExpenseAmount="0"
        authorizedExpenseNote=""
        discrepancyReason=""
        handoverNotes=""
        handoverError={null}
        handoverMessage={null}
        onCreateHandover={vi.fn()}
        onSubmitHandover={vi.fn()}
        onActualCashAmountChange={vi.fn()}
        onActualChequeAmountChange={vi.fn()}
        onAuthorizedExpenseAmountChange={vi.fn()}
        onAuthorizedExpenseNoteChange={vi.fn()}
        onDiscrepancyReasonChange={vi.fn()}
        onHandoverNotesChange={vi.fn()}
      />
    );

    // Click Review button
    const reviewBtn = screen.getByRole("button", {
      name: /हिशोब तपासा \(Review Reconciliation\)/i,
    });
    fireEvent.click(reviewBtn);

    // Expected physical is now revealed
    expect(screen.getByText("सिस्टममधील अपेक्षित रोख/चेक (Expected):")).toBeTruthy();
    expect(screen.getByText("✓ सगळं जुळलं! (Exact Match — ₹0 Difference)")).toBeTruthy();
    expect(screen.getByText("📱 UPI / डिजिटल वर्गणी")).toBeTruthy();
  });

  it("4. handles shortage discrepancy with explanation field", () => {
    render(
      <VolunteerHandoverForm
        handover={mockPendingHandover}
        creatingHandover={false}
        submittingHandover={false}
        actualCashAmount="800"
        actualChequeAmount="500"
        authorizedExpenseAmount="0"
        authorizedExpenseNote=""
        discrepancyReason=""
        handoverNotes=""
        handoverError={null}
        handoverMessage={null}
        onCreateHandover={vi.fn()}
        onSubmitHandover={vi.fn()}
        onActualCashAmountChange={vi.fn()}
        onActualChequeAmountChange={vi.fn()}
        onAuthorizedExpenseAmountChange={vi.fn()}
        onAuthorizedExpenseNoteChange={vi.fn()}
        onDiscrepancyReasonChange={vi.fn()}
        onHandoverNotesChange={vi.fn()}
      />
    );

    const reviewBtn = screen.getByRole("button", {
      name: /हिशोब तपासा \(Review Reconciliation\)/i,
    });
    fireEvent.click(reviewBtn);

    expect(screen.getByText(/₹200 कमी आहे \(Shortage\)/i)).toBeTruthy();
    expect(
      screen.getByLabelText(/तफावतीचे कारण सांगा \(Explain difference\):/i)
    ).toBeTruthy();
  });

  it("5. renders submitted success state after submission", () => {
    render(
      <VolunteerHandoverForm
        handover={{ ...mockPendingHandover, status: "submitted" }}
        creatingHandover={false}
        submittingHandover={false}
        actualCashAmount="1000"
        actualChequeAmount="500"
        authorizedExpenseAmount="0"
        authorizedExpenseNote=""
        discrepancyReason=""
        handoverNotes=""
        handoverError={null}
        handoverMessage={null}
        onCreateHandover={vi.fn()}
        onSubmitHandover={vi.fn()}
        onActualCashAmountChange={vi.fn()}
        onActualChequeAmountChange={vi.fn()}
        onAuthorizedExpenseAmountChange={vi.fn()}
        onAuthorizedExpenseNoteChange={vi.fn()}
        onDiscrepancyReasonChange={vi.fn()}
        onHandoverNotesChange={vi.fn()}
      />
    );

    expect(
      screen.getByText("हिशोब सेक्रेटरींकडे सादर झाला आहे!")
    ).toBeTruthy();
    expect(screen.getByText("हिशोब सादर (Submitted)")).toBeTruthy();
  });
});
