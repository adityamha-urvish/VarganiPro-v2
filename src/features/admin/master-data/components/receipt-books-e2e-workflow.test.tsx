// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ReceiptBooksManagementPanel } from "./receipt-books-management-panel";
import { BuildingsManagementPanel } from "./buildings-management-panel";
import * as receiptBookAdminService from "../services/receipt-book-admin.service";
import * as masterDataService from "../services/master-data.service";
import * as volunteerAdminService from "@/features/admin/volunteers/services/volunteer-admin.service";

describe("Phase 2K-2: End-to-End & Adversarial Receipt Book Tests", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(volunteerAdminService, "fetchVolunteers").mockResolvedValue([]);
  });


  describe("Complete Physical Workflow (A -> L)", () => {
    it("simulates full lifecycle: Book 1 creation -> exhaustion -> Book 2 creation -> non-overlapping sequence", async () => {
      // In-memory mock database store
      const dbBooks: receiptBookAdminService.ReceiptBookAdminRecord[] = [];

      vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockImplementation(
        async () => [...dbBooks]
      );

      vi.spyOn(receiptBookAdminService, "createReceiptBook").mockImplementation(
        async (params) => {
          // Verify unique book number
          if (dbBooks.some((b) => b.bookNumber.toLowerCase() === params.bookNumber.toLowerCase())) {
            throw new Error(`A receipt book with identifier "${params.bookNumber}" already exists for this event`);
          }
          // Verify non-overlapping range for same prefix
          const prefix = params.prefix || "VP-";
          const overlap = dbBooks.find(
            (b) =>
              b.prefix === prefix &&
              params.startNumber <= b.endNumber &&
              params.endNumber >= b.startNumber
          );
          if (overlap) {
            throw new Error(
              `Receipt range (${params.startNumber} - ${params.endNumber}) overlaps with existing Book "${overlap.bookNumber}" (${overlap.startNumber} - ${overlap.endNumber})`
            );
          }

          const newBook: receiptBookAdminService.ReceiptBookAdminRecord = {
            receiptBookId: `book-uuid-${dbBooks.length + 1}`,
            organizationId: params.organizationId,
            eventId: params.eventId,
            bookNumber: params.bookNumber,
            prefix,
            startNumber: params.startNumber,
            endNumber: params.endNumber,
            currentNumber: params.startNumber,
            status: "available",
            totalReceiptsIssued: 0,
            totalAmountCollected: 0,
            createdAt: new Date().toISOString(),
          };
          dbBooks.push(newBook);
          return {
            success: true,
            receiptBookId: newBook.receiptBookId,
            bookNumber: newBook.bookNumber,
            prefix: newBook.prefix,
            startNumber: newBook.startNumber,
            endNumber: newBook.endNumber,
            currentNumber: newBook.currentNumber,
            status: "available",
          };
        }
      );

      const { rerender } = render(
        <ReceiptBooksManagementPanel organizationId="org-1" eventId="event-1" />
      );

      // Step A: Initially empty
      await waitFor(() => {
        expect(screen.getByText(/No physical receipt books registered/i)).toBeTruthy();
      });

      // Step B: Secretary creates Book #1 (1 to 100)
      fireEvent.click(screen.getByRole("button", { name: /\+ Register First Book/i }));
      fireEvent.change(screen.getByTestId("input-book-number"), { target: { value: "BK-01" } });
      fireEvent.change(screen.getByTestId("input-start-number"), { target: { value: "1" } });
      fireEvent.change(screen.getByTestId("input-end-number"), { target: { value: "100" } });
      fireEvent.click(screen.getByTestId("submit-create-book-btn"));

      await waitFor(() => {
        expect(screen.getByText("BK-01")).toBeTruthy();
        expect(screen.getByText(/VP-1 → VP-100/i)).toBeTruthy();
        expect(screen.getByText(/● Ready/i)).toBeTruthy();
      });

      // Step C & D & E: Volunteer checks out Book 1 and creates receipts -> advances to exhaustion
      dbBooks[0].status = "exhausted";
      dbBooks[0].currentNumber = 101;
      dbBooks[0].totalReceiptsIssued = 100;
      dbBooks[0].totalAmountCollected = 50000;
      dbBooks[0].assignedVolunteerName = "Vikram Jadhav";

      rerender(<ReceiptBooksManagementPanel organizationId="org-1" eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/✓ Exhausted/i)).toBeTruthy();
        expect(screen.getByText("Vikram Jadhav")).toBeTruthy();
        expect(screen.getByText("₹50,000")).toBeTruthy();
      });

      // Step H: Secretary creates Book #2 (101 to 200)
      fireEvent.click(screen.getByTestId("add-receipt-book-btn"));
      fireEvent.change(screen.getByTestId("input-book-number"), { target: { value: "BK-02" } });
      fireEvent.change(screen.getByTestId("input-start-number"), { target: { value: "101" } });
      fireEvent.change(screen.getByTestId("input-end-number"), { target: { value: "200" } });
      fireEvent.click(screen.getByTestId("submit-create-book-btn"));

      await waitFor(() => {
        expect(screen.getByText("BK-02")).toBeTruthy();
        expect(screen.getByText(/VP-101 → VP-200/i)).toBeTruthy();
      });

      expect(dbBooks).toHaveLength(2);
      expect(dbBooks[0].bookNumber).toBe("BK-01");
      expect(dbBooks[1].bookNumber).toBe("BK-02");
      expect(dbBooks[1].startNumber).toBe(101);
      expect(dbBooks[1].endNumber).toBe(200);
      expect(dbBooks[1].status).toBe("available");
    });
  });

  describe("Adversarial & Negative Testing", () => {
    it("rejects duplicate physical book identity", async () => {
      vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockResolvedValueOnce([
        {
          receiptBookId: "book-1",
          organizationId: "org-1",
          eventId: "event-1",
          bookNumber: "BK-01",
          prefix: "VP-",
          startNumber: 1,
          endNumber: 100,
          currentNumber: 1,
          status: "available",
          totalReceiptsIssued: 0,
          totalAmountCollected: 0,
          createdAt: new Date().toISOString(),
        },
      ]);

      vi.spyOn(receiptBookAdminService, "createReceiptBook").mockRejectedValueOnce(
        new Error('A receipt book with identifier "BK-01" already exists for this event')
      );

      render(<ReceiptBooksManagementPanel organizationId="org-1" eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByTestId("add-receipt-book-btn")).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId("add-receipt-book-btn"));
      fireEvent.change(screen.getByTestId("input-book-number"), { target: { value: "BK-01" } });
      fireEvent.change(screen.getByTestId("input-start-number"), { target: { value: "101" } });
      fireEvent.change(screen.getByTestId("input-end-number"), { target: { value: "200" } });
      fireEvent.click(screen.getByTestId("submit-create-book-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("receipt-book-form-error")).toHaveProperty(
          "textContent",
          '⚠️ A receipt book with identifier "BK-01" already exists for this event'
        );
      });
    });

    it("rejects overlapping receipt range for same prefix", async () => {
      vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockResolvedValueOnce([
        {
          receiptBookId: "book-1",
          organizationId: "org-1",
          eventId: "event-1",
          bookNumber: "BK-01",
          prefix: "VP-",
          startNumber: 1,
          endNumber: 100,
          currentNumber: 1,
          status: "available",
          totalReceiptsIssued: 0,
          totalAmountCollected: 0,
          createdAt: new Date().toISOString(),
        },
      ]);

      vi.spyOn(receiptBookAdminService, "createReceiptBook").mockRejectedValueOnce(
        new Error('Receipt range (50 - 150) overlaps with existing Book "BK-01" (1 - 100)')
      );

      render(<ReceiptBooksManagementPanel organizationId="org-1" eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByTestId("add-receipt-book-btn")).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId("add-receipt-book-btn"));
      fireEvent.change(screen.getByTestId("input-book-number"), { target: { value: "BK-02" } });
      fireEvent.change(screen.getByTestId("input-start-number"), { target: { value: "50" } });
      fireEvent.change(screen.getByTestId("input-end-number"), { target: { value: "150" } });
      fireEvent.click(screen.getByTestId("submit-create-book-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("receipt-book-form-error")).toHaveProperty(
          "textContent",
          '⚠️ Receipt range (50 - 150) overlaps with existing Book "BK-01" (1 - 100)'
        );
      });
    });

    it("allows same numeric range when prefix is different (e.g. NAV-1..100 vs VP-1..100)", async () => {
      vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockResolvedValueOnce([]);
      const createSpy = vi.spyOn(receiptBookAdminService, "createReceiptBook").mockResolvedValueOnce({
        success: true,
        receiptBookId: "nav-book-1",
        bookNumber: "NAV-BK-01",
        prefix: "NAV-",
        startNumber: 1,
        endNumber: 100,
        currentNumber: 1,
        status: "available",
      });

      render(<ReceiptBooksManagementPanel organizationId="org-1" eventId="event-1" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /\+ Register First Book/i })).toBeTruthy();
      });

      fireEvent.click(screen.getByRole("button", { name: /\+ Register First Book/i }));
      fireEvent.change(screen.getByTestId("input-book-number"), { target: { value: "NAV-BK-01" } });
      fireEvent.change(screen.getByTestId("input-book-prefix"), { target: { value: "NAV-" } });
      fireEvent.change(screen.getByTestId("input-start-number"), { target: { value: "1" } });
      fireEvent.change(screen.getByTestId("input-end-number"), { target: { value: "100" } });
      fireEvent.click(screen.getByTestId("submit-create-book-btn"));

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith({
          organizationId: "org-1",
          eventId: "event-1",
          bookNumber: "NAV-BK-01",
          prefix: "NAV-",
          startNumber: 1,
          endNumber: 100,
        });
      });
    });

    it("integrates seamlessly into BuildingsManagementPanel via subtab navigation", async () => {
      vi.spyOn(masterDataService, "fetchOrganizationBuildings").mockResolvedValueOnce([]);
      vi.spyOn(receiptBookAdminService, "fetchOrganizationReceiptBooks").mockResolvedValueOnce([]);

      render(
        <BuildingsManagementPanel
          organizationId="org-1"
          eventId="event-1"
        />
      );

      // Default subtab is Residential Buildings
      expect(screen.getByTestId("subtab-buildings")).toBeTruthy();
      expect(screen.getByTestId("subtab-shops")).toBeTruthy();
      expect(screen.getByTestId("subtab-books")).toBeTruthy();

      // Click Receipt Books subtab
      fireEvent.click(screen.getByTestId("subtab-books"));

      await waitFor(() => {
        expect(screen.getByTestId("receipt-books-view")).toBeTruthy();
        expect(screen.getByText(/Receipt Books • पावती पुस्तके/i)).toBeTruthy();
      });
    });
  });
});
