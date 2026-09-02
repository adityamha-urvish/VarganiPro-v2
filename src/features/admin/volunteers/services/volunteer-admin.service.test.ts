// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchVolunteers,
  provisionVolunteer,
  resetVolunteerPin,
  setVolunteerStatus,
} from "./volunteer-admin.service";

const { supabaseRpcMock } = vi.hoisted(() => ({
  supabaseRpcMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: supabaseRpcMock,
  },
}));

describe("Phase 9-3B: Volunteer Admin Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchVolunteers calls get_organization_volunteers and maps fields correctly", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: [
        {
          volunteer_id: "vol-1",
          user_id: "user-1",
          full_name: "Rahul Shinde",
          mobile: "9820011223",
          status: "active",
          must_change_pin: true,
          created_at: "2026-08-29T00:00:00Z",
        },
      ],
      error: null,
    });

    const list = await fetchVolunteers("org-1");

    expect(supabaseRpcMock).toHaveBeenCalledWith("get_organization_volunteers", {
      p_organization_id: "org-1",
    });

    expect(list).toEqual([
      {
        volunteerId: "vol-1",
        userId: "user-1",
        fullName: "Rahul Shinde",
        mobile: "9820011223",
        status: "active",
        mustChangePin: true,
        createdAt: "2026-08-29T00:00:00Z",
      },
    ]);
  });

  it("provisionVolunteer returns temporary PIN for new user", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: {
        success: true,
        volunteer_id: "vol-new",
        user_id: "user-new",
        is_new_user: true,
        temporary_pin: "8391",
      },
      error: null,
    });

    const res = await provisionVolunteer("org-1", "Amit Kadam", "9820099887");

    expect(supabaseRpcMock).toHaveBeenCalledWith("provision_volunteer", {
      p_organization_id: "org-1",
      p_full_name: "Amit Kadam",
      p_mobile: "9820099887",
    });

    expect(res).toEqual({
      success: true,
      volunteerId: "vol-new",
      userId: "user-new",
      isNewUser: true,
      temporaryPin: "8391",
    });
  });

  it("provisionVolunteer returns null temporary PIN for existing user", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: {
        success: true,
        volunteer_id: "vol-existing",
        user_id: "user-existing",
        is_new_user: false,
        temporary_pin: null,
      },
      error: null,
    });

    const res = await provisionVolunteer("org-1", "Amit Kadam", "9820099887");

    expect(res).toEqual({
      success: true,
      volunteerId: "vol-existing",
      userId: "user-existing",
      isNewUser: false,
      temporaryPin: null,
    });
  });

  it("resetVolunteerPin calls reset_volunteer_pin RPC", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: {
        success: true,
        temporary_pin: "4421",
      },
      error: null,
    });

    const res = await resetVolunteerPin("vol-1");

    expect(supabaseRpcMock).toHaveBeenCalledWith("reset_volunteer_pin", {
      p_volunteer_id: "vol-1",
    });
    expect(res.temporaryPin).toBe("4421");
  });

  it("setVolunteerStatus calls set_volunteer_status RPC", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: {
        success: true,
        status: "inactive",
      },
      error: null,
    });

    const res = await setVolunteerStatus("vol-1", "inactive");

    expect(supabaseRpcMock).toHaveBeenCalledWith("set_volunteer_status", {
      p_volunteer_id: "vol-1",
      p_status: "inactive",
    });
    expect(res.status).toBe("inactive");
  });
});
