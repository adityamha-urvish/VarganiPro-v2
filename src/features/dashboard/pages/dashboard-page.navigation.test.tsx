// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { CachedBuildingSummary, CachedPropertyProgress } from "@/lib/offline/offline-db";

const {
  initializeCollectionSessionMock,
  getLocalReceiptsMock,
  mergeOfflineBookStateMock,
  fetchEventBuildingSummariesMock,
  fetchBuildingPropertiesProgressMock,
  getUserMock,
  supabaseRpcMock,
  supabaseFromMock,
} = vi.hoisted(() => ({
  initializeCollectionSessionMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  mergeOfflineBookStateMock: vi.fn(),
  fetchEventBuildingSummariesMock: vi.fn(),
  fetchBuildingPropertiesProgressMock: vi.fn(),
  getUserMock: vi.fn(),
  supabaseRpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
}));

vi.mock("@/features/collection/services/collection-session.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/collection/services/collection-session.service")>();
  return {
    ...actual,
    initializeCollectionSession: initializeCollectionSessionMock,
  };
});

vi.mock("@/features/collection/services/collection-progress.service", () => ({
  fetchEventBuildingSummaries: fetchEventBuildingSummariesMock,
  fetchBuildingPropertiesProgress: fetchBuildingPropertiesProgressMock,
  recordFollowUp: vi.fn(async () => {}),
}));

vi.mock("@/lib/offline/offline-db", () => ({
  getLocalReceipts: getLocalReceiptsMock,
  mergeOfflineBookState: mergeOfflineBookStateMock,
  saveCachedBuildingSummaries: vi.fn(async () => {}),
  getCachedBuildingSummaries: vi.fn(async () => []),
  saveCachedBuildingProperties: vi.fn(async () => {}),
  getCachedBuildingProperties: vi.fn(async () => []),
  updateLocalPropertyProgress: vi.fn(async () => {}),
}));

vi.mock("@/lib/offline/receipt-sync", () => ({
  drainSyncQueue: vi.fn(async () => {}),
  setupAutoSync: vi.fn(() => () => {}),
  syncNextReceipt: vi.fn(async () => null),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
    rpc: supabaseRpcMock,
    from: supabaseFromMock,
  },
}));

import { DashboardPage } from "./dashboard-page";
import { AppLayout } from "@/app/layouts/AppLayout";
import {
  parseNavigationState,
  buildNavigationQueryString,
} from "../hooks/use-dashboard-navigation";

const mockAdminSession: CollectionSessionContext = {
  sessionId: "session-admin-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-admin-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-ADM-1",
  prefix: "VP-",
  startNumber: 1,
  endNumber: 100,
  currentNumber: 1,
  sessionStatus: "open",
  bookStatus: "assigned",
};

const mockBuilding: CachedBuildingSummary = {
  buildingId: "bld-1",
  eventId: "event-1",
  organizationId: "org-1",
  buildingName: "Gokul Heights",
  code: "GH",
  wing: "A",
  areaName: "Shivaji Nagar",
  totalUnits: 2,
  collectedCount: 0,
  pendingCount: 0,
  refusedCount: 0,
  notVisitedCount: 2,
  remainingCount: 2,
  totalAmountCollected: 0,
  lastActivityAt: null,
  cachedAt: new Date().toISOString(),
};

const mockProperties: CachedPropertyProgress[] = [
  {
    propertyId: "flat-101",
    buildingId: "bld-1",
    eventId: "event-1",
    organizationId: "org-1",
    propertyType: "flat",
    unitNumber: "101",
    flatNumber: "101",
    floorNumber: 1,
    shopName: null,
    ownerName: "Aditya Sharma",
    contactMobile: "9820011223",
    status: "not_visited",
    receiptCount: 0,
    totalCollectedAmount: 0,
    latestReceiptNumber: null,
    lastReceiptAt: null,
    pendingReason: null,
    followUpTime: null,
    followUpNotes: null,
    followUpAt: null,
    cachedAt: new Date().toISOString(),
  },
];

