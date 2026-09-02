// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReceiptCreationForm } from "./receipt-creation-form";
import { FastReceiptModal } from "./fast-receipt-modal";
import { SessionSummaryCard } from "./session-summary-card";
import type { CachedPropertyProgress } from "@/lib/offline/offline-db";
import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";

const mockProperty: CachedPropertyProgress = {
  propertyId: "prop-1",
  buildingId: "bldg-1",
  eventId: "event-1",
  organizationId: "org-1",
  unitNumber: "101",
  flatNumber: "101",
  floorNumber: 1,
  propertyType: "residential",
  ownerName: "Anand Shah",
  contactMobile: "9820011111",
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

const mockOpenSession: CollectionSessionContext = {
  sessionId: "session-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-01",
  prefix: "VP-",
  startNumber: 101,
  endNumber: 105,
  currentNumber: 101,
  sessionStatus: "open",
  bookStatus: "checked_out",
};

describe("Exhausted Receipt Book UX Tests", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // 1. Book with numbers remaining: receipt creation remains available
  it("1. Book with numbers remaining: Normal Receipt Form allows input and submission", () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <ReceiptCreationForm
        donorName="Test Donor"
        donorMobile="9820011223"
        amount="500"
        paymentMode="cash"
        paymentReference=""
        notes=""
        creating={false}
        createError={null}
        sessionStatus="open"
        currentReceiptNumber={102}
        startNumber={101}
        endNumber={105}
        onDonorNameChange={vi.fn()}
        onDonorMobileChange={vi.fn()}
        onAmountChange={vi.fn()}
        onPaymentModeChange={vi.fn()}
        onPaymentReferenceChange={vi.fn()}
        onNotesChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Create Receipt #102/i });
    expect(submitBtn).toBeDefined();
    expect(submitBtn).not.toHaveProperty("disabled", true);
    expect(screen.queryByText(/पावती पुस्तक पूर्ण झाले/i)).toBeNull();
  });

  // 2. Book exactly at final receipt: final receipt can still be created
  it("2. Book exactly at final receipt (currentNumber === endNumber): creation remains enabled", () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <ReceiptCreationForm
        donorName="Last Donor"
        donorMobile="9820011223"
        amount="500"
        paymentMode="cash"
        paymentReference=""
        notes=""
        creating={false}
        createError={null}
        sessionStatus="open"
        currentReceiptNumber={105}
        startNumber={101}
        endNumber={105}
        onDonorNameChange={vi.fn()}
        onDonorMobileChange={vi.fn()}
        onAmountChange={vi.fn()}
        onPaymentModeChange={vi.fn()}
        onPaymentReferenceChange={vi.fn()}
        onNotesChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Create Receipt #105/i });
    expect(submitBtn).not.toHaveProperty("disabled", true);
    expect(screen.queryByText(/पावती पुस्तक पूर्ण झाले/i)).toBeNull();
  });

  // 3. Book exhausted: receipt creation UI is blocked
  it("3. Book exhausted (currentNumber > endNumber): Normal Receipt Form shows completed banner and disables inputs", () => {
    const onNavigateToClose = vi.fn();
    const onSubmit = vi.fn((e) => e.preventDefault());

    render(
      <ReceiptCreationForm
        donorName=""
        donorMobile=""
        amount=""
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

    // Shows bilingual banner
    expect(screen.getAllByText(/पावती पुस्तक पूर्ण झाले/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Receipt Book Completed/i)).toBeDefined();
    expect(screen.getByText(/#101–#105/i)).toBeDefined();

    // Submit button is disabled
    const submitBtn = screen.getByRole("button", { name: /पावती पुस्तक पूर्ण झाले/i });
    expect(submitBtn).toHaveProperty("disabled", true);

    // Close collection action button is clickable
    const closeBtn = screen.getByRole("button", { name: /संकलन बंद करा \/ Close Collection/i });
    fireEvent.click(closeBtn);
    expect(onNavigateToClose).toHaveBeenCalledTimes(1);
  });

  // 4. Exhausted book in Fast Receipt Modal
  it("4. Exhausted book in Fast Receipt Modal: displays completed-book card and blocks receipt submission", () => {
    const onSubmitReceipt = vi.fn(async () => {});
    const onClose = vi.fn();
    const onNavigateToClose = vi.fn();

    render(
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
        onClose={onClose}
        onNavigateToCloseSession={onNavigateToClose}
        onSubmitReceipt={onSubmitReceipt}
        onOpenPendingDrawer={vi.fn()}
      />
    );

    // Verifies bilingual completed banner
    expect(screen.getByText(/पावती पुस्तक पूर्ण झाले/i)).toBeDefined();
    expect(screen.getByText(/Receipt Book Completed/i)).toBeDefined();
    expect(screen.getByText(/#101–#105/i)).toBeDefined();

    // Fast amount chips should NOT be present
    expect(screen.queryByText("₹501")).toBeNull();

    // Action button triggers navigation to close collection
    const actionBtn = screen.getByRole("button", { name: /संकलन बंद करा \/ Close Collection/i });
    fireEvent.click(actionBtn);
    expect(onClose).toHaveBeenCalled();
    expect(onNavigateToClose).toHaveBeenCalled();
    expect(onSubmitReceipt).not.toHaveBeenCalled();
  });

  // 5. SessionSummaryCard highlights exhausted book state
  it("5. SessionSummaryCard: displays exhausted book banner and changes primary action to Close Collection", () => {
    const onCloseSession = vi.fn();
    const exhaustedSession: CollectionSessionContext = {
      ...mockOpenSession,
      currentNumber: 106,
      startNumber: 101,
      endNumber: 105,
    };

    render(
      <SessionSummaryCard
        session={exhaustedSession}
        receiptCount={5}
        totalAmount={2500}
        pendingCount={0}
        conflictCount={0}
        cashAmount={2500}
        upiAmount={0}
        chequeAmount={0}
        bankTransferAmount={0}
        closingSession={false}
        sessionCloseError={null}
        sessionCloseMessage={null}
        onCloseSession={onCloseSession}
      />
    );

    expect(screen.getByText(/पावती पुस्तक पूर्ण झाले \/ Receipt Book Completed/i)).toBeDefined();
    expect(screen.getByText(/#101–#105/i)).toBeDefined();

    const closeBtn = screen.getByRole("button", { name: /संकलन बंद करा \/ Close Collection Session/i });
    fireEvent.click(closeBtn);
    expect(onCloseSession).toHaveBeenCalledTimes(1);
  });

  // 6 & 7. Core invariant: Allocator defensive guard remains intact
  it("6 & 7. Core invariant: allocateAndCreateLocalReceiptAtomic defensively rejects allocation when nextLocalNumber > endNumber", async () => {
    const { allocateAndCreateLocalReceiptAtomic, mergeOfflineBookState, getLocalReceipts } = await import("@/lib/offline/offline-db");

    // Prime an exhausted book state in IndexedDB (start: 101, end: 105, nextLocalNumber: 106)
    await mergeOfflineBookState({
      receiptBookId: "book-exhausted-test",
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-1",
      volunteerId: "vol-1",
      bookNumber: "BOOK-EXHAUSTED",
      prefix: "VP-",
      startNumber: 101,
      endNumber: 105,
      nextLocalNumber: 106,
      updatedAt: new Date().toISOString(),
    });

    // Attempting allocation must throw the exact defensive safety error
    await expect(
      allocateAndCreateLocalReceiptAtomic({
        organizationId: "org-1",
        eventId: "event-1",
        collectionSessionId: "session-1",
        receiptBookId: "book-exhausted-test",
        volunteerId: "vol-1",
        propertyId: null,
        donorName: "Blocked Donor",
        donorMobile: null,
        amount: 500,
        paymentMode: "cash",
        paymentReference: null,
        notes: null,
      })
    ).rejects.toThrow("Receipt book has no more available receipt numbers.");

    // Verify 0 receipts were written to IndexedDB
    const receipts = await getLocalReceipts("book-exhausted-test");
    expect(receipts.length).toBe(0);
  });

  // 8. Completed session allows checking out a fresh receipt book
  it("8. Workflow: Completed session allows starting next collection session with a fresh book", async () => {
    const { StartCollectionCard } = await import("./start-collection-card");
    const onStartCollection = vi.fn();

    const availableEvents = [
      { id: "event-1", name: "Ganesh Festival", code: "GF-2026", start_date: "2026-08-25", end_date: "2026-09-05" },
    ];
    const availableBooks = [
      { id: "book-2", book_number: "BOOK-02", prefix: "VP-", start_number: 106, end_number: 150, current_number: 106, status: "available", event_id: "event-1" },
    ];

    render(
      <StartCollectionCard
        title="Start New Collection"
        description="Your previous collection is completed. Start a new session with an available receipt book."
        events={availableEvents}
        books={availableBooks}
        selectedEventId="event-1"
        selectedBookId="book-2"
        loading={false}
        error={null}
        onEventChange={vi.fn()}
        onBookChange={vi.fn()}
        onStartCollection={onStartCollection}
      />
    );

    expect(screen.getByText(/Start New Collection/i)).toBeDefined();
    expect(screen.getAllByText(/BOOK-02/i).length).toBeGreaterThanOrEqual(1);
    const startBtn = screen.getByRole("button", { name: /Start Collection/i });
    fireEvent.click(startBtn);
    expect(onStartCollection).toHaveBeenCalledTimes(1);
  });
});
