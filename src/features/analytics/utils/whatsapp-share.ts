/**
 * WhatsApp Receipt Sharing Utility
 * Phase 9-4 Step 4B: Canonical pure utility for WhatsApp receipt sharing
 */

export interface WhatsAppReceiptInput {
  receiptNumber: number;
  receiptPrefix?: string;
  amount: number;
  paymentMode: string;
  paymentReference?: string | null;
  donorName: string;
  donorMobile?: string | null;
  createdAt: string;
  notes?: string | null;
  // Optional property/location details
  buildingName?: string | null;
  buildingWing?: string | null;
  unitNumber?: string | null;
  propertyType?: string | null;
  // Optional Mandal / Event details
  mandalName?: string | null;
  eventName?: string | null;
  // Sync & Lifecycle state
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'conflict' | string | null;
  serverReceiptId?: string | null;
  id?: string;
  status?: string;
  voidReason?: string | null;
  voidedAt?: string | null;
  cancelledAt?: string | null;
}

export interface ShareEligibilityResult {
  isShareable: boolean;
  reason: string | null;
  code: 'ELIGIBLE' | 'UNSYNCED' | 'SYNCING' | 'CONFLICT' | 'VOIDED' | 'CANCELLED';
}

export interface WhatsAppShareDetails {
  message: string;
  targetMobile: string | null;
  url: string;
  isTargeted: boolean;
}

/**
 * Normalizes an Indian mobile number into standard 91XXXXXXXXXX format.
 * Accepts: 10-digit, 0XXXXXXXXXX, 91XXXXXXXXXX, +91XXXXXXXXXX, with spaces or hyphens.
 * Returns 91XXXXXXXXXX if valid 10-digit Indian number, or null if invalid/unusable.
 */
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');

  // 10 digits e.g. 9820012345
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `91${digits}`;
  }

  // 11 digits starting with 0 e.g. 09820012345
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]\d{9}$/.test(digits.slice(1))) {
    return `91${digits.slice(1)}`;
  }

  // 12 digits starting with 91 e.g. 919820012345
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return digits;
  }

  return null;
}

/**
 * Evaluates whether a receipt is eligible for WhatsApp sharing.
 * A receipt is shareable ONLY when:
 * 1. It is not voided
 * 2. It is not cancelled
 * 3. It is server-authoritative / synced (syncStatus === 'synced' OR server-fetched record with valid status)
 */
export function checkShareEligibility(receipt: WhatsAppReceiptInput | null | undefined): ShareEligibilityResult {
  if (!receipt) {
    return {
      isShareable: false,
      reason: 'पावती उपलब्ध नाही (Receipt unavailable)',
      code: 'UNSYNCED',
    };
  }

  // Check voided state
  if (receipt.status === 'voided' || Boolean(receipt.voidedAt) || Boolean(receipt.voidReason)) {
    return {
      isShareable: false,
      reason: 'रद्द केलेली पावती शेअर करता येत नाही (Voided receipt cannot be shared)',
      code: 'VOIDED',
    };
  }

  // Check cancelled state
  if (receipt.status === 'cancelled' || Boolean(receipt.cancelledAt)) {
    return {
      isShareable: false,
      reason: 'रद्द केलेली पावती शेअर करता येत नाही (Cancelled receipt cannot be shared)',
      code: 'CANCELLED',
    };
  }

  // Check sync state
  if (receipt.syncStatus) {
    if (receipt.syncStatus === 'pending') {
      return {
        isShareable: false,
        reason: 'Sync झाल्यावर उपलब्ध होईल (Available after sync)',
        code: 'UNSYNCED',
      };
    }
    if (receipt.syncStatus === 'syncing') {
      return {
        isShareable: false,
        reason: 'Sync होत आहे... (Syncing in progress)',
        code: 'SYNCING',
      };
    }
    if (receipt.syncStatus === 'conflict') {
      return {
        isShareable: false,
        reason: 'Sync त्रुटी (Sync conflict - cannot share)',
        code: 'CONFLICT',
      };
    }
    if (receipt.syncStatus === 'synced') {
      return {
        isShareable: true,
        reason: null,
        code: 'ELIGIBLE',
      };
    }
  }

  // If syncStatus is not explicitly set, check if it is a server-persisted receipt (id or serverReceiptId with valid status)
  const isServerRecord = Boolean(receipt.id || receipt.serverReceiptId);
  const isValidStatus = receipt.status === 'valid' || receipt.status === 'issued' || !receipt.status;

  if (isServerRecord && isValidStatus) {
    return {
      isShareable: true,
      reason: null,
      code: 'ELIGIBLE',
    };
  }

  return {
    isShareable: false,
    reason: 'Sync झाल्यावर उपलब्ध होईल (Available after sync)',
    code: 'UNSYNCED',
  };
}

