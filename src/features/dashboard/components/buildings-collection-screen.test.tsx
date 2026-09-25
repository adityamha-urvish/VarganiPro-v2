// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { BuildingsCollectionScreen } from "./buildings-collection-screen";
import type { CachedBuildingSummary } from "@/lib/offline/offline-db";
import type { PropertyRecord } from "@/features/admin/master-data/services/master-data.service";

describe("BuildingsCollectionScreen: Volunteer Building & Commercial Shop Flows", () => {
  afterEach(() => {
    cleanup();
  });

  const mockBuildings: CachedBuildingSummary[] = [
    {
      buildingId: "bld-1",
      eventId: "event-1",
      organizationId: "org-1",
      buildingName: "Gokuldham Co-op",
      code: "GK",
      wing: "A",
      areaName: "Powai",
      totalUnits: 10,
      collectedCount: 4,
      pendingCount: 2,
      refusedCount: 0,
      notVisitedCount: 4,
      remainingCount: 6,
      totalAmountCollected: 2004,
      lastActivityAt: null,
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
      shopName: "Sai Medical & General Stores",
      floorNumber: null,
      ownerName: "Dr. Suresh Joshi",
      contactMobile: "9876543210",
      locationNote: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];

  it("1. Renders + Add button in header for volunteer and triggers Add Building modal", async () => {
    const onAddBuilding = vi.fn().mockResolvedValue({ buildingId: "bld-new" });

    render(
      <BuildingsCollectionScreen
        buildings={mockBuildings}
        loading={false}
        onSelectBuilding={vi.fn()}
        onOpenCollect={vi.fn()}
        onViewFlats={vi.fn()}
        onAddBuilding={onAddBuilding}
        isAdmin={false}
      />
    );

    const addBtn = screen.getByTestId("volunteer-add-building-btn");
    expect(addBtn).toBeTruthy();
    expect(addBtn.textContent).toContain("+ Add");

    fireEvent.click(addBtn);

    expect(screen.getByText(/Add Building \(इमारत जोडा\)/)).toBeTruthy();

    const nameInput = screen.getByTestId("input-building-name");
    fireEvent.change(nameInput, { target: { value: "Sai Dham" } });

    const wingInput = screen.getByTestId("input-building-wing");
    fireEvent.change(wingInput, { target: { value: "B" } });

    const submitBtn = screen.getByTestId("btn-submit-building");
    fireEvent.click(submitBtn);

    expect(onAddBuilding).toHaveBeenCalledWith("Sai Dham", "B");
  });

  it("2. Switches to Commercial segment, renders shop cards, and triggers shop receipt collection", async () => {
    const onSelectShop = vi.fn();

    render(
      <BuildingsCollectionScreen
        buildings={mockBuildings}
        loading={false}
        shops={mockShops}
        loadingShops={false}
        onSelectBuilding={vi.fn()}
        onOpenCollect={vi.fn()}
        onViewFlats={vi.fn()}
        onSelectShop={onSelectShop}
        isAdmin={false}
      />
    );

    // Switch to commercial
    const commFilter = screen.getByTestId("filter-commercial");
    expect(commFilter.textContent).toContain("Commercial (1)");
    fireEvent.click(commFilter);

    // Verify shop details are displayed
    expect(screen.getByText(/Sai Medical & General Stores/)).toBeTruthy();
    expect(screen.getByText(/Dr. Suresh Joshi/)).toBeTruthy();
    expect(screen.getByText(/9876543210/)).toBeTruthy();

    // Click collect button on shop
    const collectBtn = screen.getByTestId("btn-collect-shop-shop-1");
    fireEvent.click(collectBtn);

    expect(onSelectShop).toHaveBeenCalledWith(mockShops[0]);
  });

  it("3. Opens Add Shop modal from header and creates commercial shop for volunteer", async () => {
    const onAddShop = vi.fn().mockResolvedValue({ propertyId: "shop-new" });

    render(
      <BuildingsCollectionScreen
        buildings={mockBuildings}
        loading={false}
        shops={mockShops}
        loadingShops={false}
        onSelectBuilding={vi.fn()}
        onOpenCollect={vi.fn()}
        onViewFlats={vi.fn()}
        onAddShop={onAddShop}
        isAdmin={false}
      />
    );

    // Switch to commercial
    fireEvent.click(screen.getByTestId("filter-commercial"));

    const addShopBtn = screen.getByTestId("volunteer-add-shop-btn");
    expect(addShopBtn).toBeTruthy();
    fireEvent.click(addShopBtn);

    expect(screen.getByText(/Add Commercial Shop \(दुकान जोडा\)/)).toBeTruthy();

    fireEvent.change(screen.getByTestId("input-shop-name"), {
      target: { value: "Shree Ganesh Sweets" },
    });
    fireEvent.change(screen.getByTestId("input-shop-owner"), {
      target: { value: "Mahesh Patil" },
    });
    fireEvent.change(screen.getByTestId("input-shop-mobile"), {
      target: { value: "9820011223" },
    });

    fireEvent.click(screen.getByTestId("btn-submit-shop"));

    expect(onAddShop).toHaveBeenCalledWith({
      shopName: "Shree Ganesh Sweets",
      ownerName: "Mahesh Patil",
      contactMobile: "9820011223",
    });
  });
});
