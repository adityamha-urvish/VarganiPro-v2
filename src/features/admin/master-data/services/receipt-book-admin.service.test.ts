import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/supabase/client";
import {
  createReceiptBook,
  fetchOrganizationReceiptBooks,
} from "./receipt-book-admin.service";

describe("Phase 2K-2: Receipt Book Admin Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchOrganizationReceiptBooks", () => {
    it("fetches and maps receipt books correctly", async () => {
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: [
          {
            receipt_book_id: "book-1",
            organization_id: "org-1",
            event_id: "event-1",
            book_number: "BK-01",
            prefix: "VP-",
            start_number: 1,
            end_number: 100,
            current_number: 45,
            status: "checked_out",
            assigned_volunteer_id: "vol-1",
            assigned_volunteer_name: "Amit Deshmukh",
            checked_out_session_id: "session-1",
            checked_out_at: "2026-09-01T10:00:00Z",
            total_receipts_issued: 44,
            total_amount_collected: 22000,
            created_at: "2026-09-01T09:00:00Z",
          },
        ],
        error: null,
      } as any);

      const result = await fetchOrganizationReceiptBooks("org-1", "event-1");

      expect(supabase.rpc).toHaveBeenCalledWith("get_organization_receipt_books", {
        p_organization_id: "org-1",
        p_event_id: "event-1",
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        receiptBookId: "book-1",
        organizationId: "org-1",
        eventId: "event-1",
        bookNumber: "BK-01",
        prefix: "VP-",
        startNumber: 1,
        endNumber: 100,
        currentNumber: 45,
        status: "checked_out",
        assignedVolunteerId: "vol-1",
        assignedVolunteerName: "Amit Deshmukh",
        checkedOutSessionId: "session-1",
        checkedOutAt: "2026-09-01T10:00:00Z",
        totalReceiptsIssued: 44,
        totalAmountCollected: 22000,
        createdAt: "2026-09-01T09:00:00Z",
      });
    });

    it("throws a human-readable error when RPC fails", async () => {
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: null,
        error: { message: "Unauthorized access", code: "P0001" },
      } as any);

      await expect(
        fetchOrganizationReceiptBooks("org-1", "event-1")
      ).rejects.toThrow("Unauthorized access");
    });
  });

  describe("createReceiptBook", () => {
    it("successfully creates a receipt book with valid inputs", async () => {
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          receipt_book_id: "book-new-123",
          book_number: "BK-02",
          prefix: "VP-",
          start_number: 101,
          end_number: 200,
          current_number: 101,
          status: "available",
        },
        error: null,
      } as any);

      const result = await createReceiptBook({
        organizationId: "org-1",
        eventId: "event-1",
        bookNumber: "BK-02",
        prefix: "VP-",
        startNumber: 101,
        endNumber: 200,
      });

      expect(supabase.rpc).toHaveBeenCalledWith("create_receipt_book", {
        p_organization_id: "org-1",
        p_event_id: "event-1",
        p_book_number: "BK-02",
        p_prefix: "VP-",
        p_start_number: 101,
        p_end_number: 200,
      });

      expect(result).toEqual({
        success: true,
        receiptBookId: "book-new-123",
        bookNumber: "BK-02",
        prefix: "VP-",
        startNumber: 101,
        endNumber: 200,
        currentNumber: 101,
        status: "available",
      });
    });

    it("rejects when book number is empty", async () => {
      await expect(
        createReceiptBook({
          organizationId: "org-1",
          eventId: "event-1",
          bookNumber: "   ",
          prefix: "VP-",
          startNumber: 1,
          endNumber: 100,
        })
      ).rejects.toThrow("Book number or identifier is required");
    });

    it("rejects when start number is invalid or < 1", async () => {
      await expect(
        createReceiptBook({
          organizationId: "org-1",
          eventId: "event-1",
          bookNumber: "BK-01",
          prefix: "VP-",
          startNumber: 0,
          endNumber: 100,
        })
      ).rejects.toThrow("Start receipt number must be a valid positive integer");
    });

    it("rejects when end number is less than or equal to start number", async () => {
      await expect(
        createReceiptBook({
          organizationId: "org-1",
          eventId: "event-1",
          bookNumber: "BK-01",
          prefix: "VP-",
          startNumber: 100,
          endNumber: 50,
        })
      ).rejects.toThrow("End receipt number must be greater than start receipt number");
    });

    it("surfaces server conflict error when range overlaps", async () => {
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Receipt range (101 - 200) overlaps with existing Book "BK-02" (101 - 200)',
          code: "P0001",
        },
      } as any);

      await expect(
        createReceiptBook({
          organizationId: "org-1",
          eventId: "event-1",
          bookNumber: "BK-03",
          prefix: "VP-",
          startNumber: 101,
          endNumber: 200,
        })
      ).rejects.toThrow('Receipt range (101 - 200) overlaps with existing Book "BK-02" (101 - 200)');
    });
  });

  describe("assignReceiptBook", () => {
    it("successfully assigns a receipt book to a volunteer", async () => {
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          receipt_book_id: "book-1",
          assigned_volunteer_id: "vol-1",
          status: "assigned",
        },
        error: null,
      } as any);

      const result = await (await import("./receipt-book-admin.service")).assignReceiptBook(
        "book-1",
        "vol-1"
      );

      expect(supabase.rpc).toHaveBeenCalledWith("assign_receipt_book", {
        p_receipt_book_id: "book-1",
        p_volunteer_id: "vol-1",
      });
      expect(result).toEqual({
        success: true,
        receiptBookId: "book-1",
        assignedVolunteerId: "vol-1",
        status: "assigned",
      });
    });

    it("successfully unassigns a receipt book when volunteerId is null", async () => {
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          receipt_book_id: "book-1",
          assigned_volunteer_id: null,
          status: "available",
        },
        error: null,
      } as any);

      const result = await (await import("./receipt-book-admin.service")).assignReceiptBook(
        "book-1",
        null
      );

      expect(supabase.rpc).toHaveBeenCalledWith("assign_receipt_book", {
        p_receipt_book_id: "book-1",
        p_volunteer_id: null,
      });
      expect(result).toEqual({
        success: true,
        receiptBookId: "book-1",
        assignedVolunteerId: null,
        status: "available",
      });
    });

    it("throws error when assign RPC fails", async () => {
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: null,
        error: { message: "Volunteer does not belong to this organization" },
      } as any);

      await expect(
        (await import("./receipt-book-admin.service")).assignReceiptBook("book-1", "vol-bad")
      ).rejects.toThrow("Volunteer does not belong to this organization");
    });
  });
});

