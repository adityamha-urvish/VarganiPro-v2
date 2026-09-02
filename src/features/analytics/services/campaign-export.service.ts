/**
 * Campaign Export & Download Service
 * Phase 9-4 Step 4D: Multi-page paginated export assembler, CSV builder, and formula injection defense
 */

import { supabase } from "@/supabase/client";

export type ExportType = "donations" | "daily_summary" | "penetration";

export interface DonationExportRow {
  receipt_number: number;
  receipt_code: string;
  book_number: string;
  amount: number;
  payment_mode: string;
  payment_reference: string;
  donor_name: string;
  donor_mobile: string;
  property_type: string;
  unit_number: string;
  building_name: string;
  building_wing: string;
  volunteer_name: string;
  status: "VALID" | "VOIDED" | "CANCELLED";
  void_reason: string;
  voided_at: string | null;
  voided_by_name: string;
  notes: string;
  created_at: string;
}

export interface DailySummaryExportRow {
  collection_date: string;
  receipt_count: number;
  total_collected: number;
  cash_collected: number;
  cheque_collected: number;
  upi_collected: number;
  bank_transfer_collected: number;
  voided_receipt_count: number;
  voided_amount: number;
}

export interface PenetrationExportRow {
  building_name: string;
  wing: string;
  area_name: string;
  total_units: number;
  collected_units: number;
  pending_units: number;
  refused_units: number;
  not_visited_units: number;
  total_amount_collected: number;
}

export interface CampaignExportResponse<T> {
  success: boolean;
  event_id: string;
  organization_id: string;
  export_type: ExportType;
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
  data: T[];
}

export interface ExportProgress {
  current: number;
  total: number;
  percentage: number;
}

