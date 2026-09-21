// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReceiptCreationForm } from "./receipt-creation-form";
import type { CachedBuildingSummary, CachedPropertyProgress } from "@/lib/offline/offline-db";

describe("ReceiptCreationForm Progressive Dropdown & Inline Addition", () => {
  afterEach(() => {
    cleanup();
  });

  const mockBuildings: CachedBuildingSummary[] = [
    {
      buildingId: "b-1",
      eventId: "event-1",
      organizationId: "org-1",
      buildingName: "Gokul Dham",
      code: "GD",
      wing: "A",
      areaName: "Main Road",
      totalUnits: 10,
      collectedCount: 2,
      pendingCount: 1,
      refusedCount: 0,
      notVisitedCount: 7,
      remainingCount: 8,
      totalAmountCollected: 1002,
      lastActivityAt: null,
      cachedAt: "2026-09-21T00:00:00Z",
    },
  ];

  const mockProperties: CachedPropertyProgress[] = [
    {
      propertyId: "p-101",
      buildingId: "b-1",
      eventId: "event-1",
      organizationId: "org-1",
      propertyType: "flat",
      unitNumber: "101",
      flatNumber: "101",
      floorNumber: 1,
      shopName: null,
      ownerName: "Jethalal Gada",
      contactMobile: "9876543210",
      status: "not_visited",
      receiptCount: 0,
      totalCollectedAmount: 0,
      latestReceiptNumber: null,
      lastReceiptAt: null,
      pendingReason: null,
      followUpTime: null,
      followUpNotes: null,
      followUpAt: null,
      cachedAt: "2026-09-21T00:00:00Z",
    },
  ];

  it("shows General Donation option in Flat dropdown when no building is selected", () => {
    render(
      <ReceiptCreationForm
        propertyId={null}
        properties={[]}
        buildings={mockBuildings}
        selectedBuildingId={null}
        onBuildingIdChange={() => {}}
        onAddBuilding={vi.fn()}
        onAddProperty={vi.fn()}
        donorName=""
        onDonorNameChange={() => {}}
        donorMobile=""
        onDonorMobileChange={() => {}}
        amount="501"
        onAmountChange={() => {}}
        paymentMode="cash"
        onPaymentModeChange={() => {}}
        paymentReference=""
        onPaymentReferenceChange={() => {}}
        notes=""
        onNotesChange={() => {}}
        creating={false}
        createError={null}
        sessionStatus="open"
        currentReceiptNumber={1}
        onSubmit={() => {}}
        onPropertyIdChange={() => {}}
      />
    );

    expect(screen.getByText(/-- General \/ Non-Property Donation --/i)).toBeTruthy();
  });

  it("shows building flats when a building is selected", () => {
    render(
      <ReceiptCreationForm
        propertyId={null}
        properties={mockProperties}
        buildings={mockBuildings}
        selectedBuildingId="b-1"
        onBuildingIdChange={() => {}}
        onAddBuilding={vi.fn()}
        onAddProperty={vi.fn()}
        donorName=""
        onDonorNameChange={() => {}}
        donorMobile=""
        onDonorMobileChange={() => {}}
        amount="501"
        onAmountChange={() => {}}
        paymentMode="cash"
        onPaymentModeChange={() => {}}
        paymentReference=""
        onPaymentReferenceChange={() => {}}
        notes=""
        onNotesChange={() => {}}
        creating={false}
        createError={null}
        sessionStatus="open"
        currentReceiptNumber={1}
        onSubmit={() => {}}
        onPropertyIdChange={() => {}}
      />
    );

    const flatSelect = screen.getByLabelText(/Flat \/ Property/i) as HTMLSelectElement;
    expect(flatSelect).toBeTruthy();
    expect(screen.getByText(/Flat 101 \(Jethalal Gada\)/i)).toBeTruthy();
  });

  it("opens inline Add Building dialog when '+ Add Building' button is clicked", () => {
    render(
      <ReceiptCreationForm
        propertyId={null}
        properties={[]}
        buildings={mockBuildings}
        selectedBuildingId={null}
        onBuildingIdChange={() => {}}
        onAddBuilding={vi.fn()}
        onAddProperty={vi.fn()}
        donorName=""
        onDonorNameChange={() => {}}
        donorMobile=""
        onDonorMobileChange={() => {}}
        amount="501"
        onAmountChange={() => {}}
        paymentMode="cash"
        onPaymentModeChange={() => {}}
        paymentReference=""
        onPaymentReferenceChange={() => {}}
        notes=""
        onNotesChange={() => {}}
        creating={false}
        createError={null}
        sessionStatus="open"
        currentReceiptNumber={1}
        onSubmit={() => {}}
        onPropertyIdChange={() => {}}
      />
    );

    const addBldgBtn = screen.getByRole("button", { name: /[+＋]\s*Add Building/i });
    fireEvent.click(addBldgBtn);

    expect(screen.getByPlaceholderText(/Building Name \(e\.g\. Gokul Dham\)/i)).toBeTruthy();
  });
});