describe("P1 Navigation Architecture & Deep Linking Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/dashboard");
    localStorage.clear();
    getLocalReceiptsMock.mockResolvedValue([]);
    mergeOfflineBookStateMock.mockResolvedValue(mockAdminSession);
    initializeCollectionSessionMock.mockResolvedValue(mockAdminSession);
    fetchEventBuildingSummariesMock.mockResolvedValue([mockBuilding]);
    fetchBuildingPropertiesProgressMock.mockResolvedValue(mockProperties);
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-admin-1" } },
      error: null,
    });
    supabaseRpcMock.mockImplementation(async (fnName: string) => {
      if (fnName === "current_user_role") {
        return { data: "admin", error: null };
      }
      if (fnName === "get_secretary_overview_metrics") {
        return {
          data: {
            today: { total_amount: 0, cash_amount: 0, upi_amount: 0, cheque_amount: 0, receipt_count: 0 },
            total: { total_amount: 0, cash_amount: 0, upi_amount: 0, cheque_amount: 0, receipt_count: 0 },
            active_volunteers: 0,
            pending_handovers_count: 0,
            property_progress: { completion_percentage: 50 },
          },
          error: null,
        };
      }
      if (fnName === "get_volunteer_financial_ledger") {
        return {
          data: {
            success: true,
            event_id: "event-1",
            organization_id: "org-1",
            summary: {
              total_volunteers: 0,
              active_volunteers: 0,
              total_receipt_count: 0,
              grand_total_collected: 0,
              total_physical_collected: 0,
              total_digital_settled: 0,
              total_verified_handed_over: 0,
              total_verified_expenses: 0,
              total_outstanding_physical_held: 0,
              volunteers_holding_cash_count: 0,
            },
            volunteers: [],
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { organization_id: "org-1" }, error: null }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    });
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/dashboard");
  });

  it("Test 1 — Navigation query string parser and builder work symmetrically", () => {
    const parsed = parseNavigationState("?tab=buildings&buildingId=bld-1&flatId=flat-101&mode=collect");
    expect(parsed.tab).toBe("buildings");
    expect(parsed.buildingId).toBe("bld-1");
    expect(parsed.flatId).toBe("flat-101");
    expect(parsed.mode).toBe("collect");

    const qs = buildNavigationQueryString(parsed);
    expect(qs).toContain("tab=buildings");
    expect(qs).toContain("buildingId=bld-1");
    expect(qs).toContain("flatId=flat-101");
    expect(qs).toContain("mode=collect");
  });

  it("Test 2 — Default URL (/dashboard) renders Mandal Home Screen", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText(/Namaste/i)).toBeTruthy();
    expect(screen.getByTestId("secretary-new-receipt-btn")).toBeTruthy();
    expect(screen.getByTestId("nav-tab-collection")).toBeTruthy();
  });

  it("Test 3 — Tab Switching updates URL query params and displays corresponding workspace", async () => {
    render(<DashboardPage />);

    // Click Receipts (history) tab
    const historyTab = await screen.findByTestId("nav-tab-history");
    fireEvent.click(historyTab);

    // URL should have ?tab=history
    expect(window.location.search).toContain("tab=history");
    expect(screen.getByText(/Receipt Search & History/i)).toBeTruthy();

    // Click Handovers tab
    const handoverTab = screen.getByTestId("nav-tab-handovers");
    fireEvent.click(handoverTab);

    expect(window.location.search).toContain("tab=handovers");
    expect(await screen.findByText(/Volunteer Financial Custody|कार्यकर्ते हिशोब/i)).toBeTruthy();
  });

  it("Test 4 — Tapping Dashboard (🏠) resets URL parameters and returns to base home screen", async () => {
    render(<DashboardPage />);

    // Go to Handovers tab
    const handoverTab = await screen.findByTestId("nav-tab-handovers");
    fireEvent.click(handoverTab);
    expect(window.location.search).toContain("tab=handovers");

    // Tap Dashboard tab (🏠)
    const dashboardTab = screen.getByTestId("nav-tab-collection");
    fireEvent.click(dashboardTab);

    // Search params cleared, Mandal Home displayed
    expect(window.location.search).toBe("");
    expect(await screen.findByText(/Namaste/i)).toBeTruthy();
  });

  it("Test 5 — Admin Collection Mode enters ?mode=collect and back button resets to home", async () => {
    render(<DashboardPage />);

    const newReceiptBtn = await screen.findByTestId("secretary-new-receipt-btn");
    fireEvent.click(newReceiptBtn);

    expect(window.location.search).toContain("mode=collect");
    expect(screen.getByText("👑 Secretary Collection Mode")).toBeTruthy();

    // Tap Back to Dashboard
    const backBtn = screen.getByTestId("admin-back-dashboard");
    fireEvent.click(backBtn);

    expect(window.location.search).toBe("");
    expect(screen.getByTestId("secretary-new-receipt-btn")).toBeTruthy();
  });

  it("Test 6 — AppLayout shell architecture has 100dvh flex-col and overflow-y-auto scroll container", () => {
    const { container } = render(
      <MemoryRouter>
        <AppLayout>
          <div data-testid="test-content">Content</div>
        </AppLayout>
      </MemoryRouter>
    );

    const rootDiv = container.firstElementChild as HTMLElement;
    expect(rootDiv.className).toContain("h-[100dvh]");
    expect(rootDiv.className).toContain("overflow-hidden");
    expect(rootDiv.className).toContain("flex-col");

    const header = rootDiv.querySelector("header");
    expect(header?.className).toContain("shrink-0");

    const main = rootDiv.querySelector("main");
    expect(main?.className).toContain("flex-1");
    expect(main?.className).toContain("overflow-y-auto");
    expect(main?.className).toContain("overscroll-y-contain");
    expect(main?.className).toContain("pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]");
  });
});
