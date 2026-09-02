// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";

const {
  initializeCollectionSessionMock,
  getLocalReceiptsMock,
  mergeOfflineBookStateMock,
  supabaseRpcMock,
  supabaseFromMock,
} = vi.hoisted(() => ({
  initializeCollectionSessionMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  mergeOfflineBookStateMock: vi.fn(),
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
  mergeOfflineBookState: mergeOfflineBookStateMock,
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "auth-user-1" } },
        error: null,
      })),
    },

    rpc: supabaseRpcMock,
    from: supabaseFromMock,
  },
}));

import { DashboardPage } from "./dashboard-page";

const mockActiveEvents = [
  {
    id: "event-1",
    name: "Ganesh Utsav 2026",
    code: "GU26",
    start_date: "2026-09-01",
    end_date: "2026-09-10",
    is_active: true,
  },
  {
    id: "event-2",
    name: "Navratri 2026",
    code: "NV26",
    start_date: "2026-10-01",
    end_date: "2026-10-10",
    is_active: true,
  },
];

const mockBooksEvent1 = [
  {
    id: "book-1",
    book_number: "BOOK-01",
    prefix: "VP-",
    start_number: 1,
    end_number: 100,
    current_number: 1,
    status: "available",
    event_id: "event-1",
  },
  {
    id: "book-2",
    book_number: "BOOK-02",
    prefix: "VP-",
    start_number: 101,
    end_number: 200,
    current_number: 101,
    status: "available",
    event_id: "event-1",
  },
];

const mockBooksEvent2 = [
  {
    id: "book-3",
    book_number: "BOOK-03",
    prefix: "NV-",
    start_number: 1,
    end_number: 50,
    current_number: 1,
    status: "available",
    event_id: "event-2",
  },
];

