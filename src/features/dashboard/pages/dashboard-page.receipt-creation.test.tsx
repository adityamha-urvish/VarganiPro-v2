// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { LocalReceipt } from "@/lib/offline/offline-db";

const {
  createLocalReceiptMock,
  getLocalReceiptsMock,
  initializeCollectionSessionMock,
  syncNextReceiptMock,
  supabaseRpcMock,
} = vi.hoisted(() => ({
  createLocalReceiptMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  initializeCollectionSessionMock: vi.fn(),
  syncNextReceiptMock: vi.fn(),
  supabaseRpcMock: vi.fn(),
}));

vi.mock("@/features/collection/services/collection-session.service", () => ({
  initializeCollectionSession: initializeCollectionSessionMock,
}));

vi.mock("@/lib/offline/receipt-store", () => ({
  createLocalReceipt: createLocalReceiptMock,
}));

vi.mock("@/lib/offline/offline-db", () => ({
  getLocalReceipts: getLocalReceiptsMock,
  mergeOfflineBookState: vi.fn(),
}));

vi.mock("@/lib/offline/receipt-sync", () => ({
  syncNextReceipt: syncNextReceiptMock,
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "auth-vol-1" } },
        error: null,
      })),
    },

    rpc: supabaseRpcMock,

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
                data: { id: "user-1" },
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

const mockOpenSession: CollectionSessionContext = {
  sessionId: "session-open-101",
  organizationId: "org-1",
  eventId: "event-1",
  volunteerId: "vol-1",
  receiptBookId: "book-1",
  bookNumber: "BOOK-1",
  prefix: "VP-",
  startNumber: 101,
  endNumber: 199,
  currentNumber: 101,
  sessionStatus: "open",
  bookStatus: "assigned",
};

