// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createLocalReceiptMock, syncNextReceiptMock } = vi.hoisted(() => ({
  createLocalReceiptMock: vi.fn(),
  syncNextReceiptMock: vi.fn(),
}));

vi.mock("@/lib/offline/receipt-store", () => ({
  createLocalReceipt: createLocalReceiptMock,
}));

vi.mock("@/lib/offline/receipt-sync", () => ({
  syncNextReceipt: syncNextReceiptMock,
  drainSyncQueue: vi.fn(async () => {}),
  setupAutoSync: vi.fn(() => () => {}),
}));

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import { useReceiptCreation } from "./use-receipt-creation";

const mockSession: CollectionSessionContext = {
  sessionId: "session-1",
  sessionStatus: "open",
  receiptBookId: "book-1",
  bookNumber: "BOOK-1",
  prefix: "VP-",
  startNumber: 1,
  endNumber: 100,
  currentNumber: 1,
  bookStatus: "assigned",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-1",
};

describe("useReceiptCreation — Double-Submit Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncNextReceiptMock.mockResolvedValue(null);
  });

  it("TEST 1 — Double-submit protection: ignores subsequent submit attempts while creation is in-flight", async () => {
    let resolveCreation: (val: unknown) => void;
    const slowCreationPromise = new Promise((resolve) => {
      resolveCreation = resolve;
    });

    createLocalReceiptMock.mockImplementationOnce(() => slowCreationPromise);

    const { result } = renderHook(() =>
      useReceiptCreation({
        session: mockSession,
      })
    );

    act(() => {
      result.current.setDonorName("Donor Rapid Click");
      result.current.setAmount("500");
    });

    const mockEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>;

    // First submit starts
    let firstSubmitPromise: Promise<void>;
    act(() => {
      firstSubmitPromise = result.current.handleCreateReceipt(mockEvent);
    });

    // Immediate second submit attempt while first is in flight
    act(() => {
      void result.current.handleCreateReceipt(mockEvent);
    });

    // Only one createLocalReceipt call was made
    expect(createLocalReceiptMock).toHaveBeenCalledTimes(1);

    // Resolve the first creation
    await act(async () => {
      resolveCreation!({
        clientReceiptId: "rec-1",
        receiptNumber: 1,
        syncStatus: "pending",
      });
      await firstSubmitPromise;
    });

    expect(createLocalReceiptMock).toHaveBeenCalledTimes(1);
    expect(result.current.creating).toBe(false);
  });

  it("TEST 2 — Calls onReceiptCreated callback immediately upon local receipt allocation before sync", async () => {
    const onReceiptCreatedMock = vi.fn();
    const onReceiptHistoryRefreshMock = vi.fn();
    const createdReceipt = {
      clientReceiptId: "rec-1000",
      receiptNumber: 1000,
      syncStatus: "pending",
    };

    createLocalReceiptMock.mockResolvedValue(createdReceipt);
    syncNextReceiptMock.mockRejectedValue(new Error("Network offline"));

    const { result } = renderHook(() =>
      useReceiptCreation({
        session: { ...mockSession, currentNumber: 1000 },
        onReceiptCreated: onReceiptCreatedMock,
        onReceiptHistoryRefresh: onReceiptHistoryRefreshMock,
      })
    );

    act(() => {
      result.current.setDonorName("Offline Donor");
      result.current.setAmount("500");
    });

    const mockEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>;

    await act(async () => {
      await result.current.handleCreateReceipt(mockEvent);
    });

    expect(onReceiptCreatedMock).toHaveBeenCalledWith(createdReceipt);
    expect(onReceiptHistoryRefreshMock).toHaveBeenCalled();
  });
});

