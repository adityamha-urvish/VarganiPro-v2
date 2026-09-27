// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBuildingCollection } from "../hooks/use-building-collection";
import type { CachedPropertyProgress } from "@/lib/offline/offline-db";

const mockCreateLocalReceipt = vi.fn();
const mockUpdateLocalPropertyProgress = vi.fn();
const mockDrainSyncQueue = vi.fn().mockResolvedValue(undefined);
const mockFetchStandaloneShops = vi.fn();

vi.mock("@/lib/offline/receipt-store", () => ({
  createLocalReceipt: (args: unknown) => mockCreateLocalReceipt(args),
}));

vi.mock("@/lib/offline/offline-db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/offline-db")>();
  return {
    ...actual,
    updateLocalPropertyProgress: (args: unknown) => mockUpdateLocalPropertyProgress(args),
  };
});

vi.mock("@/lib/offline/receipt-sync", () => ({
  drainSyncQueue: (args: unknown) => mockDrainSyncQueue(args),
}));

vi.mock("@/features/admin/master-data/services/master-data.service", () => ({
  fetchOrganizationBuildings: vi.fn().mockResolvedValue([]),
  fetchBuildingProperties: vi.fn().mockResolvedValue([]),
  fetchStandaloneShops: (orgId: string) => mockFetchStandaloneShops(orgId),
  createBuilding: vi.fn(),
  createResidentialFlat: vi.fn(),
  createStandaloneShop: vi.fn(),
}));

