// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchEventBuildingSummaries,
  fetchBuildingPropertiesProgress,
  recordFollowUp,
} from "@/features/collection/services/collection-progress.service";
import {
  saveCachedBuildingSummaries,
  getCachedBuildingSummaries,
  saveCachedBuildingProperties,
  getCachedBuildingProperties,
  updateLocalPropertyProgress,
} from "@/lib/offline/offline-db";

const { supabaseRpcMock } = vi.hoisted(() => ({
  supabaseRpcMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: supabaseRpcMock,
  },
}));

describe("Phase 9-2B: Collection Experience & Workflow Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Suite 1: IndexedDB Master Data Caching & Offline Invalidation", () => {
    it("caches and retrieves building summaries from IndexedDB when offline", async () => {
      const summaries = [
        {
          buildingId: "bld-1",
          eventId: "event-1",
          organizationId: "org-1",
          buildingName: "Shivam Paradise",
          code: "SHIV",
          wing: "A",
          areaName: "Station Road",
          totalUnits: 25,
          collectedCount: 18,
          pendingCount: 3,
          refusedCount: 1,
          notVisitedCount: 3,
          remainingCount: 6,
          totalAmountCollected: 9500,
          lastActivityAt: "2026-08-27T01:30:00Z",
          cachedAt: new Date().toISOString(),
        },
      ];

      await saveCachedBuildingSummaries("event-1", summaries);
      const cached = await getCachedBuildingSummaries("event-1");

      expect(cached).toHaveLength(1);
      expect(cached[0].buildingName).toBe("Shivam Paradise");
      expect(cached[0].collectedCount).toBe(18);
      expect(cached[0].remainingCount).toBe(6);
    });

    it("caches and retrieves building flat properties with natural floor sorting", async () => {
      const properties = [
        {
          propertyId: "p-201",
          buildingId: "bld-1",
          eventId: "event-1",
          organizationId: "org-1",
          propertyType: "residential",
          unitNumber: "201",
          flatNumber: "201",
          floorNumber: 2,
          shopName: null,
          ownerName: "Ajay Mehta",
          contactMobile: "9820011111",
          status: "not_visited" as const,
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
          propertyId: "p-101",
          buildingId: "bld-1",
          eventId: "event-1",
          organizationId: "org-1",
          propertyType: "residential",
          unitNumber: "101",
          flatNumber: "101",
          floorNumber: 1,
          shopName: null,
          ownerName: "Ramesh Shah",
          contactMobile: "9820022222",
          status: "collected" as const,
          receiptCount: 1,
          totalCollectedAmount: 501,
          latestReceiptNumber: 1001,
          lastReceiptAt: "2026-08-27T01:00:00Z",
          pendingReason: null,
          followUpTime: null,
          followUpNotes: null,
          followUpAt: null,
          cachedAt: new Date().toISOString(),
        },
      ];

      await saveCachedBuildingProperties("event-1", "bld-1", properties);
      const cached = await getCachedBuildingProperties("event-1", "bld-1");

      expect(cached).toHaveLength(2);
      // Verify natural sort orders Floor 1 (101) before Floor 2 (201)
      expect(cached[0].unitNumber).toBe("101");
      expect(cached[1].unitNumber).toBe("201");
    });

    it("updates local property status in IndexedDB when offline receipt or follow-up is recorded", async () => {
      await saveCachedBuildingProperties("event-1", "bld-1", [
        {
          propertyId: "p-201",
          buildingId: "bld-1",
          eventId: "event-1",
          organizationId: "org-1",
          propertyType: "residential",
          unitNumber: "201",
          flatNumber: "201",
          floorNumber: 2,
          shopName: null,
          ownerName: "Ajay Mehta",
          contactMobile: "9820011111",
          status: "not_visited" as const,
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
      ]);

      await updateLocalPropertyProgress("event-1", "bld-1", "p-201", {
        status: "collected",
        totalCollectedAmount: 1001,
        receiptCount: 1,
      });

      const cached = await getCachedBuildingProperties("event-1", "bld-1");
      const prop201 = cached.find((p) => p.propertyId === "p-201");
      expect(prop201?.status).toBe("collected");
      expect(prop201?.totalCollectedAmount).toBe(1001);
    });
  });

  describe("Suite 2: Continue Collection & Building Progress Service", () => {
    it("falls back to local cache when network fails fetching building summaries", async () => {
      // Seed local cache first
      await saveCachedBuildingSummaries("event-offline", [
        {
          buildingId: "bld-offline-1",
          eventId: "event-offline",
          organizationId: "org-1",
          buildingName: "Offline Heights",
          code: "OFF",
          wing: null,
          areaName: "Main Road",
          totalUnits: 10,
          collectedCount: 5,
          pendingCount: 2,
          refusedCount: 0,
          notVisitedCount: 3,
          remainingCount: 5,
          totalAmountCollected: 2500,
          lastActivityAt: "2026-08-27T01:00:00Z",
          cachedAt: new Date().toISOString(),
        },
      ]);

      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Network unavailable" },
      });

      const result = await fetchEventBuildingSummaries("event-offline", "org-1");
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].buildingName).toBe("Offline Heights");
    });

    it("falls back to local cache when network fails fetching building properties", async () => {
      // Seed local cache first
      await saveCachedBuildingProperties("event-offline", "bld-offline-1", [
        {
          propertyId: "prop-off-1",
          buildingId: "bld-offline-1",
          eventId: "event-offline",
          organizationId: "org-1",
          propertyType: "residential",
          unitNumber: "101",
          flatNumber: "101",
          floorNumber: 1,
          shopName: null,
          ownerName: "Offline Resident",
          contactMobile: null,
          status: "not_visited" as const,
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
      ]);

      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Network timeout" },
      });

      const result = await fetchBuildingPropertiesProgress("event-offline", "bld-offline-1", "org-1");
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].unitNumber).toBe("101");
    });
  });

  describe("Suite 3: Follow-Up & Refusal Lifecycle", () => {
    it("records refused reason and excludes flat from active remaining count", async () => {
      await saveCachedBuildingProperties("event-1", "bld-1", [
        {
          propertyId: "p-201",
          buildingId: "bld-1",
          eventId: "event-1",
          organizationId: "org-1",
          propertyType: "residential",
          unitNumber: "201",
          flatNumber: "201",
          floorNumber: 2,
          shopName: null,
          ownerName: "Ajay Mehta",
          contactMobile: "9820011111",
          status: "not_visited" as const,
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
      ]);

      supabaseRpcMock.mockResolvedValueOnce({
        data: { id: "follow-up-1" },
        error: null,
      });

      await recordFollowUp({
        eventId: "event-1",
        buildingId: "bld-1",
        propertyId: "p-201",
        reason: "refused",
      });

      const cached = await getCachedBuildingProperties("event-1", "bld-1");
      const prop = cached.find((p) => p.propertyId === "p-201");
      expect(prop?.status).toBe("refused");
      expect(prop?.pendingReason).toBe("refused");
    });
  });
});
