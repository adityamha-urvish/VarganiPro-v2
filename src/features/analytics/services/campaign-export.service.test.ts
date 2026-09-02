// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sanitizeCsvCell,
  getAuthoritativeRowKey,
  fetchCompleteCampaignExport,
  buildDonationsCsv,
  buildDailySummaryCsv,
  buildPenetrationCsv,
  type DonationExportRow,
  type DailySummaryExportRow,
  type PenetrationExportRow,
} from "./campaign-export.service";
import { supabase } from "@/supabase/client";

describe("Campaign Export Service (campaign-export.service.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. CSV Sanitization & Formula Injection Defense (CWE-1236)
  // ---------------------------------------------------------------------------
  describe("CSV Sanitization & Formula Injection", () => {
    it("1. preserves Marathi Devanagari text cleanly", () => {
      expect(sanitizeCsvCell("श्री गणेश मित्र मंडळ")).toBe('"श्री गणेश मित्र मंडळ"');
      expect(sanitizeCsvCell("राहुल शिंदे")).toBe('"राहुल शिंदे"');
    });

    it("2. escapes embedded quotes and handles commas", () => {
      expect(sanitizeCsvCell('Flat "A", Gokuldham')).toBe('"Flat ""A"", Gokuldham"');
    });

    it("3. handles multiline text with line breaks", () => {
      expect(sanitizeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });

    it("4. handles null and undefined safely", () => {
      expect(sanitizeCsvCell(null)).toBe('""');
      expect(sanitizeCsvCell(undefined)).toBe('""');
      expect(sanitizeCsvCell("")).toBe('""');
    });

    it("5. neutralizes formula injection starting with = ", () => {
      expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe("\"'=SUM(A1:A10)\"");
      expect(sanitizeCsvCell("=cmd|' /C calc'!A0")).toBe("\"'=cmd|' /C calc'!A0\"");
    });

    it("6. neutralizes formula injection starting with +", () => {
      expect(sanitizeCsvCell("+123456")).toBe("\"'+123456\"");
      expect(sanitizeCsvCell("+919820012345")).toBe("\"'+919820012345\"");
    });

    it("7. neutralizes formula injection starting with -", () => {
      expect(sanitizeCsvCell("-500")).toBe("\"'-500\"");
    });

    it("8. neutralizes formula injection starting with @", () => {
      expect(sanitizeCsvCell("@SUM(1,2)")).toBe("\"'@SUM(1,2)\"");
    });

    it("9. neutralizes leading tab and carriage return", () => {
      expect(sanitizeCsvCell("\tMaliciousTab")).toBe("\"'\tMaliciousTab\"");
      expect(sanitizeCsvCell("\rMaliciousCR")).toBe("\"'\rMaliciousCR\"");
    });

    it("10. quotes standard 10-digit mobile numbers as text literals", () => {
      expect(sanitizeCsvCell("9820012345")).toBe('"9820012345"');
      expect(sanitizeCsvCell("09820012345")).toBe('"09820012345"');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Authoritative Primary Key Derivation
  // ---------------------------------------------------------------------------
  describe("Authoritative Primary Keys", () => {
    it("11. derives primary key correctly for each export type", () => {
      const donRow: DonationExportRow = {
        receipt_code: "VPA-101",
        receipt_number: 101,
        book_number: "B1",
        amount: 500,
        payment_mode: "cash",
        payment_reference: "",
        donor_name: "Test",
        donor_mobile: "",
        property_type: "",
        unit_number: "",
        building_name: "",
        building_wing: "",
        volunteer_name: "",
        status: "VALID",
        void_reason: "",
        voided_at: null,
        voided_by_name: "",
        notes: "",
        created_at: "2026-08-30T10:00:00Z",
      };
      expect(getAuthoritativeRowKey("donations", donRow)).toBe("VPA-101");

      const dailyRow: DailySummaryExportRow = {
        collection_date: "2026-08-30",
        receipt_count: 5,
        total_collected: 2500,
        cash_collected: 2000,
        cheque_collected: 0,
        upi_collected: 500,
        bank_transfer_collected: 0,
        voided_receipt_count: 0,
        voided_amount: 0,
      };
      expect(getAuthoritativeRowKey("daily_summary", dailyRow)).toBe("2026-08-30");

      const penRow: PenetrationExportRow = {
        building_name: "गोकुळ धाम",
        wing: "A",
        area_name: "Sector 4",
        total_units: 20,
        collected_units: 15,
        pending_units: 3,
        refused_units: 2,
        not_visited_units: 0,
        total_amount_collected: 7500,
      };
      expect(getAuthoritativeRowKey("penetration", penRow)).toBe("गोकुळ धाम::A::Sector 4");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Paginated Batch Assembly & Integrity Checks
  // ---------------------------------------------------------------------------
  describe("Paginated Batch Assembly (fetchCompleteCampaignExport)", () => {
    it("12. successfully fetches single page export", async () => {
      const mockRows = [
        { receipt_code: "VPA-1", receipt_number: 1 },
        { receipt_code: "VPA-2", receipt_number: 2 },
      ];

      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          event_id: "evt-1",
          organization_id: "org-1",
          export_type: "donations",
          total_count: 2,
          limit: 500,
          offset: 0,
          has_more: false,
          data: mockRows,
        },
        error: null,
      } as any);

      const progressCallback = vi.fn();
      const results = await fetchCompleteCampaignExport({
        eventId: "evt-1",
        exportType: "donations",
        onProgress: progressCallback,
      });

      expect(results).toHaveLength(2);
      expect(progressCallback).toHaveBeenCalledWith({
        current: 2,
        total: 2,
        percentage: 100,
      });
    });

    it("13. successfully concatenates multiple pages", async () => {
      const page1 = [{ receipt_code: "VPA-1" }, { receipt_code: "VPA-2" }];
      const page2 = [{ receipt_code: "VPA-3" }];

      vi.spyOn(supabase, "rpc")
        .mockResolvedValueOnce({
          data: {
            success: true,
            event_id: "evt-1",
            export_type: "donations",
            total_count: 3,
            limit: 2,
            offset: 0,
            has_more: true,
            data: page1,
          },
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: {
            success: true,
            event_id: "evt-1",
            export_type: "donations",
            total_count: 3,
            limit: 2,
            offset: 2,
            has_more: false,
            data: page2,
          },
          error: null,
        } as any);

      const results = await fetchCompleteCampaignExport({
        eventId: "evt-1",
        exportType: "donations",
        batchSize: 2,
      });

      expect(results).toHaveLength(3);
    });

    it("14. FAIL-CLOSED: aborts if duplicate primary key is observed across pages", async () => {
      const page1 = [{ receipt_code: "VPA-1" }, { receipt_code: "VPA-2" }];
      // page2 accidentally repeats VPA-2 due to concurrent insert offset shift
      const page2 = [{ receipt_code: "VPA-2" }, { receipt_code: "VPA-3" }];

      vi.spyOn(supabase, "rpc")
        .mockResolvedValueOnce({
          data: {
            success: true,
            total_count: 4,
            limit: 2,
            offset: 0,
            has_more: true,
            data: page1,
          },
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: {
            success: true,
            total_count: 4,
            limit: 2,
            offset: 2,
            has_more: false,
            data: page2,
          },
          error: null,
        } as any);

      await expect(
        fetchCompleteCampaignExport({
          eventId: "evt-1",
          exportType: "donations",
          batchSize: 2,
        })
      ).rejects.toThrow(/Export data changed unexpectedly/);
    });

    it("15. FAIL-CLOSED: aborts if total retrieved count does not equal server total_count", async () => {
      const page1 = [{ receipt_code: "VPA-1" }];

      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          total_count: 5, // Server claims 5 total, but returns only 1 with has_more=false
          limit: 500,
          offset: 0,
          has_more: false,
          data: page1,
        },
        error: null,
      } as any);

      await expect(
        fetchCompleteCampaignExport({
          eventId: "evt-1",
          exportType: "donations",
        })
      ).rejects.toThrow(/Export count mismatch/);
    });

    it("16. aborts immediately on user cancellation via AbortSignal", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        fetchCompleteCampaignExport({
          eventId: "evt-1",
          exportType: "donations",
          signal: controller.signal,
        })
      ).rejects.toThrow(/Export cancelled by user/);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. CSV File Generation & Formatting
  // ---------------------------------------------------------------------------
  describe("CSV Generation", () => {
    it("17. buildDonationsCsv generates UTF-8 BOM, metadata, and data rows", () => {
      const mockRecords: DonationExportRow[] = [
        {
          receipt_code: "VPA-1001",
          receipt_number: 1001,
          book_number: "BK-01",
          amount: 501,
          payment_mode: "cash",
          payment_reference: "",
          donor_name: "राहुल शिंदे",
          donor_mobile: "9820012345",
          property_type: "residential",
          unit_number: "402",
          building_name: "गोकुळ धाम",
          building_wing: "A",
          volunteer_name: "Volunteer Vinod",
          status: "VALID",
          void_reason: "",
          voided_at: null,
          voided_by_name: "",
          notes: "Building collection",
          created_at: "2026-08-30T10:00:00Z",
        },
      ];

      const csv = buildDonationsCsv(mockRecords, { eventName: "Ganesh Utsav 2026" });

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("# VarganiPro Campaign Export - संपूर्ण देणगीदार यादी");
      expect(csv).toContain("# Event: Ganesh Utsav 2026");
      expect(csv).toContain('"VPA-1001"');
      expect(csv).toContain('"राहुल शिंदे"');
      expect(csv).toContain('"9820012345"');
      expect(csv).toContain('"501.00"');
    });

    it("18. buildDailySummaryCsv generates UTF-8 BOM and daily aggregates", () => {
      const mockRecords: DailySummaryExportRow[] = [
        {
          collection_date: "2026-08-30",
          receipt_count: 10,
          total_collected: 5000,
          cash_collected: 4000,
          cheque_collected: 0,
          upi_collected: 1000,
          bank_transfer_collected: 0,
          voided_receipt_count: 1,
          voided_amount: 500,
        },
      ];

      const csv = buildDailySummaryCsv(mockRecords, { eventName: "Ganesh Utsav 2026" });

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("# VarganiPro Campaign Export - दैनंदिन संकलन व तिजोरी अहवाल");
      expect(csv).toContain('"2026-08-30"');
      expect(csv).toContain('"5000.00"');
      expect(csv).toContain('"4000.00"');
      expect(csv).toContain('"1000.00"');
    });

    it("19. buildPenetrationCsv generates UTF-8 BOM and building penetration data", () => {
      const mockRecords: PenetrationExportRow[] = [
        {
          building_name: "गोकुळ धाम",
          wing: "A",
          area_name: "Sector 4",
          total_units: 20,
          collected_units: 18,
          pending_units: 2,
          refused_units: 0,
          not_visited_units: 0,
          total_amount_collected: 9000,
        },
      ];

      const csv = buildPenetrationCsv(mockRecords, { eventName: "Ganesh Utsav 2026" });

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("# VarganiPro Campaign Export - इमारत व परिसर प्रगती अहवाल");
      expect(csv).toContain('"गोकुळ धाम"');
      expect(csv).toContain('"9000.00"');
      expect(csv).toContain('"18"');
    });
  });
});
