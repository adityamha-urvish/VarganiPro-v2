import { supabase } from "@/supabase/client";
import type { ExpenseSummary, ExpenseItem } from "../types/expenses.types";

export interface CreateExpenseInput {
  eventId: string;
  title: string;
  amount: number;
  expenseDate?: string;
}

export interface UpdateExpenseInput {
  expenseId: string;
  title: string;
  amount: number;
  expenseDate?: string;
}

/**
 * Creates a new expense record for the festival event (Volunteer or Admin).
 */
export async function createExpense(
  input: CreateExpenseInput
): Promise<{ success: boolean; expenseId?: string; error?: string }> {
  try {
    const cleanTitle = input.title.trim();
    if (cleanTitle.length < 2) {
      return { success: false, error: "खर्चाचे नाव किमान २ अक्षरांचे असावे (Title must be at least 2 characters)" };
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: "रक्कम ० पेक्षा जास्त असावी (Amount must be greater than zero)" };
    }

    const { data, error } = await supabase.rpc("create_expense", {
      p_event_id: input.eventId,
      p_title: cleanTitle,
      p_amount: input.amount,
      p_expense_date: input.expenseDate || new Date().toISOString().split("T")[0],
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      expenseId: data?.expense_id,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Updates an existing expense record (Admin only).
 */
export async function updateExpense(
  input: UpdateExpenseInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanTitle = input.title.trim();
    if (cleanTitle.length < 2) {
      return { success: false, error: "खर्चाचे नाव किमान २ अक्षरांचे असावे (Title must be at least 2 characters)" };
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: "रक्कम ० पेक्षा जास्त असावी (Amount must be greater than zero)" };
    }

    const { error } = await supabase.rpc("update_expense", {
      p_expense_id: input.expenseId,
      p_title: cleanTitle,
      p_amount: input.amount,
      p_expense_date: input.expenseDate || new Date().toISOString().split("T")[0],
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Fetches all expenses and aggregate totals for an event (Volunteer or Admin).
 */
export async function getEventExpenses(
  eventId: string
): Promise<{ success: boolean; data?: ExpenseSummary; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("get_event_expenses", {
      p_event_id: eventId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const summary: ExpenseSummary = {
      totalAmount: Number(data?.total_amount || 0),
      todayAmount: Number(data?.today_amount || 0),
      count: Number(data?.count || 0),
      expenses: (data?.expenses || []) as ExpenseItem[],
    };

    return { success: true, data: summary };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
