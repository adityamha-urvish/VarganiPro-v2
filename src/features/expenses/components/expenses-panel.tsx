import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ExpenseItem, ExpenseSummary } from "../types/expenses.types";
import {
  createExpense,
  updateExpense,
  getEventExpenses,
} from "../services/expenses.service";

export interface ExpensesPanelProps {
  eventId: string | null;
  organizationId: string | null;
  isAdmin: boolean;
}

export function ExpensesPanel({
  eventId,
  organizationId: _organizationId,
  isAdmin,
}: ExpensesPanelProps) {
  const [summary, setSummary] = useState<ExpenseSummary>({
    totalAmount: 0,
    todayAmount: 0,
    count: 0,
    expenses: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Add Expense Dialog state
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [addTitle, setAddTitle] = useState<string>("");
  const [addAmount, setAddAmount] = useState<string>("");
  const [addDate, setAddDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [addSaving, setAddSaving] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Expense Dialog state (Admin only)
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editSaving, setEditSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await getEventExpenses(eventId);
    if (res.success && res.data) {
      setSummary(res.data);
    } else {
      setError(res.error || "Failed to load expenses");
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) return;

    const parsedAmount = Number(addAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setAddError("कृपया वैध रक्कम प्रविष्ट करा (Enter a valid amount > 0)");
      return;
    }

    setAddSaving(true);
    setAddError(null);

    const res = await createExpense({
      eventId,
      title: addTitle.trim(),
      amount: parsedAmount,
      expenseDate: addDate,
    });

    if (res.success) {
      setAddTitle("");
      setAddAmount("");
      setAddDate(new Date().toISOString().split("T")[0]);
      setIsAddOpen(false);
      void loadExpenses();
    } else {
      setAddError(res.error || "खर्च नोंदवताना त्रुटी आली (Failed to create expense)");
    }
    setAddSaving(false);
  }

  function handleOpenEdit(exp: ExpenseItem) {
    if (!isAdmin) return;
    setEditingExpense(exp);
    setEditTitle(exp.title);
    setEditAmount(String(exp.amount));
    setEditDate(exp.expense_date);
    setEditError(null);
  }

  async function handleUpdateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!editingExpense) return;

    const parsedAmount = Number(editAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setEditError("कृपया वैध रक्कम प्रविष्ट करा (Enter a valid amount > 0)");
      return;
    }

    setEditSaving(true);
    setEditError(null);

    const res = await updateExpense({
      expenseId: editingExpense.id,
      title: editTitle.trim(),
      amount: parsedAmount,
      expenseDate: editDate,
    });

    if (res.success) {
      setEditingExpense(null);
      void loadExpenses();
    } else {
      setEditError(res.error || "खर्च बदलताना त्रुटी आली (Failed to update expense)");
    }
    setEditSaving(false);
  }

  return (
    <div data-testid="expenses-panel" className="space-y-6 pb-12">
      {/* -------------------------------------------------------------
          1. HEADER & SUMMARY METRICS
      -------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">💸</span>
            <h2 className="text-xl font-black text-foreground">
              उत्सव खर्च / Festival Expenses
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            उत्सवातील सर्व खर्चांची अचूक नोंद व हिशोब
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadExpenses()}
            disabled={loading}
            className="h-9 text-xs font-semibold cursor-pointer"
          >
            ↻ Refresh
          </Button>

          <Button
            type="button"
            size="sm"
            data-testid="btn-add-expense"
            onClick={() => {
              setAddError(null);
              setIsAddOpen(true);
            }}
            className="h-9 text-xs font-bold shadow-xs cursor-pointer"
          >
            ➕ Add Expense / नवीन खर्च
          </Button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* TOTAL EXPENSES */}
        <div data-testid="card-total-expenses" className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1">
          <p className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
            एकूण खर्च / Total Expenses
          </p>
          <p
            data-testid="total-expenses-amount"
            className="text-2xl sm:text-3xl font-black text-rose-950 dark:text-rose-100"
          >
            ₹{summary.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            या महोत्सवातील सर्व नोंदींचा एकूण खर्च
          </p>
        </div>

        {/* TODAY'S EXPENSES */}
        <div data-testid="card-today-expenses" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
            आजचा खर्च / Today's Expenses
          </p>
          <p
            data-testid="today-expenses-amount"
            className="text-2xl sm:text-3xl font-black text-amber-950 dark:text-amber-100"
          >
            ₹{summary.todayAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            आजच्या तारखेला झालेला एकूण खर्च
          </p>
        </div>

        {/* EXPENSES COUNT */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            खर्च नोंदी / Total Entries
          </p>
          <p
            data-testid="expenses-count"
            className="text-2xl sm:text-3xl font-black text-foreground"
          >
            {summary.count}
          </p>
          <p className="text-[11px] text-muted-foreground">
            नोंदवलेल्या एकूण खर्चांच्या पावत्या / नोंदी
          </p>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* -------------------------------------------------------------
          2. EXPENSES LIST
      -------------------------------------------------------------- */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">
          खर्चाची यादी / Expense Entries ({summary.expenses.length})
        </h3>

        {loading ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-xs text-muted-foreground font-medium">
            खर्च लोड होत आहेत... (Loading expenses...)
          </div>
        ) : summary.expenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center space-y-2">
            <span className="text-3xl">🧾</span>
            <h4 className="text-sm font-bold text-foreground">
              कोणताही खर्च नोंदवलेला नाही
            </h4>
            <p className="text-xs text-muted-foreground">
              No expenses recorded yet. Tap "Add Expense" to record a new entry.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card overflow-hidden shadow-xs divide-y">
            {summary.expenses.map((exp) => (
              <div
                key={exp.id}
                data-testid={`expense-row-${exp.id}`}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">
                      {exp.title}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                      {exp.expense_date}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    नोंदवणारे: <span className="font-medium text-foreground">{exp.created_by_name}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0">
                  <div className="text-left sm:text-right">
                    <span className="text-base font-black text-rose-600 dark:text-rose-400">
                      ₹{Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`btn-edit-expense-${exp.id}`}
                      onClick={() => handleOpenEdit(exp)}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer shrink-0"
                    >
                      ✏️ Edit
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
          3. ADD EXPENSE MODAL
      -------------------------------------------------------------- */}
      {isAddOpen && (
        <div
          data-testid="add-expense-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-black text-foreground">
                  नवीन खर्च नोंदवा / Add Expense
                </h3>
                <p className="text-xs text-muted-foreground">
                  उत्सवातील कोणत्याही खर्चाची तात्काळ नोंद करा
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-muted-foreground hover:text-foreground text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  खर्चाचे नाव / Title <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="उदा. फुलांची सजावट, मंडप साहित्य, चहा-पाणी"
                  data-testid="input-expense-title"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    रक्कम (₹) / Amount <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="500"
                    data-testid="input-expense-amount"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="text-xs h-9 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    दिनांक / Date <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="date"
                    required
                    data-testid="input-expense-date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {addError && (
                <p className="text-xs text-rose-600 font-medium">{addError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 h-10 text-xs font-semibold cursor-pointer"
                >
                  रद्द करा / Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={addSaving}
                  data-testid="btn-save-expense"
                  className="flex-1 h-10 text-xs font-bold cursor-pointer"
                >
                  {addSaving ? "Saving..." : "✓ जतन करा / Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          4. EDIT EXPENSE MODAL (ADMIN ONLY)
      -------------------------------------------------------------- */}
      {editingExpense && isAdmin && (
        <div
          data-testid="edit-expense-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-black text-foreground">
                  खर्च दुरुस्त करा / Edit Expense
                </h3>
                <p className="text-xs text-muted-foreground">
                  Admin authorization required
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-muted-foreground hover:text-foreground text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateExpense} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  खर्चाचे नाव / Title <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  data-testid="input-edit-expense-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    रक्कम (₹) / Amount <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    data-testid="input-edit-expense-amount"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="text-xs h-9 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    दिनांक / Date <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="date"
                    required
                    data-testid="input-edit-expense-date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {editError && (
                <p className="text-xs text-rose-600 font-medium">{editError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 h-10 text-xs font-semibold cursor-pointer"
                >
                  रद्द करा / Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={editSaving}
                  data-testid="btn-update-expense"
                  className="flex-1 h-10 text-xs font-bold cursor-pointer"
                >
                  {editSaving ? "Saving..." : "✓ बदल जतन करा / Update"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
