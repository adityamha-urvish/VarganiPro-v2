// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { FastReceiptModal } from "./fast-receipt-modal";
import { BuildingFlatGrid } from "./building-flat-grid";
import type { CachedPropertyProgress } from "@/lib/offline/offline-db";

describe("FastReceiptModal: Donor Details Persistence & State Stability", () => {
  afterEach(() => {
    cleanup();
  });

  const mockPendingProperty: CachedPropertyProgress = {
    propertyId: "prop-302",
    buildingId: "bld-1",
    eventId: "ev-1",
    organizationId: "org-1",
    propertyType: "flat",
    unitNumber: "302",
    flatNumber: "302",
    floorNumber: 3,
    shopName: null,
    ownerName: null,
    contactMobile: null,
    status: "pending",
    receiptCount: 0,
    totalCollectedAmount: 0,
    latestReceiptNumber: null,
    lastReceiptAt: null,
    pendingReason: "door_locked",
    followUpTime: "Tomorrow 10 AM",
    followUpNotes: null,
    followUpAt: "2026-09-29T10:00:00Z",
    cachedAt: new Date().toISOString(),
  };

  const mockPropertyWithOwner: CachedPropertyProgress = {
    propertyId: "prop-101",
    buildingId: "bld-1",
    eventId: "ev-1",
    organizationId: "org-1",
    propertyType: "flat",
    unitNumber: "101",
    flatNumber: "101",
    floorNumber: 1,
    shopName: null,
    ownerName: "Rajesh Sharma",
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

  it("TEST A — EXISTING WORKING PATH: preserves pre-filled donor name/mobile and creates receipt", async () => {
    const onSubmitReceipt = vi.fn().mockResolvedValue(undefined);

    render(
      <FastReceiptModal
        isOpen={true}
        buildingName="Gokul Dham"
        property={mockPropertyWithOwner}
        nextProperty={null}
        currentReceiptNumber={101}
        hasActiveSession={true}
        creating={false}
        createError={null}
        onClose={vi.fn()}
        onSubmitReceipt={onSubmitReceipt}
        onOpenPendingDrawer={vi.fn()}
      />
    );

    expect(screen.getByText("Flat 101")).toBeDefined();

    const submitBtn = screen.getByRole("button", { name: /collect receipt #101/i });
    fireEvent.click(submitBtn);

    expect(onSubmitReceipt).toHaveBeenCalledTimes(1);
    expect(onSubmitReceipt).toHaveBeenCalledWith({
      propertyId: "prop-101",
      amount: 501,
      paymentMode: "cash",
      donorName: "Rajesh Sharma",
      donorMobile: "9820011111",
      paymentReference: null,
    });
  });

  it("TEST B — BROKEN PATH (NOW FIXED): reopening pending flat, entering custom donor name/mobile and submitting", async () => {
    const onSubmitReceipt = vi.fn().mockResolvedValue(undefined);

    render(
      <FastReceiptModal
        isOpen={true}
        buildingName="Gokul Dham"
        property={mockPendingProperty}
        nextProperty={null}
        currentReceiptNumber={121}
        hasActiveSession={true}
        creating={false}
        createError={null}
        onClose={vi.fn()}
        onSubmitReceipt={onSubmitReceipt}
        onOpenPendingDrawer={vi.fn()}
      />
    );

    expect(screen.getByText("Flat 302")).toBeDefined();

    const expandBtn = screen.getByText(/Add Custom Donor Name \/ Phone/i);
    fireEvent.click(expandBtn);

    const nameInput = screen.getByPlaceholderText(/Donor name \(default: Flat 302 Resident\)/i);
    const mobileInput = screen.getByPlaceholderText(/Mobile number for WhatsApp receipt/i);

    fireEvent.change(nameInput, { target: { value: "Chetan Navlagi" } });
    fireEvent.change(mobileInput, { target: { value: "7506725655" } });

    const submitBtn = screen.getByRole("button", { name: /collect receipt #121/i });
    fireEvent.click(submitBtn);

    expect(onSubmitReceipt).toHaveBeenCalledTimes(1);
    expect(onSubmitReceipt).toHaveBeenCalledWith({
      propertyId: "prop-302",
      amount: 501,
      paymentMode: "cash",
      donorName: "Chetan Navlagi",
      donorMobile: "7506725655",
      paymentReference: null,
    });
  });

  it("TEST C — REOPEN WITHOUT EDIT: falls back to default Flat 302 Resident", async () => {
    const onSubmitReceipt = vi.fn().mockResolvedValue(undefined);

    render(
      <FastReceiptModal
        isOpen={true}
        buildingName="Gokul Dham"
        property={mockPendingProperty}
        nextProperty={null}
        currentReceiptNumber={122}
        hasActiveSession={true}
        creating={false}
        createError={null}
        onClose={vi.fn()}
        onSubmitReceipt={onSubmitReceipt}
        onOpenPendingDrawer={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /collect receipt #122/i });
    fireEvent.click(submitBtn);

    expect(onSubmitReceipt).toHaveBeenCalledTimes(1);
    expect(onSubmitReceipt).toHaveBeenCalledWith({
      propertyId: "prop-302",
      amount: 501,
      paymentMode: "cash",
      donorName: "Flat 302 Resident",
      donorMobile: null,
      paymentReference: null,
    });
  });

  it("TEST D — BACKGROUND REFRESH: edited donor details survive background re-renders of the property", async () => {
    const onSubmitReceipt = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <FastReceiptModal
        isOpen={true}
        buildingName="Gokul Dham"
        property={mockPendingProperty}
        nextProperty={null}
        currentReceiptNumber={123}
        hasActiveSession={true}
        creating={false}
        createError={null}
        onClose={vi.fn()}
        onSubmitReceipt={onSubmitReceipt}
        onOpenPendingDrawer={vi.fn()}
      />
    );

    const expandBtn = screen.getByText(/Add Custom Donor Name \/ Phone/i);
    fireEvent.click(expandBtn);

    const nameInput = screen.getByPlaceholderText(/Donor name \(default: Flat 302 Resident\)/i);
    const mobileInput = screen.getByPlaceholderText(/Mobile number for WhatsApp receipt/i);

    fireEvent.change(nameInput, { target: { value: "Chetan Navlagi" } });
    fireEvent.change(mobileInput, { target: { value: "7506725655" } });

    const amount1001Btn = screen.getByRole("button", { name: /₹1001/i });
    fireEvent.click(amount1001Btn);

    // Simulate 3 consecutive background sync re-renders with new property object references
    for (let i = 0; i < 3; i++) {
      const refreshedPropertyObject: CachedPropertyProgress = {
        ...mockPendingProperty,
        cachedAt: new Date(Date.now() + i * 1000).toISOString(),
      };

      rerender(
        <FastReceiptModal
          isOpen={true}
          buildingName="Gokul Dham"
          property={refreshedPropertyObject}
          nextProperty={null}
          currentReceiptNumber={123}
          hasActiveSession={true}
          creating={false}
          createError={null}
          onClose={vi.fn()}
          onSubmitReceipt={onSubmitReceipt}
          onOpenPendingDrawer={vi.fn()}
        />
      );
    }

    const currentNameInput = screen.getByPlaceholderText(/Donor name \(default: Flat 302 Resident\)/i) as HTMLInputElement;
    const currentMobileInput = screen.getByPlaceholderText(/Mobile number for WhatsApp receipt/i) as HTMLInputElement;
    expect(currentNameInput.value).toBe("Chetan Navlagi");
    expect(currentMobileInput.value).toBe("7506725655");

    const submitBtn = screen.getByRole("button", { name: /collect receipt #123/i });
    fireEvent.click(submitBtn);

    expect(onSubmitReceipt).toHaveBeenCalledTimes(1);
    expect(onSubmitReceipt).toHaveBeenCalledWith({
      propertyId: "prop-302",
      amount: 1001,
      paymentMode: "cash",
      donorName: "Chetan Navlagi",
      donorMobile: "7506725655",
      paymentReference: null,
    });
  });

  it("TEST E — FLAT CARD UI: BuildingFlatGrid immediately displays newly captured donor name after completing pending flat", () => {
    const updatedPropertyAfterCollection: CachedPropertyProgress = {
      ...mockPendingProperty,
      status: "collected",
      receiptCount: 1,
      totalCollectedAmount: 501,
      latestReceiptNumber: 121,
      ownerName: "Test Ignore",
      contactMobile: "1234567890",
    };

    const mockBuilding = {
      buildingId: "bld-1",
      eventId: "ev-1",
      organizationId: "org-1",
      buildingName: "Gokul Dham",
      code: "GD",
      wing: "A",
      areaName: "Sector 28",
      totalUnits: 1,
      collectedCount: 1,
      pendingCount: 0,
      refusedCount: 0,
      notVisitedCount: 0,
      remainingCount: 0,
      totalAmountCollected: 501,
      lastActivityAt: null,
      cachedAt: new Date().toISOString(),
    };

    render(
      <BuildingFlatGrid
        building={mockBuilding}
        properties={[updatedPropertyAfterCollection]}
        loading={false}
        onBack={vi.fn()}
        onSelectProperty={vi.fn()}
      />
    );

    // Verify Flat 302 card shows the unit number, amount, and the captured donor name
    expect(screen.getByText("Flat 302")).toBeDefined();
    expect(screen.getByText("₹501 ✓")).toBeDefined();
    expect(screen.getByText("Test Ignore")).toBeDefined();
  });
});
