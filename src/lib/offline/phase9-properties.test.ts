// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalReceipt } from "./offline-db";

const {
  supabaseRpcMock,
  getLocalReceiptsMock,
  updateLocalReceiptSyncStateMock,
} = vi.hoisted(() => ({
  supabaseRpcMock: vi.fn(),
  getLocalReceiptsMock: vi.fn(),
  updateLocalReceiptSyncStateMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: supabaseRpcMock,
    from: vi.fn((table: string) => ({
      insert: vi.fn(() => ({
        error: { code: "42501", message: `permission denied for table ${table}` },
      })),
      update: vi.fn(() => ({
        error: { code: "42501", message: `permission denied for table ${table}` },
      })),
      delete: vi.fn(() => ({
        error: { code: "42501", message: `permission denied for table ${table}` },
      })),
    })),
  },
}));

vi.mock("@/lib/offline/offline-db", () => ({
  getLocalReceipts: getLocalReceiptsMock,
  updateLocalReceiptSyncState: updateLocalReceiptSyncStateMock,
}));

vi.mock("./offline-db", () => ({
  getLocalReceipts: getLocalReceiptsMock,
  updateLocalReceiptSyncState: updateLocalReceiptSyncStateMock,
}));

import { syncNextReceipt } from "./receipt-sync";

