// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEventCollectionSummary } from "./event-collection-summary.service";
import { supabase } from "@/supabase/client";

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("event-collection-summary.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Input Validation & RPC Calling", () => {
    it("returns error immediately if eventId is empty", async () => {
      const res = await getEventCollectionSummary("");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Event ID is required");
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("calls get_event_collection_summary RPC with p_event_id only", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: true,
          event_id: "ev-100",
          organization_id: "org-100",
          total_amount: 150000,
          cash_amount: 90000,
          upi_amount: 50000,
          cheque_amount: 10000,
          bank_transfer_amount: 0,
          receipt_count: 120,
        },
        error: null,
      } as any);

      const res = await getEventCollectionSummary("ev-100");
      expect(supabase.rpc).toHaveBeenCalledWith("get_event_collection_summary", {
        p_event_id: "ev-100",
      });
      expect(res.success).toBe(true);
      expect(res.data?.total_amount).toBe(150000);
      expect(res.data?.cash_amount).toBe(90000);
      expect(res.data?.upi_amount).toBe(50000);
      expect(res.data?.cheque_amount).toBe(10000);
      expect(res.data?.receipt_count).toBe(120);
    });
  });

  describe("Adversarial & Authorization Error Scenarios", () => {
    it("handles 401 unauthenticated exception", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: "Not authenticated" },
      } as any);

      const res = await getEventCollectionSummary("ev-100");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Not authenticated");
    });

    it("handles inactive volunteer / unauthorized exception", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: "Unauthorized: Caller is neither an administrator nor an active volunteer for this organization" },
      } as any);

      const res = await getEventCollectionSummary("ev-100");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized");
    });

    it("handles inactive or expired event exception", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: "Unauthorized: Event is inactive or expired" },
      } as any);

      const res = await getEventCollectionSummary("ev-100");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Unauthorized: Event is inactive or expired");
    });
  });
});