function createSampleLocalReceipt(overrides: Partial<LocalReceipt> = {}): LocalReceipt {
  return {
    clientReceiptId: "client-rec-1",
    organizationId: "org-1",
    eventId: "event-1",
    collectionSessionId: "session-open-101",
    receiptBookId: "book-1",
    volunteerId: "vol-1",
    propertyId: null,
    receiptNumber: 101,
    donorName: "Aarav Patel",
    donorMobile: "9876543210",
    amount: 500,
    paymentMode: "cash",
    paymentReference: null,
    notes: "Ganpati vargani",
    offlineCreatedAt: new Date().toISOString(),
    syncStatus: "synced",
    syncAttempts: 0,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("DashboardPage receipt creation workflow characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeCollectionSessionMock.mockResolvedValue(mockOpenSession);
    getLocalReceiptsMock.mockResolvedValue([]);
    supabaseRpcMock.mockImplementation(async (rpcName: string) => {
      if (rpcName === "current_user_role") {
        return { data: "volunteer", error: null };
      }
      return { data: null, error: null };
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("successfully creates a receipt locally, refreshes history, triggers auto-sync, and displays last created receipt", async () => {
    const createdReceipt = createSampleLocalReceipt({
      amount: 500,
      donorName: "Aarav Patel",
      donorMobile: "9876543210",
      paymentMode: "cash",
      paymentReference: "REF123",
      notes: "Mandir donation",
    });

    createLocalReceiptMock.mockResolvedValue(createdReceipt);
    syncNextReceiptMock.mockResolvedValue({
      success: true,
      alreadyExists: false,
    });

    render(<DashboardPage />);

    expect(await screen.findByText("New Receipt")).toBeTruthy();

    const donorNameInput = screen.getByLabelText(/Donor Name/i);
    const donorMobileInput = screen.getByLabelText(/Mobile/i);
    const amountInput = screen.getByLabelText(/Amount/i);
    const paymentReferenceInput = screen.getByLabelText(/Payment Reference/i);
    const notesInput = screen.getByLabelText(/Notes/i);

    fireEvent.change(donorNameInput, { target: { value: "Aarav Patel" } });
    fireEvent.change(donorMobileInput, { target: { value: "9876543210" } });
    fireEvent.change(amountInput, { target: { value: "500" } });
    fireEvent.change(paymentReferenceInput, { target: { value: "REF123" } });
    fireEvent.change(notesInput, { target: { value: "Mandir donation" } });

    const submitButton = screen.getByRole("button", { name: /Create Receipt #101/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createLocalReceiptMock).toHaveBeenCalledTimes(1);
    });

    expect(createLocalReceiptMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      eventId: "event-1",
      collectionSessionId: "session-open-101",
      receiptBookId: "book-1",
      volunteerId: "vol-1",
      propertyId: null,
      donorName: "Aarav Patel",
      donorMobile: "9876543210",
      amount: 500,
      paymentMode: "cash",
      paymentReference: "REF123",
      notes: "Mandir donation",
    });

    await waitFor(() => {
      expect(syncNextReceiptMock).toHaveBeenCalledWith("book-1");
    });

    expect(getLocalReceiptsMock).toHaveBeenCalledWith("book-1");

    expect(await screen.findByText("Receipt created")).toBeTruthy();
    expect(screen.getByText("#101")).toBeTruthy();
    expect(screen.getByText("Aarav Patel — ₹500.00")).toBeTruthy();
    expect(await screen.findByText("Receipt created and synced successfully.")).toBeTruthy();
  });

  it("validates donor name and blocks creation when donor name is empty or whitespace", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText("New Receipt")).toBeTruthy();

    const amountInput = screen.getByLabelText(/Amount/i);
    const donorNameInput = screen.getByLabelText(/Donor Name/i);

    fireEvent.change(amountInput, { target: { value: "500" } });
    fireEvent.change(donorNameInput, { target: { value: "   " } });

    const form = donorNameInput.closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    expect(createLocalReceiptMock).not.toHaveBeenCalled();

    expect(await screen.findByText("Donor name is required.")).toBeTruthy();
  });

  it("validates amount and blocks creation when amount is zero or negative", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText("New Receipt")).toBeTruthy();

    const donorNameInput = screen.getByLabelText(/Donor Name/i);
    const amountInput = screen.getByLabelText(/Amount/i);

    fireEvent.change(donorNameInput, { target: { value: "Aarav Patel" } });
    fireEvent.change(amountInput, { target: { value: "0" } });

    const form = donorNameInput.closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    expect(createLocalReceiptMock).not.toHaveBeenCalled();

    expect(await screen.findByText("Amount must be greater than zero.")).toBeTruthy();
  });

  it("handles local receipt creation failure gracefully without crashing or triggering sync", async () => {
    createLocalReceiptMock.mockRejectedValueOnce(
      new Error("Receipt book is not available offline on this device.")
    );

    render(<DashboardPage />);

    expect(await screen.findByText("New Receipt")).toBeTruthy();

    const donorNameInput = screen.getByLabelText(/Donor Name/i);
    const amountInput = screen.getByLabelText(/Amount/i);

    fireEvent.change(donorNameInput, { target: { value: "Aarav Patel" } });
    fireEvent.change(amountInput, { target: { value: "500" } });

    const form = donorNameInput.closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    expect(
      await screen.findByText("Receipt book is not available offline on this device.")
    ).toBeTruthy();

    expect(syncNextReceiptMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Receipt created")).toBeNull();
  });

  it("treats sync failure as non-fatal, keeping the receipt stored locally with an informative message", async () => {
    const createdReceipt = createSampleLocalReceipt({
      amount: 500,
      donorName: "Aarav Patel",
      syncStatus: "pending",
    });

    createLocalReceiptMock.mockResolvedValue(createdReceipt);
    syncNextReceiptMock.mockRejectedValueOnce(new Error("Network offline"));

    render(<DashboardPage />);

    expect(await screen.findByText("New Receipt")).toBeTruthy();

    const donorNameInput = screen.getByLabelText(/Donor Name/i);
    const amountInput = screen.getByLabelText(/Amount/i);

    fireEvent.change(donorNameInput, { target: { value: "Aarav Patel" } });
    fireEvent.change(amountInput, { target: { value: "500" } });

    const form = donorNameInput.closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(createLocalReceiptMock).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Receipt created")).toBeTruthy();
    expect(
      await screen.findByText(
        "Receipt created locally. It will remain available for synchronization."
      )
    ).toBeTruthy();
  });

  it("resets form inputs back to defaults after successful receipt creation", async () => {
    const createdReceipt = createSampleLocalReceipt();
    createLocalReceiptMock.mockResolvedValue(createdReceipt);
    syncNextReceiptMock.mockResolvedValue({ success: true, alreadyExists: false });

    render(<DashboardPage />);

    expect(await screen.findByText("New Receipt")).toBeTruthy();

    const donorNameInput = screen.getByLabelText(/Donor Name/i) as HTMLInputElement;
    const donorMobileInput = screen.getByLabelText(/Mobile/i) as HTMLInputElement;
    const amountInput = screen.getByLabelText(/Amount/i) as HTMLInputElement;
    const paymentReferenceInput = screen.getByLabelText(/Payment Reference/i) as HTMLInputElement;
    const notesInput = screen.getByLabelText(/Notes/i) as HTMLTextAreaElement;

    fireEvent.change(donorNameInput, { target: { value: "Aarav Patel" } });
    fireEvent.change(donorMobileInput, { target: { value: "9876543210" } });
    fireEvent.change(amountInput, { target: { value: "500" } });
    fireEvent.change(paymentReferenceInput, { target: { value: "REF123" } });
    fireEvent.change(notesInput, { target: { value: "Special note" } });

    const form = donorNameInput.closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(donorNameInput.value).toBe("");
    });

    expect(donorMobileInput.value).toBe("");
    expect(amountInput.value).toBe("");
    expect(paymentReferenceInput.value).toBe("");
    expect(notesInput.value).toBe("");
  });

  it("disables the submit button when the collection session is completed", async () => {
    const completedSession: CollectionSessionContext = {
      ...mockOpenSession,
      sessionStatus: "completed",
    };

    initializeCollectionSessionMock.mockResolvedValue(completedSession);

    render(<DashboardPage />);

    const submitButton = await screen.findByRole("button", {
      name: /Collection Session Completed/i,
    });

    expect(submitButton).toBeTruthy();
    expect(submitButton).toHaveProperty("disabled", true);
  });
});
