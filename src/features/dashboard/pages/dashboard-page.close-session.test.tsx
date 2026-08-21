// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { LocalReceipt } from "@/lib/offline/offline-db";

const {
  completeCollectionSessionRpc,
  getLocalReceipts,
  initializeCollectionSession,
  supabaseRpc,
} = vi.hoisted(() => ({
  completeCollectionSessionRpc: vi.fn(),
  getLocalReceipts: vi.fn(),
  initializeCollectionSession: vi.fn(),
  supabaseRpc: vi.fn(),
}));

vi.mock("@/features/collection/services/collection-session.service", () => ({
  initializeCollectionSession,
}));

vi.mock("@/lib/offline/offline-db", () => ({
  getLocalReceipts,
  mergeOfflineBookState: vi.fn(),
}));

vi.mock("@/lib/offline/receipt-sync", () => ({
  syncNextReceipt: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "auth-1" } },
        error: null,
      })),
    },

    rpc: supabaseRpc,

    from(table: string) {
      if (table === "organization_members") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "collection_handovers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

import { DashboardPage } from "./dashboard-page";

const session = {
  sessionId: "session-open-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "volunteer-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-1",
  prefix: "VP-",
  startNumber: 101,
  endNumber: 199,
  currentNumber: 101,
  sessionStatus: "open",
  bookStatus: "checked_out",
};

function receipt(syncStatus: LocalReceipt["syncStatus"]): LocalReceipt {
  return {
    clientReceiptId: `client-${syncStatus}`,
    organizationId: "org-1",
    eventId: "event-1",
    collectionSessionId: "session-open-1",
    receiptBookId: "book-1",
    volunteerId: "volunteer-1",
    propertyId: null,
    receiptNumber: 101,
    donorName: "Ada Donor",
    donorMobile: null,
    amount: 250,
    paymentMode: "cash",
    paymentReference: null,
    notes: null,
    offlineCreatedAt: "2026-08-21T00:00:00.000Z",
    syncStatus,
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };
}

describe("DashboardPage close-session characterization", () => {
  beforeEach(() => {
    initializeCollectionSession.mockResolvedValue(session);

    supabaseRpc.mockImplementation(async (name: string, args?: unknown) => {
      if (name === "complete_collection_session") {
        completeCollectionSessionRpc(name, args);

        return {
          data: { success: true },
          error: null,
        };
      }

      if (name === "current_user_role") {
        return {
          data: "volunteer",
          error: null,
        };
      }

      return {
        data: null,
        error: null,
      };
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  async function renderWithReceipts(receipts: LocalReceipt[]) {
    getLocalReceipts.mockResolvedValue(receipts);

    render(<DashboardPage />);

    return screen.findByRole("button", {
      name: "Close Collection Session",
    });
  }

  it.each([
    ["pending", "pending"],
    ["syncing", "syncing"],
    ["conflict", "conflict"],
  ] as const)(
    "%s receipt blocks close and does not call complete_collection_session",
    async (_label, status) => {
      const closeButton = await renderWithReceipts([receipt(status)]);

      expect(closeButton).toHaveProperty("disabled", true);

      expect(
        completeCollectionSessionRpc
      ).not.toHaveBeenCalled();
    }
  );

  it("allows close when all receipts are synced and completes the session once", async () => {
    const closeButton = await renderWithReceipts([receipt("synced")]);

    expect(closeButton).toHaveProperty("disabled", false);

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(completeCollectionSessionRpc).toHaveBeenCalledTimes(1);
    });

    expect(completeCollectionSessionRpc).toHaveBeenCalledWith(
      "complete_collection_session",
      {
        p_collection_session_id: "session-open-1",
      }
    );

    expect(
      await screen.findByText("Collection Session Completed")
    ).toBeTruthy();
  });
});