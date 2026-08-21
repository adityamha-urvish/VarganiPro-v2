import { describe, expect, it, vi } from "vitest";

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
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "user-1", is_active: true },
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
                  data: {
                    id: "volunteer-1",
                    organization_id: "org-1",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "collection_sessions") {
        let status = "";
        const query = {
          eq: (_column: string, value: string) => {
            if (value === "open" || value === "completed") {
              status = value;
            }
            return query;
          },
          order: () => query,
          limit: () => query,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({
              data:
                status === "open"
                  ? [
                      {
                        id: "open-1",
                        organization_id: "org-1",
                        event_id: "event-1",
                        volunteer_id: "volunteer-1",
                        receipt_book_id: "book-1",
                        status: "open",
                        started_at: "2026-08-21T00:00:00.000Z",
                      },
                    ]
                  : [],
              error: null,
            }).then(resolve),
        };
        return { select: () => query };
      }

      if (table === "receipt_books") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "book-1",
                  book_number: "BOOK-1",
                  prefix: "VP-",
                  start_number: 101,
                  end_number: 199,
                  current_number: 101,
                  status: "checked_out",
                  assigned_volunteer_id: "volunteer-1",
                  checked_out_session_id: "open-1",
                },
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

import { initializeCollectionSession } from "./collection-session.service";
import {
  getBookState,
  getLocalReceipt,
} from "@/lib/offline/offline-db";
import { createLocalReceipt } from "@/lib/offline/receipt-store";

const receiptInput = {
  receiptBookId: "book-1",
  organizationId: "org-1",
  eventId: "event-1",
  collectionSessionId: "open-1",
  volunteerId: "volunteer-1",
  propertyId: null,
  donorName: "Ada Donor",
  donorMobile: null,
  amount: 250,
  paymentMode: "cash" as const,
  paymentReference: null,
  notes: null,
};

describe("collection-session refresh with an unsynced receipt", () => {
  it("preserves the local next number and the original receipt", async () => {
    await initializeCollectionSession();

    const first = await createLocalReceipt(receiptInput);
    expect(first.receiptNumber).toBe(101);
    expect((await getBookState("book-1"))?.nextLocalNumber).toBe(102);

    await initializeCollectionSession();

    expect((await getBookState("book-1"))?.nextLocalNumber).toBe(102);

    const second = await createLocalReceipt(receiptInput);

    expect(second.receiptNumber).toBe(102);
    expect(await getLocalReceipt(first.clientReceiptId)).toMatchObject({
      clientReceiptId: first.clientReceiptId,
      receiptNumber: 101,
      syncStatus: "pending",
    });
  });
});
