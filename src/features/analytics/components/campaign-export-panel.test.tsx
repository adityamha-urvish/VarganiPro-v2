// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { CampaignExportPanel } from "./campaign-export-panel";
import * as exportService from "../services/campaign-export.service";

describe("CampaignExportPanel (Step 4D)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("1. renders header and all three export report cards", () => {
    render(
      <CampaignExportPanel
        eventId="event-1"
        eventName="Ganesh Utsav 2026"
      />
    );

    expect(screen.getByText(/अहवाल आणि डेटा निर्यात \(Reports & Data Export\)/)).toBeTruthy();
    expect(screen.getByText("संपूर्ण देणगीदार यादी")).toBeTruthy();
    expect(screen.getByText("दैनंदिन संकलन अहवाल")).toBeTruthy();
    expect(screen.getByText("इमारत प्रगती अहवाल")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Donations/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Daily Summary/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Penetration/i })).toBeTruthy();
  });

  it("2. handles successful donations export and triggers download", async () => {
    const mockDonations: exportService.DonationExportRow[] = [
      {
        receipt_code: "VPA-1001",
        receipt_number: 1001,
        book_number: "BK-1",
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
        notes: "",
        created_at: "2026-08-30T10:00:00Z",
      },
    ];

    const fetchSpy = vi.spyOn(exportService, "fetchCompleteCampaignExport").mockResolvedValue(mockDonations);
    const downloadSpy = vi.spyOn(exportService, "downloadCsvBlob").mockImplementation(() => {});

    render(
      <CampaignExportPanel
        eventId="event-1"
        eventName="Ganesh Utsav 2026"
      />
    );

    const donBtn = screen.getByRole("button", { name: /Donations/i });
    fireEvent.click(donBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "event-1",
          exportType: "donations",
        })
      );
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.stringContaining("VarganiPro_Donations_"),
        expect.stringContaining("VPA-1001")
      );
      expect(screen.getByText(/संपूर्ण देणगीदार यादी \(1 नोंदी\) यशस्वीरित्या डाउनलोड झाली/)).toBeTruthy();
    });
  });

  it("3. handles successful daily summary export", async () => {
    const mockDaily: exportService.DailySummaryExportRow[] = [
      {
        collection_date: "2026-08-30",
        receipt_count: 5,
        total_collected: 2500,
        cash_collected: 2000,
        cheque_collected: 0,
        upi_collected: 500,
        bank_transfer_collected: 0,
        voided_receipt_count: 0,
        voided_amount: 0,
      },
    ];

    vi.spyOn(exportService, "fetchCompleteCampaignExport").mockResolvedValue(mockDaily);
    const downloadSpy = vi.spyOn(exportService, "downloadCsvBlob").mockImplementation(() => {});

    render(
      <CampaignExportPanel
        eventId="event-1"
        eventName="Ganesh Utsav 2026"
      />
    );

    const dailyBtn = screen.getByRole("button", { name: /Daily Summary/i });
    fireEvent.click(dailyBtn);

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.stringContaining("VarganiPro_DailySummary_"),
        expect.stringContaining("2026-08-30")
      );
      expect(screen.getByText(/दैनंदिन संकलन अहवाल \(1 दिवस\) यशस्वीरित्या डाउनलोड झाला/)).toBeTruthy();
    });
  });

  it("4. handles successful building penetration export", async () => {
    const mockPen: exportService.PenetrationExportRow[] = [
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

    vi.spyOn(exportService, "fetchCompleteCampaignExport").mockResolvedValue(mockPen);
    const downloadSpy = vi.spyOn(exportService, "downloadCsvBlob").mockImplementation(() => {});

    render(
      <CampaignExportPanel
        eventId="event-1"
        eventName="Ganesh Utsav 2026"
      />
    );

    const penBtn = screen.getByRole("button", { name: /Penetration/i });
    fireEvent.click(penBtn);

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.stringContaining("VarganiPro_Penetration_"),
        expect.stringContaining("गोकुळ धाम")
      );
      expect(screen.getByText(/इमारत प्रगती अहवाल \(1 इमारती\) यशस्वीरित्या डाउनलोड झाला/)).toBeTruthy();
    });
  });

  it("5. displays error notification when no records are found", async () => {
    vi.spyOn(exportService, "fetchCompleteCampaignExport").mockResolvedValue([]);

    render(
      <CampaignExportPanel
        eventId="event-1"
        eventName="Ganesh Utsav 2026"
      />
    );

    const donBtn = screen.getByRole("button", { name: /Donations/i });
    fireEvent.click(donBtn);

    await waitFor(() => {
      expect(screen.getByText(/या अहवालासाठी कोणतीही नोंद उपलब्ध नाही/)).toBeTruthy();
    });
  });

  it("6. displays error notification on RPC failure", async () => {
    vi.spyOn(exportService, "fetchCompleteCampaignExport").mockRejectedValue(
      new Error("Export count mismatch: expected 5, retrieved 3")
    );

    render(
      <CampaignExportPanel
        eventId="event-1"
        eventName="Ganesh Utsav 2026"
      />
    );

    const donBtn = screen.getByRole("button", { name: /Donations/i });
    fireEvent.click(donBtn);

    await waitFor(() => {
      expect(screen.getByText(/Export count mismatch/)).toBeTruthy();
    });
  });
});
