// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { LocalReceipt } from "@/lib/offline/offline-db";

const {
  initializeCollectionSessionMock,
  getLocalReceiptsMock,
  mergeOfflineBookStateMock,
  supabaseRpcMock,
  supabaseFromMock,
  getUserMock,
} = vi.hoisted(() => ({
  initializeCollectionSessionMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  mergeOfflineBookStateMock: vi.fn(),
  supabaseRpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  getUserMock: vi.fn(),
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
      getUser: getUserMock,
    },
    rpc: supabaseRpcMock,
    from: supabaseFromMock,
  },
}));

import { DashboardPage } from "./dashboard-page";

const mockOpenSession: CollectionSessionContext = {
  sessionId: "session-open-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-01",
  prefix: "VP-",
  startNumber: 1,
  endNumber: 100,
  currentNumber: 12,
  sessionStatus: "open",
  bookStatus: "assigned",
};

const mockCompletedSession: CollectionSessionContext = {
  sessionId: "session-completed-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-01",
  prefix: "VP-",
  startNumber: 1,
  endNumber: 100,
  currentNumber: 25,
  sessionStatus: "completed",
  bookStatus: "assigned",
};

const mockReceipt: LocalReceipt = {
  clientReceiptId: "receipt-1",
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "session-open-1",
  receiptBookId: "book-1",
  volunteerId: "vol-1",
  propertyId: null,
  receiptNumber: 1,
  donorName: "Amit Shah",
  donorMobile: "9876543210",
  amount: 501,
  paymentMode: "cash",
  paymentReference: null,
  notes: null,
  offlineCreatedAt: "2026-08-23T10:00:00Z",
  syncStatus: "synced",
  syncAttempts: 1,
  lastSyncAttemptAt: "2026-08-23T10:01:00Z",
  lastSyncError: null,
  createdAt: "2026-08-23T10:00:00Z",
  updatedAt: "2026-08-23T10:01:00Z",
};

