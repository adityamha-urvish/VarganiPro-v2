// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  SecretaryCommandCenter,
} from "./secretary-command-center";
import type { SecretaryOverviewMetrics, VolunteerFinancialLedgerResponse } from "../types/analytics.types";
import type { CachedBuildingSummary, LocalReceipt } from "@/lib/offline/offline-db";

const mockMetrics: SecretaryOverviewMetrics = {
  success: true,
  event_id: "event-123",
  organization_id: "org-123",
  today: {
    receipt_count: 128,
    total_amount: 68500,
    cash_amount: 52500,
    cheque_amount: 0,
    upi_amount: 16000,
    bank_transfer_amount: 0,
  },
  festival_total: {
    receipt_count: 480,
    total_amount: 245000,
    cash_amount: 180000,
    cheque_amount: 5000,
    upi_amount: 60000,
    bank_transfer_amount: 0,
  },
  property_progress: {
    total_residential_units: 120,
    collected_count: 75,
    pending_count: 7,
    refused_count: 2,
    not_visited_count: 36,
    completion_percentage: 63,
  },
  treasury: {
    pending_handover_count: 2,
    pending_handover_amount: 14500,
    treasury_cash_received: 34000,
    total_authorized_expenses: 0,
    total_physical_cash_held: 18500,
    volunteers_holding_cash_count: 4,
  },
};

const mockLedger: VolunteerFinancialLedgerResponse = {
  success: true,
  event_id: "event-123",
  organization_id: "org-123",
  summary: {
    total_volunteers: 4,
    active_volunteers: 4,
    total_receipt_count: 128,
    grand_total_collected: 68500,
    total_physical_collected: 52500,
    total_digital_settled: 16000,
    total_verified_handed_over: 34000,
    total_verified_expenses: 0,
    total_outstanding_physical_held: 18500,
    volunteers_holding_cash_count: 4,
  },
  volunteers: [
    {
      volunteer_id: "v1",
      name: "Rahul Sharma",
      mobile: "9820112345",
      status: "active",
      receipt_count: 22,
      total_collected: 11700,
      cash_collected: 8500,
      cheque_collected: 0,
      upi_collected: 3200,
      bank_transfer_collected: 0,
      physical_collected: 8500,
      digital_settled: 3200,
      verified_handed_over: 0,
      verified_expenses: 0,
      outstanding_physical_held: 8500,
      pending_handover_count: 1,
      pending_handover_amount: 8500,
      latest_handover_status: "submitted",
    },
    {
      volunteer_id: "v2",
      name: "Priya Patel",
      mobile: "9820223456",
      status: "active",
      receipt_count: 18,
      total_collected: 10500,
      cash_collected: 6000,
      cheque_collected: 0,
      upi_collected: 4500,
      bank_transfer_collected: 0,
      physical_collected: 6000,
      digital_settled: 4500,
      verified_handed_over: 0,
      verified_expenses: 0,
      outstanding_physical_held: 6000,
      pending_handover_count: 1,
      pending_handover_amount: 6000,
      latest_handover_status: "submitted",
    },
  ],
};

const mockBuildings: CachedBuildingSummary[] = [
  {
    buildingId: "b1",
    eventId: "event-123",
    organizationId: "org-123",
    buildingName: "Wing A",
    code: "WA",
    wing: "Gokul Dham",
    areaName: "Sector 1",
    totalUnits: 40,
    collectedCount: 34,
    pendingCount: 2,
    refusedCount: 0,
    notVisitedCount: 4,
    remainingCount: 6,
    totalAmountCollected: 32400,
    lastActivityAt: new Date().toISOString(),
    cachedAt: new Date().toISOString(),
  },
  {
    buildingId: "b2",
    eventId: "event-123",
    organizationId: "org-123",
    buildingName: "Wing B",
    code: "WB",
    wing: "Shanti Niwas",
    areaName: "Sector 1",
    totalUnits: 40,
    collectedCount: 25,
    pendingCount: 3,
    refusedCount: 0,
    notVisitedCount: 12,
    remainingCount: 15,
    totalAmountCollected: 22100,
    lastActivityAt: new Date().toISOString(),
    cachedAt: new Date().toISOString(),
  },
];

