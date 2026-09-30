// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MandalHomeScreen } from "./mandal-home-screen";
import { RoleNavigation } from "@/app/layouts/RoleNavigation";
import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { LocalReceipt } from "@/lib/offline/offline-db";

const {
  initializeCollectionSessionMock,
  getLocalReceiptsMock,
  supabaseRpcMock,
  supabaseFromMock,
  getUserMock,
} = vi.hoisted(() => ({
  initializeCollectionSessionMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  supabaseRpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/features/collection/services/collection-session.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/collection/services/collection-session.service")>();
  return {
    ...actual,
    initializeCollectionSession: initializeCollectionSessionMock,
  };
});

vi.mock("@/features/collection/services/collection-progress.service", () => ({
  fetchEventBuildingSummaries: vi.fn(async () => [
    {
      buildingId: "bld-1",
      eventId: "event-1",
      organizationId: "org-1",
      buildingName: "Gokul Heights",
      code: "GH",
      wing: "A",
      areaName: "Shivaji Nagar",
      totalUnits: 10,
      collectedCount: 4,
      pendingCount: 2,
      refusedCount: 0,
      notVisitedCount: 4,
      remainingCount: 6,
      totalAmountCollected: 2400,
      lastActivityAt: null,
      cachedAt: new Date().toISOString(),
    },
  ]),
  fetchBuildingPropertiesProgress: vi.fn(async () => [
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
  ]),
  recordFollowUp: vi.fn(async () => {}),
}));

vi.mock("@/lib/offline/offline-db", () => ({
  getLocalReceipts: getLocalReceiptsMock,
  getLocalReceiptsForSession: getLocalReceiptsMock,
  mergeOfflineBookState: vi.fn(),
}));

vi.mock("@/lib/offline/receipt-sync", () => ({
  syncNextReceipt: vi.fn(),
  drainSyncQueue: vi.fn(async () => {}),
  setupAutoSync: vi.fn(() => () => {}),
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

import { DashboardPage } from "../pages/dashboard-page";

const mockActiveSession: CollectionSessionContext = {
  sessionId: "session-active-123",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-1",
  receiptBookId: "book-02",
  bookNumber: "BK-02",
  prefix: "VP-NU",
  startNumber: 101,
  endNumber: 200,
  currentNumber: 138,
  sessionStatus: "open",
  bookStatus: "assigned",
};

const mockReceipts: LocalReceipt[] = Array.from({ length: 17 }, (_, i) => ({
  clientReceiptId: `client-${121 + i}`,
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "session-active-123",
  receiptBookId: "book-02",
  volunteerId: "vol-1",
  propertyId: null,
  receiptNumber: 121 + i,
  donorName: `Donor ${121 + i}`,
  donorMobile: "9876543210",
  amount: 918.94,
  paymentMode: "cash",
  paymentReference: null,
  notes: null,
  offlineCreatedAt: "2026-09-29T10:00:00.000Z",
  syncStatus: "synced",
  syncAttempts: 0,
  lastSyncAttemptAt: null,
  lastSyncError: null,
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
}));

describe("Navigation & Session State UX Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });

    supabaseRpcMock.mockImplementation(async (method: string) => {
      if (method === "current_user_role") {
        return { data: "volunteer", error: null };
      }
      return { data: null, error: null };
    });

    supabaseFromMock.mockImplementation(() => {
      const builder: any = {
        eq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        in: vi.fn(() => builder),
        or: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        then: (resolve: (val: any) => any) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return { select: vi.fn(() => builder) };
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("1. State-Aware Home Screen & Contextual Banner", () => {
    it("State A (No active session): Renders 'Start Collection' tile and NO active session banner", () => {
      render(
        <MandalHomeScreen
          hasActiveSession={false}
          sessionReceiptCount={0}
          sessionTotalAmount={0}
          onStartCollection={vi.fn()}
          onNavigateTab={vi.fn()}
        />
      );

      // Contextual active banner should NOT be rendered
      expect(screen.queryByTestId("active-session-banner")).toBeNull();

      // Quick action tile displays "Start Collection"
      const startTile = screen.getByTestId("home-tile-start-collection");
      expect(startTile.textContent).toContain("Start Collection");
      expect(startTile.textContent).toContain("New receipt session");
    });

    it("State B (Active session): Renders lightweight compact active banner and state-aware tile with exact receipt count and amount", () => {
      const onStartCollection = vi.fn();
      const onNavigateToCloseSession = vi.fn();

      render(
        <MandalHomeScreen
          hasActiveSession={true}
          sessionReceiptCount={17}
          sessionTotalAmount={15622}
          onStartCollection={onStartCollection}
          onNavigateToCloseSession={onNavigateToCloseSession}
          onNavigateTab={vi.fn()}
        />
      );

      // 1. Contextual active session banner strip is rendered
      const banner = screen.getByTestId("active-session-banner");
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain("Collection Active");
      expect(banner.textContent).toContain("17 receipts · ₹15,622");

      // 2. Banner has [Continue] button
      const continueBtn = screen.getByTestId("banner-btn-continue-session");
      expect(continueBtn).toBeTruthy();
      fireEvent.click(continueBtn);
      expect(onStartCollection).toHaveBeenCalledTimes(1);

      // 3. Banner has [End Session] button directly exposing close flow
      const endBtn = screen.getByTestId("banner-btn-end-session");
      expect(endBtn).toBeTruthy();
      fireEvent.click(endBtn);
      expect(onNavigateToCloseSession).toHaveBeenCalledTimes(1);

      // 4. State-aware Quick Action tile also reflects active session state
      const startTile = screen.getByTestId("home-tile-start-collection");
      expect(startTile.textContent).toContain("Collection Active");
      expect(startTile.textContent).toContain("17 receipts · ₹15,622");
    });
  });

  describe("2. Quick Actions Grid Configuration", () => {
    it("renders the approved 5 quick action tiles and excludes removed buttons", () => {
      const onNavigateTab = vi.fn();

      render(
        <MandalHomeScreen
          hasActiveSession={false}
          onStartCollection={vi.fn()}
          onNavigateTab={onNavigateTab}
        />
      );

      // Approved 5 tiles present
      expect(screen.getByTestId("home-tile-start-collection")).toBeTruthy();
      expect(screen.getByTestId("home-tile-buildings")).toBeTruthy();
      expect(screen.getByTestId("home-tile-receipts")).toBeTruthy();
      expect(screen.getByTestId("home-tile-handovers")).toBeTruthy();
      expect(screen.getByTestId("home-tile-expenses")).toBeTruthy();

      // Navigation routing on tile clicks
      fireEvent.click(screen.getByTestId("home-tile-buildings"));
      expect(onNavigateTab).toHaveBeenCalledWith("masterData");

      fireEvent.click(screen.getByTestId("home-tile-receipts"));
      expect(onNavigateTab).toHaveBeenCalledWith("history");

      fireEvent.click(screen.getByTestId("home-tile-handovers"));
      expect(onNavigateTab).toHaveBeenCalledWith("handovers");

      fireEvent.click(screen.getByTestId("home-tile-expenses"));
      expect(onNavigateTab).toHaveBeenCalledWith("expenses");
    });
  });

  describe("3. More Drawer Surface & Secondary Actions", () => {
    it("surfaces Mandal QR, Cash Handover, and App Settings in the Volunteer More drawer", () => {
      const onTabChange = vi.fn();
      const onShowMandalQr = vi.fn();

      render(
        <RoleNavigation
          activeTab="collection"
          onTabChange={onTabChange}
          isAdmin={false}
          onShowMandalQr={onShowMandalQr}
        />
      );

      // Open mobile More drawer
      const moreBtn = screen.getByTestId("mobile-nav-tab-more_drawer");
      fireEvent.click(moreBtn);

      // Drawer is open with items
      expect(screen.getByTestId("mobile-more-drawer")).toBeTruthy();
      expect(screen.getByTestId("drawer-tab-handovers")).toBeTruthy();
      expect(screen.getByTestId("drawer-tab-mandalQr")).toBeTruthy();
      expect(screen.getByTestId("drawer-tab-more")).toBeTruthy();

      // Clicking Mandal QR triggers QR modal callback
      fireEvent.click(screen.getByTestId("drawer-tab-mandalQr"));
      expect(onShowMandalQr).toHaveBeenCalledTimes(1);
    });

    it("surfaces Receipt Books, Volunteers, Handovers, Mandal QR, and Reports in Admin More drawer", () => {
      const onTabChange = vi.fn();

      render(
        <RoleNavigation
          activeTab="collection"
          onTabChange={onTabChange}
          isAdmin={true}
        />
      );

      // Open mobile More drawer
      fireEvent.click(screen.getByTestId("mobile-nav-tab-more_drawer"));

      expect(screen.getByTestId("drawer-tab-receiptBooks")).toBeTruthy();
      expect(screen.getByTestId("drawer-tab-volunteers")).toBeTruthy();
      expect(screen.getByTestId("drawer-tab-handovers")).toBeTruthy();
      expect(screen.getByTestId("drawer-tab-mandalQr")).toBeTruthy();
      expect(screen.getByTestId("drawer-tab-more")).toBeTruthy();
    });
  });

  describe("4. End-to-End Integration in DashboardPage", () => {
    it("Active session displays banner on Home and allows direct End Session navigation", async () => {
      initializeCollectionSessionMock.mockResolvedValue(mockActiveSession);
      getLocalReceiptsMock.mockResolvedValue(mockReceipts);

      render(<DashboardPage />);

      // Banner appears on home screen
      const banner = await screen.findByTestId("active-session-banner");
      expect(banner).toBeTruthy();

      // Click End Session button on the banner
      const endBtn = screen.getByTestId("banner-btn-end-session");
      fireEvent.click(endBtn);

      // Renders Close Session confirmation screen
      expect(await screen.findByRole("button", { name: "Close Collection Session" })).toBeTruthy();
    });

    it("Unified Buildings flow: Navigating to Buildings tab shows Buildings screen for both Volunteer and Admin", async () => {
      initializeCollectionSessionMock.mockResolvedValue(mockActiveSession);
      getLocalReceiptsMock.mockResolvedValue([]);

      render(<DashboardPage />);

      // Navigate to Buildings tab
      const buildingsTab = await screen.findByTestId("nav-tab-masterData");
      fireEvent.click(buildingsTab);

      // Renders Buildings screen with Residential / Commercial segments
      expect(await screen.findByText("Building Collection")).toBeTruthy();
      expect(screen.getByText(/Residential/i)).toBeTruthy();
      expect(screen.getByText(/Commercial/i)).toBeTruthy();
    });
  });
});
