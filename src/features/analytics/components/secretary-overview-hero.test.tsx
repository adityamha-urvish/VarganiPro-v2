// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  SecretaryOverviewHero,
  formatCurrency,
} from "./secretary-overview-hero";
import type { SecretaryOverviewMetrics } from "../types/analytics.types";

const mockMetrics: SecretaryOverviewMetrics = {
  success: true,
  event_id: "event-123",
  organization_id: "org-123",
  today: {
    receipt_count: 5,
    total_amount: 14500,
    cash_amount: 8000,
    cheque_amount: 500,
    upi_amount: 6000,
    bank_transfer_amount: 0,
  },
  festival_total: {
    receipt_count: 124,
    total_amount: 52750,
    cash_amount: 30000,
    cheque_amount: 2750,
    upi_amount: 20000,
    bank_transfer_amount: 0,
  },
  property_progress: {
    total_residential_units: 200,
    collected_count: 156,
    pending_count: 20,
    refused_count: 4,
    not_visited_count: 20,
    completion_percentage: 78,
  },
  treasury: {
    pending_handover_count: 2,
    pending_handover_amount: 2750,
    treasury_cash_received: 32500,
    total_authorized_expenses: 1200,
    total_physical_cash_held: 4250,
    volunteers_holding_cash_count: 3,
  },
};

describe("formatCurrency", () => {
  it("formats whole numbers cleanly without decimals", () => {
    expect(formatCurrency(14500)).toBe("₹14,500");
    expect(formatCurrency(0)).toBe("₹0");
  });

  it("formats decimal amounts when paise are present", () => {
    expect(formatCurrency(500.5)).toBe("₹500.50");
  });
});

describe("SecretaryOverviewHero", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders today's collection, festival total and treasury metrics accurately", () => {
    render(
      <SecretaryOverviewHero
        metrics={mockMetrics}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />
    );

    // Today's collection
    expect(screen.getByText("₹14,500")).toBeTruthy();
    expect(screen.getByText("5 पावत्या (Receipts)")).toBeTruthy();

    // Physical & Digital breakdown
    expect(screen.getByText("₹8,500")).toBeTruthy();
    expect(screen.getByText("₹6,000")).toBeTruthy();

    // Festival total
    expect(screen.getByText("₹52,750")).toBeTruthy();
    expect(screen.getByText("124 एकूण पावत्या")).toBeTruthy();

    // Treasury and volunteer custody
    expect(screen.getByText("₹32,500")).toBeTruthy();
    expect(screen.getByText("₹4,250")).toBeTruthy();
    expect(screen.getByText("3 कार्यकर्ते")).toBeTruthy();

    // Door-to-door progress
    expect(screen.getByText("78% पूर्ण")).toBeTruthy();
    expect(screen.getByText(/200 घरे/)).toBeTruthy();
  });

  it("renders the pending handover alert and triggers review callback", () => {
    const onReview = vi.fn();
    render(
      <SecretaryOverviewHero
        metrics={mockMetrics}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onReviewHandovers={onReview}
      />
    );

    expect(
      screen.getByText("2 हस्तबदल तपासणीसाठी बाकी आहेत")
    ).toBeTruthy();
    expect(screen.getByText("₹2,750")).toBeTruthy();

    const reviewButton = screen.getByRole("button", {
      name: /हिशोब तपासा \(Review\)/i,
    });
    fireEvent.click(reviewButton);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it("renders error state when error is provided", () => {
    const onRefresh = vi.fn();
    render(
      <SecretaryOverviewHero
        metrics={null}
        loading={false}
        error="Permission denied"
        onRefresh={onRefresh}
      />
    );

    expect(
      screen.getByText("आकडेवारी लोड करता आली नाही (Unable to load overview)")
    ).toBeTruthy();
    expect(screen.getByText("Permission denied")).toBeTruthy();

    const retryBtn = screen.getByRole("button", {
      name: /पुन्हा प्रयत्न करा/i,
    });
    fireEvent.click(retryBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
