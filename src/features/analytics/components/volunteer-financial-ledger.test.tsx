// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { VolunteerFinancialLedger } from "./volunteer-financial-ledger";
import type { VolunteerFinancialLedgerResponse } from "../types/analytics.types";

const mockLedger: VolunteerFinancialLedgerResponse = {
  success: true,
  event_id: "event-123",
  organization_id: "org-123",
  summary: {
    total_volunteers: 2,
    active_volunteers: 2,
    total_receipt_count: 7,
    grand_total_collected: 5752,
    total_physical_collected: 3752,
    total_digital_settled: 2000,
    total_verified_handed_over: 1751,
    total_verified_expenses: 0,
    total_outstanding_physical_held: 2001,
    volunteers_holding_cash_count: 1,
  },
  volunteers: [
    {
      volunteer_id: "vol-1",
      name: "Rahul Shinde",
      mobile: "9820112233",
      status: "active",
      receipt_count: 4,
      total_collected: 4001,
      cash_collected: 1501,
      cheque_collected: 500,
      upi_collected: 2000,
      bank_transfer_collected: 0,
      physical_collected: 2001,
      digital_settled: 2000,
      verified_handed_over: 0,
      verified_expenses: 0,
      outstanding_physical_held: 2001,
      pending_handover_count: 1,
      pending_handover_amount: 2001,
      latest_handover_status: "submitted",
    },
    {
      volunteer_id: "vol-2",
      name: "Sneha Patil",
      mobile: "9820445566",
      status: "active",
      receipt_count: 3,
      total_collected: 1751,
      cash_collected: 1751,
      cheque_collected: 0,
      upi_collected: 0,
      bank_transfer_collected: 0,
      physical_collected: 1751,
      digital_settled: 0,
      verified_handed_over: 1751,
      verified_expenses: 0,
      outstanding_physical_held: 0,
      pending_handover_count: 0,
      pending_handover_amount: 0,
      latest_handover_status: "verified",
    },
  ],
};

describe("VolunteerFinancialLedger", () => {
  afterEach(() => {
    cleanup();
  });

  it("1. renders volunteer names and basic stats", () => {
    render(
      <VolunteerFinancialLedger
        ledger={mockLedger}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText(/Rahul Shinde/)).toBeTruthy();
    expect(screen.getByText(/Sneha Patil/)).toBeTruthy();
    expect(screen.getByText("4 पावत्या")).toBeTruthy();
    expect(screen.getByText("3 पावत्या")).toBeTruthy();
  });

  it("2. renders total collected and whole-rupee currency correctly", () => {
    render(
      <VolunteerFinancialLedger
        ledger={mockLedger}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText("₹4,001")).toBeTruthy();
    expect(screen.getAllByText("₹1,751").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("₹5,752")).toBeTruthy(); // summary grand total
  });

  it("3. normal cash custody badge is styled neutrally (not warning)", () => {
    render(
      <VolunteerFinancialLedger
        ledger={mockLedger}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    const rahulBadge = screen.getByText("₹2,001 रोख बाकी");
    expect(rahulBadge).toBeTruthy();
    // Neutral slate styling check
    expect(rahulBadge.className).toContain("bg-slate-100");
    expect(rahulBadge.className).not.toContain("bg-red");
    expect(rahulBadge.className).not.toContain("border-red");

    const snehaBadge = screen.getByText("✓ हिशोब पूर्ण");
    expect(snehaBadge).toBeTruthy();
  });

  it("4. expands card to reveal physical/digital breakdown on interaction", () => {
    render(
      <VolunteerFinancialLedger
        ledger={mockLedger}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    // Click on Rahul Shinde's card to expand
    const rahulRow = screen.getByRole("button", { name: /Rahul Shinde/i });
    fireEvent.click(rahulRow);

    // Expanded details should now be visible
    expect(screen.getByText("💵 रोख (Cash)")).toBeTruthy();
    expect(screen.getByText("📄 चेक (Cheque)")).toBeTruthy();
    expect(screen.getByText("📱 UPI (Digital)")).toBeTruthy();
    expect(screen.getByText("₹1,501")).toBeTruthy(); // cash
    expect(screen.getByText("₹500")).toBeTruthy(); // cheque
    expect(screen.getByText("₹2,000")).toBeTruthy(); // upi
    expect(
      screen.getByText("🏛️ तिजोरीत जमा रक्कम (Handed Over)")
    ).toBeTruthy();
  });

  it("5. search input filters volunteers dynamically", () => {
    render(
      <VolunteerFinancialLedger
        ledger={mockLedger}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      /कार्यकर्त्याचे नाव किंवा मोबाईल नंबर शोधा/i
    );
    fireEvent.change(searchInput, { target: { value: "Sneha" } });

    expect(screen.getByText(/Sneha Patil/)).toBeTruthy();
    expect(screen.queryByText(/Rahul Shinde/)).toBeNull();

    // Clear search
    const clearBtn = screen.getByRole("button", { name: "✕" });
    fireEvent.click(clearBtn);

    expect(screen.getByText(/Rahul Shinde/)).toBeTruthy();
    expect(screen.getByText(/Sneha Patil/)).toBeTruthy();
  });

  it("6. renders empty state when no volunteers exist", () => {
    render(
      <VolunteerFinancialLedger
        ledger={{
          ...mockLedger,
          summary: { ...mockLedger.summary, grand_total_collected: 0 },
          volunteers: [],
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    expect(
      screen.getByText("सध्या कोणतेही कार्यकर्ते नाहीत")
    ).toBeTruthy();
  });

  it("7. renders zero-collection empty state when collection hasn't started", () => {
    render(
      <VolunteerFinancialLedger
        ledger={{
          ...mockLedger,
          summary: { ...mockLedger.summary, grand_total_collected: 0 },
          volunteers: [
            {
              ...mockLedger.volunteers[0],
              total_collected: 0,
              receipt_count: 0,
            },
          ],
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    expect(
      screen.getByText("अजून वर्गणी जमा झालेली नाही")
    ).toBeTruthy();
  });

  it("8. renders error state and triggers retry callback", () => {
    const onRefresh = vi.fn();
    render(
      <VolunteerFinancialLedger
        ledger={null}
        loading={false}
        error="Network timeout"
        onRefresh={onRefresh}
      />
    );

    expect(
      screen.getByText(
        "कार्यकर्त्यांचा हिशोब लोड करता आला नाही (Unable to load ledger)"
      )
    ).toBeTruthy();
    expect(screen.getByText("Network timeout")).toBeTruthy();

    const retryBtn = screen.getByRole("button", {
      name: /पुन्हा प्रयत्न करा/i,
    });
    fireEvent.click(retryBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
