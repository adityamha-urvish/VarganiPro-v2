// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ReceiptSearchPanel } from "./receipt-search-panel";
import * as receiptSearchService from "../services/receipt-search.service";

describe("ReceiptSearchPanel (Step 4C)", () => {
  const mockReceipts: receiptSearchService.SearchReceiptItem[] = [
    {
      id: "rec-1",
      receipt_number: 1042,
      receipt_prefix: "VPA-",
      book_number: "BK-01",
      amount: 501,
      payment_mode: "cash",
      payment_reference: null,
      donor_name: "राहुल शिंदे",
      donor_mobile: "9820012345",
      property_id: "prop-1",
      property_type: "residential",
      unit_number: "402",
      building_name: "गोकुळ धाम",
      building_wing: "A",
      volunteer_id: "vol-1",
      volunteer_name: "Volunteer Vinod",
      collection_session_id: "sess-1",
      status: "issued",
      void_reason: null,
      voided_at: null,
      voided_by_name: null,
      notes: "Building collection",
      created_at: "2026-08-30T10:00:00Z",
    },
    {
      id: "rec-2",
      receipt_number: 1041,
      receipt_prefix: "VPA-",
      book_number: "BK-01",
      amount: 1500,
      payment_mode: "upi",
      payment_reference: "UPI-TXN-1234",
      donor_name: "आनंद देशमुख",
      donor_mobile: "9820055555",
      property_id: null,
      property_type: null,
      unit_number: null,
      building_name: null,
      building_wing: null,
      volunteer_id: "vol-2",
      volunteer_name: "Volunteer Varun",
      collection_session_id: "sess-2",
      status: "voided",
      void_reason: "Cheque damaged",
      voided_at: "2026-08-30T11:00:00Z",
      voided_by_name: "Admin Secretary",
      notes: "Voided cheque",
      created_at: "2026-08-30T09:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("1. renders search header, input, and filters in initial clean state", () => {
    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={vi.fn()}
      />
    );

    expect(screen.getByText(/सर्व पावत्या शोधा \(Search All Receipts\)/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/देणगीदार नाव, मोबाईल, पावती क्र\./)).toBeTruthy();
    expect(screen.getByLabelText("Filter by payment mode")).toBeTruthy();
    expect(screen.getByLabelText("Filter by receipt status")).toBeTruthy();
    expect(screen.getByText(/पावती शोधण्यासाठी वरील सर्च बॉक्स वापरा/)).toBeTruthy();
  });

  it("2. does not automatically fetch on mount until search or filter is touched", () => {
    const searchSpy = vi.spyOn(receiptSearchService, "searchOrganizationReceipts");

    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={vi.fn()}
      />
    );

    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("3. fetches results upon typing in search box after debounce", async () => {
    const searchSpy = vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 2,
      limit: 25,
      offset: 0,
      has_more: false,
      receipts: mockReceipts,
    });

    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/देणगीदार नाव, मोबाईल, पावती क्र\./);
    fireEvent.change(input, { target: { value: "राहुल" } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "event-1",
          query: "राहुल",
        })
      );
    });

    // Results rendered
    expect(screen.getByText("VPA-1042")).toBeTruthy();
    expect(screen.getByText(/राहुल शिंदे/)).toBeTruthy();
    expect(screen.getByText(/₹501\.00/)).toBeTruthy();
  });

  it("4. renders voided receipt badge and void metadata clearly", async () => {
    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 2,
      limit: 25,
      offset: 0,
      has_more: false,
      receipts: mockReceipts,
    });

    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={vi.fn()}
      />
    );

    const searchBtn = screen.getByRole("button", { name: /शोधा \(Search\)/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText("VPA-1041")).toBeTruthy();
    });

    // Void badge and reason
    expect(screen.getByText("रद्द (VOIDED)")).toBeTruthy();
    expect(screen.getByText(/Cheque damaged/)).toBeTruthy();
    expect(screen.getByText(/Admin Secretary/)).toBeTruthy();
  });

  it("5. clicking View Receipt invokes onViewReceipt callback with mapped receipt", async () => {
    const onViewReceiptMock = vi.fn();
    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 1,
      limit: 25,
      offset: 0,
      has_more: false,
      receipts: [mockReceipts[0]],
    });

    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={onViewReceiptMock}
      />
    );

    const searchBtn = screen.getByRole("button", { name: /शोधा \(Search\)/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText("VPA-1042")).toBeTruthy();
    });

    const viewBtn = screen.getByRole("button", { name: /पावती पहा \(View\)/i });
    fireEvent.click(viewBtn);

    expect(onViewReceiptMock).toHaveBeenCalledTimes(1);
    expect(onViewReceiptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptNumber: 1042,
        donorName: "राहुल शिंदे",
        amount: 501,
      })
    );
  });

  it("6. shows empty state when search returns 0 results", async () => {
    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 0,
      limit: 25,
      offset: 0,
      has_more: false,
      receipts: [],
    });

    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/देणगीदार नाव, मोबाईल, पावती क्र\./);
    fireEvent.change(input, { target: { value: "NonExistentDonor" } });

    await waitFor(() => {
      expect(screen.getByText(/पावत्या सापडल्या नाहीत \(No receipts found\)/)).toBeTruthy();
    });
  });

  it("7. shows error banner with retry button on RPC failure", async () => {
    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockRejectedValue(
      new Error("Database connection timed out.")
    );

    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={vi.fn()}
      />
    );

    const searchBtn = screen.getByRole("button", { name: /शोधा \(Search\)/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/Database connection timed out\./)).toBeTruthy();
      expect(screen.getByRole("button", { name: /पुन्हा प्रयत्न करा \(Retry\)/i })).toBeTruthy();
    });
  });

  it("8. renders Load More button when has_more is true and appends next page", async () => {
    const searchSpy = vi.spyOn(receiptSearchService, "searchOrganizationReceipts")
      .mockResolvedValueOnce({
        success: true,
        event_id: "event-1",
        organization_id: "org-1",
        is_admin: true,
        total_count: 3,
        limit: 1,
        offset: 0,
        has_more: true,
        receipts: [mockReceipts[0]],
      })
      .mockResolvedValueOnce({
        success: true,
        event_id: "event-1",
        organization_id: "org-1",
        is_admin: true,
        total_count: 3,
        limit: 1,
        offset: 1,
        has_more: false,
        receipts: [mockReceipts[1]],
      });

    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={vi.fn()}
      />
    );

    const searchBtn = screen.getByRole("button", { name: /शोधा \(Search\)/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText("VPA-1042")).toBeTruthy();
      expect(screen.getByRole("button", { name: /आणखी पावत्या पहा \(Load More\)/i })).toBeTruthy();
    });

    const loadMoreBtn = screen.getByRole("button", { name: /आणखी पावत्या पहा \(Load More\)/i });
    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(screen.getByText("VPA-1041")).toBeTruthy();
    });

    expect(searchSpy).toHaveBeenCalledTimes(2);
  });
});