const mockRecentReceipts: LocalReceipt[] = [
  {
    clientReceiptId: "cr1",
    organizationId: "org-123",
    eventId: "event-123",
    collectionSessionId: "sess-123",
    receiptBookId: "rb1",
    volunteerId: "v1",
    propertyId: null,
    receiptNumber: 1042,
    donorName: "Rajesh Shinde",
    donorMobile: "9820411223",
    amount: 1500,
    paymentMode: "cash",
    paymentReference: null,
    notes: null,
    offlineCreatedAt: new Date().toISOString(),
    syncStatus: "synced",
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    clientReceiptId: "cr2",
    organizationId: "org-123",
    eventId: "event-123",
    collectionSessionId: "sess-123",
    receiptBookId: "rb1",
    volunteerId: "v2",
    propertyId: null,
    receiptNumber: 1041,
    donorName: "Sneha Deshmukh",
    donorMobile: "9820522334",
    amount: 2100,
    paymentMode: "upi",
    paymentReference: null,
    notes: null,
    offlineCreatedAt: new Date().toISOString(),
    syncStatus: "synced",
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("SecretaryCommandCenter Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Today's Total Collection, Cash vs UPI breakdown accurately", () => {
    render(
      <SecretaryCommandCenter
        metrics={mockMetrics}
        ledger={mockLedger}
        buildings={mockBuildings}
        recentReceipts={mockRecentReceipts}
        pendingSyncCount={3}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    // Primary Total
    expect(screen.getByTestId("today-total-collection").textContent).toBe("₹68,500");

    // Cash and UPI separation (₹52,500 appears in today's cash and total physical cash custody)
    expect(screen.getAllByText("₹52,500").length).toBe(2);
    expect(screen.getByText("₹16,000")).toBeTruthy();

    // Physical Cash Custody: Safe vs Field Custody
    expect(screen.getByText("₹34,000")).toBeTruthy();
    expect(screen.getByText("₹18,500")).toBeTruthy();

    // Festival Overall
    expect(screen.getByText("₹2,45,000")).toBeTruthy();
    expect(screen.getByText("63%")).toBeTruthy();
  });

  it("renders Needs Attention triage dock with pending handovers and sync count", () => {
    const onNavigateTab = vi.fn();
    const onSync = vi.fn();

    render(
      <SecretaryCommandCenter
        metrics={mockMetrics}
        ledger={mockLedger}
        buildings={mockBuildings}
        recentReceipts={mockRecentReceipts}
        pendingSyncCount={3}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onNavigateTab={onNavigateTab}
        onSync={onSync}
      />
    );

    expect(screen.getByTestId("needs-attention-dock")).toBeTruthy();
    expect(screen.getByText(/2 Handover/)).toBeTruthy();
    expect(screen.getByText(/3 Receipts/)).toBeTruthy();

    const verifyBtn = screen.getByRole("button", { name: /Verify Handover →/i });
    fireEvent.click(verifyBtn);
    expect(onNavigateTab).toHaveBeenCalledWith("handovers");

    const syncBtn = screen.getByRole("button", { name: /Sync Now 🔄/i });
    fireEvent.click(syncBtn);
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("renders Volunteer Fleet status with individual cash held & UPI totals", () => {
    render(
      <SecretaryCommandCenter
        metrics={mockMetrics}
        ledger={mockLedger}
        buildings={mockBuildings}
        recentReceipts={mockRecentReceipts}
        pendingSyncCount={0}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    expect(screen.getByText("Rahul Sharma")).toBeTruthy();
    expect(screen.getByText("₹8,500 Cash")).toBeTruthy();
    expect(screen.getByText("+₹3,200 UPI")).toBeTruthy();

    expect(screen.getByText("Priya Patel")).toBeTruthy();
    expect(screen.getByText("₹6,000 Cash")).toBeTruthy();
    expect(screen.getByText("+₹4,500 UPI")).toBeTruthy();
  });

  it("renders Building Coverage matrix with completion percentage", () => {
    render(
      <SecretaryCommandCenter
        metrics={mockMetrics}
        ledger={mockLedger}
        buildings={mockBuildings}
        recentReceipts={mockRecentReceipts}
        pendingSyncCount={0}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    expect(screen.getByText(/Wing A \(Gokul Dham\)/)).toBeTruthy();
    expect(screen.getByText("34/40 (85%)")).toBeTruthy();
    expect(screen.getByText(/Wing B \(Shanti Niwas\)/)).toBeTruthy();
    expect(screen.getByText("25/40 (63%)")).toBeTruthy();
  });

  it("renders Recent Receipts stream with payment badges and handles click", () => {
    const onViewReceipt = vi.fn();

    render(
      <SecretaryCommandCenter
        metrics={mockMetrics}
        ledger={mockLedger}
        buildings={mockBuildings}
        recentReceipts={mockRecentReceipts}
        pendingSyncCount={0}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onNavigateTab={vi.fn()}
        onViewReceipt={onViewReceipt}
      />
    );

    expect(screen.getByText("Rajesh Shinde")).toBeTruthy();
    expect(screen.getByText("₹1,500")).toBeTruthy();

    expect(screen.getByText("Sneha Deshmukh")).toBeTruthy();
    expect(screen.getByText("₹2,100")).toBeTruthy();

    fireEvent.click(screen.getByText("Rajesh Shinde"));
    expect(onViewReceipt).toHaveBeenCalledWith(mockRecentReceipts[0]);
  });

  describe("Financial Data Consistency & Invariant Verification", () => {
    it("Case 1: Fully Reconciled - Total = Cash + UPI and Custody = Safe + Field", () => {
      render(
        <SecretaryCommandCenter
          metrics={mockMetrics}
          ledger={mockLedger}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          onNavigateTab={vi.fn()}
        />
      );

      // Total Collection = ₹68,500
      expect(screen.getByTestId("today-total-collection").textContent).toBe("₹68,500");
      // Cash = ₹52,500, UPI = ₹16,000 -> 52500 + 16000 = 68500
      expect(screen.getAllByText("₹52,500").length).toBe(2); // In breakdown and custody header
      expect(screen.getByText("₹16,000")).toBeTruthy();
      // Safe (₹34,000) + Field (₹18,500) = ₹52,500
      expect(screen.getByText("₹34,000")).toBeTruthy();
      expect(screen.getByText("₹18,500")).toBeTruthy();
    });

    it("Case 2: Active Field Collection - Cash increment increases Field Custody and Total", () => {
      const activeMetrics: SecretaryOverviewMetrics = {
        ...mockMetrics,
        today: {
          ...mockMetrics.today,
          receipt_count: 134,
          total_amount: 72100,
          cash_amount: 54100,
          upi_amount: 18000,
        },
        treasury: {
          ...mockMetrics.treasury,
          treasury_cash_received: 34000,
          total_physical_cash_held: 20100, // +1600 in field
        },
      };

      render(
        <SecretaryCommandCenter
          metrics={activeMetrics}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          onNavigateTab={vi.fn()}
        />
      );

      // Today Total = ₹72,100 (54,100 Cash + 18,000 UPI)
      expect(screen.getByTestId("today-total-collection").textContent).toBe("₹72,100");
      expect(screen.getAllByText("₹54,100").length).toBe(2); // Today cash & custody badge
      expect(screen.getByText("₹18,000")).toBeTruthy();
      // Safe (₹34,000) + Field (₹20,100) = ₹54,100
      expect(screen.getByText("₹34,000")).toBeTruthy();
      expect(screen.getByText("₹20,100")).toBeTruthy();
    });

    it("Case 3: All Cash Handed Over - Safe holds 100% of cash, Field is ₹0", () => {
      const allHandedMetrics: SecretaryOverviewMetrics = {
        ...mockMetrics,
        treasury: {
          ...mockMetrics.treasury,
          pending_handover_count: 0,
          pending_handover_amount: 0,
          treasury_cash_received: 52500,
          total_physical_cash_held: 0,
          volunteers_holding_cash_count: 0,
        },
      };

      render(
        <SecretaryCommandCenter
          metrics={allHandedMetrics}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          onNavigateTab={vi.fn()}
        />
      );

      expect(screen.getByTestId("today-total-collection").textContent).toBe("₹68,500");
      // Safe has all ₹52,500
      expect(screen.getAllByText("₹52,500").length).toBe(3); // Breakdown cash, custody badge, safe amount
      expect(screen.getByText("₹0")).toBeTruthy(); // Field custody is 0
    });

    it("Case 4: Digital UPI Spike - Only digital track increases, Physical Custody invariant", () => {
      const upiSpikeMetrics: SecretaryOverviewMetrics = {
        ...mockMetrics,
        today: {
          ...mockMetrics.today,
          total_amount: 73500, // 52500 cash + 21000 upi (+5000)
          cash_amount: 52500,
          upi_amount: 21000,
        },
      };

      render(
        <SecretaryCommandCenter
          metrics={upiSpikeMetrics}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          onNavigateTab={vi.fn()}
        />
      );

      // Today Total = ₹73,500
      expect(screen.getByTestId("today-total-collection").textContent).toBe("₹73,500");
      expect(screen.getByText("₹21,000")).toBeTruthy();
      // Physical Cash Custody remains exactly ₹52,500 (Safe 34,000 + Field 18,500)
      expect(screen.getAllByText("₹52,500").length).toBe(2);
      expect(screen.getByText("₹34,000")).toBeTruthy();
      expect(screen.getByText("₹18,500")).toBeTruthy();
    });

    it("Case 5: Pending Follow-up Callback - Unrealized ₹0 value does not alter collection or custody", () => {
      const followUpMetrics: SecretaryOverviewMetrics = {
        ...mockMetrics,
        property_progress: {
          ...mockMetrics.property_progress,
          pending_count: 8, // One extra callback logged
          not_visited_count: 35,
        },
      };

      render(
        <SecretaryCommandCenter
          metrics={followUpMetrics}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          onNavigateTab={vi.fn()}
        />
      );

      // Total Collection and Physical Custody are completely unperturbed
      expect(screen.getByTestId("today-total-collection").textContent).toBe("₹68,500");
      expect(screen.getAllByText("₹52,500").length).toBe(2);
      expect(screen.getByText("₹16,000")).toBeTruthy();
    });
  });
});