describe("Commercial Shop Receipt Creation & Residential Regression Tests", () => {
  const mockSession = {
    sessionId: "sess-123",
    receiptBookId: "book-456",
    organizationId: "org-789",
    eventId: "event-001",
    volunteerId: "vol-999",
    bookNumber: "BK-01",
    prefix: "VP-",
    startNumber: 1,
    endNumber: 50,
    currentNumber: 10,
    sessionStatus: "open" as const,
    bookStatus: "assigned" as const,
  };

  const onReceiptCreatedMock = vi.fn();
  const onReceiptHistoryRefreshMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchStandaloneShops.mockResolvedValue([
      {
        id: "shop-tailor-uuid",
        organizationId: "org-789",
        buildingId: null,
        propertyType: "commercial",
        shopName: "Tailor",
        ownerName: "Tailor",
        contactMobile: "9820011111",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ]);
  });

  it("1. Commercial Shop: creates local receipt with authoritative property UUID when selectedBuilding is null", async () => {
    const { result } = renderHook(() =>
      useBuildingCollection({
        session: mockSession,
        eventId: "event-001",
        organizationId: "org-789",
        onReceiptCreated: onReceiptCreatedMock,
        onReceiptHistoryRefresh: onReceiptHistoryRefreshMock,
      })
    );

    // Load shops
    await act(async () => {
      await result.current.loadShops();
    });

    expect(result.current.shops).toHaveLength(1);
    expect(result.current.shops[0].shopName).toBe("Tailor");

    // Open receipt modal for commercial shop (selectedBuilding is null)
    const commercialShopProp: CachedPropertyProgress = {
      propertyId: "shop-tailor-uuid",
      buildingId: "",
      eventId: "event-001",
      organizationId: "org-789",
      propertyType: "commercial",
      unitNumber: "Tailor",
      flatNumber: "Tailor",
      floorNumber: null,
      shopName: "Tailor",
      ownerName: "Tailor",
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
    };

    act(() => {
      result.current.openPropertyReceipt(commercialShopProp);
    });

    expect(result.current.isFastReceiptOpen).toBe(true);
    expect(result.current.selectedProperty?.shopName).toBe("Tailor");
    expect(result.current.selectedBuilding).toBeNull();

    // Mock created receipt return
    const mockCreatedReceipt = {
      clientReceiptId: "local-rcpt-1",
      receiptBookId: "book-456",
      organizationId: "org-789",
      eventId: "event-001",
      collectionSessionId: "sess-123",
      volunteerId: "vol-999",
      propertyId: "shop-tailor-uuid",
      receiptNumber: 10,
      receiptPrefix: "VP-",
      amount: 1001,
      paymentMode: "cash" as const,
      paymentReference: null,
      donorName: "Tailor",
      donorMobile: "9820011111",
      notes: null,
      offlineCreatedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    };
    mockCreateLocalReceipt.mockResolvedValueOnce(mockCreatedReceipt);

    // Submit Fast Receipt for commercial shop
    await act(async () => {
      await result.current.submitFastReceipt({
        propertyId: "shop-tailor-uuid",
        amount: 1001,
        paymentMode: "cash",
        donorName: "Tailor",
        donorMobile: "9820011111",
        paymentReference: null,
      });
    });

    // Verify createLocalReceipt was called with exact propertyId and parameters
    expect(mockCreateLocalReceipt).toHaveBeenCalledTimes(1);
    expect(mockCreateLocalReceipt).toHaveBeenCalledWith({
      receiptBookId: "book-456",
      organizationId: "org-789",
      eventId: "event-001",
      collectionSessionId: "sess-123",
      volunteerId: "vol-999",
      propertyId: "shop-tailor-uuid",
      amount: 1001,
      paymentMode: "cash",
      paymentReference: null,
      donorName: "Tailor",
      donorMobile: "9820011111",
      notes: null,
    });

    // Verify callback was invoked and sync queue drain was triggered
    expect(onReceiptCreatedMock).toHaveBeenCalledWith(mockCreatedReceipt);
    expect(mockDrainSyncQueue).toHaveBeenCalledWith("book-456");

    // Modal closed and selectedProperty cleared
    expect(result.current.isFastReceiptOpen).toBe(false);
    expect(result.current.selectedProperty).toBeNull();
  });

  it("2. Residential Flat: creates receipt and updates local building progress normally without regression", async () => {
    const { result } = renderHook(() =>
      useBuildingCollection({
        session: mockSession,
        eventId: "event-001",
        organizationId: "org-789",
        onReceiptCreated: onReceiptCreatedMock,
        onReceiptHistoryRefresh: onReceiptHistoryRefreshMock,
      })
    );

    // Set a residential building in state
    const building = {
      buildingId: "bld-101",
      organizationId: "org-789",
      eventId: "event-001",
      buildingName: "Shivaji Heights",
      code: "SH-01",
      wing: "A",
      areaName: "Sector 1",
      totalUnits: 10,
      collectedCount: 2,
      pendingCount: 0,
      refusedCount: 0,
      notVisitedCount: 8,
      remainingCount: 8,
      totalAmountCollected: 2000,
      lastActivityAt: null,
      cachedAt: new Date().toISOString(),
    };

    act(() => {
      result.current.setSelectedBuilding(building);
    });

    const flatProp: CachedPropertyProgress = {
      propertyId: "flat-201-uuid",
      buildingId: "bld-101",
      eventId: "event-001",
      organizationId: "org-789",
      propertyType: "residential",
      unitNumber: "201",
      flatNumber: "201",
      floorNumber: 2,
      shopName: null,
      ownerName: "Sunil Shinde",
      contactMobile: "9820022222",
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
    };

    act(() => {
      result.current.openPropertyReceipt(flatProp);
    });

    expect(result.current.isFastReceiptOpen).toBe(true);
    expect(result.current.selectedBuilding?.buildingId).toBe("bld-101");

    const mockFlatReceipt = {
      clientReceiptId: "local-rcpt-2",
      receiptBookId: "book-456",
      organizationId: "org-789",
      eventId: "event-001",
      collectionSessionId: "sess-123",
      volunteerId: "vol-999",
      propertyId: "flat-201-uuid",
      receiptNumber: 11,
      receiptPrefix: "VP-",
      amount: 501,
      paymentMode: "cash" as const,
      paymentReference: null,
      donorName: "Sunil Shinde",
      donorMobile: "9820022222",
      notes: null,
      offlineCreatedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    };
    mockCreateLocalReceipt.mockResolvedValueOnce(mockFlatReceipt);

    await act(async () => {
      await result.current.submitFastReceipt({
        propertyId: "flat-201-uuid",
        amount: 501,
        paymentMode: "cash",
        donorName: "Sunil Shinde",
        donorMobile: "9820022222",
        paymentReference: null,
      });
    });

    expect(mockCreateLocalReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: "flat-201-uuid",
        amount: 501,
      })
    );
    expect(onReceiptCreatedMock).toHaveBeenCalledWith(mockFlatReceipt);
  });
});
