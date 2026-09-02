// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReceiptSearch } from "./use-receipt-search";
import * as receiptSearchService from "../services/receipt-search.service";

describe("useReceiptSearch Hook (Step 4C)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1. initial mount does NOT issue any search requests", () => {
    const searchSpy = vi.spyOn(receiptSearchService, "searchOrganizationReceipts");

    const { result } = renderHook(() =>
      useReceiptSearch({ eventId: "event-1" })
    );

    expect(result.current.hasSearched).toBe(false);
    expect(result.current.receipts).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("2. debounces query and triggers search after 350ms", async () => {
    const searchSpy = vi.spyOn(receiptSearchService, "searchOrganizationReceipts").mockResolvedValue({
      success: true,
      event_id: "event-1",
      organization_id: "org-1",
      is_admin: true,
      total_count: 1,
      limit: 25,
      offset: 0,
      has_more: false,
      receipts: [
        {
          id: "rec-1",
          receipt_number: 101,
          receipt_prefix: "VP-",
          book_number: "BK-1",
          amount: 500,
          payment_mode: "cash",
          payment_reference: null,
          donor_name: "Rahul",
          donor_mobile: "9820011111",
          property_id: null,
          property_type: null,
          unit_number: null,
          building_name: null,
          building_wing: null,
          volunteer_id: "vol-1",
          volunteer_name: "Vinod",
          collection_session_id: "sess-1",
          status: "issued",
          void_reason: null,
          voided_at: null,
          voided_by_name: null,
          notes: null,
          created_at: "2026-08-30T10:00:00Z",
        },
      ],
    });

    const { result } = renderHook(() =>
      useReceiptSearch({ eventId: "event-1" })
    );

    act(() => {
      result.current.setQuery("Rahul");
    });

    // Before timer fires
    expect(searchSpy).not.toHaveBeenCalled();

    // Fast forward debounce timer
    await act(async () => {
      vi.advanceTimersByTime(360);
    });

    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-1",
        query: "Rahul",
      })
    );
    expect(result.current.receipts.length).toBe(1);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.hasSearched).toBe(true);
  });

  it("3. changing filters resets offset to 0 and replaces existing results", async () => {
    const searchSpy = vi.spyOn(receiptSearchService, "searchOrganizationReceipts")
      .mockResolvedValueOnce({
        success: true,
        event_id: "event-1",
        organization_id: "org-1",
        is_admin: true,
        total_count: 5,
        limit: 25,
        offset: 0,
        has_more: false,
        receipts: [
          {
            id: "rec-1",
            receipt_number: 101,
            receipt_prefix: "VP-",
            book_number: "BK-1",
            amount: 500,
            payment_mode: "cash",
            payment_reference: null,
            donor_name: "Cash Donor",
            donor_mobile: null,
            property_id: null,
            property_type: null,
            unit_number: null,
            building_name: null,
            building_wing: null,
            volunteer_id: "vol-1",
            volunteer_name: "Vinod",
            collection_session_id: "sess-1",
            status: "issued",
            void_reason: null,
            voided_at: null,
            voided_by_name: null,
            notes: null,
            created_at: "2026-08-30T10:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        event_id: "event-1",
        organization_id: "org-1",
        is_admin: true,
        total_count: 2,
        limit: 25,
        offset: 0,
        has_more: false,
        receipts: [
          {
            id: "rec-2",
            receipt_number: 102,
            receipt_prefix: "VP-",
            book_number: "BK-1",
            amount: 1000,
            payment_mode: "upi",
            payment_reference: "UPI-9999",
            donor_name: "UPI Donor",
            donor_mobile: null,
            property_id: null,
            property_type: null,
            unit_number: null,
            building_name: null,
            building_wing: null,
            volunteer_id: "vol-1",
            volunteer_name: "Vinod",
            collection_session_id: "sess-1",
            status: "issued",
            void_reason: null,
            voided_at: null,
            voided_by_name: null,
            notes: null,
            created_at: "2026-08-30T10:05:00Z",
          },
        ],
      });

    const { result } = renderHook(() =>
      useReceiptSearch({ eventId: "event-1" })
    );

    // Initial search
    act(() => {
      result.current.setPaymentMode("cash");
    });
    await act(async () => {
      vi.advanceTimersByTime(360);
    });

    expect(result.current.receipts[0].donor_name).toBe("Cash Donor");

    // Change filter to UPI
    act(() => {
      result.current.setPaymentMode("upi");
    });
    await act(async () => {
      vi.advanceTimersByTime(360);
    });

    expect(result.current.receipts.length).toBe(1);
    expect(result.current.receipts[0].donor_name).toBe("UPI Donor");
    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
        paymentMode: "upi",
      })
    );
  });

  it("4. STALE REQUEST GUARD: out-of-order response from older request is discarded", async () => {
    let resolveRequestA!: (val: receiptSearchService.SearchReceiptsResult) => void;
    let resolveRequestB!: (val: receiptSearchService.SearchReceiptsResult) => void;

    const promiseA = new Promise<receiptSearchService.SearchReceiptsResult>((res) => {
      resolveRequestA = res;
    });
    const promiseB = new Promise<receiptSearchService.SearchReceiptsResult>((res) => {
      resolveRequestB = res;
    });

    const searchSpy = vi.spyOn(receiptSearchService, "searchOrganizationReceipts")
      .mockImplementationOnce(() => promiseA)
      .mockImplementationOnce(() => promiseB);

    const { result } = renderHook(() =>
      useReceiptSearch({ eventId: "event-1" })
    );

    // Trigger Request A (query = "A")
    act(() => {
      result.current.setQuery("A");
    });
    await act(async () => {
      vi.advanceTimersByTime(360);
    });

    // Trigger Request B (query = "AB") before A resolves
    act(() => {
      result.current.setQuery("AB");
    });
    await act(async () => {
      vi.advanceTimersByTime(360);
    });

    expect(searchSpy).toHaveBeenCalledTimes(2);

    // Now resolve Request B FIRST with newer results
    await act(async () => {
      resolveRequestB({
        success: true,
        event_id: "event-1",
        organization_id: "org-1",
        is_admin: true,
        total_count: 1,
        limit: 25,
        offset: 0,
        has_more: false,
        receipts: [
          {
            id: "rec-B",
            receipt_number: 200,
            receipt_prefix: "VP-",
            book_number: "BK-1",
            amount: 2000,
            payment_mode: "cash",
            payment_reference: null,
            donor_name: "Donor B (Newer)",
            donor_mobile: null,
            property_id: null,
            property_type: null,
            unit_number: null,
            building_name: null,
            building_wing: null,
            volunteer_id: "vol-1",
            volunteer_name: "Vinod",
            collection_session_id: "sess-1",
            status: "issued",
            void_reason: null,
            voided_at: null,
            voided_by_name: null,
            notes: null,
            created_at: "2026-08-30T10:00:00Z",
          },
        ],
      });
    });

    expect(result.current.receipts[0].donor_name).toBe("Donor B (Newer)");

    // Now resolve Request A LATER with stale results
    await act(async () => {
      resolveRequestA({
        success: true,
        event_id: "event-1",
        organization_id: "org-1",
        is_admin: true,
        total_count: 99,
        limit: 25,
        offset: 0,
        has_more: false,
        receipts: [
          {
            id: "rec-A",
            receipt_number: 100,
            receipt_prefix: "VP-",
            book_number: "BK-1",
            amount: 100,
            payment_mode: "cash",
            payment_reference: null,
            donor_name: "Donor A (Stale)",
            donor_mobile: null,
            property_id: null,
            property_type: null,
            unit_number: null,
            building_name: null,
            building_wing: null,
            volunteer_id: "vol-1",
            volunteer_name: "Vinod",
            collection_session_id: "sess-1",
            status: "issued",
            void_reason: null,
            voided_at: null,
            voided_by_name: null,
            notes: null,
            created_at: "2026-08-30T09:00:00Z",
          },
        ],
      });
    });

    // Stale result A was DISCARDED, newer result B remains intact!
    expect(result.current.receipts.length).toBe(1);
    expect(result.current.receipts[0].donor_name).toBe("Donor B (Newer)");
    expect(result.current.totalCount).toBe(1);
  });
});
