// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerMandalAndAdmin } from "./onboarding.service";

const { supabaseRpcMock, loginMock } = vi.hoisted(() => ({
  supabaseRpcMock: vi.fn(),
  loginMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: supabaseRpcMock,
  },
}));

vi.mock("@/features/auth/services/auth.service", () => ({
  login: loginMock,
}));

describe("Phase 9-3B: Onboarding Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("calls register_mandal_and_admin and auto-logs in newly registered admin", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: {
        success: true,
        organization_id: "org-123",
        user_id: "user-123",
        event_id: "event-123",
        mandal_name: "Shree Shivam Mandal",
      },
      error: null,
    });

    loginMock.mockResolvedValueOnce({
      id: "user-123",
      name: "Sunil Patil",
      mobile: "9876543210",
      role: "admin",
      isActive: true,
    });

    const result = await registerMandalAndAdmin({
      mandalName: "Shree Shivam Mandal",
      adminName: "Sunil Patil",
      mobile: "9876543210",
      pin: "1234",
    });

    expect(supabaseRpcMock).toHaveBeenCalledWith("register_mandal_and_admin", {
      p_mandal_name: "Shree Shivam Mandal",
      p_admin_name: "Sunil Patil",
      p_mobile: "9876543210",
      p_pin: "1234",
    });

    expect(loginMock).toHaveBeenCalledWith({
      mobile: "9876543210",
      pin: "1234",
    });

    expect(result).toEqual({
      success: true,
      organizationId: "org-123",
      userId: "user-123",
      eventId: "event-123",
      mandalName: "Shree Shivam Mandal",
    });

    expect(localStorage.getItem("vp_user")).toContain("Sunil Patil");
  });

  it("throws error if RPC returns an error", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Enter a valid 10-digit mobile number" },
    });

    await expect(
      registerMandalAndAdmin({
        mandalName: "Shree Shivam Mandal",
        adminName: "Sunil Patil",
        mobile: "123",
        pin: "1234",
      })
    ).rejects.toThrow("Enter a valid 10-digit mobile number");
  });
});
