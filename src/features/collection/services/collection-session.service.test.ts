import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveBookState, sessionState } = vi.hoisted(() => ({
  saveBookState: vi.fn(),
  sessionState: {
    open: null as object | null,
    completed: null as object | null,
  },
}));

function result(data: object | null) {
  return { data, error: null };
}

vi.mock("@/lib/offline/offline-db", () => ({
  saveBookState,
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "auth-1" } },
        error: null,
      })),
    },
    from(table: string) {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => result({ id: "user-1", is_active: true }) }),
          }),
        };
      }

      if (table === "volunteers") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => result({ id: "volunteer-1", organization_id: "org-1" }),
              }),
            }),
          }),
        };
      }

      if (table === "collection_sessions") {
        let status = "";
        const query = {
          eq: (_column: string, value: string) => {
            if (value === "open" || value === "completed") status = value;
            return query;
          },
          order: () => query,
          limit: () => query,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(
              result(status === "open" ? sessionState.open : sessionState.completed)
            ).then(resolve),
        };
        return { select: () => query };
      }

      if (table === "receipt_books") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                result({
                  id: "book-1",
                  book_number: "BOOK-1",
                  prefix: "VP-",
                  start_number: 100,
                  end_number: 199,
                  current_number: 104,
                  status: "available",
                  assigned_volunteer_id: "another-volunteer",
                  checked_out_session_id: "completed-1",
                }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

import { initializeCollectionSession } from "./collection-session.service";

describe("initializeCollectionSession", () => {
  beforeEach(() => {
    saveBookState.mockReset();
  });

  it("restores the latest completed session when no open session exists", async () => {
    sessionState.open = null;
    sessionState.completed = [
      {
        id: "completed-1",
        organization_id: "org-1",
        event_id: "event-1",
        volunteer_id: "volunteer-1",
        receipt_book_id: "book-1",
        status: "completed",
        started_at: "2026-08-21T00:00:00.000Z",
      },
    ];

    const session = await initializeCollectionSession();

    expect(session).toMatchObject({
      sessionId: "completed-1",
      sessionStatus: "completed",
      receiptBookId: "book-1",
      currentNumber: 104,
    });
    expect(saveBookState).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionSessionId: "completed-1",
        nextLocalNumber: 104,
      })
    );
  });
});