describe("DashboardPage Bootstrap & Rehydration Characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUserMock.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });

    getLocalReceiptsMock.mockResolvedValue([]);
    mergeOfflineBookStateMock.mockResolvedValue(undefined);

    supabaseRpcMock.mockImplementation(async (method: string) => {
      if (method === "current_user_role") {
        return { data: "volunteer", error: null };
      }
      return { data: null, error: null };
    });

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { organization_id: "org-1" },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "collection_handovers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({ data: [], error: null })),
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
        };
      }

      if (table === "events") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    id: "event-1",
                    name: "Ganesh Utsav 2026",
                    code: "GU26",
                    is_active: true,
                  },
                ],
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === "receipt_books") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [
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
                  ],
                  error: null,
                })),
              })),
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "book-1",
                  book_number: "BOOK-01",
                  prefix: "VP-",
                  start_number: 1,
                  end_number: 100,
                  current_number: 12,
                  status: "assigned",
                },
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "user-1" },
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === "volunteers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: "vol-1", organization_id: "org-1" },
                  error: null,
                })),
              })),
            })),
            in: vi.fn(async () => ({ data: [], error: null })),
          })),
        };
      }

      if (table === "collection_sessions") {
        const queryObj: any = {
          eq: vi.fn(() => queryObj),
          in: vi.fn(() => queryObj),
          order: vi.fn(() => queryObj),
          limit: vi.fn(() => queryObj),
          then: (resolve: (val: any) => any) =>
            Promise.resolve({
              data: [
                {
                  id: "session-open-1",
                  organization_id: "org-1",
                  event_id: "event-1",
                  volunteer_id: "vol-1",
                  receipt_book_id: "book-1",
                  status: "open",
                  started_at: "2026-08-23T10:00:00Z",
                },
              ],
              error: null,
            }).then(resolve),
        };
        return {
          select: vi.fn(() => queryObj),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("1. Volunteer bootstrap with an open session: resolves role, session, offline book state, and active UI", async () => {
    initializeCollectionSessionMock.mockResolvedValueOnce(mockOpenSession);
    getLocalReceiptsMock.mockResolvedValueOnce([mockReceipt]);

    render(<DashboardPage />);

    // Renders active session summary
    expect(await screen.findByText("BOOK-01")).toBeTruthy();
    expect(screen.getByText("VP-12")).toBeTruthy();
    expect(screen.getAllByText("₹501.00").length).toBeGreaterThan(0);

    // Verifies role resolution
    expect(supabaseRpcMock).toHaveBeenCalledWith("current_user_role");

    // Verifies service call
    expect(initializeCollectionSessionMock).toHaveBeenCalledTimes(1);

    // Verifies offline book state hydration
    expect(mergeOfflineBookStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptBookId: "book-1",
        organizationId: "org-1",
        collectionSessionId: "session-open-1",
        nextLocalNumber: 12,
      })
    );

    // Verifies receipt history hydration
    expect(getLocalReceiptsMock).toHaveBeenCalledWith("book-1");

    // Verifies ReceiptCreationForm is present for open session
    expect(screen.getByLabelText("Donor Name *")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create Receipt #12" })
    ).toBeTruthy();

    // Verifies volunteer handover card is NOT rendered for open session
    expect(screen.queryByText("Collection Handover")).toBeNull();
    // Verifies admin panel is NOT rendered for volunteer
    expect(screen.queryByText("Collection Handover Verification")).toBeNull();
  });

  it("2. Volunteer bootstrap with a completed session: restores session and renders handover & start-new-collection UI", async () => {
    initializeCollectionSessionMock.mockResolvedValueOnce(mockCompletedSession);
    getLocalReceiptsMock.mockResolvedValueOnce([mockReceipt]);

    render(<DashboardPage />);

    // Renders completed session summary
    expect(await screen.findByText("BOOK-01")).toBeTruthy();
    expect(screen.getAllByText(/completed/i).length).toBeGreaterThan(0);

    // Verifies Volunteer Handover card is rendered for completed session
    expect(
      screen.getByRole("button", { name: /Start Handover/i })
    ).toBeTruthy();

    // Verifies Start New Collection card is rendered
    expect(screen.getByText("Start New Collection")).toBeTruthy();

    // Verifies ReceiptCreationForm indicates session is completed
    const submitBtn = screen.getByRole("button", {
      name: "Collection Session Completed",
    });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
  });

  it("3. Primary initialization failure → direct-query fallback: restores session via loadCurrentCollectionSession", async () => {
    // Primary service initialization fails
    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("Strict ownership validation failed")
    );

    getLocalReceiptsMock.mockResolvedValueOnce([mockReceipt]);

    render(<DashboardPage />);

    // Fallback restores the open session
    expect(await screen.findByText("BOOK-01")).toBeTruthy();
    expect(screen.getByText("VP-12")).toBeTruthy();

    // Offline book state was still ensured via fallback
    expect(mergeOfflineBookStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptBookId: "book-1",
        collectionSessionId: "session-open-1",
      })
    );

    // Receipt history was still loaded
    expect(getLocalReceiptsMock).toHaveBeenCalledWith("book-1");

    // Error alert is not shown since recovery succeeded
    expect(
      screen.queryByText("Unable to initialize collection session")
    ).toBeNull();
  });

  it("4. Admin bootstrap with no active session: loads admin handover panel and start collection", async () => {
    supabaseRpcMock.mockImplementation(async (method: string) => {
      if (method === "current_user_role") {
        return { data: "admin", error: null };
      }
      return { data: null, error: null };
    });

    // Primary service reports no session
    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("No active volunteer profile")
    );

    // Fallback collection_sessions query returns empty
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { organization_id: "org-1" },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "collection_handovers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    id: "handover-1",
                    organization_id: "org-1",
                    volunteer_id: "vol-2",
                    status: "submitted",
                    expected_total_amount: 1500,
                    expected_receipt_count: 3,
                    actual_cash_amount: 1500,
                    created_at: "2026-08-23T12:00:00Z",
                  },
                ],
                error: null,
              })),
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
        };
      }

      if (table === "volunteers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
            in: vi.fn(async () => ({
              data: [{ id: "vol-2", name: "Suresh Patil" }],
              error: null,
            })),
          })),
        };
      }

      if (table === "collection_sessions") {
        const queryObj: any = {
          eq: vi.fn(() => queryObj),
          in: vi.fn(() => queryObj),
          order: vi.fn(() => queryObj),
          limit: vi.fn(() => queryObj),
          then: (resolve: (val: any) => any) =>
            Promise.resolve({
              data: [],
              error: null,
            }).then(resolve),
        };
        return {
          select: vi.fn(() => queryObj),
        };
      }

      if (table === "events") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    id: "event-1",
                    name: "Ganesh Utsav 2026",
                    code: "GU26",
                    is_active: true,
                  },
                ],
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === "receipt_books") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [
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
                  ],
                  error: null,
                })),
              })),
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "user-admin" },
                error: null,
              })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      };
    });

    render(<DashboardPage />);

    // Admin Handover panel renders with submitted handover and volunteer name
    expect(
      await screen.findByText(/Handover Verification/i)
    ).toBeTruthy();
    expect(await screen.findByText(/Suresh Patil/)).toBeTruthy();

    // Start collection card is available for admin
    expect(screen.getByRole("button", { name: "Start Collection" })).toBeTruthy();

    // Volunteer active session cards are not shown
    expect(screen.queryByLabelText("Donor Name *")).toBeNull();
  });

  it("5. Non-admin with no recoverable session: displays initialization error state", async () => {
    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("No active volunteer profile is linked to this VarganiPro user.")
    );

    // Fallback also fails (e.g. user lookup returns null)
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: null,
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null,
              })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      };
    });

    render(<DashboardPage />);

    // Displays the error alert box
    expect(
      await screen.findByText("Unable to initialize collection session")
    ).toBeTruthy();

    expect(
      screen.getByText(
        "No active volunteer profile is linked to this VarganiPro user."
      )
    ).toBeTruthy();

    // Main session UI is omitted
    expect(screen.queryByText("BOOK-01")).toBeNull();
    expect(screen.queryByLabelText("Donor Name *")).toBeNull();
  });
});
