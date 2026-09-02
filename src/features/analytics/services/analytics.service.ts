import { supabase } from "@/supabase/client";
import type {
  SecretaryOverviewMetrics,
  VolunteerFinancialLedgerResponse,
} from "../types/analytics.types";

export interface VoidReceiptResult {
  success: boolean;
  receipt_id: string;
  receipt_number: number;
  amount: number;
  payment_mode: string;
  status: string;
  void_reason: string;
  voided_at: string;
  voided_by: string;
}

/**
 * Fetch executive overview metrics for the mandal secretary.
 */
export async function getSecretaryOverviewMetrics(
  eventId: string
): Promise<SecretaryOverviewMetrics> {
  if (!eventId) {
    throw new Error("Event ID is required to fetch overview metrics");
  }

  const { data, error } = await supabase.rpc(
    "get_secretary_overview_metrics",
    { p_event_id: eventId }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Invalid response format from secretary overview metrics RPC");
  }

  return data as SecretaryOverviewMetrics;
}

/**
 * Fetch detailed volunteer financial ledger and cash custody balances.
 */
export async function getVolunteerFinancialLedger(
  eventId: string
): Promise<VolunteerFinancialLedgerResponse> {
  if (!eventId) {
    throw new Error("Event ID is required to fetch volunteer ledger");
  }

  const { data, error } = await supabase.rpc(
    "get_volunteer_financial_ledger",
    { p_event_id: eventId }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Invalid response format from volunteer financial ledger RPC");
  }

  return data as VolunteerFinancialLedgerResponse;
}

/**
 * Void an operational receipt online (Secretary/Admin only).
 */
export async function voidReceipt(
  receiptId: string,
  voidReason: string
): Promise<VoidReceiptResult> {
  if (!receiptId) {
    throw new Error("Receipt ID is required");
  }

  const cleanReason = voidReason.trim();
  if (cleanReason.length < 3) {
    throw new Error("A valid void reason of at least 3 characters is required");
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("इंटरनेट कनेक्शन आवश्यक आहे (Internet connection required)");
  }

  const { data, error } = await supabase.rpc("void_receipt", {
    p_receipt_id: receiptId,
    p_void_reason: cleanReason,
  });

  if (error) {
    if (
      error.message.includes("submitted or verified") ||
      error.message.includes("finalized/in review")
    ) {
      throw new Error(
        "हा हिशोब आधीच जमा/पडताळला गेला आहे. ही पावती आता रद्द करता येणार नाही."
      );
    }
    if (error.message.includes("already voided")) {
      throw new Error("ही पावती आधीच रद्द केलेली आहे.");
    }
    throw new Error(error.message);
  }

  if (
    !data ||
    typeof data !== "object" ||
    !("success" in data) ||
    (data as { success?: boolean }).success !== true
  ) {
    throw new Error("Unexpected response from void receipt RPC");
  }

  return data as VoidReceiptResult;
}
