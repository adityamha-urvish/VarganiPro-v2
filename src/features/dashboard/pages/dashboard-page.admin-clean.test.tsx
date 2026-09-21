// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";

const {
  initializeCollectionSessionMock,
  getLocalReceiptsMock,
  supabaseRpcMock,
  supabaseFromMock,
} = vi.hoisted(() => ({
  initializeCollectionSessionMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  supabaseRpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
}));

vi.mock("@/features/collection/services/collection-session.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/collection/services/collection-session.service")>();
  return {
    ...actual,
    initializeCollectionSession: initializeCollectionSessionMock,
  };
});

vi.mock("@/features/collection/services/collection-progress.service", () => ({
  fetchEventBuildingSummaries: vi.fn(async () => []),
  fetchBuildingPropertiesProgress: vi.fn(async () => []),
  recordFollowUp: vi.fn(async () => {}),
}));

vi.mock("@/lib/offline/offline-db", () => ({
  getLocalReceipts: getLocalReceiptsMock,
  mergeOfflineBookState: vi.fn(),
}));

vi.mock("@/lib/offline/receipt-sync", () => ({
  syncNextReceipt: vi.fn(),
  drainSyncQueue: vi.fn(async () => {}),
  setupAutoSync: vi.fn(() => () => {}),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "admin-auth-1" } },
        error: null,
      })),
    },
    rpc: supabaseRpcMock,
    from: supabaseFromMock,
  },
}));

import { DashboardPage } from "./dashboard-page";

const mockActiveEvent = {
  id: "event-1",
  name: "Ganesh Utsav 2026",
  code: "GU26",
  start_date: "2026-09-01",
  end_date: "2026-09-10",
  is_active: true,
};

const mockAvailableBook = {
  id: "book-1",
  book_number: "BOOK-ADMIN-01",
  prefix: "VP-",
  start_number: 1,
  end_number: 100,
  current_number: 1,
  status: "available",
  event_id: "event-1",
};

const mockSessionContext: CollectionSessionContext = {
  sessionId: "session-admin-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-admin-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-ADMIN-01",
  prefix: "VP-",
  startNumber: 1,
  endNumber: 100,
  currentNumber: 1,
  sessionStatus: "open",
  bookStatus: "assigned",
};

describe("P0 Remediation: Clean Admin Start Collection UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocalReceiptsMock.mockResolvedValue([]);

    supabaseRpcMock.mockImplementation(async (name: string) => {
      if (name === "current_user_role") {
        return { data: "admin", error: null };
      }
      return { data: null, error: null };
    });

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "user-admin-1" },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "organization_members") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: { organization_id: "org-1" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "events") {
        return {
          select: () => ({
            eq: (field: string, val: unknown) => ({
              order: async () => ({
                data: field === "is_active" && val === true ? [mockActiveEvent] : [],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "receipt_books") {
        return {
          select: () => {
            const queryBuilder = {
              eq: () => queryBuilder,
              or: () => queryBuilder,
              order: async () => ({
                data: [mockAvailableBook],
                error: null,
              }),
              maybeSingle: async () => ({
                data: mockAvailableBook,
                error: null,
              }),
            };
            return queryBuilder;
          },
        };
      }

      if (table === "collection_handovers") {
        return {
          select: () => {
            const builder = {
              eq: () => builder,
              order: async () => ({
                data: [],
                error: null,
              }),
              maybeSingle: async () => ({
                data: null,
                error: null,
              }),
            };
            return builder;
          },
        };
      }

      if (table === "volunteers") {
        return {
          select: () => ({
            in: async () => ({
              data: [],
              error: null,
            }),
          }),
        };
      }

      return {
        select: () => {
          const generic = {
            eq: () => generic,
            maybeSingle: async () => ({ data: null, error: null }),
            order: async () => ({ data: [], error: null }),
          };
          return generic;
        },
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Secretary overview on initial load, and cleanly enters Collection Mode without clutter", async () => {
    initializeCollectionSessionMock.mockResolvedValueOnce(mockSessionContext);

    render(<DashboardPage />);

    // Initial Overview: + New Receipt button is present
    const newReceiptBtn = await screen.findByTestId("secretary-new-receipt-btn");
    expect(newReceiptBtn).toBeTruthy();

    // Tap "+ New Receipt" to enter collectionMode
    fireEvent.click(newReceiptBtn);

    // In active collectionMode, Secretary Command Center and Admin Handover should NOT pollute the screen
    await waitFor(() => {
      expect(screen.queryByTestId("secretary-command-center")).toBeNull();
      expect(screen.queryByTestId("admin-handover-panel")).toBeNull();
      expect(screen.getByTestId("admin-back-dashboard")).toBeTruthy();
    });
  });
});
