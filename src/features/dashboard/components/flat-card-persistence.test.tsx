// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BuildingFlatGrid } from "./building-flat-grid";
import {
  saveCachedBuildingProperties,
  getCachedBuildingProperties,
  updateLocalPropertyProgress,
  type CachedPropertyProgress,
  type CachedBuildingSummary,
} from "@/lib/offline/offline-db";
import { fetchBuildingPropertiesProgress } from "@/features/collection/services/collection-progress.service";
import { supabase } from "@/supabase/client";

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("Flat Card Donor Name UI/State Persistence Regression Test", () => {
  const eventId = "ev-navratri-2026";
  const buildingId = "bld-sector28-gokul";
  const organizationId = "org-trust-28";
  const testPropertyId = "prop-406-uuid";

  const mockBuilding: CachedBuildingSummary = {
    buildingId,
    eventId,
    organizationId,
    buildingName: "Gokul Heights",
    code: "GH",
    wing: "A",
    areaName: "Sector 28",
    totalUnits: 10,
    collectedCount: 1,
    pendingCount: 0,
    refusedCount: 0,
    notVisitedCount: 9,
    remainingCount: 9,
    totalAmountCollected: 1,
    lastActivityAt: null,
    cachedAt: new Date().toISOString(),
  };

  it("proves addPropertyDirect -> PROPERTIES_STORE -> updateLocalPropertyProgress -> fetchBuildingPropertiesProgress -> BuildingFlatGrid", async () => {
    // 1. Newly discovered flat added without owner name (Pending / Come Later flow)
    const newlyCreatedFlat: CachedPropertyProgress = {
      propertyId: testPropertyId,
      buildingId,
      eventId,
      organizationId,
      propertyType: "flat",
      unitNumber: "406",
      flatNumber: "406",
      floorNumber: 4,
      shopName: null,
      ownerName: null,
      contactMobile: null,
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

    // Step A: Immediately persisted into PROPERTIES_STORE by addPropertyDirect
    await saveCachedBuildingProperties(eventId, buildingId, [newlyCreatedFlat]);

    // Inspect IndexedDB record BEFORE donor capture
    const cachedBefore = await getCachedBuildingProperties(eventId, buildingId);
    const flat406Before = cachedBefore.find((p) => p.propertyId === testPropertyId);

    expect(flat406Before).toBeDefined();
    expect(flat406Before?.unitNumber).toBe("406");
    expect(flat406Before?.ownerName).toBeNull();
    expect(flat406Before?.contactMobile).toBeNull();
    expect(flat406Before?.status).toBe("not_visited");

    console.log("EXACT IndexedDB record BEFORE donor capture:\n" + JSON.stringify(flat406Before, null, 2));

    // Step B: Mark Pending / Come Later
    await updateLocalPropertyProgress(eventId, buildingId, testPropertyId, {
      status: "pending",
      pendingReason: "asked_to_return_later",
      followUpTime: "Evening 7 PM",
    });

    const cachedPending = await getCachedBuildingProperties(eventId, buildingId);
    const flat406Pending = cachedPending.find((p) => p.propertyId === testPropertyId);
    expect(flat406Pending?.status).toBe("pending");
    expect(flat406Pending?.pendingReason).toBe("asked_to_return_later");

    // Step C: Reopen flat, capture donor details and issue receipt VP-NU121 (amount: 1, donorName: "Test Ignore")
    await updateLocalPropertyProgress(eventId, buildingId, testPropertyId, {
      status: "collected",
      receiptCount: 1,
      totalCollectedAmount: 1,
      latestReceiptNumber: 121,
      lastReceiptAt: new Date().toISOString(),
      ownerName: "Test Ignore",
      contactMobile: "1234567890",
    });

    // Inspect IndexedDB record AFTER donor capture
    const cachedAfter = await getCachedBuildingProperties(eventId, buildingId);
    const flat406After = cachedAfter.find((p) => p.propertyId === testPropertyId);

    expect(flat406After).toBeDefined();
    expect(flat406After?.unitNumber).toBe("406");
    expect(flat406After?.status).toBe("collected");
    expect(flat406After?.totalCollectedAmount).toBe(1);
    expect(flat406After?.latestReceiptNumber).toBe(121);
    expect(flat406After?.ownerName).toBe("Test Ignore");
    expect(flat406After?.contactMobile).toBe("1234567890");

    console.log("EXACT IndexedDB record AFTER donor capture:\n" + JSON.stringify(flat406After, null, 2));

    // Step D: Leave building and re-enter.
    // Supabase RPC returns owner_name: null (because DB properties table has NULL for pending flat)
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        success: true,
        event_id: eventId,
        building_id: buildingId,
        building_name: "Gokul Heights",
        building_wing: "A",
        properties: [
          {
            property_id: testPropertyId,
            property_type: "flat",
            unit_number: "406",
            flat_number: "406",
            floor_number: 4,
            shop_name: null,
            owner_name: null, // Server has null!
            contact_mobile: null,
            status: "collected",
            receipt_count: 1,
            total_collected_amount: 1,
            latest_receipt_number: 121,
            last_receipt_at: new Date().toISOString(),
            pending_reason: null,
            follow_up_time: null,
            follow_up_notes: null,
            follow_up_at: null,
          },
        ],
      },
      error: null,
    });

    const refreshedProperties = await fetchBuildingPropertiesProgress(eventId, buildingId, organizationId);
    const resolvedFlat406 = refreshedProperties.find((p) => p.propertyId === testPropertyId);

    // Verify local ownerName fallback kicks in: p.owner_name || local.ownerName || null
    expect(resolvedFlat406?.ownerName).toBe("Test Ignore");
    expect(resolvedFlat406?.contactMobile).toBe("1234567890");

    // Step E: Render in BuildingFlatGrid
    render(
      <BuildingFlatGrid
        building={mockBuilding}
        properties={refreshedProperties}
        loading={false}
        onBack={vi.fn()}
        onSelectProperty={vi.fn()}
      />
    );

    // Verify Flat Card UI contains unit number, collected badge, and captured donor name
    expect(screen.getByText("Flat 406")).toBeDefined();
    expect(screen.getByText("₹1 ✓")).toBeDefined();
    expect(screen.getByText("Test Ignore")).toBeDefined();
  });

  it("proves complete user flow with brand new test flat (Add -> Pending -> Reopen -> Receipt -> Leave/Re-enter -> Reload)", async () => {
    const flat508Id = "prop-flat-508";

    // 1. Add new flat (Flat 508) with no initial owner
    const initialFlat508: CachedPropertyProgress = {
      propertyId: flat508Id,
      buildingId,
      eventId,
      organizationId,
      propertyType: "flat",
      unitNumber: "508",
      flatNumber: "508",
      floorNumber: 5,
      shopName: null,
      ownerName: null,
      contactMobile: null,
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

    // Simulated addPropertyDirect persistence
    await saveCachedBuildingProperties(eventId, buildingId, [initialFlat508]);

    // 2. Verify persisted in PROPERTIES_STORE
    const storeCheck1 = await getCachedBuildingProperties(eventId, buildingId);
    const saved508 = storeCheck1.find((p) => p.propertyId === flat508Id);
    expect(saved508).toBeDefined();
    expect(saved508?.unitNumber).toBe("508");
    expect(saved508?.ownerName).toBeNull();

    // 3. Mark Pending
    await updateLocalPropertyProgress(eventId, buildingId, flat508Id, {
      status: "pending",
      pendingReason: "asked_to_return_later",
    });

    // 4. Reopen and complete with donor name & receipt
    const donorName = "Sachin Tendulkar";
    const donorMobile = "9820098200";
    const amount = 501;

    await updateLocalPropertyProgress(eventId, buildingId, flat508Id, {
      status: "collected",
      receiptCount: 1,
      totalCollectedAmount: amount,
      latestReceiptNumber: 122,
      lastReceiptAt: new Date().toISOString(),
      ownerName: donorName,
      contactMobile: donorMobile,
    });

    // 5. Verify PROPERTIES_STORE after donor capture
    const storeCheck2 = await getCachedBuildingProperties(eventId, buildingId);
    const collected508 = storeCheck2.find((p) => p.propertyId === flat508Id);
    expect(collected508?.status).toBe("collected");
    expect(collected508?.ownerName).toBe("Sachin Tendulkar");
    expect(collected508?.contactMobile).toBe("9820098200");
    expect(collected508?.totalCollectedAmount).toBe(501);

    // 6. Leave building and re-enter
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        success: true,
        event_id: eventId,
        building_id: buildingId,
        properties: [
          {
            property_id: flat508Id,
            property_type: "flat",
            unit_number: "508",
            flat_number: "508",
            floor_number: 5,
            shop_name: null,
            owner_name: null, // Server DB has null for pending flat
            contact_mobile: null,
            status: "collected",
            receipt_count: 1,
            total_collected_amount: 501,
            latest_receipt_number: 122,
            last_receipt_at: new Date().toISOString(),
          },
        ],
      },
      error: null,
    });

    const reloadedProperties = await fetchBuildingPropertiesProgress(eventId, buildingId, organizationId);
    const reloaded508 = reloadedProperties.find((p) => p.propertyId === flat508Id);
    expect(reloaded508?.ownerName).toBe("Sachin Tendulkar");

    // 7. Verify UI rendering
    render(
      <BuildingFlatGrid
        building={mockBuilding}
        properties={reloadedProperties}
        loading={false}
        onBack={vi.fn()}
        onSelectProperty={vi.fn()}
      />
    );

    expect(screen.getByText("Flat 508")).toBeDefined();
    expect(screen.getByText("₹501 ✓")).toBeDefined();
    expect(screen.getByText("Sachin Tendulkar")).toBeDefined();
  });
});
