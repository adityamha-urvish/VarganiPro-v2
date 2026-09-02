// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  signOutMock,
  mockNavigate,
  getPendingReceiptsForOwnerMock,
} = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  mockNavigate: vi.fn(),
  getPendingReceiptsForOwnerMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: signOutMock,
    },
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/lib/offline/offline-db", () => ({
  getPendingReceiptsForOwner: getPendingReceiptsForOwnerMock,
}));

import { AppLayout } from "./AppLayout";

describe("AppLayout logout behavior & pending receipt safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getPendingReceiptsForOwnerMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("Test 2 — Logout with no pending receipts: calls signOut and navigates normally", async () => {
    localStorage.setItem("vp_user", JSON.stringify({ id: "user-1", name: "Volunteer" }));
    signOutMock.mockResolvedValueOnce({ error: null });
    getPendingReceiptsForOwnerMock.mockResolvedValueOnce([]);

    render(
      <AppLayout>
        <div>Dashboard Content</div>
      </AppLayout>
    );

    expect(screen.getByText("Dashboard Content")).toBeTruthy();
    expect(screen.getByText("🛕 VarganiPro")).toBeTruthy();

    const logoutButton = screen.getByRole("button", { name: "Logout" });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.getItem("vp_user")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(screen.queryByText("Pending receipts found")).toBeNull();
  });

  it("Test 3 — Logout with pending receipts — cancellation: cancels logout and keeps user on dashboard", async () => {
    localStorage.setItem("vp_user", JSON.stringify({ id: "user-1", name: "Volunteer" }));
    getPendingReceiptsForOwnerMock.mockResolvedValueOnce([
      { clientReceiptId: "rec-1", syncStatus: "pending" },
      { clientReceiptId: "rec-2", syncStatus: "pending" },
    ]);

    render(
      <AppLayout>
        <div>Dashboard Content</div>
      </AppLayout>
    );

    const logoutButton = screen.getByRole("button", { name: "Logout" });
    fireEvent.click(logoutButton);

    // Warning dialog appears
    expect(await screen.findByText("Pending receipts found")).toBeTruthy();
    expect(screen.getByText(/You have 2 receipts that haven't been synchronized yet/)).toBeTruthy();

    // User clicks Cancel
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    // Dialog closes
    await waitFor(() => {
      expect(screen.queryByText("Pending receipts found")).toBeNull();
    });

    // No signOut occurred
    expect(signOutMock).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(localStorage.getItem("vp_user")).not.toBeNull();
  });

  it("Test 4 — Logout with pending receipts — preserve data: confirms logout and preserves offline data", async () => {
    localStorage.setItem("vp_user", JSON.stringify({ id: "user-1", name: "Volunteer" }));
    signOutMock.mockResolvedValueOnce({ error: null });
    getPendingReceiptsForOwnerMock.mockResolvedValueOnce([
      { clientReceiptId: "rec-1", syncStatus: "pending" },
    ]);

    render(
      <AppLayout>
        <div>Dashboard Content</div>
      </AppLayout>
    );

    const logoutButton = screen.getByRole("button", { name: "Logout" });
    fireEvent.click(logoutButton);

    // Warning dialog appears
    expect(await screen.findByText("Pending receipts found")).toBeTruthy();

    // User chooses "Logout & Keep Pending Receipts"
    const confirmLogoutButton = screen.getByRole("button", {
      name: "Logout & Keep Pending Receipts",
    });
    fireEvent.click(confirmLogoutButton);

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.getItem("vp_user")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("handles supabase.auth.signOut error gracefully and still clears local user state and navigates", async () => {
    localStorage.setItem("vp_user", JSON.stringify({ id: "user-1", name: "Volunteer" }));
    signOutMock.mockResolvedValueOnce({
      error: { message: "Network error during sign out" },
    });

    render(
      <AppLayout>
        <div>Dashboard Content</div>
      </AppLayout>
    );

    const logoutButton = screen.getByRole("button", { name: "Logout" });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.getItem("vp_user")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("handles unexpected thrown error in signOut safely and still completes teardown", async () => {
    localStorage.setItem("vp_user", JSON.stringify({ id: "user-1", name: "Volunteer" }));
    signOutMock.mockRejectedValueOnce(new Error("Connection aborted"));

    render(
      <AppLayout>
        <div>Dashboard Content</div>
      </AppLayout>
    );

    const logoutButton = screen.getByRole("button", { name: "Logout" });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.getItem("vp_user")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
