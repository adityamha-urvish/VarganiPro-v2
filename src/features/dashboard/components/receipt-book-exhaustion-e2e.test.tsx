// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FastReceiptModal } from "./fast-receipt-modal";
import { ReceiptCreationForm } from "./receipt-creation-form";
import { ReadyToCollectScreen } from "./ready-to-collect-screen";
import {
  allocateAndCreateLocalReceiptAtomic,
  mergeOfflineBookState,
  getLocalReceipts,
  type CachedPropertyProgress,
} from "@/lib/offline/offline-db";

describe("Phase 2K-4: Receipt Book Exhaustion Field Verification", () => {
  const mockProperty: CachedPropertyProgress = {
    propertyId: "prop-106",
    buildingId: "bldg-1",
    eventId: "event-1",
    organizationId: "org-1",
    unitNumber: "106",
    flatNumber: "106",
    floorNumber: 1,
    propertyType: "residential",
    ownerName: "Deepak Shinde",
    contactMobile: "9820055555",
    shopName: null,
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

  const mockNextProperty: CachedPropertyProgress = {
    ...mockProperty,
    propertyId: "prop-107",
    unitNumber: "107",
    flatNumber: "107",
    ownerName: "Sunil Joshi",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // TEST 1: Exact state transition (1 remaining -> final receipt -> 0 remaining)
  // --------------------------------------------------------------------------
  it("1. State transition: Book with 1 remaining allows final receipt, then transitions to 0 remaining", async () => {
    // Start book at 101-105 with nextLocalNumber = 105 (exactly 1 remaining: #105)
    await mergeOfflineBookState({
      receiptBookId: "book-transition-test",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "vol-1",
      bookNumber: "BK-01",
      prefix: "VP-",
      startNumber: 101,
      endNumber: 105,
      nextLocalNumber: 105,
      updatedAt: new Date().toISOString(),
    });

    // 1 remaining receipt available
    const initialReceipt = await allocateAndCreateLocalReceiptAtomic({
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      receiptBookId: "book-transition-test",
      volunteerId: "vol-1",
      propertyId: "prop-105",
      donorName: "Fifth Donor",
      donorMobile: "9820011111",
      amount: 1000,
      paymentMode: "cash",
      paymentReference: null,
      notes: null,
    });

    expect(initialReceipt.receiptNumber).toBe(105);
    expect(initialReceipt.syncStatus).toBe("pending");

    // Book is now exhausted (nextLocalNumber is 106 > 105)
    // Any subsequent creation attempt must be defensively rejected without data corruption
    await expect(
      allocateAndCreateLocalReceiptAtomic({
        organizationId: "org-1",
        eventId: "event-1",
        collectionSessionId: "session-1",
        receiptBookId: "book-transition-test",
        volunteerId: "vol-1",
        propertyId: "prop-106",
        donorName: "Over-the-limit Donor",
        donorMobile: null,
        amount: 500,
        paymentMode: "cash",
        paymentReference: null,
        notes: null,
      })
    ).rejects.toThrow("Receipt book has no more available receipt numbers.");

    // Exactly 1 receipt in this book was written
    const receipts = await getLocalReceipts("book-transition-test");
    expect(receipts.length).toBe(1);
    expect(receipts[0].receiptNumber).toBe(105);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Mid-building door-to-door workflow guidance
  // --------------------------------------------------------------------------
  it("2. Mid-Building Scenario: FastReceiptModal on exhausted book presents clear bilingual guidance and route to Close Collection", () => {
    const onNavigateToClose = vi.fn();
    const onSubmitReceipt = vi.fn(async () => {});
    const onClose = vi.fn();

    render(
      <FastReceiptModal
        isOpen={true}
        buildingName="Shree Ganesh Heights"
        property={mockNextProperty}
        nextProperty={null}
        currentReceiptNumber={106}
        startNumber={101}
        endNumber={105}
        creating={false}
        createError={null}
        onClose={onClose}
        onNavigateToCloseSession={onNavigateToClose}
        onSubmitReceipt={onSubmitReceipt}
        onOpenPendingDrawer={vi.fn()}
      />
    );

    // Header badge indicates book completion
    expect(screen.getByText("Book Completed")).toBeTruthy();
    expect(screen.getByText("Flat 107")).toBeTruthy();

    // Bilingual explanatory card
    expect(screen.getByText("पावती पुस्तक पूर्ण झाले")).toBeTruthy();
    expect(screen.getByText("Receipt Book Completed")).toBeTruthy();
    expect(
      screen.getByText(/पावती क्रमांक #101–#105 पर्यंत सर्व पावत्या वापरल्या आहेत/i)
    ).toBeTruthy();

    // Receipt creation buttons (e.g. amount chips, submit) are NOT rendered
    expect(screen.queryByRole("button", { name: /Create Receipt/i })).toBeNull();
    expect(screen.queryByText("₹501")).toBeNull();

    // Primary guidance button triggers navigation to close collection
    const closeBtn = screen.getByRole("button", {
      name: /संकलन बंद करा \/ Close Collection →/i,
    });
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onNavigateToClose).toHaveBeenCalledTimes(1);
    expect(onSubmitReceipt).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // TEST 3: General Receipt Form exhaustion safeguards
  // --------------------------------------------------------------------------
  it("3. ReceiptCreationForm: Completely disables input fields and displays exhausted status banner", () => {
    const onNavigateToClose = vi.fn();
    const onSubmit = vi.fn((e) => e.preventDefault());

    render(
      <ReceiptCreationForm
        donorName="Blocked Resident"
        donorMobile="9820011223"
        amount="500"
        paymentMode="cash"
        paymentReference=""
        notes=""
        creating={false}
        createError={null}
        sessionStatus="open"
        currentReceiptNumber={106}
        startNumber={101}
        endNumber={105}
        onNavigateToCloseSession={onNavigateToClose}
        onDonorNameChange={vi.fn()}
        onDonorMobileChange={vi.fn()}
        onAmountChange={vi.fn()}
        onPaymentModeChange={vi.fn()}
        onPaymentReferenceChange={vi.fn()}
        onNotesChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    // Banner present
    expect(screen.getAllByText(/पावती पुस्तक पूर्ण झाले/i).length).toBeGreaterThanOrEqual(1);

    // Submit button disabled
    const submitBtn = screen.getByRole("button", {
      name: /पावती पुस्तक पूर्ण झाले \(Book Completed\)/i,
    });
    expect(submitBtn).toHaveProperty("disabled", true);

    // Navigate to close session button works
    const closeSessionBtn = screen.getByRole("button", {
      name: /संकलन बंद करा \/ Close Collection →/i,
    });
    fireEvent.click(closeSessionBtn);
    expect(onNavigateToClose).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // TEST 4: ReadyToCollectScreen handles exhausted state and prompts for next book
  // --------------------------------------------------------------------------
  it("4. ReadyToCollectScreen: Infers exhausted state when remainingCount is 0 and prompts Get Next Book", () => {
    const onStartCollection = vi.fn();

    render(
      <ReadyToCollectScreen
        idPrefix="exhausted-test"
        startNumber={101}
        endNumber={105}
        currentNumber={106}
        remainingCount={0}
        events={[{ id: "ev-1", name: "Ganeshotsav 2026", code: "GANESH-2026", start_date: "2026-08-25", end_date: "2026-09-05" }]}
        books={[]}
        loading={false}
        error={null}
        onEventChange={vi.fn()}
        onBookChange={vi.fn()}
        onStartCollection={onStartCollection}
      />
    );

    // Badge and title indicate completion
    expect(screen.getByText("✓ Book Completed")).toBeTruthy();
    expect(screen.getByText("Book Completed")).toBeTruthy();
    expect(screen.getByText("पावती पुस्तक पूर्ण भरले आहे")).toBeTruthy();

    // Primary action button displays 'Get Next Book'
    expect(screen.getByText(/Get Next Book/i)).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // TEST 5: Responsive layout integrity (375px, 390px, 414px, 1440px)
  // --------------------------------------------------------------------------
  it("5. Responsive layout check: Modal and summary card render without throwing errors across viewports", () => {
    const viewports = [375, 390, 414, 1440];

    for (const width of viewports) {
      window.innerWidth = width;
      const { container } = render(
        <FastReceiptModal
          isOpen={true}
          buildingName="Gokul Dham"
          property={mockProperty}
          nextProperty={null}
          currentReceiptNumber={106}
          startNumber={101}
          endNumber={105}
          creating={false}
          createError={null}
          onClose={vi.fn()}
          onNavigateToCloseSession={vi.fn()}
          onSubmitReceipt={vi.fn(async () => {})}
          onOpenPendingDrawer={vi.fn()}
        />
      );

      expect(container.querySelector(".fixed")).toBeTruthy();
      cleanup();
    }
  });
});
