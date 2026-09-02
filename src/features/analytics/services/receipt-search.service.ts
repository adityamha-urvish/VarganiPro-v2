/**
 * Receipt Search Service
 * Phase 9-4 Step 4C: Client service for global receipt search RPC
 */

import { supabase } from "@/supabase/client";

export interface SearchReceiptItem {
  id: string;
  receipt_number: number;
  receipt_prefix: string;
  book_number: string;
  amount: number;
  payment_mode: string;
  payment_reference: string | null;
  donor_name: string;
  donor_mobile: string | null;
  property_id: string | null;
  property_type: string | null;
  unit_number: string | null;
  building_name: string | null;
  building_wing: string | null;
  volunteer_id: string;
  volunteer_name: string;
  collection_session_id: string;
  status: string;
  void_reason: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface SearchReceiptsParams {
  eventId: string;
  query?: string | null;
  paymentMode?: string | null;
  status?: string | null;
  volunteerId?: string | null;
  limit?: number;
  offset?: number;
}

export interface SearchReceiptsResult {
  success: boolean;
  event_id: string;
  organization_id: string;
  is_admin: boolean;
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
  receipts: SearchReceiptItem[];
}

export async function searchOrganizationReceipts(
  params: SearchReceiptsParams
): Promise<SearchReceiptsResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      "ग्लोबल सर्चसाठी इंटरनेट आवश्यक आहे (Internet required for global search)"
    );
  }

  if (!params.eventId) {
    throw new Error("Event ID is required for receipt search.");
  }

  const { data, error } = await supabase.rpc("search_organization_receipts", {
    p_event_id: params.eventId,
    p_query: params.query?.trim() || null,
    p_payment_mode:
      params.paymentMode && params.paymentMode !== "all"
        ? params.paymentMode
        : null,
    p_status:
      params.status && params.status !== "all" ? params.status : null,
    p_volunteer_id: params.volunteerId || null,
    p_limit: params.limit || 25,
    p_offset: params.offset || 0,
  });

  if (error) {
    throw new Error(error.message || "Failed to search receipts.");
  }

  return data as SearchReceiptsResult;
}
