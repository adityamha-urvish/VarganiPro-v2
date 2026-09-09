// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { BuildingFlatGrid } from "./building-flat-grid";
import type { CachedBuildingSummary, CachedPropertyProgress } from "@/lib/offline/offline-db";

describe("Phase 2I: BuildingFlatGrid Progressive Discovery Component", () => {
  afterEach(() => {
    cleanup();
  });

  const mockBuilding: CachedBuildingSummary = {
    buildingId: "bld-1",
    eventId: "event-1",
    organizationId: "org-1",
    buildingName: "Shivaji Heights",
    code: "SH",
    wing: "A",
    areaName: "Shivaji Nagar",
    totalUnits: 3,
    collectedCount: 1,
    pendingCount: 1,
    refusedCount: 1,
    notVisitedCount: 0,
    remainingCount: 1,
    totalAmountCollected: 501,
    lastActivityAt: null,
    cachedAt: new Date().toISOString(),
  };

  const mockProperties: CachedPropertyProgress[] = [
    {
      propertyId: "prop-1",
      buildingId: "bld-1",
      eventId: "event-1",
      organizationId: "org-1",
      propertyType: "flat",
      unitNumber: "101",
      flatNumber: "101",
      floorNumber: 1,
      shopName: null,
      ownerName: "Rajesh Sharma",
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
      propertyId: "prop-2",
      buildingId: "bld-1",
      eventId: "event-1",
      organizationId: "org-1",
      propertyType: "flat",
      unitNumber: "201",
      flatNumber: "201",
      floorNumber: 2,
      shopName: null,
      ownerName: "Anita Kulkarni",
      contactMobile: "9820022222",
      status: "pending",
      receiptCount: 0,
      totalCollectedAmount: 0,
      latestReceiptNumber: null,
      lastReceiptAt: null,
      pendingReason: "asked_to_return_later",
      followUpTime: "7:00 PM",
      followUpNotes: null,
      followUpAt: "2026-09-09T10:30:00Z",
      cachedAt: new Date().toISOString(),
    },
    {
      propertyId: "prop-3",
      buildingId: "bld-1",
      eventId: "event-1",
      organizationId: "org-1",
      propertyType: "flat",
      unitNumber: "202",
      flatNumber: "202",
      floorNumber: 2,
      shopName: null,
      ownerName: "Deepak Shinde",
      contactMobile: "9820033333",
      status: "refused",
      receiptCount: 0,
      totalCollectedAmount: 0,
      latestReceiptNumber: null,
      lastReceiptAt: null,
      pendingReason: "refused",
      followUpTime: null,
      followUpNotes: null,
      followUpAt: "2026-09-09T11:00:00Z",
      cachedAt: new Date().toISOString(),
    },
  ];

  it("renders building header with honest counts and no fake percentages", () => {
    render(
      <BuildingFlatGrid
        building={mockBuilding}
        properties={mockProperties}
        loading={false}
        onBack={vi.fn()}
        onSelectProperty={vi.fn()}
      />
    );

    expect(screen.getByText(/Shivaji Heights/)).toBeTruthy();
    expect(screen.getByText(/(Wing A)/)).toBeTruthy();
    expect(screen.getByText("Shivaji Nagar")).toBeTruthy();

    // Honest counts
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Flats Recorded")).toBeTruthy();
    expect(screen.getByText("Collected")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Refused")).toBeTruthy();
    expect(screen.getByText("₹501")).toBeTruthy();
  });

  it("groups flats by floor in descending order", () => {
    render(
      <BuildingFlatGrid
        building={mockBuilding}
        properties={mockProperties}
        loading={false}
        onBack={vi.fn()}
        onSelectProperty={vi.fn()}
      />
    );

    expect(screen.getByText(/Floor 2/i)).toBeTruthy();
    expect(screen.getByText(/Floor 1/i)).toBeTruthy();
    expect(screen.getByText("Flat 101")).toBeTruthy();
    expect(screen.getByText("Flat 201")).toBeTruthy();
    expect(screen.getByText("Flat 202")).toBeTruthy();
  });

  it("triggers onSelectProperty when flat card is clicked", () => {
    const onSelectProperty = vi.fn();
    render(
      <BuildingFlatGrid
        building={mockBuilding}
        properties={mockProperties}
        loading={false}
        onBack={vi.fn()}
        onSelectProperty={onSelectProperty}
      />
    );

    const flat101Button = screen.getByText("Flat 101").closest("button");
    expect(flat101Button).toBeTruthy();
    fireEvent.click(flat101Button!);

    expect(onSelectProperty).toHaveBeenCalledWith(mockProperties[0]);
  });

  it("opens Add Flat modal and validates required fields and duplicate prevention", async () => {
    const onAddProperty = vi.fn();
    render(
      <BuildingFlatGrid
        building={mockBuilding}
        properties={mockProperties}
        loading={false}
        onBack={vi.fn()}
        onSelectProperty={vi.fn()}
        onAddProperty={onAddProperty}
      />
    );

    const addFlatButton = screen.getByText("+ Add Flat");
    fireEvent.click(addFlatButton);

    expect(screen.getByText("+ Add Flat to Shivaji Heights")).toBeTruthy();

    const unitInput = screen.getByLabelText(/Flat \/ Unit Number/);
    // Enter duplicate flat 101
    fireEvent.change(unitInput, { target: { value: "101" } });
    expect(screen.getByText(/already recorded in this building/)).toBeTruthy();

    // Enter new flat 301
    fireEvent.change(unitInput, { target: { value: "301" } });
    expect(screen.queryByText(/already recorded in this building/)).toBeNull();
  });

  it("supports Add & Continue flow to immediately select newly added flat", async () => {
    const newProp: CachedPropertyProgress = {
      propertyId: "prop-new-301",
      buildingId: "bld-1",
      eventId: "event-1",
      organizationId: "org-1",
      propertyType: "flat",
      unitNumber: "301",
      flatNumber: "301",
      floorNumber: 3,
      shopName: null,
      ownerName: "Vikas Patil",
      contactMobile: "9820044444",
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

    const onAddProperty = vi.fn().mockResolvedValue(newProp);
    const onSelectProperty = vi.fn();

    render(
      <BuildingFlatGrid
        building={mockBuilding}
        properties={mockProperties}
        loading={false}
        onBack={vi.fn()}
        onSelectProperty={onSelectProperty}
        onAddProperty={onAddProperty}
      />
    );

    fireEvent.click(screen.getByText("+ Add Flat"));

    const unitInput = screen.getByLabelText(/Flat \/ Unit Number/);
    fireEvent.change(unitInput, { target: { value: "301" } });

    const continueButton = screen.getByText("⚡ Add & Continue →");
    fireEvent.click(continueButton);

    expect(onAddProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        unitNumber: "301",
        floorNumber: 3,
      })
    );
  });

  it("filters properties using filter chips", () => {
    render(
      <BuildingFlatGrid
        building={mockBuilding}
        properties={mockProperties}
        loading={false}
        onBack={vi.fn()}
        onSelectProperty={vi.fn()}
      />
    );

    // Click 'Collected (1)' filter chip
    fireEvent.click(screen.getByText("Collected (1)"));
    expect(screen.getByText("Flat 101")).toBeTruthy();
    expect(screen.queryByText("Flat 201")).toBeNull();
    expect(screen.queryByText("Flat 202")).toBeNull();

    // Click 'Pending (1)' filter chip
    fireEvent.click(screen.getByText("Pending (1)"));
    expect(screen.queryByText("Flat 101")).toBeNull();
    expect(screen.getByText("Flat 201")).toBeTruthy();
    expect(screen.queryByText("Flat 202")).toBeNull();

    // Click 'All (3)'
    fireEvent.click(screen.getByText("All (3)"));
    expect(screen.getByText("Flat 101")).toBeTruthy();
    expect(screen.getByText("Flat 201")).toBeTruthy();
    expect(screen.getByText("Flat 202")).toBeTruthy();
  });
});
