// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createExpense,
  updateExpense,
  getEventExpenses,
} from "./expenses.service";
import { supabase } from "@/supabase/client";

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("expenses.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createExpense", () => {
    it("validates title length before calling rpc", async () => {
      const res = await createExpense({
        eventId: "ev-1",
        title: "A",
        amount: 100,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("किमान २ अक्षरांचे");
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("validates positive amount before calling rpc", async () => {
      const res = await createExpense({
        eventId: "ev-1",
        title: "Puja flowers",
        amount: 0,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("रक्कम ० पेक्षा जास्त");
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("calls create_expense RPC successfully with trimmed values", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { success: true, expense_id: "exp-123" },
        error: null,
      } as any);

      const res = await createExpense({
        eventId: "ev-1",
        title: "  मंडप सजावट  ",
        amount: 1500,
        expenseDate: "2026-09-28",
      });

      expect(res.success).toBe(true);
      expect(res.expenseId).toBe("exp-123");
      expect(supabase.rpc).toHaveBeenCalledWith("create_expense", {
        p_event_id: "ev-1",
        p_title: "मंडप सजावट",
        p_amount: 1500,
        p_expense_date: "2026-09-28",
      });
    });
  });

  describe("updateExpense", () => {
    it("calls update_expense RPC successfully", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      } as any);

      const res = await updateExpense({
        expenseId: "exp-123",
        title: "फुलांची सजावट",
        amount: 2000,
        expenseDate: "2026-09-28",
      });

      expect(res.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith("update_expense", {
        p_expense_id: "exp-123",
        p_title: "फुलांची सजावट",
        p_amount: 2000,
        p_expense_date: "2026-09-28",
      });
    });
  });

  describe("getEventExpenses", () => {
    it("fetches event expenses and aggregates", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          total_amount: 3500,
          today_amount: 1500,
          count: 2,
          expenses: [
            {
              id: "exp-1",
              title: "मंडप",
              amount: 2000,
              expense_date: "2026-09-27",
              created_by: "u-1",
              created_by_name: "Admin",
              created_at: "2026-09-27T10:00:00Z",
              updated_at: "2026-09-27T10:00:00Z",
            },
          ],
        },
        error: null,
      } as any);

      const res = await getEventExpenses("ev-1");
      expect(res.success).toBe(true);
      expect(res.data?.totalAmount).toBe(3500);
      expect(res.data?.todayAmount).toBe(1500);
      expect(res.data?.count).toBe(2);
      expect(res.data?.expenses.length).toBe(1);
    });
  });
});
