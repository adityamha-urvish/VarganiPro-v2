// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBuilding,
  createResidentialFlat,
  createStandaloneShop,
} from "./master-data.service";

const { supabaseRpcMock, supabaseFromMock } = vi.hoisted(() => ({
  supabaseRpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  supabase: {
    rpc: supabaseRpcMock,
    from: supabaseFromMock,
  },
}));

describe("Phase 9-3B: Master Data Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createBuilding calls create_building RPC with correct parameters", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: { success: true, building_id: "bld-1" },
      error: null,
    });

    const res = await createBuilding({
      organizationId: "org-1",
      name: "Shivam Residency",
      code: "SHIV-A",
      wing: "Wing A",
      areaName: "Sector 19",
    });

    expect(supabaseRpcMock).toHaveBeenCalledWith("create_building", {
      p_organization_id: "org-1",
      p_name: "Shivam Residency",
      p_code: "SHIV-A",
      p_area_name: "Sector 19",
      p_wing: "Wing A",
    });
    expect(res.buildingId).toBe("bld-1");
  });

  it("createResidentialFlat calls create_property RPC with residential type and building_id", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: { success: true, property_id: "prop-1" },
      error: null,
    });

    const res = await createResidentialFlat({
      organizationId: "org-1",
      buildingId: "bld-1",
      unitNumber: "101",
      floorNumber: 1,
      ownerName: "Rajesh Patil",
      contactMobile: "9820011223",
    });

    expect(supabaseRpcMock).toHaveBeenCalledWith("create_property", {
      p_organization_id: "org-1",
      p_property_type: "residential",
      p_building_id: "bld-1",
      p_unit_number: "101",
      p_shop_name: null,
      p_owner_name: "Rajesh Patil",
      p_contact_mobile: "9820011223",
      p_floor_number: 1,
    });
    expect(res.propertyId).toBe("prop-1");
  });

  it("createStandaloneShop calls create_property RPC with commercial type and NULL building_id", async () => {
    supabaseRpcMock.mockResolvedValueOnce({
      data: { success: true, property_id: "shop-1" },
      error: null,
    });

    const res = await createStandaloneShop({
      organizationId: "org-1",
      shopName: "Om Sai Medical",
      ownerName: "Mahesh Shah",
      contactMobile: "9820055555",
    });

    expect(supabaseRpcMock).toHaveBeenCalledWith("create_property", {
      p_organization_id: "org-1",
      p_property_type: "commercial",
      p_building_id: null,
      p_unit_number: null,
      p_shop_name: "Om Sai Medical",
      p_owner_name: "Mahesh Shah",
      p_contact_mobile: "9820055555",
      p_floor_number: null,
    });
    expect(res.propertyId).toBe("shop-1");
  });
});