/**
 * Formats payment mode into friendly Marathi / English bilingual label.
 */
export function formatPaymentModeLabel(mode: string): string {
  const normalized = mode?.toLowerCase().trim();
  switch (normalized) {
    case 'cash':
      return 'रोख / Cash';
    case 'upi':
      return 'UPI';
    case 'cheque':
      return 'धनादेश / Cheque';
    case 'bank_transfer':
      return 'बँक ट्रान्सफर / Bank Transfer';
    default:
      return mode || 'इतर / Other';
  }
}

/**
 * Formats date string into readable local Indian date format.
 */
export function formatReceiptDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Constructs the concise Marathi-first bilingual WhatsApp message.
 */
export function formatWhatsAppReceiptMessage(input: WhatsAppReceiptInput): string {
  const prefix = input.receiptPrefix || 'VP-';
  const receiptCode = `${prefix}${input.receiptNumber}`;
  const mandalOrEvent = input.mandalName || input.eventName || 'श्री गणेश उत्सव २०२६';
  const modeLabel = formatPaymentModeLabel(input.paymentMode);
  const formattedDate = formatReceiptDateTime(input.createdAt);
  const amountStr = `₹${input.amount.toFixed(2)}`;

  const lines: string[] = [];

  lines.push(`🚩 *${mandalOrEvent}* 🚩`);
  lines.push('');
  lines.push('*वर्गणी पावती / Donation Receipt*');
  lines.push('');
  lines.push(`*पावती क्र. / Receipt No.:* ${receiptCode}`);
  lines.push(`*देणगीदार / Donor:* ${input.donorName}`);
  lines.push(`*रक्कम / Amount:* ${amountStr} (${modeLabel})`);
  lines.push(`*दिनांक / Date:* ${formattedDate}`);

  // Property / flat line only when genuinely present
  const locationParts: string[] = [];
  if (input.buildingName) {
    let bld = input.buildingName;
    if (input.buildingWing) {
      bld += ` (${input.buildingWing})`;
    }
    locationParts.push(bld);
  }
  if (input.unitNumber) {
    const isShop = input.propertyType === 'commercial';
    locationParts.push(isShop ? `गाळा क्र. ${input.unitNumber}` : `फ्लॅट क्र. ${input.unitNumber}`);
  }
  if (locationParts.length > 0) {
    lines.push(`*पत्ता / Property:* ${locationParts.join(', ')}`);
  }

  // Payment reference only for UPI / Bank Transfer when non-empty
  if (
    input.paymentReference &&
    (input.paymentMode === 'upi' || input.paymentMode === 'bank_transfer')
  ) {
    lines.push(`*संदर्भ / Ref:* ${input.paymentReference}`);
  }

  lines.push('');
  lines.push('आपल्या सहकार्याबद्दल धन्यवाद!');
  lines.push('गणपती बाप्पा मोरया! 🌺');

  return lines.join('\n');
}

/**
 * Builds the complete WhatsApp share URL (targeted or generic).
 */
export function buildWhatsAppShareUrl(input: WhatsAppReceiptInput): WhatsAppShareDetails {
  const message = formatWhatsAppReceiptMessage(input);
  const targetMobile = normalizeIndianMobile(input.donorMobile);
  const encodedText = encodeURIComponent(message);

  let url: string;
  let isTargeted = false;

  if (targetMobile) {
    url = `https://wa.me/${targetMobile}?text=${encodedText}`;
    isTargeted = true;
  } else {
    url = `https://wa.me/?text=${encodedText}`;
    isTargeted = false;
  }

  return {
    message,
    targetMobile,
    url,
    isTargeted,
  };
}

/**
 * Opens WhatsApp share URL in a new window/tab synchronously.
 */
export function openWhatsAppShare(url: string): boolean {
  if (typeof window === 'undefined') return false;
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  return Boolean(win);
}
