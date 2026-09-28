import { supabase } from "@/supabase/client";

export interface BuildingRecord {
  id: string;
  organizationId: string;
  name: string;
  code?: string | null;
  areaName?: string | null;
  wing?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PropertyRecord {
  id: string;
  organizationId: string;
  buildingId?: string | null;
  propertyType: "residential" | "commercial";
  unitNumber?: string | null;
  flatNumber?: string | null;
  shopName?: string | null;
  floorNumber?: number | null;
  ownerName?: string | null;
  contactMobile?: string | null;
  locationNote?: string | null;
  receiptCount?: number;
  totalCollectedAmount?: number;
  latestReceiptNumber?: number | null;
  lastReceiptAt?: string | null;
  status?: "collected" | "pending" | "refused" | "unvisited";
  followUpReason?: string | null;
  followUpTime?: string | null;
  isActive: boolean;
  createdAt: string;
}

export async function fetchOrganizationBuildings(
  organizationId: string
): Promise<BuildingRecord[]> {
  const { data, error } = await supabase
    .from("buildings")
    .select("id, organization_id, name, code, area_name, wing, is_active, created_at")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchOrganizationBuildings error:", error);
    throw new Error(error.message || "Failed to load buildings");
  }

  return (data || []).map((b: any) => ({
    id: b.id,
    organizationId: b.organization_id,
    name: b.name,
    code: b.code,
    areaName: b.area_name,
    wing: b.wing,
    isActive: b.is_active ?? true,
    createdAt: b.created_at,
  }));
}

export async function createBuilding(params: {
  organizationId: string;
  name: string;
  code?: string;
  areaName?: string;
  wing?: string;
}): Promise<{ buildingId: string }> {
  const { data, error } = await supabase.rpc("create_building", {
    p_organization_id: params.organizationId,
    p_name: params.name.trim(),
    p_code: params.code?.trim() || null,
    p_area_name: params.areaName?.trim() || null,
    p_wing: params.wing?.trim() || null,
  });

  if (error) {
    console.error("createBuilding error:", error);
    throw new Error(error.message || "Failed to create building");
  }

  return {
    buildingId: data.building_id,
  };
}

export async function fetchBuildingProperties(
  buildingId: string
): Promise<PropertyRecord[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, organization_id, building_id, property_type, unit_number, flat_number, shop_name, floor_number, owner_name, contact_mobile, location_note, is_active, created_at"
    )
    .eq("building_id", buildingId)
    .order("unit_number", { ascending: true });

  if (error) {
    console.error("fetchBuildingProperties error:", error);
    throw new Error(error.message || "Failed to load properties");
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    organizationId: p.organization_id,
    buildingId: p.building_id,
    propertyType: p.property_type,
    unitNumber: p.unit_number ?? p.flat_number,
    flatNumber: p.flat_number,
    shopName: p.shop_name,
    floorNumber: p.floor_number,
    ownerName: p.owner_name,
    contactMobile: p.contact_mobile,
    locationNote: p.location_note,
    isActive: p.is_active ?? true,
    createdAt: p.created_at,
  }));
}

export async function quickAddBuilding(params: {
  organizationId: string;
  name: string;
  wing?: string;
}): Promise<{ buildingId: string; buildingName: string; wing: string | null; code: string }> {
  const { data, error } = await supabase.rpc("quick_add_building", {
    p_organization_id: params.organizationId,
    p_name: params.name.trim(),
    p_wing: params.wing?.trim() || null,
  });

  if (error) {
    console.error("quickAddBuilding error:", error);
    throw new Error(error.message || "Failed to add building");
  }

  return {
    buildingId: data.building_id,
    buildingName: data.building_name,
    wing: data.wing,
    code: data.code,
  };
}

export async function quickAddFlat(params: {
  buildingId: string;
  unitNumber: string;
  floorNumber?: number | null;
  ownerName?: string;
  contactMobile?: string;
}): Promise<{ propertyId: string; isExisting?: boolean; unitNumber: string }> {
  const { data, error } = await supabase.rpc("quick_add_flat", {
    p_building_id: params.buildingId,
    p_unit_number: params.unitNumber.trim(),
    p_floor_number: params.floorNumber ?? null,
    p_owner_name: params.ownerName?.trim() || null,
    p_contact_mobile: params.contactMobile?.trim() || null,
  });

  if (error) {
    console.error("quickAddFlat error:", error);
    throw new Error(error.message || "Failed to add flat");
  }

  return {
    propertyId: data.property_id,
    isExisting: data.is_existing,
    unitNumber: data.unit_number,
  };
}

export async function createResidentialFlat(params: {
  organizationId: string;
  buildingId: string;
  unitNumber: string;
  floorNumber?: number;
  ownerName?: string;
  contactMobile?: string;
}): Promise<{ propertyId: string }> {
  const { data, error } = await supabase.rpc("create_property", {
    p_organization_id: params.organizationId,
    p_property_type: "residential",
    p_building_id: params.buildingId,
    p_unit_number: params.unitNumber.trim(),
    p_shop_name: null,
    p_owner_name: params.ownerName?.trim() || null,
    p_contact_mobile: params.contactMobile?.trim() || null,
    p_floor_number: params.floorNumber || null,
  });

  if (error) {
    console.error("createResidentialFlat error:", error);
    throw new Error(error.message || "Failed to add flat");
  }

  return {
    propertyId: data.property_id,
  };
}

