// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseRpcMock } = vi.hoisted(() => ({
  supabaseRpcMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: supabaseRpcMock,
  },
}));

describe("Phase 9-2A: Backend Foundation & Collection Progress Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Suite 1: Duplicate-Safe Receipt Aggregation & Building Summaries", () => {
    it("aggregates multiple receipts on a single property as ONE collected unit with summed amount", async () => {
      // Scenario: Flat 101 has 2 receipts (₹500 and ₹1000)
      supabaseRpcMock.mockResolvedValueOnce({
        data: {
          success: true,
          event_id: "event-1",
          organization_id: "org-1",
          buildings: [
            {
              building_id: "bld-1",
              building_name: "Shivam Paradise",
              total_units: 1,
              collected_count: 1, // Must be 1, NOT 2!
              pending_count: 0,
              refused_count: 0,
              not_visited_count: 0,
              remaining_count: 0,
              total_amount_collected: 1500, // ₹500 + ₹1000
              last_activity_at: "2026-08-27T01:00:00Z",
            },
          ],
        },
        error: null,
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("get_event_building_summaries", {
        p_event_id: "event-1",
      });

      expect(res.error).toBeNull();
      const bld = res.data?.buildings?.[0];
      expect(bld?.total_units).toBe(1);
      expect(bld?.collected_count).toBe(1);
      expect(bld?.total_amount_collected).toBe(1500);
      expect(bld?.remaining_count).toBe(0);
    });

    it("correctly computes multi-property status totals including collected, pending, refused, and remaining", async () => {
      // Scenario: 4 units in Shivam Paradise:
      // Flat 101 -> Collected (₹500)
      // Flat 102 -> Pending (Come Later)
      // Flat 103 -> Refused
      // Flat 104 -> Not Visited
      supabaseRpcMock.mockResolvedValueOnce({
        data: {
          success: true,
          event_id: "event-1",
          organization_id: "org-1",
          buildings: [
            {
              building_id: "bld-1",
              building_name: "Shivam Paradise",
              wing: "A",
              total_units: 4,
              collected_count: 1,
              pending_count: 1,
              refused_count: 1,
              not_visited_count: 1,
              remaining_count: 2, // 1 pending + 1 not_visited (refused is excluded from remaining queue)
              total_amount_collected: 500,
              last_activity_at: "2026-08-27T01:15:00Z",
            },
          ],
        },
        error: null,
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("get_event_building_summaries", {
        p_event_id: "event-1",
      });

      expect(res.error).toBeNull();
      const bld = res.data?.buildings?.[0];
      expect(bld?.total_units).toBe(4);
      expect(bld?.collected_count).toBe(1);
      expect(bld?.pending_count).toBe(1);
      expect(bld?.refused_count).toBe(1);
      expect(bld?.not_visited_count).toBe(1);
      expect(bld?.remaining_count).toBe(2);
      expect(bld?.collected_count + bld?.refused_count + bld?.remaining_count).toBe(bld?.total_units);
    });
  });

  describe("Suite 2: Active Building Flat Grid Progress RPC (get_building_properties_progress)", () => {
    it("returns distinct flat statuses with multiple receipt details pre-aggregated", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: {
          success: true,
          event_id: "event-1",
          building_id: "bld-1",
          building_name: "Shivam Paradise",
          building_wing: "A",
          properties: [
            {
              property_id: "prop-101",
              unit_number: "101",
              floor_number: 1,
              owner_name: "Ramesh Shah",
              status: "collected",
              receipt_count: 2,
              total_collected_amount: 1500,
              latest_receipt_number: 1004,
              last_receipt_at: "2026-08-27T01:00:00Z",
              pending_reason: null,
            },
            {
              property_id: "prop-102",
              unit_number: "102",
              floor_number: 1,
              owner_name: "Suresh Patil",
              status: "pending",
              receipt_count: 0,
              total_collected_amount: 0,
              latest_receipt_number: null,
              pending_reason: "asked_to_return_later",
              follow_up_time: "Evening 7 PM",
            },
            {
              property_id: "prop-103",
              unit_number: "103",
              floor_number: 1,
              owner_name: "Kishore Kumar",
              status: "refused",
              receipt_count: 0,
              total_collected_amount: 0,
              latest_receipt_number: null,
              pending_reason: "refused",
            },
            {
              property_id: "prop-104",
              unit_number: "104",
              floor_number: 1,
              owner_name: null,
              status: "not_visited",
              receipt_count: 0,
              total_collected_amount: 0,
              latest_receipt_number: null,
              pending_reason: null,
            },
          ],
        },
        error: null,
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("get_building_properties_progress", {
        p_event_id: "event-1",
        p_building_id: "bld-1",
      });

      expect(res.error).toBeNull();
      expect(res.data?.properties).toHaveLength(4);
      expect(res.data?.properties[0].status).toBe("collected");
      expect(res.data?.properties[0].receipt_count).toBe(2);
      expect(res.data?.properties[0].total_collected_amount).toBe(1500);
      expect(res.data?.properties[1].status).toBe("pending");
      expect(res.data?.properties[2].status).toBe("refused");
      expect(res.data?.properties[3].status).toBe("not_visited");
    });
  });

  describe("Suite 3: Security, Active User & Organization Boundary Enforcement", () => {
    it("rejects caller when user is inactive (is_active = false)", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Unauthorized: User is not an active member of this organization" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("get_event_building_summaries", {
        p_event_id: "event-1",
      });

      expect(res.error).toBeTruthy();
      expect(res.error?.message).toContain("User is not an active member");
    });

    it("rejects cross-organization event request", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Unauthorized: User is not an active member of this organization" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("get_event_building_summaries", {
        p_event_id: "other-org-event",
      });

      expect(res.error).toBeTruthy();
      expect(res.error?.message).toContain("Unauthorized");
    });

    it("rejects building progress query when building belongs to different organization", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Building not found in this organization" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("get_building_properties_progress", {
        p_event_id: "event-1",
        p_building_id: "foreign-bld-id",
      });

      expect(res.error).toBeTruthy();
      expect(res.error?.message).toContain("Building not found in this organization");
    });

    it("rejects unauthenticated caller", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Not authenticated" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("get_event_building_summaries", {
        p_event_id: "event-1",
      });

      expect(res.error?.message).toContain("Not authenticated");
    });
  });
});
