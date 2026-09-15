// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ReceiptSearchPanel } from "./receipt-search-panel";
import * as receiptSearchService from "../services/receipt-search.service";
import * as analyticsService from "../services/analytics.service";
import * as whatsappShare from "../utils/whatsapp-share";

describe("ReceiptSearchPanel (Phase 2J - Direction C)", () => {
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
      created_at: new Date().toISOString(),
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
    {
      id: "rec-3",
      receipt_number: 1043,
      receipt_prefix: "VPA-",
      book_number: "BK-01",
      amount: 550,
      payment_mode: "cash",
      payment_reference: null,
      donor_name: "राहुल शिंदे",
      donor_mobile: "9820012345", // Same mobile -> Verified Phone Match
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
      notes: "Additional contribution",
      created_at: new Date().toISOString(),
    },
    {
      id: "rec-4",
      receipt_number: 1044,
      receipt_prefix: "VPA-",
      book_number: "BK-02",
      amount: 1000,
      payment_mode: "upi",
      payment_reference: "UPI-9999",
      donor_name: "राहुल शिंदे", // Same name, DIFFERENT mobile -> Possible Name Match
      donor_mobile: "9899988888",
      property_id: "prop-2",
      property_type: "residential",
      unit_number: "101",
      building_name: "शांती निकेतन",
      building_wing: "B",
      volunteer_id: "vol-2",
      volunteer_name: "Volunteer Varun",
      collection_session_id: "sess-2",
      status: "issued",
      void_reason: null,
      voided_at: null,
      voided_by_name: null,
      notes: "Different mobile donor",
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("1. renders search header, date filter chips, input, and filters in initial clean state", () => {
    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={vi.fn()}
      />
    );

    expect(screen.getByText(/पावती शोध व इतिहास \(Receipt Search & History\)/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/देणगीदार नाव, मोबाईल, पावती क्र\./)).toBeTruthy();
    expect(screen.getByText(/सर्व पावत्या \(All\)/)).toBeTruthy();
    expect(screen.getByText(/आज \(Today\)/)).toBeTruthy();
    expect(screen.getByText(/काल \(Yesterday\)/)).toBeTruthy();
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

  it("3. fetches results upon typing in search box and renders list and inspector split view", async () => {
    const searchSpy = vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 4,
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

    // Results rendered in list
    expect(screen.getAllByText("VPA-1042").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/राहुल शिंदे/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹501\.00/).length).toBeGreaterThan(0);
  });

  it("4. selecting a receipt renders the Inspector with all 3 tabs and metadata", async () => {
    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 4,
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
      expect(screen.getAllByText("VPA-1042").length).toBeGreaterThan(0);
    });

    // Click first receipt card to open inspector
    const receiptCards = screen.getAllByText("VPA-1042");
    fireEvent.click(receiptCards[0]);

    // Segmented tabs should be visible
    expect(screen.getAllByRole("button", { name: /पावती तपशील \(Receipt\)/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /देणगीदार इतिहास \(Donor\)/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /इमारत व फ्लॅट \(Property\)/i }).length).toBeGreaterThan(0);

    // Quick action buttons should be visible
    expect(screen.getAllByRole("button", { name: /WhatsApp/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /JPG पावती/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /प्रिंट \(Print\)/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /रद्द करा \(Void\)/i }).length).toBeGreaterThan(0);
  });

  it("5. DONOR IDENTITY SAFETY: Verified Phone Match vs Possible Name Matches disambiguation", async () => {
    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 4,
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
      expect(screen.getAllByText("VPA-1042").length).toBeGreaterThan(0);
    });

    // Select rec-1 (Rahul with mobile 9820012345)
    fireEvent.click(screen.getAllByText("VPA-1042")[0]);

    // Switch to Donor Tab
    const donorTabBtn = screen.getAllByRole("button", { name: /देणगीदार इतिहास \(Donor\)/i })[0];
    fireEvent.click(donorTabBtn);

    // Section A: Verified Phone Match (rec-1 & rec-3 with mobile 9820012345)
    expect(screen.getAllByText(/प्रमाणित फोन जुळणी \(Verified Phone Match\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/एकूण 2 पावत्या या मोबाईलवर/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹1051\.00/).length).toBeGreaterThan(0); // 501 + 550

    // Section B: Possible Name Matches (rec-4 with different mobile 9899988888)
    expect(screen.getAllByText(/संभाव्य नाव जुळणी \(Possible Name Matches — Unlinked\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/सुरक्षा सूचना:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/VPA-1044/).length).toBeGreaterThan(0);

    // NO forbidden labels should appear
    expect(screen.queryByText(/Loyal Donor/i)).toBeNull();
    expect(screen.queryByText(/Lifetime Giving/i)).toBeNull();
    expect(screen.queryByText(/VIP Donor/i)).toBeNull();
  });

  it("6. PROPERTY CONTEXT: Shows building summary and View Building Grid trigger", async () => {
    const onNavigateMock = vi.fn();
    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 4,
      limit: 25,
      offset: 0,
      has_more: false,
      receipts: mockReceipts,
    });

    render(
      <ReceiptSearchPanel
        eventId="event-1"
        onViewReceipt={vi.fn()}
        onNavigateToBuilding={onNavigateMock}
      />
    );

    const searchBtn = screen.getByRole("button", { name: /शोधा \(Search\)/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getAllByText("VPA-1042").length).toBeGreaterThan(0);
    });

    // Select rec-1 (Flat 402, Gokul Dham)
    fireEvent.click(screen.getAllByText("VPA-1042")[0]);

    // Switch to Property Tab
    const propertyTabBtn = screen.getAllByRole("button", { name: /इमारत व फ्लॅट \(Property\)/i })[0];
    fireEvent.click(propertyTabBtn);

    expect(screen.getAllByText(/गोकुळ धाम/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/फ्लॅट क्र\. 402/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /इमारतीचे ग्रिड पहा \(View Building Grid →\)/i }).length).toBeGreaterThan(0);

    // Click View Building Grid
    fireEvent.click(screen.getAllByRole("button", { name: /इमारतीचे ग्रिड पहा \(View Building Grid →\)/i })[0]);
    expect(onNavigateMock).toHaveBeenCalledTimes(1);
    expect(onNavigateMock).toHaveBeenCalledWith("prop-1", "prop-1");
  });

  it("7. VOID RECEIPT FLOW: opening void dialog and confirming voids receipt", async () => {
    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 4,
      limit: 25,
      offset: 0,
      has_more: false,
      receipts: mockReceipts,
    });

    const voidSpy = vi.spyOn(analyticsService, "voidReceipt").mockResolvedValue({
      success: true,
      receipt_id: "rec-1",
      receipt_number: 1042,
      amount: 501,
      payment_mode: "cash",
      status: "voided",
      void_reason: "Mistyped flat number",
      voided_at: "2026-09-01T12:00:00Z",
      voided_by: "Admin Akshay",
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
      expect(screen.getAllByText("VPA-1042").length).toBeGreaterThan(0);
    });

    // Select rec-1
    fireEvent.click(screen.getAllByText("VPA-1042")[0]);

    // Click Void Button in Inspector
    const voidBtn = screen.getAllByRole("button", { name: /रद्द करा \(Void\)/i })[0];
    fireEvent.click(voidBtn);

    // Dialog opens
    expect(screen.getByText(/ही पावती रद्द करायची आहे\? \(Void Receipt\)/i)).toBeTruthy();

    const reasonInput = screen.getByPlaceholderText(/उदा\. चुकीची रक्कम नोंदवली गेली/i);
    fireEvent.change(reasonInput, { target: { value: "Mistyped flat number" } });

    const confirmVoidBtn = screen.getByRole("button", { name: /✕ पावती रद्द करा \(Confirm Void\)/i });
    fireEvent.click(confirmVoidBtn);

    await waitFor(() => {
      expect(voidSpy).toHaveBeenCalledWith("rec-1", "Mistyped flat number");
    });
  });

  it("8. WHATSAPP SHARE: triggers sharing for eligible active receipts", async () => {
    const openSpy = vi.spyOn(whatsappShare, "openWhatsAppShare").mockReturnValue(true);

    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 4,
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
      expect(screen.getAllByText("VPA-1042").length).toBeGreaterThan(0);
    });

    // Select rec-1
    fireEvent.click(screen.getAllByText("VPA-1042")[0]);

    const waBtn = screen.getAllByRole("button", { name: /WhatsApp/i })[0];
    fireEvent.click(waBtn);

    expect(openSpy).toHaveBeenCalled();
  });

  it("9. shows empty state when search returns 0 results", async () => {
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

  it("10. shows error banner with retry button on RPC failure", async () => {
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

  it("11. ROLE ISOLATION: Volunteer dropdown is only shown when volunteers prop is passed (Admin)", () => {
    // Non-admin / volunteer
    const { unmount } = render(
      <ReceiptSearchPanel
        eventId="event-1"
        volunteers={[]}
        onViewReceipt={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Filter by volunteer")).toBeNull();
    unmount();

    // Admin with volunteer options
    render(
      <ReceiptSearchPanel
        eventId="event-1"
        volunteers={[
          { id: "vol-1", name: "Vinod (Volunteer)" },
          { id: "vol-2", name: "Varun (Volunteer)" },
        ]}
        onViewReceipt={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Filter by volunteer")).toBeTruthy();
    expect(screen.getByText("Vinod (Volunteer)")).toBeTruthy();
  });

  it("12. ADVERSARIAL QA: Rajesh Patil with +91 9876543210 and Rajesh Patil with +91 9820011111 are kept unlinked", async () => {
    const rajeshPatilDataset: receiptSearchService.SearchReceiptItem[] = [
      {
        id: "rajesh-1",
        receipt_number: 101,
        receipt_prefix: "VP-",
        book_number: "BK-01",
        amount: 500,
        payment_mode: "cash",
        payment_reference: null,
        donor_name: "Rajesh Patil",
        donor_mobile: "9876543210",
        property_id: "prop-402",
        property_type: "residential",
        unit_number: "402",
        building_name: "Gokul Dham",
        building_wing: "A",
        volunteer_id: "vol-1",
        volunteer_name: "Volunteer Vinod",
        collection_session_id: "sess-1",
        status: "issued",
        void_reason: null,
        voided_at: null,
        voided_by_name: null,
        notes: "Ganesh Festival donation",
        created_at: new Date().toISOString(),
      },
      {
        id: "rajesh-2",
        receipt_number: 102,
        receipt_prefix: "VP-",
        book_number: "BK-01",
        amount: 1000,
        payment_mode: "upi",
        payment_reference: "UPI-TXN-9999",
        donor_name: "Rajesh Patil",
        donor_mobile: "9876543210", // Strong match (same mobile)
        property_id: "prop-402",
        property_type: "residential",
        unit_number: "402",
        building_name: "Gokul Dham",
        building_wing: "A",
        volunteer_id: "vol-1",
        volunteer_name: "Volunteer Vinod",
        collection_session_id: "sess-1",
        status: "issued",
        void_reason: null,
        voided_at: null,
        voided_by_name: null,
        notes: "Pooja contribution",
        created_at: new Date().toISOString(),
      },
      {
        id: "rajesh-3",
        receipt_number: 103,
        receipt_prefix: "VP-",
        book_number: "BK-02",
        amount: 2500,
        payment_mode: "bank_transfer",
        payment_reference: "IMPS-1111",
        donor_name: "Rajesh Patil",
        donor_mobile: "9820011111", // DIFFERENT mobile -> Unlinked possible match!
        property_id: "prop-101",
        property_type: "residential",
        unit_number: "101",
        building_name: "Shanti Niketan",
        building_wing: "B",
        volunteer_id: "vol-2",
        volunteer_name: "Volunteer Varun",
        collection_session_id: "sess-2",
        status: "issued",
        void_reason: null,
        voided_at: null,
        voided_by_name: null,
        notes: "Other Rajesh donation",
        created_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 3,
      limit: 25,
      offset: 0,
      has_more: false,
      receipts: rajeshPatilDataset,
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
      expect(screen.getAllByText("VP-101").length).toBeGreaterThan(0);
    });

    // Select Rajesh #1
    fireEvent.click(screen.getAllByText("VP-101")[0]);

    // Open Donor Tab
    const donorTab = screen.getAllByRole("button", { name: /देणगीदार इतिहास \(Donor\)/i })[0];
    fireEvent.click(donorTab);

    // Verified Phone Match shows 2 receipts (₹1,500.00)
    expect(screen.getAllByText(/प्रमाणित फोन जुळणी \(Verified Phone Match\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/एकूण 2 पावत्या या मोबाईलवर/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹1500\.00/).length).toBeGreaterThan(0);

    // Possible Name Matches shows Rajesh with 9820011111 as unlinked
    expect(screen.getAllByText(/संभाव्य नाव जुळणी \(Possible Name Matches — Unlinked\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/VP-103/).length).toBeGreaterThan(0);

    // Safety checks: Combined ₹4,000 does NOT appear
    expect(screen.queryByText(/₹4000\.00/)).toBeNull();
    expect(screen.queryByText(/Loyal Donor/i)).toBeNull();
    expect(screen.queryByText(/Lifetime Giving/i)).toBeNull();
  });
});

