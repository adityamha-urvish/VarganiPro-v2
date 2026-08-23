// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  collectionHandoversQuery,
  getLocalReceipts,
  initializeCollectionSession,
  supabaseRpc,
  volunteersQuery,
} = vi.hoisted(() => ({
  collectionHandoversQuery: vi.fn(),
  getLocalReceipts: vi.fn(),
  initializeCollectionSession: vi.fn(),
  supabaseRpc: vi.fn(),
  volunteersQuery: vi.fn(),
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

const mockSubmittedHandoverRow = {
  id: "handover-sub-1",
  organization_id: "org-1",
  event_id: "event-1",
  collection_session_id: "session-1",
  volunteer_id: "vol-1",
  expected_receipt_count: 5,
  expected_total_amount: 2500,
  expected_cash_amount: 1500,
  expected_upi_amount: 1000,
  expected_cheque_amount: 0,
  expected_bank_transfer_amount: 0,
  actual_cash_amount: 1500,
  actual_upi_amount: 1000,
  actual_cheque_amount: 0,
  actual_bank_transfer_amount: 0,
  status: "submitted",
  submitted_at: "2026-08-23T10:00:00Z",
  submitted_by: "vol-1",
  verified_at: null,
  verified_by: null,
  rejection_reason: null,
  notes: "All envelopes counted and matched.",
  created_at: "2026-08-23T10:00:00Z",
  updated_at: "2026-08-23T10:00:00Z",
};

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "auth-admin-1" } },
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
                  data: { organization_id: "org-1" },
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
            eq: (column: string, value: string) => {
              collectionHandoversQuery(column, value);
              return {
                order: async () => ({
                  data: [mockSubmittedHandoverRow],
                  error: null,
                }),
              };
            },
          }),
        };
      }

      if (table === "volunteers") {
        return {
          select: () => ({
            in: async (column: string, values: string[]) => {
              volunteersQuery(column, values);
              return {
                data: [{ id: "vol-1", name: "Volunteer Ramesh" }],
                error: null,
              };
            },
          }),
        };
      }

      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "receipt_books") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: async () => ({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "users") {
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

describe("DashboardPage admin handover verification characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeCollectionSession.mockRejectedValue(new Error("No volunteer active session"));
    getLocalReceipts.mockResolvedValue([]);

    supabaseRpc.mockImplementation(async (rpcName: string) => {
      if (rpcName === "current_user_role") {
        return { data: "admin", error: null };
      }
      if (rpcName === "verify_collection_handover") {
        return { data: { success: true }, error: null };
      }
      if (rpcName === "reject_collection_handover") {
        return { data: { success: true }, error: null };
      }
      return { data: null, error: null };
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads collection handovers scoped to the user's organizationId and renders volunteer details", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText("Collection Handover Verification")).toBeTruthy();
    expect(collectionHandoversQuery).toHaveBeenCalledWith("organization_id", "org-1");
    expect(await screen.findByText("Volunteer Ramesh")).toBeTruthy();
    expect(screen.getByText("submitted")).toBeTruthy();
    expect(screen.getByText(/Handover ID: handover-sub-1/)).toBeTruthy();
    expect(screen.getByText("All envelopes counted and matched.")).toBeTruthy();
  });

  it("verifies a submitted handover when the admin confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<DashboardPage />);

    const verifyButton = await screen.findByRole("button", { name: "Verify" });
    expect(verifyButton).toBeTruthy();

    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(supabaseRpc).toHaveBeenCalledWith("verify_collection_handover", {
        p_handover_id: "handover-sub-1",
      });
    });
  });

  it("cancels rejection when window.prompt is dismissed (null)", async () => {
    vi.spyOn(window, "prompt").mockReturnValue(null);

    render(<DashboardPage />);

    const rejectButton = await screen.findByRole("button", { name: "Reject" });
    expect(rejectButton).toBeTruthy();

    fireEvent.click(rejectButton);

    expect(supabaseRpc).not.toHaveBeenCalledWith(
      "reject_collection_handover",
      expect.anything()
    );
  });

  it("blocks rejection and displays an error when reason is empty or whitespace", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("   ");

    render(<DashboardPage />);

    const rejectButton = await screen.findByRole("button", { name: "Reject" });
    expect(rejectButton).toBeTruthy();

    fireEvent.click(rejectButton);

    expect(supabaseRpc).not.toHaveBeenCalledWith(
      "reject_collection_handover",
      expect.anything()
    );

    expect(await screen.findByText("A rejection reason is required.")).toBeTruthy();
  });

  it("rejects a submitted handover with the provided reason", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Cash amount mismatch");

    render(<DashboardPage />);

    const rejectButton = await screen.findByRole("button", { name: "Reject" });
    expect(rejectButton).toBeTruthy();

    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(supabaseRpc).toHaveBeenCalledWith("reject_collection_handover", {
        p_handover_id: "handover-sub-1",
        p_rejection_reason: "Cash amount mismatch",
      });
    });
  });
});
