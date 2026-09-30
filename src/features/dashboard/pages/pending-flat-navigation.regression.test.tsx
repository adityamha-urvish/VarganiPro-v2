// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { CachedBuildingSummary, CachedPropertyProgress } from "@/lib/offline/offline-db";

const {
  initializeCollectionSessionMock,
  getLocalReceiptsMock,
  mergeOfflineBookStateMock,
  fetchEventBuildingSummariesMock,
  fetchBuildingPropertiesProgressMock,
  recordFollowUpMock,
  getUserMock,
  supabaseRpcMock,
  supabaseFromMock,
  quickAddFlatMock,
  createLocalReceiptMock,
} = vi.hoisted(() => ({
  initializeCollectionSessionMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  mergeOfflineBookStateMock: vi.fn(),
  fetchEventBuildingSummariesMock: vi.fn(),
  fetchBuildingPropertiesProgressMock: vi.fn(),
  recordFollowUpMock: vi.fn(),
  getUserMock: vi.fn(),
  supabaseRpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  quickAddFlatMock: vi.fn(),
  createLocalReceiptMock: vi.fn(),
}));

vi.mock("@/features/collection/services/collection-session.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/collection/services/collection-session.service")>();
  return {
    ...actual,
    initializeCollectionSession: initializeCollectionSessionMock,
    loadCurrentCollectionSession: vi.fn(async () => mockVolunteerSession),
  };
});

vi.mock("@/features/collection/services/collection-progress.service", () => ({
  fetchEventBuildingSummaries: fetchEventBuildingSummariesMock,
  fetchBuildingPropertiesProgress: fetchBuildingPropertiesProgressMock,
  recordFollowUp: recordFollowUpMock,
}));

vi.mock("@/features/admin/master-data/services/master-data.service", () => ({
  quickAddFlat: quickAddFlatMock,
  quickAddBuilding: vi.fn(),
  quickAddShop: vi.fn(),
  fetchStandaloneShops: vi.fn(async () => []),
}));

vi.mock("@/lib/offline/receipt-store", () => ({
  createLocalReceipt: createLocalReceiptMock,
}));

