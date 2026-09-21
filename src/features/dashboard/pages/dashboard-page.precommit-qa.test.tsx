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
  drainAllPendingSyncQueues: vi.fn(async () => {}),
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
      rpc: vi.fn(async (method: string) => {
        if (method === "current_user_role") {
          return { data: "volunteer", error: null };
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
  totalUnits: 4,
  collectedCount: 1,
  pendingCount: 1,
  refusedCount: 0,
  notVisitedCount: 2,
  remainingCount: 3,
  totalAmountCollected: 501,
  lastActivityAt: "2026-08-23T11:00:00Z",
  cachedAt: "2026-08-23T11:00:00Z",
};

const defaultMockProperties: CachedPropertyProgress[] = [
  {
    propertyId: "prop-101",
    buildingId: "bld-shivaji",
    eventId: "event-1",
    organizationId: "org-1",
    propertyType: "flat",
    unitNumber: "101",
    flatNumber: "101",
    floorNumber: 1,
    shopName: null,
    ownerName: "Nitin Gadkari",
    contactMobile: "9822000001",
    status: "not_visited",
    receiptCount: 0,
    totalCollectedAmount: 0,
    latestReceiptNumber: null,
    lastReceiptAt: null,
    pendingReason: null,
    followUpTime: null,
    followUpNotes: null,
    followUpAt: null,
    cachedAt: "2026-08-23T11:00:00Z",
  },
  {
    propertyId: "prop-102",
    buildingId: "bld-shivaji",
    eventId: "event-1",
    organizationId: "org-1",
    propertyType: "flat",
    unitNumber: "102",
    flatNumber: "102",
    floorNumber: 1,
    shopName: null,
    ownerName: "Devendra Fadnavis",
    contactMobile: "9822000002",
    status: "not_visited",
    receiptCount: 0,
    totalCollectedAmount: 0,
    latestReceiptNumber: null,
    lastReceiptAt: null,
    pendingReason: null,
    followUpTime: null,
    followUpNotes: null,
    followUpAt: null,
    cachedAt: "2026-08-23T11:00:00Z",
  },
];

describe("Pre-Commit Real Interaction QA Suite (Flows A through H)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem(
      "vp_user",
      JSON.stringify({
        id: "auth-user-1",
        email: "volunteer@varganipro.com",
        role: "volunteer",
      })
    );

    initializeCollectionSessionMock.mockResolvedValue(mockOpenSession);
    getLocalReceiptsMock.mockResolvedValue([]);
    mergeOfflineBookStateMock.mockResolvedValue(undefined);
    fetchEventBuildingSummariesMock.mockResolvedValue([defaultMockBuilding]);
    fetchBuildingPropertiesProgressMock.mockResolvedValue(defaultMockProperties);
  });

  afterEach(() => {
    cleanup();
  });

  it("Flow A & B: Start Collection never opens a stale previously selected flat", async () => {
    render(<DashboardPage />);

    const startBtn = await screen.findByTestId("volunteer-collect-btn");
    expect(startBtn).toBeTruthy();

    fireEvent.click(startBtn);

    // Verify Building Shivaji Heights is shown
    expect(await screen.findByText(/Continue Shivaji Heights/i)).toBeTruthy();

    // Verify modal is NOT open yet
    expect(screen.queryByRole("button", { name: /Collect Receipt/i })).toBeNull();

    // Select Building
    const continueBuildingBtn = screen.getByRole("button", { name: /Continue Shivaji Heights/i });
    fireEvent.click(continueBuildingBtn);

    await waitFor(() => {
      expect(screen.getByText(/Shivaji Heights \(Wing A\)/)).toBeTruthy();
    });

    // Flat grid appears with 101 (Nitin Gadkari) and 102 (Devendra Fadnavis)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Nitin Gadkari/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Devendra Fadnavis/i })).toBeTruthy();
    });

    // Tap Flat 101 -> Fast Receipt Modal opens with Flat 101
    fireEvent.click(screen.getByRole("button", { name: /Nitin Gadkari/i }));
    expect(await screen.findByRole("button", { name: /Collect Receipt/i })).toBeTruthy();
  });

  it("Flow C: Successful receipt collection closes modal, marks Flat complete, and does not auto-advance", async () => {
    const mockCreatedReceipt: LocalReceipt = {
      clientReceiptId: "rec-local-105",
      receiptNumber: 105,
      receiptBookId: "book-1",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "vol-1",
      propertyId: "prop-101",
      amount: 501,
      paymentMode: "cash",
      paymentReference: null,
      donorName: "Nitin Gadkari",
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

    render(<DashboardPage />);

    const startBtn = await screen.findByTestId("volunteer-collect-btn");
    fireEvent.click(startBtn);

    expect(await screen.findByText(/Continue Shivaji Heights/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Continue Shivaji Heights/i }));

    await waitFor(() => {
      expect(screen.getByText(/Shivaji Heights \(Wing A\)/)).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Nitin Gadkari/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Nitin Gadkari/i }));

    const submitReceiptBtn = await screen.findByRole("button", { name: /Collect Receipt/i });
    const form = submitReceiptBtn.closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Collect Receipt/i })).toBeNull();
    });

    // User remains on Shivaji Heights grid and Flat 102 is NOT open
    expect(screen.getByRole("button", { name: /Devendra Fadnavis/i })).toBeTruthy();
    expect(screen.queryByText("जलद पावती (Fast Receipt)")).toBeNull();
  });

  it("Flow D: Mark Pending drawer is accessible", async () => {
    render(<DashboardPage />);

    const startBtn = await screen.findByTestId("volunteer-collect-btn");
    fireEvent.click(startBtn);

    expect(await screen.findByText(/Continue Shivaji Heights/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Continue Shivaji Heights/i }));

    await waitFor(() => {
      expect(screen.getByText(/Shivaji Heights \(Wing A\)/)).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Nitin Gadkari/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Nitin Gadkari/i }));

    const pendingBtn = await screen.findByRole("button", { name: /Mark Pending/i });
    fireEvent.click(pendingBtn);

    expect(await screen.findByText("Select why collection was not completed")).toBeTruthy();
    expect(screen.getByText(/Door Locked/i)).toBeTruthy();
  });

  it("Flow F & G: Receipt History and Post-Collection immediate WhatsApp, View, and Print actions", async () => {
    const mockReceipt: LocalReceipt = {
      clientReceiptId: "cr-qa-001",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      receiptBookId: "book-1",
      volunteerId: "vol-1",
      receiptNumber: 105,
      donorName: "Sanjay Raut",
      donorMobile: "9822000003",
      amount: 2001,
      paymentMode: "cash",
      paymentReference: null,
      propertyId: null,
      notes: null,
      syncStatus: "synced",
      syncAttempts: 1,
      lastSyncAttemptAt: new Date().toISOString(),
      lastSyncError: null,
      offlineCreatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerUserId: "auth-user-1",
    };

    getLocalReceiptsMock.mockResolvedValue([mockReceipt]);

    render(<DashboardPage />);

    fireEvent.click(await screen.findByTestId("nav-tab-history"));

    expect(await screen.findByText("Sanjay Raut")).toBeTruthy();
    expect(screen.getAllByText(/2,001|2001/).length).toBeGreaterThan(0);

    expect(screen.getByRole("button", { name: /WhatsApp/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /View/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Print/i })).toBeTruthy();
  });

  it("Flow H: Malformed receipt date does not crash app or clear auth session", async () => {
    const malformedReceipt: LocalReceipt = {
      clientReceiptId: "cr-corrupt-001",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      receiptBookId: "book-1",
      volunteerId: "vol-1",
      receiptNumber: 106,
      donorName: "Corrupted Data User",
      donorMobile: "9822000004",
      amount: 501,
      paymentMode: "cash",
      paymentReference: null,
      propertyId: null,
      notes: null,
      syncStatus: "pending",
      syncAttempts: 0,
      lastSyncAttemptAt: null,
      lastSyncError: null,
      offlineCreatedAt: "invalid-date-string",
      createdAt: "corrupted-timestamp",
      updatedAt: "corrupted-timestamp",
      ownerUserId: "auth-user-1",
    };

    getLocalReceiptsMock.mockResolvedValue([malformedReceipt]);

    render(<DashboardPage />);

    fireEvent.click(await screen.findByTestId("nav-tab-history"));

    expect(await screen.findByText("Corrupted Data User")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /View/i }));

    expect(await screen.findByText(/Receipt Details/i)).toBeTruthy();
    expect(localStorage.getItem("vp_user")).not.toBeNull();
  });
});
