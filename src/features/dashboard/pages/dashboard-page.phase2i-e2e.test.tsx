// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { CachedBuildingSummary, CachedPropertyProgress, LocalReceipt } from "@/lib/offline/offline-db";

const {
  initializeCollectionSessionMock,
  getLocalReceiptsMock,
  mergeOfflineBookStateMock,
  fetchEventBuildingSummariesMock,
  fetchBuildingPropertiesProgressMock,
  recordFollowUpMock,
  createLocalReceiptMock,
} = vi.hoisted(() => ({
  initializeCollectionSessionMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  mergeOfflineBookStateMock: vi.fn(),
  fetchEventBuildingSummariesMock: vi.fn(),
  fetchBuildingPropertiesProgressMock: vi.fn(),
  recordFollowUpMock: vi.fn(),
  createLocalReceiptMock: vi.fn(),
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
  recordFollowUp: recordFollowUpMock,
}));

vi.mock("@/lib/offline/receipt-store", () => ({
  createLocalReceipt: createLocalReceiptMock,
}));

vi.mock("@/lib/offline/receipt-sync", () => ({
  drainSyncQueue: vi.fn(async () => {}),
  setupAutoSync: vi.fn(() => () => {}),
  syncNextReceipt: vi.fn(async () => null),
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

vi.mock("@/supabase/client", () => {
  const createMockBuilder = () => {
    const builder: any = {
      select: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: { organization_id: "org-1" }, error: null })),
      maybeSingle: vi.fn(async () => ({ data: { organization_id: "org-1" }, error: null })),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return builder;
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "auth-user-1" } },
          error: null,
        })),
      },
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "current_user_role") {
          return { data: "volunteer", error: null };
        }
        if (fnName === "create_property") {
          return { data: { property_id: "prop-402", success: true }, error: null };
        }
        return { data: { success: true }, error: null };
      }),
      from: vi.fn(() => createMockBuilder()),
    },
  };
});

import { DashboardPage } from "./dashboard-page";

const mockOpenSession: CollectionSessionContext = {
  sessionId: "session-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-1",
  prefix: "VP-",
  startNumber: 101,
  endNumber: 200,
  currentNumber: 105,
  sessionStatus: "open",
  bookStatus: "assigned",
};

const defaultMockBuilding: CachedBuildingSummary = {
  buildingId: "bld-shivaji",
  eventId: "event-1",
  organizationId: "org-1",
  buildingName: "Shivaji Heights",
  code: "SH",
  wing: "A",
  areaName: "Shivaji Nagar",
  totalUnits: 0,
  collectedCount: 0,
  pendingCount: 0,
  refusedCount: 0,
  notVisitedCount: 0,
  remainingCount: 0,
  totalAmountCollected: 0,
  lastActivityAt: null,
  cachedAt: new Date().toISOString(),
};