vi.mock("@/lib/offline/offline-db", () => ({
  getLocalReceipts: getLocalReceiptsMock,
  getLocalReceiptsForSession: getLocalReceiptsMock,
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
  organizationId: "org-test-1",
  eventId: "event-test-1",
  volunteerId: "vol-1",
  receiptBookId: "book-test-1",
  bookNumber: "BK-01",
  prefix: "VP-",
  startNumber: 1,
  endNumber: 100,
  currentNumber: 1,
  sessionStatus: "open",
  bookStatus: "assigned",
};

const mockBuilding: CachedBuildingSummary = {
  buildingId: "bld-test-1",
  eventId: "event-test-1",
  organizationId: "org-test-1",
  buildingName: "Sai Sadan",
  code: "SS",
  wing: "A",
  areaName: "Station Road",
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

const initialProperties: CachedPropertyProgress[] = [
  {
    propertyId: "flat-101",
    buildingId: "bld-test-1",
    eventId: "event-test-1",
    organizationId: "org-test-1",
    propertyType: "flat",
    unitNumber: "101",
    flatNumber: "101",
    floorNumber: 1,
    shopName: null,
    ownerName: "Ramesh Sharma",
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
  {
    propertyId: "flat-102",
    buildingId: "bld-test-1",
    eventId: "event-test-1",
    organizationId: "org-test-1",
    propertyType: "flat",
    unitNumber: "102",
    flatNumber: "102",
    floorNumber: 1,
    shopName: null,
    ownerName: "Suresh Gupta",
    contactMobile: "9820011224",
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

describe("Pending Flat Navigation UX Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/dashboard?tab=buildings&buildingId=bld-test-1&mode=collect");
    localStorage.clear();
    getLocalReceiptsMock.mockResolvedValue([]);
    mergeOfflineBookStateMock.mockResolvedValue(mockVolunteerSession);
    initializeCollectionSessionMock.mockResolvedValue(mockVolunteerSession);
    fetchEventBuildingSummariesMock.mockResolvedValue([mockBuilding]);
    fetchBuildingPropertiesProgressMock.mockResolvedValue([...initialProperties]);
    recordFollowUpMock.mockResolvedValue(undefined);
    quickAddFlatMock.mockResolvedValue({
      propertyId: "flat-401",
      unitNumber: "401",
      floorNumber: 4,
    });
    createLocalReceiptMock.mockResolvedValue({
      id: "rcpt-1",
      clientReceiptId: "rcpt-1",
      receiptBookId: "book-test-1",
      organizationId: "org-test-1",
      eventId: "event-test-1",
      collectionSessionId: "session-vol-1",
      volunteerId: "vol-1",
      propertyId: "flat-101",
      receiptNumber: 1,
      amount: 501,
      paymentMode: "cash",
      donorName: "Ramesh Sharma",
      donorMobile: "9820011223",
      syncStatus: "pending",
      offlineCreatedAt: new Date().toISOString(),
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
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { name: "Test Mandal" }, error: null }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    });
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/dashboard");
  });

  it("TEST B — Marking a flat as Pending ('Come Later') returns directly to the SAME Building page with NO next-flat popup", async () => {
    render(<DashboardPage />);

    // Wait for the building flat grid to load
    expect(await screen.findByText("Flat 101")).toBeTruthy();
    expect(screen.getByText("Flat 102")).toBeTruthy();
    expect(screen.getByText(/Sai Sadan/i)).toBeTruthy();

    // Click "+ Add Flat"
    const addFlatBtn = screen.getByRole("button", { name: /\+ Add Flat/i });
    fireEvent.click(addFlatBtn);

    // Fill in new flat details
    const unitInput = screen.getByLabelText(/Flat \/ Unit Number/i);
    fireEvent.change(unitInput, { target: { value: "401" } });

    // Click "⚡ Add & Continue →"
    const continueBtn = screen.getByRole("button", { name: /⚡ Add & Continue →/i });
    fireEvent.click(continueBtn);

    // Fast Receipt modal opens for Flat 401
    expect(await screen.findByText("Receipt #1")).toBeTruthy();
    expect(screen.getAllByText("Flat 401").length).toBeGreaterThanOrEqual(1);

    // Click "⏰ Mark Pending / Refused"
    const markPendingBtn = screen.getByRole("button", { name: /⏰ Mark Pending \/ Refused/i });
    fireEvent.click(markPendingBtn);

    // Pending Reason Drawer opens
    expect(await screen.findByText("Mark Flat 401")).toBeTruthy();

    // Select "Come Later / Return Later"
    const comeLaterBtn = screen.getByRole("button", { name: /⏰ Come Later \/ Return Later/i });
    fireEvent.click(comeLaterBtn);

    // Select follow-up time chip
    const eveningChip = screen.getByRole("button", { name: /Evening after 7 PM/i });
    fireEvent.click(eveningChip);

    // Click "Save Pending"
    const savePendingBtn = screen.getByRole("button", { name: /Save Pending/i });
    fireEvent.click(savePendingBtn);

    // Wait for follow-up submission to complete
    await waitFor(() => {
      expect(recordFollowUpMock).toHaveBeenCalledWith(
        expect.objectContaining({
          buildingId: "bld-test-1",
          propertyId: "flat-401",
          reason: "asked_to_return_later",
          followUpTime: "Evening after 7 PM",
        })
      );
    });

    // VERIFY EXPECTED OUTCOME:
    // 1. We are still on the SAME building workspace (Sai Sadan)
    expect(screen.getByText(/Sai Sadan/i)).toBeTruthy();

    // 2. The newly created Flat 401 appears in the grid with "Come Later ⏰" badge
    expect(screen.getByText("Flat 401")).toBeTruthy();
    expect(screen.getByText("Come Later ⏰")).toBeTruthy();

    // 3. FastReceiptModal is CLOSED (no "Receipt #1" or "Flat 102" receipt popup automatically opened)
    expect(screen.queryByText("Receipt #1")).toBeNull();
    expect(screen.queryByText("Mark Flat 102")).toBeNull();
    expect(screen.queryByText("Mark Flat 401")).toBeNull();

    // 4. URL flatId is cleared
    expect(window.location.search).not.toContain("flatId=");
    expect(window.location.search).toContain("buildingId=bld-test-1");
  });

  it("TEST A — Normal Receipt collection flow remains intact and returns to the SAME Building page on 'Done'", async () => {
    render(<DashboardPage />);

    // Click on Flat 101 to open receipt modal
    const flat101Btn = await screen.findByText("Flat 101");
    fireEvent.click(flat101Btn);

    // Fast Receipt modal opens for Flat 101
    expect(await screen.findByText("Receipt #1")).toBeTruthy();

    // Collect receipt
    const collectBtn = screen.getByRole("button", { name: /⚡ Collect Receipt #1 ✓/i });
    fireEvent.click(collectBtn);

    // Receipt creation confirmation opens
    expect(await screen.findByText("Receipt Generated")).toBeTruthy();

    // Click "Done" on confirmation dialog
    const doneBtn = screen.getByTestId("confirmation-done-btn");
    fireEvent.click(doneBtn);

    // Returns to SAME Building page
    expect(screen.getByText(/Sai Sadan/i)).toBeTruthy();
    expect(screen.queryByText("Receipt Generated")).toBeNull();
    expect(screen.queryByText("Receipt #1")).toBeNull();
  });

  it("TEST C — Existing Pending Flat can be opened and saving pending returns to the SAME Building page", async () => {
    const existingPendingProps: CachedPropertyProgress[] = [
      {
        ...initialProperties[0],
        status: "pending",
        pendingReason: "asked_to_return_later",
      },
      initialProperties[1],
    ];
    fetchBuildingPropertiesProgressMock.mockResolvedValue(existingPendingProps);

    render(<DashboardPage />);

    // Flat 101 shows Come Later badge
    expect(await screen.findByText("Come Later ⏰")).toBeTruthy();

    // Tap on the existing pending flat
    const flat101Btn = screen.getByText("Flat 101");
    fireEvent.click(flat101Btn);

    // Fast receipt modal opens for Flat 101
    expect(await screen.findByText("Receipt #1")).toBeTruthy();

    // Click "⏰ Mark Pending / Refused"
    const markPendingBtn = screen.getByRole("button", { name: /⏰ Mark Pending \/ Refused/i });
    fireEvent.click(markPendingBtn);

    // Select Door Locked
    const doorLockedBtn = await screen.findByRole("button", { name: /🏠 Door Locked \/ Not Home/i });
    fireEvent.click(doorLockedBtn);

    // Click "Save Pending"
    const savePendingBtn = screen.getByRole("button", { name: /Save Pending/i });
    fireEvent.click(savePendingBtn);

    // Wait for submission
    await waitFor(() => {
      expect(recordFollowUpMock).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId: "flat-101",
          reason: "door_locked",
        })
      );
    });

    // Remains on SAME Building page with NO modal popup
    expect(screen.getByText(/Sai Sadan/i)).toBeTruthy();
    expect(screen.queryByText("Receipt #1")).toBeNull();
    expect(screen.queryByText("Mark Flat 101")).toBeNull();
  });
});
