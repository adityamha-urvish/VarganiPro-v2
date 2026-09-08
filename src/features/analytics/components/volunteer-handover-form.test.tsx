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

  it("1. renders actual cash/cheque fields cleanly in Step 1", () => {
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
      screen.getByLabelText(/Cash Counted \(मोजलेली रोख\)/i)
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/Cheques Counted \(चेक रक्कम\)/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Collection Expenses \(खर्च झाला का\?\)/i)
    ).toBeTruthy();
  });

  it("2. expected physical amount is NOT visible before actual count entry (Blind Count / No Anchoring)", () => {
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
      screen.queryByText(/Expected Physical Cash \/ Cheque/)
    ).toBeNull();
    expect(
      screen.queryByText(/CASH TO HAND OVER \(प्रत्यक्ष रोख स्वाधीन करा\)/i)
    ).toBeNull();
  });

  it("3. reveals reconciliation desk with primary cash headline after entering count and clicking review", () => {
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
      name: /Review Reconciliation \(हिशोब तपासा\)/i,
    });
    fireEvent.click(reviewBtn);

    // Primary headline & secondary tiles revealed
    expect(screen.getByText(/CASH TO HAND OVER \(प्रत्यक्ष रोख स्वाधीन करा\)/i)).toBeTruthy();
    expect(screen.getByText("Expected Physical Cash / Cheque (अपेक्षित रोख/चेक):")).toBeTruthy();
    expect(screen.getByText("✓ CASH COUNT MATCHED")).toBeTruthy();
    expect(screen.getByText("✓ Exact Match — ₹0 Difference (रोख मोजणी तंतोतंत जुळली!)")).toBeTruthy();
    expect(screen.getByText(/UPI RECORDED \(डिजिटल वर्गणी\)/i)).toBeTruthy();
    expect(screen.getByText(/TOTAL COLLECTION VALUE \(एकूण संकलन\)/i)).toBeTruthy();
  });

  it("4. handles shortage discrepancy and requires explanation before submitting", () => {
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
      name: /Review Reconciliation \(हिशोब तपासा\)/i,
    });
    fireEvent.click(reviewBtn);

    expect(screen.getByText(/SHORTAGE ALERT: -₹200 \(कमी रक्कम\)/i)).toBeTruthy();
    expect(
      screen.getByLabelText(/Discrepancy Reason \(तफावतीचे कारण सांगा\):/i)
    ).toBeTruthy();

    // Submit button is disabled without discrepancy reason
    const submitBtn = screen.getByRole("button", {
      name: /Submit Handover \(हिशोब जमा करा\)/i,
    });
    expect(submitBtn).toHaveProperty("disabled", true);
  });

  it("5. handles excess discrepancy (+₹300) with explanation requirement", () => {
    render(
      <VolunteerHandoverForm
        handover={mockPendingHandover}
        creatingHandover={false}
        submittingHandover={false}
        actualCashAmount="1300"
        actualChequeAmount="500"
        authorizedExpenseAmount="0"
        authorizedExpenseNote=""
        discrepancyReason="Extra tip given by donor"
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
      name: /Review Reconciliation \(हिशोब तपासा\)/i,
    });
    fireEvent.click(reviewBtn);

    expect(screen.getByText(/SURPLUS ALERT: \+?₹300 \(जास्त रक्कम जमा\)/i)).toBeTruthy();
    expect(
      screen.getByLabelText(/Surplus Reason \(जास्त रकमेचे कारण सांगा\):/i)
    ).toBeTruthy();

    const submitBtn = screen.getByRole("button", {
      name: /Submit Handover \(हिशोब जमा करा\)/i,
    });
    expect(submitBtn).toHaveProperty("disabled", false);
  });

  it("6. blocks submission and displays warning when unsynced receipts exist", () => {
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
        unsyncedCount={2}
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

    expect(screen.getByText(/2 पावत्या सिंक बाकी/i)).toBeTruthy();

    const reviewBtn = screen.getByRole("button", {
      name: /Review Reconciliation \(हिशोब तपासा\)/i,
    });
    fireEvent.click(reviewBtn);

    const submitBtn = screen.getByRole("button", {
      name: /Sync Pending \(सिंक प्रलंबित\)/i,
    });
    expect(submitBtn).toHaveProperty("disabled", true);
  });

  it("7. renders submitted and verified terminal states cleanly", () => {
    const { rerender } = render(
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
      screen.getByText("Handover Submitted to Secretary! (हिशोब सादर झाला)")
    ).toBeTruthy();
    expect(screen.getByText(/Submitted — Awaiting Verification/i)).toBeTruthy();

    rerender(
      <VolunteerHandoverForm
        handover={{ ...mockPendingHandover, status: "verified" }}
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
      screen.getByText("✓ Handover Verified & Completed! (हस्तबदल पडताळणी पूर्ण)")
    ).toBeTruthy();
    expect(
      screen.getAllByText(/In Treasury · Session Closed/i).length
    ).toBeGreaterThan(0);
  });
});
