import QRCode from "qrcode";
import { supabase } from "@/supabase/client";

const STORAGE_KEY_PREFIX = "varganipro_mandal_upi_";

export interface MandalUpiConfig {
  upiId: string | null;
  upiName: string | null;
}

/**
 * Builds the canonical UPI payment intent URI conforming to NPCI specification.
 */
export function buildUpiPaymentIntentUri(
  upiId: string,
  mandalName?: string | null,
  amount?: number | null
): string {
  const cleanUpi = upiId.trim();
  const cleanName = (mandalName || "Mandal").trim();
  const params = new URLSearchParams({
    pa: cleanUpi,
    pn: cleanName,
    cu: "INR",
  });

  if (amount && Number.isFinite(amount) && amount > 0) {
    params.set("am", amount.toFixed(2));
  }

  return `upi://pay?${params.toString()}`;
}

/**
 * Generates an SVG string representation of the UPI QR code for crisp, offline vector rendering.
 */
export async function generateUpiQrSvg(
  upiUri: string,
  options: { size?: number } = {}
): Promise<string> {
  const size = options.size || 280;
  return QRCode.toString(upiUri, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    width: size,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

/**
 * Generates a PNG Data URL of the UPI QR code.
 */
export async function generateUpiQrDataUrl(
  upiUri: string,
  options: { size?: number } = {}
): Promise<string> {
  const size = options.size || 280;
  return QRCode.toDataURL(upiUri, {
    margin: 2,
    errorCorrectionLevel: "M",
    width: size,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

export function getMandalUpiStorageKey(
  organizationId?: string | null,
  eventId?: string | null
): string {
  if (organizationId && eventId) {
    return `${STORAGE_KEY_PREFIX}${organizationId}_${eventId}`;
  }
  if (organizationId) {
    return `${STORAGE_KEY_PREFIX}${organizationId}`;
  }
  return `${STORAGE_KEY_PREFIX}default`;
}

/**
 * Loads cached Mandal UPI configuration from localStorage for 100% offline availability.
 */
export function loadCachedMandalUpiConfig(
  organizationId?: string | null,
  eventId?: string | null
): MandalUpiConfig {
  if (typeof window === "undefined") {
    return { upiId: null, upiName: null };
  }

  try {
    const key = getMandalUpiStorageKey(organizationId, eventId);
    const stored = window.localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<MandalUpiConfig>;
      return {
        upiId: parsed.upiId?.trim() || null,
        upiName: parsed.upiName?.trim() || null,
      };
    }
  } catch (err) {
    console.warn("Failed to load cached Mandal UPI config:", err);
  }

  return { upiId: null, upiName: null };
}

/**
 * Persists Mandal UPI configuration into localStorage cache.
 */
export function saveCachedMandalUpiConfig(
  organizationId: string | null | undefined,
  eventId: string | null | undefined,
  config: MandalUpiConfig
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getMandalUpiStorageKey(organizationId, eventId);
    window.localStorage.setItem(key, JSON.stringify(config));
  } catch (err) {
    console.warn("Failed to cache Mandal UPI config:", err);
  }
}

/**
 * Updates event-level authoritative UPI configuration on Supabase via secure RPC.
 */
export async function updateEventUpiConfigRemote(
  eventId: string,
  upiId: string,
  upiName?: string | null,
  organizationId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc("update_event_upi_config", {
      p_event_id: eventId,
      p_upi_id: upiId.trim(),
      p_upi_name: upiName?.trim() || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Cache locally immediately
    saveCachedMandalUpiConfig(organizationId, eventId, {
      upiId: upiId.trim(),
      upiName: upiName?.trim() || null,
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