export interface ExportFetchOptions {
  eventId: string;
  exportType: ExportType;
  batchSize?: number;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

export interface ExportMetadata {
  eventName?: string;
  exportedAt?: string;
}

/**
 * Sanitizes a single cell value for CSV formatting and neutralizes CWE-1236 Formula Injection.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Neutralize formula injection characters: =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  } else {
    str = str.trim();
  }

  // Escape embedded double quotes by doubling them
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Derives the authoritative primary key for a row based on export type.
 */
export function getAuthoritativeRowKey(
  exportType: ExportType,
  row: unknown
): string {
  if (exportType === "donations") {
    const d = row as DonationExportRow;
    return d.receipt_code || `VP-${d.receipt_number}`;
  }
  if (exportType === "daily_summary") {
    const s = row as DailySummaryExportRow;
    return s.collection_date;
  }
  if (exportType === "penetration") {
    const p = row as PenetrationExportRow;
    return `${p.building_name}::${p.wing}::${p.area_name}`;
  }
  return JSON.stringify(row);
}

/**
 * Formats ISO date to Indian Standard Time string.
 */
export function formatIstDateTime(dateStr?: string): string {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Sequentially fetches all paginated records from get_campaign_export_data RPC.
 * Fail-Closed: Aborts immediately without altering data if duplicate rows or count mismatch occurs.
 */
export async function fetchCompleteCampaignExport<T>(
  options: ExportFetchOptions
): Promise<T[]> {
  const { eventId, exportType, batchSize = 500, onProgress, signal } = options;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error(
      "डेटा निर्यातीसाठी इंटरनेट आवश्यक आहे (Internet required for data export)"
    );
  }

  if (!eventId) {
    throw new Error("Event ID is required for export.");
  }

  const allRecords: T[] = [];
  const seenKeys = new Set<string>();
  let currentOffset = 0;
  let hasMore = true;
  let serverTotalCount = 0;

  while (hasMore) {
    if (signal?.aborted) {
      throw new Error("Export cancelled by user.");
    }

    const { data: response, error } = await supabase.rpc(
      "get_campaign_export_data",
      {
        p_event_id: eventId,
        p_export_type: exportType,
        p_limit: batchSize,
        p_offset: currentOffset,
      }
    );

    if (error) {
      throw new Error(error.message || "Failed to fetch export data.");
    }

    const typedResponse = response as CampaignExportResponse<T>;

    if (!typedResponse || !typedResponse.success || !Array.isArray(typedResponse.data)) {
      throw new Error("Invalid export response format from server.");
    }

    if (currentOffset === 0) {
      serverTotalCount = typedResponse.total_count || 0;
      if (serverTotalCount === 0 || typedResponse.data.length === 0) {
        return [];
      }
    }

    for (const item of typedResponse.data) {
      const key = getAuthoritativeRowKey(exportType, item);

      // Financial Fail-Closed Safety: Abort if duplicate record detected across pages
      if (seenKeys.has(key)) {
        throw new Error(
          "Export data changed unexpectedly. Please try again. (डेटा बदलल्यामुळे निर्यात अयशस्वी झाली)"
        );
      }

      seenKeys.add(key);
      allRecords.push(item);
    }

    onProgress?.({
      current: allRecords.length,
      total: serverTotalCount,
      percentage:
        serverTotalCount > 0
          ? Math.min(100, Math.round((allRecords.length / serverTotalCount) * 100))
          : 100,
    });

    currentOffset += typedResponse.data.length;
    hasMore = typedResponse.has_more && typedResponse.data.length > 0;

    // Safety guard against infinite loops
    if (typedResponse.data.length === 0 && hasMore) {
      throw new Error("Unexpected end of paginated export data.");
    }
  }

  // Reconciliation Check: Verify retrieved count equals server total count
  if (allRecords.length !== serverTotalCount) {
    throw new Error(
      `Export count mismatch: expected ${serverTotalCount} records, retrieved ${allRecords.length}. Please retry.`
    );
  }

  return allRecords;
}

/**
 * Builds CSV for Full Donations Register with UTF-8 BOM.
 */
export function buildDonationsCsv(
  records: DonationExportRow[],
  metadata: ExportMetadata = {}
): string {
  const lines: string[] = [];
  const exportedAtStr = formatIstDateTime(metadata.exportedAt);
  const eventName = metadata.eventName || "VarganiPro Event";

  // 1. UTF-8 Byte Order Mark (BOM) for Excel Devanagari support
  const BOM = "\uFEFF";

  // 2. Metadata header rows
  lines.push(`# VarganiPro Campaign Export - संपूर्ण देणगीदार यादी (Full Donations Register)`);
  lines.push(`# Event: ${eventName}`);
  lines.push(`# Exported At: ${exportedAtStr} (IST)`);
  lines.push(`# Total Records: ${records.length}`);
  lines.push("");

  // 3. Column headers (Marathi + English)
  const headers = [
    "पावती क्र. (Receipt Code)",
    "पावती नंबर (Receipt No)",
    "पावती पुस्तक (Book Number)",
    "रक्कम (Amount INR)",
    "पेमेंट पद्धत (Payment Mode)",
    "पेमेंट संदर्भ (Payment Ref)",
    "देणगीदार नाव (Donor Name)",
    "मोबाईल नंबर (Donor Mobile)",
    "इमारत (Building)",
    "विंग (Wing)",
    "फ्लॅट / गाळा (Unit No)",
    "मालमत्ता प्रकार (Property Type)",
    "कार्यकर्ता (Volunteer Name)",
    "पावती स्थिती (Status)",
    "रद्द करण्याचे कारण (Void Reason)",
    "रद्द केल्याची तारीख (Voided At)",
    "रद्द करणारा (Voided By)",
    "शेरा (Notes)",
    "पावती दिनांक (Created At)",
  ];
  lines.push(headers.map(sanitizeCsvCell).join(","));

  // 4. Data rows
  for (const r of records) {
    const row = [
      r.receipt_code,
      r.receipt_number,
      r.book_number,
      r.amount.toFixed(2),
      r.payment_mode,
      r.payment_reference || "",
      r.donor_name,
      r.donor_mobile || "",
      r.building_name || "",
      r.building_wing || "",
      r.unit_number || "",
      r.property_type || "",
      r.volunteer_name || "",
      r.status,
      r.void_reason || "",
      r.voided_at ? formatIstDateTime(r.voided_at) : "",
      r.voided_by_name || "",
      r.notes || "",
      formatIstDateTime(r.created_at),
    ];
    lines.push(row.map(sanitizeCsvCell).join(","));
  }

  return BOM + lines.join("\r\n");
}

/**
 * Builds CSV for Daily Treasury Summary with UTF-8 BOM.
 */
export function buildDailySummaryCsv(
  records: DailySummaryExportRow[],
  metadata: ExportMetadata = {}
): string {
  const lines: string[] = [];
  const exportedAtStr = formatIstDateTime(metadata.exportedAt);
  const eventName = metadata.eventName || "VarganiPro Event";
  const BOM = "\uFEFF";

  lines.push(`# VarganiPro Campaign Export - दैनंदिन संकलन व तिजोरी अहवाल (Daily Treasury Summary)`);
  lines.push(`# Event: ${eventName}`);
  lines.push(`# Exported At: ${exportedAtStr} (IST)`);
  lines.push(`# Total Dates: ${records.length}`);
  lines.push("");

  const headers = [
    "संकलन दिनांक (Collection Date)",
    "एकूण वैध पावत्या (Valid Receipts)",
    "एकूण संकलन (Total Collected INR)",
    "रोख संकलन (Cash Collected INR)",
    "UPI संकलन (UPI Collected INR)",
    "धनादेश संकलन (Cheque Collected INR)",
    "बँक ट्रान्सफर (Bank Transfer INR)",
    "रद्द पावत्या (Voided Receipts Count)",
    "रद्द रक्कम (Voided Amount INR)",
  ];
  lines.push(headers.map(sanitizeCsvCell).join(","));

  for (const r of records) {
    const row = [
      r.collection_date,
      r.receipt_count,
      r.total_collected.toFixed(2),
      r.cash_collected.toFixed(2),
      r.upi_collected.toFixed(2),
      r.cheque_collected.toFixed(2),
      r.bank_transfer_collected.toFixed(2),
      r.voided_receipt_count,
      r.voided_amount.toFixed(2),
    ];
    lines.push(row.map(sanitizeCsvCell).join(","));
  }

  return BOM + lines.join("\r\n");
}

/**
 * Builds CSV for Building Penetration Report with UTF-8 BOM.
 */
export function buildPenetrationCsv(
  records: PenetrationExportRow[],
  metadata: ExportMetadata = {}
): string {
  const lines: string[] = [];
  const exportedAtStr = formatIstDateTime(metadata.exportedAt);
  const eventName = metadata.eventName || "VarganiPro Event";
  const BOM = "\uFEFF";

  lines.push(`# VarganiPro Campaign Export - इमारत व परिसर प्रगती अहवाल (Building Penetration Report)`);
  lines.push(`# Event: ${eventName}`);
  lines.push(`# Exported At: ${exportedAtStr} (IST)`);
  lines.push(`# Total Buildings: ${records.length}`);
  lines.push("");

  const headers = [
    "इमारत (Building Name)",
    "विंग (Wing)",
    "परिसर / गल्ली (Area Name)",
    "एकूण फ्लॅट / गाळे (Total Units)",
    "संकलन पूर्ण (Collected Units)",
    "बाकी फ्लॅट (Pending Units)",
    "नकार (Refused Units)",
    "अपूर्ण (Not Visited Units)",
    "एकूण जमा रक्कम (Total Collected INR)",
  ];
  lines.push(headers.map(sanitizeCsvCell).join(","));

  for (const r of records) {
    const row = [
      r.building_name,
      r.wing || "",
      r.area_name || "",
      r.total_units,
      r.collected_units,
      r.pending_units,
      r.refused_units,
      r.not_visited_units,
      r.total_amount_collected.toFixed(2),
    ];
    lines.push(row.map(sanitizeCsvCell).join(","));
  }

  return BOM + lines.join("\r\n");
}

/**
 * Triggers browser file download from CSV string and safely releases Blob URL.
 */
export function downloadCsvBlob(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Release URL memory
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
