import { supabase } from "@/supabase/client";
import {
  saveCachedBuildingSummaries,
  getCachedBuildingSummaries,
  saveCachedBuildingProperties,
  getCachedBuildingProperties,
  updateLocalPropertyProgress,
  type CachedBuildingSummary,
  type CachedPropertyProgress,
} from "@/lib/offline/offline-db";

interface BuildingSummaryRpcResponse {
  success?: boolean;
  event_id?: string;
  organization_id?: string;
  buildings?: Array<{
    building_id: string;
    building_name: string;
    code: string | null;
    wing: string | null;
    area_name: string | null;
    total_units: number;
    collected_count: number;
    pending_count: number;
    refused_count: number;
    not_visited_count: number;
    remaining_count: number;
    total_amount_collected: number;
    last_activity_at: string | null;
  }>;
}

interface BuildingPropertiesRpcResponse {
  success?: boolean;
  event_id?: string;
  building_id?: string;
  building_name?: string;
  building_wing?: string | null;
  properties?: Array<{
    property_id: string;
    property_type: string;
    unit_number: string;
    flat_number: string | null;
    floor_number: number | null;
    shop_name: string | null;
    owner_name: string | null;
    contact_mobile: string | null;
    status: "collected" | "pending" | "refused" | "not_visited";
    receipt_count: number;
    total_collected_amount: number;
    latest_receipt_number: number | null;
    last_receipt_at: string | null;
    pending_reason: string | null;
    follow_up_time: string | null;
    follow_up_notes: string | null;
    follow_up_at: string | null;
  }>;
}

export async function fetchEventBuildingSummaries(
  eventId: string,
  organizationId: string
): Promise<CachedBuildingSummary[]> {
  try {
    const { data, error } = await supabase.rpc(
      "get_event_building_summaries",
      { p_event_id: eventId }
    );

    if (error) {
      console.warn("Falling back to local cached building summaries due to RPC error:", error.message);
      return await getCachedBuildingSummaries(eventId);
    }

    const res = data as BuildingSummaryRpcResponse;
    const summaries: CachedBuildingSummary[] = (res.buildings || []).map((b) => ({
      buildingId: b.building_id,
      eventId,
      organizationId,
      buildingName: b.building_name,
      code: b.code,
      wing: b.wing,
      areaName: b.area_name,
      totalUnits: Number(b.total_units || 0),
      collectedCount: Number(b.collected_count || 0),
      pendingCount: Number(b.pending_count || 0),
      refusedCount: Number(b.refused_count || 0),
      notVisitedCount: Number(b.not_visited_count || 0),
      remainingCount: Number(b.remaining_count || 0),
      totalAmountCollected: Number(b.total_amount_collected || 0),
      lastActivityAt: b.last_activity_at,
      cachedAt: new Date().toISOString(),
    }));

    await saveCachedBuildingSummaries(eventId, summaries);
    return summaries;
  } catch (err) {
    console.warn("Network error fetching building summaries; using offline cache:", err);
    return await getCachedBuildingSummaries(eventId);
  }
}

export async function fetchBuildingPropertiesProgress(
  eventId: string,
  buildingId: string,
  organizationId: string
): Promise<CachedPropertyProgress[]> {
  try {
    const { data, error } = await supabase.rpc(
      "get_building_properties_progress",
      {
        p_event_id: eventId,
        p_building_id: buildingId,
      }
    );

    if (error) {
      console.warn("Falling back to local cached properties due to RPC error:", error.message);
      return await getCachedBuildingProperties(eventId, buildingId);
    }

    const res = data as BuildingPropertiesRpcResponse;
    const properties: CachedPropertyProgress[] = (res.properties || []).map((p) => ({
      propertyId: p.property_id,
      buildingId,
      eventId,
      organizationId,
      propertyType: p.property_type,
      unitNumber: p.unit_number,
      flatNumber: p.flat_number,
      floorNumber: p.floor_number,
      shopName: p.shop_name,
      ownerName: p.owner_name,
      contactMobile: p.contact_mobile,
      status: p.status,
      receiptCount: Number(p.receipt_count || 0),
      totalCollectedAmount: Number(p.total_collected_amount || 0),
      latestReceiptNumber: p.latest_receipt_number,
      lastReceiptAt: p.last_receipt_at,
      pendingReason: p.pending_reason,
      followUpTime: p.follow_up_time,
      followUpNotes: p.follow_up_notes,
      followUpAt: p.follow_up_at,
      cachedAt: new Date().toISOString(),
    }));

    await saveCachedBuildingProperties(eventId, buildingId, properties);
    return properties;
  } catch (err) {
    console.warn("Network error fetching properties; using offline cache:", err);
    return await getCachedBuildingProperties(eventId, buildingId);
  }
}

export interface RecordFollowUpInput {
  eventId: string;
  buildingId: string;
  propertyId: string;
  reason: string;
  followUpTime?: string | null;
  notes?: string | null;
}

export async function recordFollowUp(input: RecordFollowUpInput): Promise<void> {
  const isRefused = input.reason === "refused";
  const newStatus = isRefused ? "refused" : "pending";

  // 1. Instant local optimistic update in IndexedDB
  await updateLocalPropertyProgress(input.eventId, input.buildingId, input.propertyId, {
    status: newStatus,
    pendingReason: input.reason,
    followUpTime: input.followUpTime ?? null,
    followUpNotes: input.notes ?? null,
    followUpAt: new Date().toISOString(),
  });

  // 2. Background / immediate server sync
  try {
    const { error } = await supabase.rpc("record_collection_follow_up", {
      p_event_id: input.eventId,
      p_property_id: input.propertyId,
      p_reason: input.reason,
      p_follow_up_time: input.followUpTime ?? null,
      p_notes: input.notes ?? null,
    });

    if (error) {
      console.warn("Server follow-up sync deferred/failed:", error.message);
    }
  } catch (err) {
    console.warn("Offline: follow-up queued locally:", err);
  }
}
