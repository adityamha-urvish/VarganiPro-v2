// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { CachedBuildingSummary, CachedPropertyProgress } from "@/lib/offline/offline-db";
import type { PropertyRecord } from "@/features/admin/master-data/services/master-data.service";

const {
  initializeCollectionSessionMock,
  getLocalReceiptsMock,
  mergeOfflineBookStateMock,
  fetchEventBuildingSummariesMock,
  fetchBuildingPropertiesProgressMock,
  getUserMock,
  supabaseRpcMock,
  supabaseFromMock,
  quickAddBuildingMock,
  quickAddFlatMock,
  quickAddShopMock,
  fetchStandaloneShopsMock,
} = vi.hoisted(() => ({
  initializeCollectionSessionMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  mergeOfflineBookStateMock: vi.fn(),
  fetchEventBuildingSummariesMock: vi.fn(),
  fetchBuildingPropertiesProgressMock: vi.fn(),
  getUserMock: vi.fn(),
  supabaseRpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  quickAddBuildingMock: vi.fn(),
  quickAddFlatMock: vi.fn(),
  quickAddShopMock: vi.fn(),
  fetchStandaloneShopsMock: vi.fn(),
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

vi.mock("@/features/admin/master-data/services/master-data.service", () => ({
  fetchOrganizationBuildings: vi.fn(async () => []),
  fetchBuildingProperties: vi.fn(async () => []),
  fetchStandaloneShops: fetchStandaloneShopsMock,
  createBuilding: vi.fn(),
  quickAddBuilding: quickAddBuildingMock,
  quickAddFlat: quickAddFlatMock,
  quickAddShop: quickAddShopMock,
  createStandaloneShop: vi.fn(),
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

const mockVolunteerSession: CollectionSessionContext = {
  sessionId: "session-vol-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-VOL-1",
  prefix: "VP-",
  startNumber: 1,
  endNumber: 100,
  currentNumber: 10,
  sessionStatus: "open",
  bookStatus: "assigned",
};

const mockBuilding: CachedBuildingSummary = {
  buildingId: "bld-1",
  eventId: "event-1",
  organizationId: "org-1",
  buildingName: "Gokuldham Co-op",
  code: "GK",
  wing: "A",
  areaName: "Powai",
  totalUnits: 5,
  collectedCount: 2,
  pendingCount: 1,
  refusedCount: 0,
  notVisitedCount: 2,
  remainingCount: 3,
  totalAmountCollected: 1002,
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
    ownerName: "Jethalal Gada",
    contactMobile: "9820011223",
    status: "collected",
    receiptCount: 1,
    totalCollectedAmount: 501,
    latestReceiptNumber: 101,
    lastReceiptAt: null,
    pendingReason: null,
    followUpTime: null,
    followUpNotes: null,
    followUpAt: null,
    cachedAt: new Date().toISOString(),
  },
];

const mockShops: PropertyRecord[] = [
  {
    id: "shop-1",
    organizationId: "org-1",
    buildingId: null,
    propertyType: "commercial",
    unitNumber: null,
    flatNumber: null,
    shopName: "Gada Electronics",
    floorNumber: null,
    ownerName: "Jethalal Champaklal Gada",
    contactMobile: "9820099999",
    locationNote: "Near Station",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

describe("Field Readiness Remediation: Volunteer & Admin Production Flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/dashboard?tab=masterData");
    localStorage.clear();
    getLocalReceiptsMock.mockResolvedValue([]);
    mergeOfflineBookStateMock.mockResolvedValue(mockVolunteerSession);
    initializeCollectionSessionMock.mockResolvedValue(mockVolunteerSession);
    fetchEventBuildingSummariesMock.mockResolvedValue([mockBuilding]);
    fetchBuildingPropertiesProgressMock.mockResolvedValue(mockProperties);
    fetchStandaloneShopsMock.mockResolvedValue(mockShops);
    quickAddBuildingMock.mockResolvedValue({
      buildingId: "bld-new-2",
      buildingName: "Sai Krupa",
      wing: "B",
      code: "SK",
    });
    quickAddFlatMock.mockResolvedValue({
      propertyId: "flat-new-201",
      isExisting: false,
      unitNumber: "201",
    });
    quickAddShopMock.mockResolvedValue({
      propertyId: "shop-new-2",
      isExisting: false,
      shopName: "Ganesh Sweets",
    });

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-vol-1" } },
      error: null,
    });
    supabaseRpcMock.mockImplementation(async (fnName: string) => {
      if (fnName === "current_user_role") {
        return { data: "volunteer", error: null };
      }
      return { data: null, error: null };
    });
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "app-user-1" },
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { organization_id: "org-1" },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "events") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [{ id: "event-1", name: "Ganeshotsav 2026", code: "GU-26", is_active: true }],
                error: null,
              })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [], error: null })),
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    });

  });

  afterEach(() => {
    cleanup();
  });

  it("1. Volunteer: Buildings workspace opens, + Add Building is visible and functional", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard?tab=masterData"]}>
        <DashboardPage />
      </MemoryRouter>
    );

    // Check header renders
    await waitFor(() => {
      expect(screen.getByText("Building Collection")).toBeTruthy();
      expect(screen.getByTestId("volunteer-add-building-btn")).toBeTruthy();
    });

    // Click + Add button
    fireEvent.click(screen.getByTestId("volunteer-add-building-btn"));
    expect(screen.getByText(/Add Building \(इमारत जोडा\)/)).toBeTruthy();

    // Fill form and submit
    fireEvent.change(screen.getByTestId("input-building-name"), { target: { value: "Sai Krupa" } });
    fireEvent.change(screen.getByTestId("input-building-wing"), { target: { value: "B" } });
    fireEvent.click(screen.getByTestId("btn-submit-building"));

    await waitFor(() => {
      expect(quickAddBuildingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Sai Krupa",
          wing: "B",
        })
      );
    });
  });

  it("2. Volunteer: Add Flat -> Add & Continue immediately opens receipt modal for new flat", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard?tab=masterData"]}>
        <DashboardPage />
      </MemoryRouter>
    );

    // Open existing building
    await waitFor(() => {
      expect(screen.getByTestId("btn-view-flats-bld-1")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("btn-view-flats-bld-1"));

    // Verify inside building flat grid
    await waitFor(() => {
      expect(screen.getByText("← All Buildings")).toBeTruthy();
      expect(screen.getByText("+ Add Flat")).toBeTruthy();
    });

    // Click + Add Flat
    fireEvent.click(screen.getByText("+ Add Flat"));
    expect(screen.getByText(/\+ Add Flat to/)).toBeTruthy();

    // Fill new flat details
    fireEvent.change(screen.getByLabelText(/Flat \/ Unit Number/), { target: { value: "201" } });
    fireEvent.change(screen.getByLabelText(/Floor \(Optional\)/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/Resident \/ Owner Name/), { target: { value: "Popatlal Pandey" } });
    fireEvent.change(screen.getByLabelText(/Mobile \(Optional\)/), { target: { value: "9820033333" } });

    // Click Add & Continue
    fireEvent.click(screen.getByText("⚡ Add & Continue →"));

    await waitFor(() => {
      expect(quickAddFlatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          buildingId: "bld-1",
          unitNumber: "201",
          floorNumber: 2,
          ownerName: "Popatlal Pandey",
          contactMobile: "9820033333",
        })
      );
    });

    // Verify FastReceiptModal immediately opens for Flat 201 without stale state race
    await waitFor(() => {
      expect(screen.getAllByText("Flat 201").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Receipt #10/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("3. Volunteer: Commercial tab displays shops, Add Shop is available, and shop collect opens modal", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard?tab=masterData"]}>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("filter-commercial")).toBeTruthy();
    });

    // Switch to Commercial segment
    fireEvent.click(screen.getByTestId("filter-commercial"));

    await waitFor(() => {
      expect(screen.getAllByText(/Gada Electronics/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Jethalal Champaklal Gada/)).toBeTruthy();
      expect(screen.getByText(/9820099999/)).toBeTruthy();
      expect(screen.getByTestId("volunteer-add-shop-btn")).toBeTruthy();
    });

    // Click collect receipt on existing shop
    fireEvent.click(screen.getByTestId("btn-collect-shop-shop-1"));

    // Verify FastReceiptModal opens with shop details
    await waitFor(() => {
      expect(screen.getAllByText(/Gada Electronics/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(/Receipt #10/).length).toBeGreaterThanOrEqual(1);
    });
  });


  it("4. Volunteer: Add Shop modal creates new commercial shop and triggers quickAddShop", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard?tab=masterData"]}>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("filter-commercial")).toBeTruthy();
    });

    // Switch to Commercial segment
    fireEvent.click(screen.getByTestId("filter-commercial"));

    await waitFor(() => {
      expect(screen.getByTestId("volunteer-add-shop-btn")).toBeTruthy();
    });

    // Click + Add Shop
    fireEvent.click(screen.getByTestId("volunteer-add-shop-btn"));
    expect(screen.getByText(/Add Commercial Shop \(दुकान जोडा\)/)).toBeTruthy();

    // Fill shop details
    fireEvent.change(screen.getByTestId("input-shop-name"), { target: { value: "Ganesh Sweets" } });
    fireEvent.change(screen.getByTestId("input-shop-owner"), { target: { value: "Babita Iyer" } });
    fireEvent.change(screen.getByTestId("input-shop-mobile"), { target: { value: "9820088888" } });

    // Submit shop
    fireEvent.click(screen.getByTestId("btn-submit-shop"));

    await waitFor(() => {
      expect(quickAddShopMock).toHaveBeenCalledWith({
        organizationId: "org-1",
        shopName: "Ganesh Sweets",
        ownerName: "Babita Iyer",
        contactMobile: "9820088888",
      });
    });
  });
});
