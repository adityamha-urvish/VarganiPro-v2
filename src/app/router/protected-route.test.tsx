// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";

const {
  getSessionMock,
  onAuthStateChangeMock,
  mockNavigate,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => {
      mockNavigate(to);
      return <div>Navigated to {to}</div>;
    },
  };
});

import { ProtectedRoute } from "./router";

describe("ProtectedRoute authentication validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders children when a valid Supabase session exists", async () => {
    const mockSession = {
      access_token: "valid-token",
      user: { id: "user-123" },
    } as unknown as Session;

    getSessionMock.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText("Protected Content")).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("redirects to '/' when no Supabase session exists", async () => {
    getSessionMock.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText("Navigated to /")).toBeTruthy();
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("clears stale vp_user in localStorage and redirects when no Supabase session exists", async () => {
    localStorage.setItem("vp_user", JSON.stringify({ id: "stale-user" }));

    getSessionMock.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText("Navigated to /")).toBeTruthy();
    expect(localStorage.getItem("vp_user")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("shows loading state while getSession is resolving and does not prematurely redirect", async () => {
    let resolveSessionPromise: (val: unknown) => void;
    const sessionPromise = new Promise((resolve) => {
      resolveSessionPromise = resolve;
    });

    getSessionMock.mockReturnValueOnce(sessionPromise);

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Checking authentication...")).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();

    // Now resolve with valid session
    resolveSessionPromise!({
      data: {
        session: { access_token: "token", user: { id: "user-1" } },
      },
      error: null,
    });

    expect(await screen.findByText("Protected Content")).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("handles authStateChange event when user logs out or session is invalidated", async () => {
    let authStateCallback: (event: string, session: Session | null) => void = () => {};

    onAuthStateChangeMock.mockImplementation((cb) => {
      authStateCallback = cb;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      };
    });

    const mockSession = {
      access_token: "valid-token",
      user: { id: "user-123" },
    } as unknown as Session;

    getSessionMock.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText("Protected Content")).toBeTruthy();

    // Trigger SIGNED_OUT event from Supabase
    authStateCallback("SIGNED_OUT", null);

    expect(await screen.findByText("Navigated to /")).toBeTruthy();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
