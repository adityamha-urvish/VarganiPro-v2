// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  getLocalReceipts,
  initializeCollectionSession,
  submitCollectionHandoverRpc,
  supabaseRpc,
} = vi.hoisted(() => ({
  getLocalReceipts: vi.fn(),
  initializeCollectionSession: vi.fn(),
  submitCollectionHandoverRpc: vi.fn(),
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

const mockRejectedHandoverRow = {
  id: "handover-rej-101",
  collection_session_id: "session-completed-1",
  expected_receipt_count: 3,
  expected_total_amount: 1500,
  expected_cash_amount: 1000,
  expected_upi_amount: 500,
  expected_cheque_amount: 0,
  expected_bank_transfer_amount: 0,
  actual_cash_amount: 900,
  actual_upi_amount: 500,
  actual_cheque_amount: 0,
  actual_bank_transfer_amount: 0,
  status: "rejected",
  notes: "Previous submission had cash discrepancy; recounted.",
};

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
                data: mockRejectedHandoverRow,
                error: null,
              }),
            }),
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

      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

import { DashboardPage } from "./dashboard-page";

const completedSession = {
  sessionId: "session-completed-1",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "volunteer-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-1",
  prefix: "VP-",
  startNumber: 101,
  endNumber: 199,
  currentNumber: 104,
  sessionStatus: "completed",
  bookStatus: "available",
};

describe("DashboardPage rejected handover resubmission characterization", () => {
  beforeEach(() => {
    initializeCollectionSession.mockResolvedValue(completedSession);
    getLocalReceipts.mockResolvedValue([]);

    supabaseRpc.mockImplementation(async (name: string, args?: unknown) => {
      if (name === "submit_collection_handover") {
        submitCollectionHandoverRpc(name, args);

        return {
          data: {
            success: true,
            handover_id: "handover-rej-101",
            expected_total: 1500,
            actual_total: 1500,
            difference: 0,
            status: "submitted",
          },
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

  it("restores rejected handover data, allows editing, and resubmits to submit_collection_handover", async () => {
    render(<DashboardPage />);

    // 1 & 4. Verify completed session is loaded and rejected handover status is displayed
    expect(await screen.findByText("Collection Handover")).toBeTruthy();
    expect(screen.getByText("rejected")).toBeTruthy();

    // 9. Verify server-provided expected totals are rendered (not 0 despite empty local receipts)
    expect(screen.getByText("₹1500.00")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();

    // 4. Verify restored actual amounts and notes in form inputs
    const cashInput = screen.getByLabelText("Actual Cash") as HTMLInputElement;
    const upiInput = screen.getByLabelText("Actual UPI") as HTMLInputElement;
    const chequeInput = screen.getByLabelText("Actual Cheque") as HTMLInputElement;
    const bankTransferInput = screen.getByLabelText("Actual Bank Transfer") as HTMLInputElement;
    const notesInput = screen.getByLabelText("Notes", {
      selector: "#handover-notes",
    }) as HTMLTextAreaElement;

    expect(cashInput.value).toBe("900");
    expect(upiInput.value).toBe("500");
    expect(chequeInput.value).toBe("");
    expect(bankTransferInput.value).toBe("");
    expect(notesInput.value).toBe("Previous submission had cash discrepancy; recounted.");

    // 5. Verify resubmission action is exposed and enabled
    const submitButton = screen.getByRole("button", {
      name: "Submit Handover",
    });
    expect(submitButton).toHaveProperty("disabled", false);

    // 6. User edits actual cash from 900 to 1000 and notes to reflect resolution
    fireEvent.change(cashInput, { target: { value: "1000" } });
    fireEvent.change(notesInput, {
      target: { value: "Recounted cash box: ₹1000 found, discrepancy resolved." },
    });

    expect(cashInput.value).toBe("1000");

    // Submit the handover
    fireEvent.click(submitButton);

    // 7 & 8. Verify submit_collection_handover was called once with the correct identifier and restored/edited parameters
    await waitFor(() => {
      expect(submitCollectionHandoverRpc).toHaveBeenCalledTimes(1);
    });

    expect(submitCollectionHandoverRpc).toHaveBeenCalledWith(
      "submit_collection_handover",
      {
        p_handover_id: "handover-rej-101",
        p_actual_cash_amount: 1000,
        p_actual_upi_amount: 500,
        p_actual_cheque_amount: 0,
        p_actual_bank_transfer_amount: 0,
        p_notes: "Recounted cash box: ₹1000 found, discrepancy resolved.",
      }
    );

    // 10. Verify the resulting UI indicates successful submission
    expect(
      await screen.findByText(/Handover submitted successfully/i)
    ).toBeTruthy();
  });
});