function setupSupabaseTables(options: {
  events?: typeof mockActiveEvents;
  booksByEvent?: Record<string, typeof mockBooksEvent1>;
  getCurrentSessionRow?: () => Record<string, unknown> | null;
  bookRow?: Record<string, unknown> | null;
} = {}) {
  const {
    events = mockActiveEvents,
    booksByEvent = {
      "event-1": mockBooksEvent1,
      "event-2": mockBooksEvent2,
    },
    getCurrentSessionRow = () => null,
    bookRow = null,
  } = options;

  supabaseFromMock.mockImplementation((table: string) => {
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
              data: field === "is_active" && val === true ? events : [],
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "receipt_books") {
      return {
        select: () => {
          let currentEventId = "event-1";
          const queryBuilder = {
            eq: (field: string, val: string) => {
              if (field === "event_id") {
                currentEventId = val;
              }
              return queryBuilder;
            },
            or: () => queryBuilder,
            order: async () => ({
              data: booksByEvent[currentEventId] ?? [],
              error: null,
            }),
            maybeSingle: async () => ({
              data: bookRow ?? (booksByEvent["event-1"]?.find((b) => b.id === "book-1") ?? null),
              error: null,
            }),
          };
          return queryBuilder;
        },
      };
    }

    if (table === "users") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "user-1" },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "volunteers") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "vol-1", organization_id: "org-1" },
                error: null,
              }),
            }),
          }),
          in: async () => ({
            data: [],
            error: null,
          }),
        }),
      };
    }

    if (table === "collection_sessions") {
      const sessionBuilder = {
        eq: () => sessionBuilder,
        in: () => sessionBuilder,
        order: () => sessionBuilder,
        limit: () => sessionBuilder,
        then: (resolve: (val: unknown) => void) => {
          const row = getCurrentSessionRow();
          return resolve({
            data: row ? [row] : [],
            error: null,
          });
        },
      };
      return {
        select: () => sessionBuilder,
      };
    }

    if (table === "collection_handovers") {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [],
              error: null,
            }),
            maybeSingle: async () => ({
              data: null,
              error: null,
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe("DashboardPage start collection workflow characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocalReceiptsMock.mockResolvedValue([]);
    mergeOfflineBookStateMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads active events and available receipt books when admin has no active session", async () => {
    supabaseRpcMock.mockImplementation(async (rpcName: string) => {
      if (rpcName === "current_user_role") {
        return { data: "admin", error: null };
      }
      return { data: null, error: null };
    });

    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("No active session")
    );

    setupSupabaseTables({ getCurrentSessionRow: () => null });

    render(<DashboardPage />);

    expect(await screen.findByText(/Handover Verification/i)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Start Collection" })).toBeTruthy();

    const eventSelect = (await screen.findByLabelText("Event")) as HTMLSelectElement;
    expect(eventSelect.value).toBe("event-1");

    expect(await screen.findByText(/BOOK-01/)).toBeTruthy();
    expect(screen.getByText(/Ganesh Utsav 2026 \(GU26\)/)).toBeTruthy();
  });

  it("loads available receipt books when a different event is selected in Start Collection", async () => {
    supabaseRpcMock.mockImplementation(async (rpcName: string) => {
      if (rpcName === "current_user_role") {
        return { data: "admin", error: null };
      }
      return { data: null, error: null };
    });

    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("No active session")
    );

    setupSupabaseTables({ getCurrentSessionRow: () => null });

    render(<DashboardPage />);

    const eventSelect = (await screen.findByLabelText("Event")) as HTMLSelectElement;
    expect(await screen.findByText(/BOOK-01/)).toBeTruthy();
    expect(eventSelect.value).toBe("event-1");

    fireEvent.change(eventSelect, { target: { value: "event-2" } });

    await waitFor(() => {
      expect(screen.getAllByText(/BOOK-03/).length).toBeGreaterThan(0);
    });

    const bookSelect = screen.getByLabelText("Receipt Book") as HTMLSelectElement;
    expect(bookSelect.value).toBe("book-3");
    expect(screen.getByText("Receipt Range")).toBeTruthy();
    expect(screen.getByText("NV-1 – NV-50")).toBeTruthy();
  });

  it("displays 'Start New Collection' card when a volunteer's current session status is completed", async () => {
    supabaseRpcMock.mockImplementation(async (rpcName: string) => {
      if (rpcName === "current_user_role") {
        return { data: "volunteer", error: null };
      }
      return { data: null, error: null };
    });

    const completedSession: CollectionSessionContext = {
      sessionId: "session-comp-1",
      organizationId: "org-1",
      eventId: "event-1",
      volunteerId: "vol-1",
      receiptBookId: "book-1",
      bookNumber: "BOOK-01",
      prefix: "VP-",
      startNumber: 1,
      endNumber: 100,
      currentNumber: 10,
      sessionStatus: "completed",
      bookStatus: "assigned",
    };

    initializeCollectionSessionMock.mockResolvedValueOnce(completedSession);
    setupSupabaseTables({ getCurrentSessionRow: () => null });

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Start New Collection" })).toBeTruthy();
    expect(
      screen.getByText(
        "Your previous collection is completed. Start a new session with an available receipt book."
      )
    ).toBeTruthy();

    const eventSelect = (await screen.findByLabelText("Event")) as HTMLSelectElement;
    await waitFor(() => {
      expect(eventSelect.value).toBe("event-1");
    });
  });

  it("successfully starts a collection session, syncs offline book state, and mounts the active session UI", async () => {
    let currentSessionRow: Record<string, unknown> | null = null;

    const newlyCreatedSessionRow = {
      id: "session-new-1",
      organization_id: "org-1",
      event_id: "event-1",
      volunteer_id: "vol-1",
      receipt_book_id: "book-1",
      status: "open",
      started_at: new Date().toISOString(),
    };

    const newBookRow = {
      id: "book-1",
      book_number: "BOOK-01",
      prefix: "VP-",
      start_number: 1,
      end_number: 100,
      current_number: 1,
      status: "assigned",
    };

    supabaseRpcMock.mockImplementation(async (rpcName: string) => {
      if (rpcName === "current_user_role") {
        return { data: "admin", error: null };
      }
      if (rpcName === "start_collection_session") {
        currentSessionRow = newlyCreatedSessionRow;
        return { data: { success: true }, error: null };
      }
      return { data: null, error: null };
    });

    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("No active session")
    );

    setupSupabaseTables({
      getCurrentSessionRow: () => currentSessionRow,
      bookRow: newBookRow,
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Start Collection" })).toBeTruthy();
    expect(await screen.findByText(/BOOK-01/)).toBeTruthy();

    const bookSelect = screen.getByLabelText("Receipt Book") as HTMLSelectElement;
    fireEvent.change(bookSelect, { target: { value: "book-1" } });

    const startButton = screen.getByRole("button", { name: "Start Collection" });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(supabaseRpcMock).toHaveBeenCalledWith("start_collection_session", {
        p_event_id: "event-1",
        p_receipt_book_id: "book-1",
      });
    });

    await waitFor(() => {
      expect(mergeOfflineBookStateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          receiptBookId: "book-1",
          organizationId: "org-1",
          eventId: "event-1",
          collectionSessionId: "session-new-1",
          volunteerId: "vol-1",
          bookNumber: "BOOK-01",
          prefix: "VP-",
          startNumber: 1,
          endNumber: 100,
          nextLocalNumber: 1,
        })
      );
    });

    expect(getLocalReceiptsMock).toHaveBeenCalledWith("book-1");

    expect(await screen.findByRole("heading", { name: "Session Summary" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "New Receipt" })).toBeTruthy();
  });

  it("cancels start collection flow without calling start_collection_session RPC when user declines confirm dialog", async () => {
    supabaseRpcMock.mockImplementation(async (rpcName: string) => {
      if (rpcName === "current_user_role") {
        return { data: "admin", error: null };
      }
      return { data: null, error: null };
    });

    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("No active session")
    );

    setupSupabaseTables({ getCurrentSessionRow: () => null });

    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Start Collection" })).toBeTruthy();
    expect(await screen.findByText(/BOOK-01/)).toBeTruthy();

    const bookSelect = screen.getByLabelText("Receipt Book") as HTMLSelectElement;
    fireEvent.change(bookSelect, { target: { value: "book-1" } });

    const startButton = screen.getByRole("button", { name: "Start Collection" });
    fireEvent.click(startButton);

    expect(supabaseRpcMock).not.toHaveBeenCalledWith(
      "start_collection_session",
      expect.anything()
    );
  });

  it("handles start_collection_session RPC errors gracefully and displays the error message", async () => {
    supabaseRpcMock.mockImplementation(async (rpcName: string) => {
      if (rpcName === "current_user_role") {
        return { data: "admin", error: null };
      }
      if (rpcName === "start_collection_session") {
        return { data: null, error: { message: "Receipt book is already assigned." } };
      }
      return { data: null, error: null };
    });

    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("No active session")
    );

    setupSupabaseTables({ getCurrentSessionRow: () => null });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Start Collection" })).toBeTruthy();
    expect(await screen.findByText(/BOOK-01/)).toBeTruthy();

    const bookSelect = screen.getByLabelText("Receipt Book") as HTMLSelectElement;
    fireEvent.change(bookSelect, { target: { value: "book-1" } });

    const startButton = screen.getByRole("button", { name: "Start Collection" });
    fireEvent.click(startButton);

    expect(
      await screen.findByText("Receipt book is already assigned.")
    ).toBeTruthy();
  });

  it("displays assigned receipt books in the selector and allows starting collection", async () => {
    const assignedBook = {
      id: "book-assigned-1",
      book_number: "TEST-8F2-PILOT-2026",
      prefix: "VP-",
      start_number: 1000,
      end_number: 1010,
      current_number: 1000,
      status: "assigned",
      assigned_volunteer_id: "vol-1",
      event_id: "event-1",
    };

    supabaseRpcMock.mockImplementation(async (rpcName: string) => {
      if (rpcName === "current_user_role") {
        return { data: "admin", error: null };
      }
      if (rpcName === "start_collection_session") {
        return {
          data: {
            success: true,
            collection_session_id: "session-assigned-1",
            receipt_book_id: "book-assigned-1",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    initializeCollectionSessionMock
      .mockRejectedValueOnce(new Error("No active session"))
      .mockResolvedValueOnce({
        sessionId: "session-assigned-1",
        organizationId: "org-1",
        eventId: "event-1",
        receiptBookId: "book-assigned-1",
        volunteerId: "vol-1",
        bookNumber: "TEST-8F2-PILOT-2026",
        prefix: "VP-",
        startNumber: 1000,
        endNumber: 1010,
        currentNumber: 1000,
        sessionStatus: "open",
        bookStatus: "checked_out",
      });

    setupSupabaseTables({
      booksByEvent: {
        "event-1": [assignedBook],
        "event-2": [],
      },
      getCurrentSessionRow: () => null,
      bookRow: assignedBook,
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Start Collection" })).toBeTruthy();
    expect((await screen.findAllByText(/TEST-8F2-PILOT-2026/)).length).toBeGreaterThan(0);

    const startButton = screen.getByRole("button", { name: "Start Collection" });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(supabaseRpcMock).toHaveBeenCalledWith("start_collection_session", {
        p_event_id: "event-1",
        p_receipt_book_id: "book-assigned-1",
      });
    });
  });
});