describe("Phase 9-1: Properties, Buildings, and Collection Follow-Ups Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Suite 1: Direct DML Lockdown on Master & Operational Tables", () => {
    it("rejects direct INSERT on public.buildings from client with PostgreSQL 42501", async () => {
      const { supabase } = await import("@/supabase/client");
      const result = await supabase.from("buildings").insert({ name: "Direct Building" });
      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe("42501");
    });

    it("rejects direct INSERT on public.properties from client with PostgreSQL 42501", async () => {
      const { supabase } = await import("@/supabase/client");
      const result = await supabase.from("properties").insert({ unit_number: "101" });
      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe("42501");
    });

    it("rejects direct INSERT on public.collection_follow_ups from client with PostgreSQL 42501", async () => {
      const { supabase } = await import("@/supabase/client");
      const result = await supabase.from("collection_follow_ups").insert({ status: "pending" });
      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe("42501");
    });
  });

  describe("Suite 2: Master Data RPC Authorization & Multi-Tenant Scoping", () => {
    it("allows organization administrator to create building with valid parameters", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: { success: true, building_id: "bld-1", organization_id: "org-1", name: "Shivam Paradise" },
        error: null,
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("create_building", {
        p_organization_id: "org-1",
        p_name: "Shivam Paradise",
        p_wing: "A",
        p_total_floors: 7,
        p_flats_per_floor: 4,
      });

      expect(res.error).toBeNull();
      expect(res.data?.success).toBe(true);
      expect(res.data?.building_id).toBe("bld-1");
    });

    it("rejects non-admin/volunteer caller attempting create_building", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Unauthorized: Only organization administrators can create buildings" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("create_building", {
        p_organization_id: "org-1",
        p_name: "Unauthorized Building",
      });

      expect(res.error).toBeTruthy();
      expect(res.error?.message).toContain("Only organization administrators can create buildings");
    });

    it("rejects non-admin/volunteer caller attempting create_property", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Unauthorized: Only organization administrators can create properties" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("create_property", {
        p_organization_id: "org-1",
        p_property_type: "residential",
        p_building_id: "bld-1",
        p_unit_number: "101",
      });

      expect(res.error).toBeTruthy();
      expect(res.error?.message).toContain("Only organization administrators can create properties");
    });
  });

  describe("Suite 3: Strict Property-Type Semantics (Residential vs Commercial)", () => {
    it("creates residential property with required building_id and unit_number, ensuring shop_name is null", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: {
          success: true,
          property_id: "prop-res-1",
          organization_id: "org-1",
          property_type: "residential",
          unit_number: "101",
          shop_name: null,
        },
        error: null,
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("create_property", {
        p_organization_id: "org-1",
        p_property_type: "residential",
        p_building_id: "bld-1",
        p_unit_number: "101",
      });

      expect(res.error).toBeNull();
      expect(res.data?.property_type).toBe("residential");
      expect(res.data?.unit_number).toBe("101");
      expect(res.data?.shop_name).toBeNull();
    });

    it("rejects residential property when building_id is omitted", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Building is required for residential properties" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("create_property", {
        p_organization_id: "org-1",
        p_property_type: "residential",
        p_building_id: null,
        p_unit_number: "101",
      });

      expect(res.error?.message).toContain("Building is required for residential properties");
    });

    it("creates commercial property with shop_name, ensuring building_id and unit_number are null", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: {
          success: true,
          property_id: "prop-com-1",
          organization_id: "org-1",
          property_type: "commercial",
          unit_number: null,
          shop_name: "Mahalaxmi Sweets",
        },
        error: null,
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("create_property", {
        p_organization_id: "org-1",
        p_property_type: "commercial",
        p_shop_name: "Mahalaxmi Sweets",
      });

      expect(res.error).toBeNull();
      expect(res.data?.property_type).toBe("commercial");
      expect(res.data?.shop_name).toBe("Mahalaxmi Sweets");
      expect(res.data?.unit_number).toBeNull();
    });

    it("rejects commercial property when building_id is provided", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Building must be null for commercial shops" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("create_property", {
        p_organization_id: "org-1",
        p_property_type: "commercial",
        p_building_id: "bld-1",
        p_shop_name: "Mahalaxmi Sweets",
      });

      expect(res.error?.message).toContain("Building must be null for commercial shops");
    });
  });

  describe("Suite 4: Collection Follow-Up Lifecycle & Auto-Resolution", () => {
    it("allows active volunteer to record follow-up with valid expanded reasons", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: {
          success: true,
          follow_up_id: "fu-1",
          property_id: "prop-1",
          organization_id: "org-1",
          status: "pending",
          reason: "door_locked",
        },
        error: null,
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("record_collection_follow_up", {
        p_event_id: "event-1",
        p_property_id: "prop-1",
        p_reason: "door_locked",
        p_follow_up_time: "Evening after 7 PM",
        p_notes: "Owner requested evening collection",
      });

      expect(res.error).toBeNull();
      expect(res.data?.status).toBe("pending");
      expect(res.data?.reason).toBe("door_locked");
    });

    it("rejects invalid follow-up reason", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid follow-up reason: invalid_reason" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("record_collection_follow_up", {
        p_event_id: "event-1",
        p_property_id: "prop-1",
        p_reason: "invalid_reason",
      });

      expect(res.error?.message).toContain("Invalid follow-up reason");
    });

    it("rejects cross-tenant follow-up attempt when event and property belong to different organizations", async () => {
      supabaseRpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Event and Property belong to different organizations" },
      });

      const { supabase } = await import("@/supabase/client");
      const res = await supabase.rpc("record_collection_follow_up", {
        p_event_id: "event-org-1",
        p_property_id: "prop-org-2",
        p_reason: "not_home",
      });

      expect(res.error?.message).toContain("Event and Property belong to different organizations");
    });

    it("sync_offline_receipt auto-resolves pending follow-up when property_id is provided", async () => {
      const pendingReceipt: LocalReceipt = {
        clientReceiptId: "rec-client-1",
        organizationId: "org-1",
        eventId: "event-1",
        collectionSessionId: "session-1",
        receiptBookId: "book-1",
        volunteerId: "vol-1",
        propertyId: "prop-1",
        receiptNumber: 1001,
        donorName: "Ramesh Shah",
        donorMobile: "9820012345",
        amount: 500,
        paymentMode: "cash",
        paymentReference: null,
        notes: null,
        syncStatus: "pending",
        syncAttempts: 0,
        lastSyncAttemptAt: null,
        lastSyncError: null,
        offlineCreatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      getLocalReceiptsMock.mockResolvedValueOnce([pendingReceipt]);

      supabaseRpcMock.mockResolvedValueOnce({
        data: {
          success: true,
          receipt_id: "server-rec-1",
          receipt_number: 1001,
          client_receipt_id: "rec-client-1",
        },
        error: null,
      });

      const result = await syncNextReceipt("book-1");

      expect(result?.success).toBe(true);
      expect(supabaseRpcMock).toHaveBeenCalledWith("sync_offline_receipt", {
        p_collection_session_id: "session-1",
        p_property_id: "prop-1",
        p_receipt_number: 1001,
        p_donor_name: "Ramesh Shah",
        p_donor_mobile: "9820012345",
        p_amount: 500,
        p_payment_mode: "cash",
        p_payment_reference: null,
        p_notes: null,
        p_client_receipt_id: "rec-client-1",
        p_offline_created_at: pendingReceipt.offlineCreatedAt,
      });

      expect(updateLocalReceiptSyncStateMock).toHaveBeenCalledWith(
        "rec-client-1",
        "synced",
        expect.objectContaining({
          syncAttempts: 1,
          lastSyncError: null,
        })
      );
    });

    it("sync_offline_receipt operates cleanly when property_id is null (backwards-compatible)", async () => {
      const legacyReceipt: LocalReceipt = {
        clientReceiptId: "rec-client-legacy",
        organizationId: "org-1",
        eventId: "event-1",
        collectionSessionId: "session-1",
        receiptBookId: "book-1",
        volunteerId: "vol-1",
        propertyId: null,
        receiptNumber: 1002,
        donorName: "Anonymous Donor",
        donorMobile: null,
        amount: 250,
        paymentMode: "cash",
        paymentReference: null,
        notes: null,
        syncStatus: "pending",
        syncAttempts: 0,
        lastSyncAttemptAt: null,
        lastSyncError: null,
        offlineCreatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      getLocalReceiptsMock.mockResolvedValueOnce([legacyReceipt]);

      supabaseRpcMock.mockResolvedValueOnce({
        data: {
          success: true,
          receipt_id: "server-rec-2",
          receipt_number: 1002,
          client_receipt_id: "rec-client-legacy",
        },
        error: null,
      });

      const result = await syncNextReceipt("book-1");

      expect(result?.success).toBe(true);
      expect(supabaseRpcMock).toHaveBeenCalledWith("sync_offline_receipt", {
        p_collection_session_id: "session-1",
        p_property_id: null,
        p_receipt_number: 1002,
        p_donor_name: "Anonymous Donor",
        p_donor_mobile: null,
        p_amount: 250,
        p_payment_mode: "cash",
        p_payment_reference: null,
        p_notes: null,
        p_client_receipt_id: "rec-client-legacy",
        p_offline_created_at: legacyReceipt.offlineCreatedAt,
      });

      expect(updateLocalReceiptSyncStateMock).toHaveBeenCalledWith(
        "rec-client-legacy",
        "synced",
        expect.objectContaining({
          syncAttempts: 1,
          lastSyncError: null,
        })
      );
    });
  });
});
