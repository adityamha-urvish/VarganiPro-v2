export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  expense_date: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSummary {
  totalAmount: number;
  todayAmount: number;
  count: number;
  expenses: ExpenseItem[];
}
