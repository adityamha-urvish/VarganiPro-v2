// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ReceiptBooksManagementPanel } from "./receipt-books-management-panel";
import * as receiptBookAdminService from "../services/receipt-book-admin.service";
import * as volunteerAdminService from "@/features/admin/volunteers/services/volunteer-admin.service";

describe("Phase 2K-2: ReceiptBooksManagementPanel Component", () => {
  afterEach(() => {
    cleanup();
  });

  const mockBooks: receiptBookAdminService.ReceiptBookAdminRecord[] = [
    {
      receiptBookId: "book-1",
      organizationId: "org-1",
      eventId: "event-1",
      bookNumber: "BK-01",
      prefix: "VP-",
      startNumber: 1,
      endNumber: 100,
      currentNumber: 101,
      status: "exhausted",
      assignedVolunteerId: "vol-1",
      assignedVolunteerName: "Rahul Shinde",
      totalReceiptsIssued: 100,
      totalAmountCollected: 51000,
      createdAt: "2026-09-01T10:00:00Z",
    },
    {
      receiptBookId: "book-2",
      organizationId: "org-1",
      eventId: "event-1",
      bookNumber: "BK-02",
      prefix: "VP-",
      startNumber: 101,
      endNumber: 200,
      currentNumber: 145,
      status: "checked_out",
      assignedVolunteerId: "vol-2",
      assignedVolunteerName: "Suresh Patil",
      totalReceiptsIssued: 44,
      totalAmountCollected: 22500,
      createdAt: "2026-09-02T10:00:00Z",
    },
    {
      receiptBookId: "book-3",
      organizationId: "org-1",
      eventId: "event-1",
      bookNumber: "BK-03",
      prefix: "VP-",
      startNumber: 201,
      endNumber: 300,
      currentNumber: 201,
      status: "available",
      totalReceiptsIssued: 0,
      totalAmountCollected: 0,
      createdAt: "2026-09-03T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(volunteerAdminService, "fetchVolunteers").mockResolvedValue([]);
  });


  it("renders loading state then displays list of receipt books with progress and badges", async () => {
    vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockResolvedValueOnce(
      mockBooks
    );

    render(
      <ReceiptBooksManagementPanel
        organizationId="org-1"
        eventId="event-1"
      />
    );

    expect(screen.getByText(/Loading receipt books.../i)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("BK-01")).toBeTruthy();
      expect(screen.getByText("BK-02")).toBeTruthy();
      expect(screen.getByText("BK-03")).toBeTruthy();
    });

    // Check badges
    expect(screen.getAllByText(/Exhausted/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Active/i)).toBeTruthy();
    expect(screen.getByText(/Ready/i)).toBeTruthy();

    // Check volunteer assignment
    expect(screen.getByText("Rahul Shinde")).toBeTruthy();
    expect(screen.getByText("Suresh Patil")).toBeTruthy();

    // Check total amounts
    expect(screen.getByText("₹51,000")).toBeTruthy();
    expect(screen.getByText("₹22,500")).toBeTruthy();
  });

  it("renders empty state when no receipt books exist", async () => {
    vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockResolvedValueOnce(
      []
    );

    render(
      <ReceiptBooksManagementPanel
        organizationId="org-1"
        eventId="event-1"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No physical receipt books registered/i)
      ).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: /\+ Register First Book/i })).toBeTruthy();
  });

  it("opens modal, displays live preview, and successfully registers a new receipt book", async () => {
    vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockResolvedValue(
      mockBooks
    );
    const createSpy = vi
      .spyOn(receiptBookAdminService, "createReceiptBook")
      .mockResolvedValueOnce({
        success: true,
        receiptBookId: "book-4",
        bookNumber: "BK-04",
        prefix: "VP-",
        startNumber: 301,
        endNumber: 400,
        currentNumber: 301,
        status: "available",
      });

    render(
      <ReceiptBooksManagementPanel
        organizationId="org-1"
        eventId="event-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("add-receipt-book-btn")).toBeTruthy();
    });

    // Open Modal
    fireEvent.click(screen.getByTestId("add-receipt-book-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("input-book-number")).toBeTruthy();
    });

    const bookInput = screen.getByTestId("input-book-number");
    const prefixInput = screen.getByTestId("input-book-prefix");
    const startInput = screen.getByTestId("input-start-number");
    const endInput = screen.getByTestId("input-end-number");

    fireEvent.change(bookInput, { target: { value: "BK-04" } });
    fireEvent.change(prefixInput, { target: { value: "VP-" } });
    fireEvent.change(startInput, { target: { value: "301" } });
    fireEvent.change(endInput, { target: { value: "400" } });

    // Live preview check
    expect(screen.getByText(/VP- — BK-04 — 301 to 400/i)).toBeTruthy();
    expect(screen.getByText(/Total capacity: 100 receipts/i)).toBeTruthy();

    // Submit
    const submitBtn = screen.getByTestId("submit-create-book-btn");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        organizationId: "org-1",
        eventId: "event-1",
        bookNumber: "BK-04",
        prefix: "VP-",
        startNumber: 301,
        endNumber: 400,
      });
    });
  });

  it("surfaces server validation errors in the modal dialog", async () => {
    vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockResolvedValue(
      mockBooks
    );
    vi.spyOn(receiptBookAdminService, "createReceiptBook").mockRejectedValueOnce(
      new Error('Receipt range (101 - 200) overlaps with existing Book "BK-02"')
    );

    render(
      <ReceiptBooksManagementPanel
        organizationId="org-1"
        eventId="event-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("add-receipt-book-btn")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("add-receipt-book-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("input-book-number")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("input-book-number"), {
      target: { value: "BK-DUPLICATE" },
    });
    fireEvent.change(screen.getByTestId("input-start-number"), {
      target: { value: "101" },
    });
    fireEvent.change(screen.getByTestId("input-end-number"), {
      target: { value: "200" },
    });

    fireEvent.click(screen.getByTestId("submit-create-book-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("receipt-book-form-error")).toBeTruthy();
      expect(
        screen.getByText(/Receipt range \(101 - 200\) overlaps with existing Book "BK-02"/i)
      ).toBeTruthy();
    });
  });

  it("allows admin to assign and unassign a volunteer to an available receipt book", async () => {
    vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockResolvedValue(
      mockBooks
    );
    vi.spyOn(volunteerAdminService, "fetchVolunteers").mockResolvedValue([
      {
        volunteerId: "vol-1",
        userId: "user-1",
        fullName: "Rahul Shinde",
        mobile: "9876543210",
        status: "active",
        mustChangePin: false,
        createdAt: "2026-09-01T10:00:00Z",
      },
    ]);
    const assignSpy = vi
      .spyOn(receiptBookAdminService, "assignReceiptBook")
      .mockResolvedValue({
        success: true,
        receiptBookId: "book-3",
        status: "assigned",
        assignedVolunteerId: "vol-1",
      });

    render(
      <ReceiptBooksManagementPanel
        organizationId="org-1"
        eventId="event-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("assign-select-BK-03")).toBeTruthy();
    });

    const select = screen.getByTestId("assign-select-BK-03");
    fireEvent.change(select, { target: { value: "vol-1" } });

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith("book-3", "vol-1");
    });
  });
});


