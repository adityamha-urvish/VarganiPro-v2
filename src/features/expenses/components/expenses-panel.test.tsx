// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ExpensesPanel } from "./expenses-panel";
import * as expensesService from "../services/expenses.service";

vi.mock("../services/expenses.service");

describe("ExpensesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders expenses summary and empty state", async () => {
    vi.mocked(expensesService.getEventExpenses).mockResolvedValueOnce({
      success: true,
      data: {
        totalAmount: 0,
        todayAmount: 0,
        count: 0,
        expenses: [],
      },
    });

    render(
      <ExpensesPanel
        eventId="ev-123"
        organizationId="org-123"
        isAdmin={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("उत्सव खर्च / Festival Expenses")).toBeDefined();
      expect(screen.getByTestId("total-expenses-amount").textContent).toContain("0.00");
      expect(screen.getByText("कोणताही खर्च नोंदवलेला नाही")).toBeDefined();
    });
  });

  it("renders list of expenses and hides edit button for volunteer", async () => {
    vi.mocked(expensesService.getEventExpenses).mockResolvedValueOnce({
      success: true,
      data: {
        totalAmount: 2500,
        todayAmount: 2500,
        count: 1,
        expenses: [
          {
            id: "exp-101",
            title: "पूजा साहित्य",
            amount: 2500,
            expense_date: "2026-09-28",
            created_by: "u-1",
            created_by_name: "Tanaji Volunteer",
            created_at: "2026-09-28T01:00:00Z",
            updated_at: "2026-09-28T01:00:00Z",
          },
        ],
      },
    });

    render(
      <ExpensesPanel
        eventId="ev-123"
        organizationId="org-123"
        isAdmin={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("पूजा साहित्य")).toBeDefined();
      expect(screen.getByText("Tanaji Volunteer")).toBeDefined();
      expect(screen.queryByTestId("btn-edit-expense-exp-101")).toBeNull();
    });
  });

  it("shows edit button for admin and opens edit modal", async () => {
    vi.mocked(expensesService.getEventExpenses).mockResolvedValueOnce({
      success: true,
      data: {
        totalAmount: 2500,
        todayAmount: 2500,
        count: 1,
        expenses: [
          {
            id: "exp-101",
            title: "पूजा साहित्य",
            amount: 2500,
            expense_date: "2026-09-28",
            created_by: "u-1",
            created_by_name: "Tanaji Volunteer",
            created_at: "2026-09-28T01:00:00Z",
            updated_at: "2026-09-28T01:00:00Z",
          },
        ],
      },
    });

    render(
      <ExpensesPanel
        eventId="ev-123"
        organizationId="org-123"
        isAdmin={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("btn-edit-expense-exp-101")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("btn-edit-expense-exp-101"));

    await waitFor(() => {
      expect(screen.getByTestId("edit-expense-modal")).toBeDefined();
      expect((screen.getByTestId("input-edit-expense-title") as HTMLInputElement).value).toBe("पूजा साहित्य");
    });
  });
});
