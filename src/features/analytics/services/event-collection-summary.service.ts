import { supabase } from "@/supabase/client";

export interface EventCollectionSummary {
  success: boolean;
  event_id: string;
  organization_id: string;
  total_amount: number;
  cash_amount: number;
  upi_amount: number;
  cheque_amount: number;
  bank_transfer_amount: number;
  receipt_count: number;
}

/**
 * Fetches authoritative aggregate event collection summary (Admin or Volunteer).
 * Aggregates across all volunteers, admin, books, flats, shops, and general receipts.
 */
export async function getEventCollectionSummary(
  eventId: string
): Promise<{ success: boolean; data?: EventCollectionSummary; error?: string }> {
  if (!eventId) {
    return { success: false, error: "Event ID is required" };
  }

  try {
    const { data, error } = await supabase.rpc("get_event_collection_summary", {
      p_event_id: eventId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { success: false, error: "Invalid response from collection summary RPC" };
    }

    const summary: EventCollectionSummary = {
      success: true,
      event_id: String(data.event_id || eventId),
      organization_id: String(data.organization_id || ""),
      total_amount: Number(data.total_amount || 0),
      cash_amount: Number(data.cash_amount || 0),
      upi_amount: Number(data.upi_amount || 0),
      cheque_amount: Number(data.cheque_amount || 0),
      bank_transfer_amount: Number(data.bank_transfer_amount || 0),
      receipt_count: Number(data.receipt_count || 0),
    };

    return { success: true, data: summary };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
