// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";

const {
  initializeCollectionSessionMock,
  loadCurrentCollectionSessionMock,
  mergeOfflineBookStateMock,
  supabaseRpcMock,
  supabaseFromMock,
  getUserMock,
} = vi.hoisted(() => ({
  initializeCollectionSessionMock: vi.fn(),
  loadCurrentCollectionSessionMock: vi.fn(),
  mergeOfflineBookStateMock: vi.fn(),
  supabaseRpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/features/collection/services/collection-session.service", () => ({
  initializeCollectionSession: initializeCollectionSessionMock,
  loadCurrentCollectionSession: loadCurrentCollectionSessionMock,
}));

vi.mock("@/lib/offline/offline-db", () => ({
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

import { useDashboardBootstrap } from "./use-dashboard-bootstrap";

const mockSession: CollectionSessionContext = {
  sessionId: "session-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-01",
  prefix: "VP-",
  startNumber: 1,
  endNumber: 100,
  currentNumber: 15,
  sessionStatus: "open",
  bookStatus: "assigned",
};

describe("useDashboardBootstrap Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUserMock.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });

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
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
      };
    });

    mergeOfflineBookStateMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully bootstraps a volunteer session on the primary path", async () => {
    initializeCollectionSessionMock.mockResolvedValueOnce(mockSession);
    const onSessionLoaded = vi.fn();

    const { result } = renderHook(() =>
      useDashboardBootstrap({ onSessionLoaded })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.organizationId).toBe("org-1");
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.error).toBeNull();

    expect(mergeOfflineBookStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptBookId: "book-1",
        collectionSessionId: "session-1",
        nextLocalNumber: 15,
      })
    );
    expect(onSessionLoaded).toHaveBeenCalledWith(mockSession);
  });

  it("recovers via direct fallback when primary initialization throws", async () => {
    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("Strict check failed")
    );
    loadCurrentCollectionSessionMock.mockResolvedValueOnce(mockSession);
    const onSessionLoaded = vi.fn();

    const { result } = renderHook(() =>
      useDashboardBootstrap({ onSessionLoaded })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toEqual(mockSession);
    expect(result.current.error).toBeNull();
    expect(mergeOfflineBookStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptBookId: "book-1",
      })
    );
    expect(onSessionLoaded).toHaveBeenCalledWith(mockSession);
  });

  it("sets error when both primary and fallback fail for volunteer", async () => {
    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("No active profile")
    );
    loadCurrentCollectionSessionMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useDashboardBootstrap());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.error).toBe("No active profile");
  });

  it("sets session to null without error when admin has no active session", async () => {
    supabaseRpcMock.mockImplementation(async (method: string) => {
      if (method === "current_user_role") {
        return { data: "admin", error: null };
      }
      return { data: null, error: null };
    });

    initializeCollectionSessionMock.mockRejectedValueOnce(
      new Error("No active volunteer profile")
    );
    loadCurrentCollectionSessionMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useDashboardBootstrap());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.session).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
