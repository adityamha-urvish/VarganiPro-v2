// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RoleNavigation } from "./RoleNavigation";

describe("Phase 9-3A: Role-Based Navigation & Shell Structure", () => {
  afterEach(() => {
    cleanup();
  });
  it("Test 1 — Volunteer navigation: renders volunteer tabs and excludes admin-only tab", () => {
    const onTabChangeMock = vi.fn();

    render(
      <RoleNavigation
        activeTab="collection"
        onTabChange={onTabChangeMock}
        isAdmin={false}
        pendingSyncCount={0}
      />
    );

    // Volunteer tabs
    expect(screen.getAllByText("Collection").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Receipts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Handover").length).toBeGreaterThan(0);

    // Admin-only tab must NOT exist
    expect(screen.queryByText("Admin & More")).toBeNull();

    // Volunteer role badge
    expect(screen.getByText("👤 Collection Volunteer")).toBeTruthy();
  });

  it("Test 2 — Admin/Secretary navigation: renders admin tabs including Handovers and Admin & More", () => {
    const onTabChangeMock = vi.fn();

    render(
      <RoleNavigation
        activeTab="collection"
        onTabChange={onTabChangeMock}
        isAdmin={true}
        pendingSyncCount={3}
      />
    );

    // Admin tabs
    expect(screen.getAllByText("Collection").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Volunteers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Buildings & Shops").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Handovers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Receipts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admin & More").length).toBeGreaterThan(0);

    // Admin role badge
    expect(screen.getByText("👑 Mandal Secretary / Admin")).toBeTruthy();

    // Pending sync badge
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("Test 3 — Tab switching: triggers onTabChange when a navigation tab is clicked", () => {
    const onTabChangeMock = vi.fn();

    render(
      <RoleNavigation
        activeTab="collection"
        onTabChange={onTabChangeMock}
        isAdmin={true}
        pendingSyncCount={0}
      />
    );

    const handoverButton = screen.getByTestId("nav-tab-handovers");
    fireEvent.click(handoverButton);

    expect(onTabChangeMock).toHaveBeenCalledWith("handovers");
  });
});