export async function fetchStandaloneShops(
  organizationId: string,
  eventId?: string | null
): Promise<PropertyRecord[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, organization_id, building_id, property_type, unit_number, flat_number, shop_name, floor_number, owner_name, contact_mobile, location_note, is_active, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("property_type", "commercial")
    .is("building_id", null)
    .order("shop_name", { ascending: true });

  if (error) {
    console.error("fetchStandaloneShops error:", error);
    throw new Error(error.message || "Failed to load commercial shops");
  }

  const baseShops: PropertyRecord[] = (data || []).map((p: any) => ({
    id: p.id,
    organizationId: p.organization_id,
    buildingId: null,
    propertyType: "commercial",
    unitNumber: null,
    flatNumber: null,
    shopName: p.shop_name,
    floorNumber: null,
    ownerName: p.owner_name,
    contactMobile: p.contact_mobile,
    locationNote: p.location_note,
    isActive: p.is_active ?? true,
    createdAt: p.created_at,
    receiptCount: 0,
    totalCollectedAmount: 0,
    latestReceiptNumber: null,
    status: "unvisited",
  }));

  if (!eventId || baseShops.length === 0) {
    return baseShops;
  }

  const shopIds = baseShops.map((s) => s.id);

  try {
    const [{ data: receipts }, { data: followUps }] = await Promise.all([
      supabase
        .from("receipts")
        .select("id, property_id, receipt_number, amount, created_at, status, voided_at, cancelled_at")
        .eq("event_id", eventId)
        .in("property_id", shopIds)
        .in("status", ["valid", "issued"])
        .is("voided_at", null)
        .is("cancelled_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("collection_follow_ups")
        .select("id, property_id, status, reason, follow_up_time, created_at")
        .eq("event_id", eventId)
        .in("property_id", shopIds)
        .order("created_at", { ascending: false }),
    ]);

    const receiptMap = new Map<string, { count: number; total: number; latestNo: number | null; lastAt: string | null }>();
    for (const r of (receipts || []) as any[]) {
      const prev = receiptMap.get(r.property_id) || { count: 0, total: 0, latestNo: null, lastAt: null };
      prev.count += 1;
      prev.total += Number(r.amount || 0);
      if (!prev.latestNo && r.receipt_number) {
        prev.latestNo = r.receipt_number;
        prev.lastAt = r.created_at;
      }
      receiptMap.set(r.property_id, prev);
    }

    const followUpMap = new Map<string, { status: string; reason: string; time: string }>();
    for (const f of (followUps || []) as any[]) {
      if (!followUpMap.has(f.property_id)) {
        followUpMap.set(f.property_id, {
          status: f.status,
          reason: f.reason,
          time: f.follow_up_time,
        });
      }
    }

    return baseShops.map((shop) => {
      const rec = receiptMap.get(shop.id);
      const fu = followUpMap.get(shop.id);

      let status: "collected" | "pending" | "refused" | "unvisited" = "unvisited";
      if (rec && rec.count > 0) {
        status = "collected";
      } else if (fu && fu.status === "pending") {
        status = fu.reason === "refused" ? "refused" : "pending";
      }

      return {
        ...shop,
        status,
        receiptCount: rec?.count || 0,
        totalCollectedAmount: rec?.total || 0,
        latestReceiptNumber: rec?.latestNo || null,
        lastReceiptAt: rec?.lastAt || null,
        followUpReason: fu?.reason || null,
        followUpTime: fu?.time || null,
      };
    });
  } catch (err) {
    console.warn("Could not enrich commercial shops with progress:", err);
    return baseShops;
  }
}

export async function createStandaloneShop(params: {
  organizationId: string;
  shopName: string;
  ownerName?: string;
  contactMobile?: string;
  locationNote?: string;
}): Promise<{ propertyId: string }> {
  const { data, error } = await supabase.rpc("create_property", {
    p_organization_id: params.organizationId,
    p_property_type: "commercial",
    p_building_id: null,
    p_unit_number: null,
    p_shop_name: params.shopName.trim(),
    p_owner_name: params.ownerName?.trim() || null,
    p_contact_mobile: params.contactMobile?.trim() || null,
    p_floor_number: null,
  });

  if (error) {
    console.error("createStandaloneShop error:", error);
    throw new Error(error.message || "Failed to add shop");
  }

  return {
    propertyId: data.property_id,
  };
}

export async function quickAddShop(params: {
  organizationId: string;
  shopName: string;
  ownerName?: string;
  contactMobile?: string;
}): Promise<{ propertyId: string; isExisting?: boolean; shopName: string }> {
  const { data, error } = await supabase.rpc("quick_add_shop", {
    p_organization_id: params.organizationId,
    p_shop_name: params.shopName.trim(),
    p_owner_name: params.ownerName?.trim() || null,
    p_contact_mobile: params.contactMobile?.trim() || null,
  });

  if (error) {
    console.error("quickAddShop error:", error);
    throw new Error(error.message || "Failed to add shop");
  }

  return {
    propertyId: data.property_id,
    isExisting: data.is_existing,
    shopName: data.shop_name,
  };
}
