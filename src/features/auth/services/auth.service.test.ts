// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, logout } from "./auth.service";
import { supabase } from "@/supabase/client";

vi.mock("@/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      setSession: vi.fn(),
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe("auth.service - login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("extracts specific error message from FunctionsHttpError context", async () => {
    const mockResponse = new Response(
      JSON.stringify({ error: "Invalid mobile number or PIN" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );

    const mockHttpError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: mockHttpError as any,
    });

    await expect(
      login({ mobile: "9876543210", pin: "0000" })
    ).rejects.toThrow("Invalid mobile number or PIN");
  });

  it("extracts rate limit lockout message from FunctionsHttpError context", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "Too many failed attempts. Please try again later.",
        locked_until: "2026-09-30T14:00:00Z",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );

    const mockHttpError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: mockHttpError as any,
    });

    await expect(
      login({ mobile: "9876543210", pin: "0000" })
    ).rejects.toThrow("Too many failed attempts. Please try again later.");
  });

  it("successfully sets session and returns user on valid credentials", async () => {
    const mockUser = {
      id: "usr-123",
      name: "Aditya Patil",
      mobile: "9876543210",
      role: "volunteer",
    };

    const mockSession = {
      access_token: "jwt-token-abc",
      refresh_token: "refresh-token-xyz",
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "auth-123" },
    };

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    vi.mocked(supabase.auth.setSession).mockResolvedValueOnce({
      data: { session: mockSession as any, user: mockSession.user as any },
      error: null,
    });

    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: "auth-123" } as any },
      error: null,
    });

    const user = await login({ mobile: "9876543210", pin: "1234" });

    expect(user).toEqual(mockUser);
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: "jwt-token-abc",
      refresh_token: "refresh-token-xyz",
    });
  });

  it("clears localStorage on logout", async () => {
    localStorage.setItem("vp_user", JSON.stringify({ id: "1" }));
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null });

    await logout();

    expect(localStorage.getItem("vp_user")).toBeNull();
  });
});