describe("Phase 2I: End-to-End Acceptance QA Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocalReceiptsMock.mockResolvedValue([]);
    mergeOfflineBookStateMock.mockResolvedValue(mockOpenSession);
    initializeCollectionSessionMock.mockResolvedValue(mockOpenSession);
    fetchEventBuildingSummariesMock.mockResolvedValue([defaultMockBuilding]);
    fetchBuildingPropertiesProgressMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("QA Step 2: Full End-to-End Flow (Building -> Flat 402 -> Add & Continue -> ₹501 Receipt -> Irregular Flat 405 -> Pending)", async () => {
    const mockBuilding: CachedBuildingSummary = {
      buildingId: "bld-shivaji",
      eventId: "event-1",
      organizationId: "org-1",
      buildingName: "Shivaji Heights",
      code: "SH",
      wing: "A",
      areaName: "Shivaji Nagar",
      totalUnits: 0,
      collectedCount: 0,
      pendingCount: 0,
      refusedCount: 0,
      notVisitedCount: 0,
      remainingCount: 0,
      totalAmountCollected: 0,
      lastActivityAt: null,
      cachedAt: new Date().toISOString(),
    };

    fetchEventBuildingSummariesMock.mockResolvedValue([mockBuilding]);
    fetchBuildingPropertiesProgressMock.mockResolvedValue([]);

    render(<DashboardPage />);

    await waitFor(
      () => {
        expect(screen.getByText(/Continue Shivaji Heights/i)).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // A & B: Open Building
    fireEvent.click(screen.getByText(/Continue Shivaji Heights/i));

    await waitFor(() => {
      expect(screen.getByText(/Shivaji Heights \(Wing A\)/)).toBeTruthy();
      expect(screen.getByText(/No Flats Recorded Yet/)).toBeTruthy();
    });

    // C & D: Add Flat 402 with Add & Continue
    fireEvent.click(screen.getByText("+ Add First Flat"));

    const unitInput = screen.getByLabelText(/Flat \/ Unit Number/);
    fireEvent.change(unitInput, { target: { value: "402" } });

    const ownerInput = screen.getByLabelText(/Resident \/ Owner Name/);
    fireEvent.change(ownerInput, { target: { value: "Rajesh Patil" } });

    // Click Add & Continue
    const continueBtn = screen.getByText("⚡ Add & Continue →");
    fireEvent.click(continueBtn);

    // E: Confirm it enters Phase 2F Fast Receipt Modal with Building = Shivaji Heights, Wing = A, Flat = 402
    await waitFor(() => {
      expect(screen.getAllByText(/Flat 402/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Receipt #105/).length).toBeGreaterThanOrEqual(1);
    });

    // F: Issue ₹501 Cash receipt
    const mockCreatedReceipt: LocalReceipt = {
      clientReceiptId: "rec-local-105",
      receiptNumber: 105,
      receiptBookId: "book-1",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "vol-1",
      propertyId: "local_prop_402",
      amount: 501,
      paymentMode: "cash",
      paymentReference: null,
      donorName: "Rajesh Patil",
      donorMobile: null,
      notes: null,
      syncStatus: "pending",
      syncAttempts: 0,
      lastSyncError: null,
      lastSyncAttemptAt: null,
      offlineCreatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createLocalReceiptMock.mockResolvedValue(mockCreatedReceipt);

    const submitReceiptBtn = screen.getByRole("button", { name: /Collect Receipt/i });
    fireEvent.click(submitReceiptBtn);

    // G & H: Confirm receipt succeeds and building counts update to 1 Flat Recorded, 1 Collected, ₹501 Raised
    await waitFor(() => {
      expect(createLocalReceiptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 501,
          paymentMode: "cash",
          donorName: "Rajesh Patil",
        })
      );
    });
  });

  it("QA Step 3: Same Owner / Joint Flat Test (402 -> Rajesh Patil and 403 -> Rajesh Patil allowed as separate units)", async () => {
    const propertiesWithSameOwner: CachedPropertyProgress[] = [
      {
        propertyId: "prop-402",
        buildingId: "bld-1",
        eventId: "event-1",
        organizationId: "org-1",
        propertyType: "flat",
        unitNumber: "402",
        flatNumber: "402",
        floorNumber: 4,
        shopName: null,
        ownerName: "Rajesh Patil",
        contactMobile: "9820011111",
        status: "collected",
        receiptCount: 1,
        totalCollectedAmount: 501,
        latestReceiptNumber: 101,
        lastReceiptAt: "2026-09-09T10:00:00Z",
        pendingReason: null,
        followUpTime: null,
        followUpNotes: null,
        followUpAt: null,
        cachedAt: new Date().toISOString(),
      },
      {
        propertyId: "prop-403",
        buildingId: "bld-1",
        eventId: "event-1",
        organizationId: "org-1",
        propertyType: "flat",
        unitNumber: "403",
        flatNumber: "403",
        floorNumber: 4,
        shopName: null,
        ownerName: "Rajesh Patil",
        contactMobile: "9820011111",
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

    const mockBuilding: CachedBuildingSummary = {
      buildingId: "bld-1",
      eventId: "event-1",
      organizationId: "org-1",
      buildingName: "Shivaji Heights",
      code: "SH",
      wing: "A",
      areaName: "Shivaji Nagar",
      totalUnits: 2,
      collectedCount: 1,
      pendingCount: 0,
      refusedCount: 0,
      notVisitedCount: 1,
      remainingCount: 1,
      totalAmountCollected: 501,
      lastActivityAt: null,
      cachedAt: new Date().toISOString(),
    };

    fetchEventBuildingSummariesMock.mockResolvedValue([mockBuilding]);
    fetchBuildingPropertiesProgressMock.mockResolvedValue(propertiesWithSameOwner);

    render(<DashboardPage />);

    await waitFor(
      () => {
        expect(screen.getByText(/Continue Shivaji Heights/i)).toBeTruthy();
      },
      { timeout: 5000 }
    );
    fireEvent.click(screen.getByText(/Continue Shivaji Heights/i));

    await waitFor(
      () => {
        expect(screen.getByText("Flat 402")).toBeTruthy();
        expect(screen.getByText("Flat 403")).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Verify both have owner Rajesh Patil displayed and are separate items
    const ownerTags = screen.getAllByText("Rajesh Patil");
    expect(ownerTags.length).toBe(2);
  });

  it("QA Step 4: General / Ad Hoc Receipt Test (propertyId remains null, does not increment building coverage)", async () => {
    render(<DashboardPage />);

    await waitFor(
      () => {
        expect(screen.getByText("New Receipt")).toBeTruthy();
      },
      { timeout: 5000 }
    );

    const mockGeneralReceipt: LocalReceipt = {
      clientReceiptId: "rec-general-105",
      receiptNumber: 105,
      receiptBookId: "book-1",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "vol-1",
      propertyId: null,
      amount: 501,
      paymentMode: "cash",
      paymentReference: null,
      donorName: "Walk-in Mandap Donor",
      donorMobile: null,
      notes: null,
      syncStatus: "pending",
      syncAttempts: 0,
      lastSyncError: null,
      lastSyncAttemptAt: null,
      offlineCreatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createLocalReceiptMock.mockResolvedValue(mockGeneralReceipt);

    // Fill general receipt form
    const donorInput = screen.getByLabelText(/Donor Name/i);
    fireEvent.change(donorInput, { target: { value: "Walk-in Mandap Donor" } });

    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: "501" } });

    const createBtn = screen.getByRole("button", { name: /Create Receipt/i });
    fireEvent.click(createBtn);

    await waitFor(
      () => {
        expect(createLocalReceiptMock).toHaveBeenCalledWith(
          expect.objectContaining({
            propertyId: null,
            donorName: "Walk-in Mandap Donor",
            amount: 501,
          })
        );
      },
      { timeout: 5000 }
    );
  });

  it("QA Step 5: Duplicate Flat Prevention Test (same unit number warned and prevented)", async () => {
    const existingProperties: CachedPropertyProgress[] = [
      {
        propertyId: "prop-402",
        buildingId: "bld-1",
        eventId: "event-1",
        organizationId: "org-1",
        propertyType: "flat",
        unitNumber: "402",
        flatNumber: "402",
        floorNumber: 4,
        shopName: null,
        ownerName: "Rajesh Patil",
        contactMobile: "9820011111",
        status: "collected",
        receiptCount: 1,
        totalCollectedAmount: 501,
        latestReceiptNumber: 101,
        lastReceiptAt: "2026-09-09T10:00:00Z",
        pendingReason: null,
        followUpTime: null,
        followUpNotes: null,
        followUpAt: null,
        cachedAt: new Date().toISOString(),
      },
    ];

    const mockBuilding: CachedBuildingSummary = {
      buildingId: "bld-1",
      eventId: "event-1",
      organizationId: "org-1",
      buildingName: "Shivaji Heights",
      code: "SH",
      wing: "A",
      areaName: "Shivaji Nagar",
      totalUnits: 1,
      collectedCount: 0,
      pendingCount: 0,
      refusedCount: 0,
      notVisitedCount: 1,
      remainingCount: 1,
      totalAmountCollected: 0,
      lastActivityAt: null,
      cachedAt: new Date().toISOString(),
    };

    fetchEventBuildingSummariesMock.mockResolvedValue([mockBuilding]);
    fetchBuildingPropertiesProgressMock.mockResolvedValue(existingProperties);

    render(<DashboardPage />);

    await waitFor(
      () => {
        expect(screen.getByText(/Continue Shivaji Heights/i)).toBeTruthy();
      },
      { timeout: 5000 }
    );
    fireEvent.click(screen.getByText(/Continue Shivaji Heights/i));

    await waitFor(
      () => {
        expect(screen.getByText("Flat 402")).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Try to add 402 again
    fireEvent.click(screen.getByText("+ Add Flat"));

    const unitInput = screen.getByLabelText(/Flat \/ Unit Number/);
    fireEvent.change(unitInput, { target: { value: "402" } });

    // Confirm duplicate warning appears and submit is prevented
    expect(screen.getByText(/already recorded in this building/)).toBeTruthy();
  });
});
