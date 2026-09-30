// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useReceiptHistory } from "./use-receipt-history";

const { mockGetLocalReceipts, mockGetLocalReceiptsForSession, mockSyncNextReceipt } = vi.hoisted(() => ({
  mockGetLocalReceipts: vi.fn(),
  mockGetLocalReceiptsForSession: vi.fn(),
  mockSyncNextReceipt: vi.fn(),
}));

vi.mock("@/lib/offline/offline-db", () => ({
  getLocalReceipts: mockGetLocalReceipts,
  getLocalReceiptsForSession: mockGetLocalReceiptsForSession,
}));

vi.mock("@/lib/offline/receipt-sync", () => ({
  syncNextReceipt: mockSyncNextReceipt,
}));

describe("useReceiptHistory hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocalReceipts.mockResolvedValue([]);
    mockGetLocalReceiptsForSession.mockResolvedValue([]);
  });

  it("calls getLocalReceiptsForSession when collectionSessionId is provided", async () => {
    const mockSessionReceipts = [
      { clientReceiptId: "r-1", receiptNumber: 121, amount: 900, status: "issued" },
      { clientReceiptId: "r-2", receiptNumber: 122, amount: 900, status: "issued" },
    ];
    mockGetLocalReceiptsForSession.mockResolvedValueOnce(mockSessionReceipts);

    const { result } = renderHook(() =>
      useReceiptHistory({
        receiptBookId: "book-1",
        collectionSessionId: "session-B",
      })
    );

    await act(async () => {
      await result.current.loadReceiptHistory();
    });

    expect(mockGetLocalReceiptsForSession).toHaveBeenCalledWith("session-B");
    expect(mockGetLocalReceipts).not.toHaveBeenCalled();
    expect(result.current.receipts).toEqual(mockSessionReceipts);
  });

  it("calls getLocalReceipts when only receiptBookId is provided (book-level history)", async () => {
    const mockBookReceipts = [
      { clientReceiptId: "r-1", receiptNumber: 101, amount: 500, status: "issued" },
      { clientReceiptId: "r-2", receiptNumber: 102, amount: 500, status: "issued" },
      { clientReceiptId: "r-3", receiptNumber: 121, amount: 900, status: "issued" },
    ];
    mockGetLocalReceipts.mockResolvedValueOnce(mockBookReceipts);

    const { result } = renderHook(() =>
      useReceiptHistory({
        receiptBookId: "book-bk02",
      })
    );

    await act(async () => {
      await result.current.loadReceiptHistory();
    });

    expect(mockGetLocalReceipts).toHaveBeenCalledWith("book-bk02");
    expect(mockGetLocalReceiptsForSession).not.toHaveBeenCalled();
    expect(result.current.receipts).toHaveLength(3);
  });

  it("supports explicit argument overrides in loadReceiptHistory", async () => {
    const { result } = renderHook(() =>
      useReceiptHistory({
        receiptBookId: "default-book",
        collectionSessionId: "default-session",
      })
    );

    // Explicit session override
    await act(async () => {
      await result.current.loadReceiptHistory(undefined, "override-session");
    });
    expect(mockGetLocalReceiptsForSession).toHaveBeenCalledWith("override-session");

    // Explicit book override when no session in hook
    const { result: bookHook } = renderHook(() =>
      useReceiptHistory({
        receiptBookId: "default-book",
      })
    );

    await act(async () => {
      await bookHook.current.loadReceiptHistory("override-book");
    });
    expect(mockGetLocalReceipts).toHaveBeenCalledWith("override-book");
  });
});
