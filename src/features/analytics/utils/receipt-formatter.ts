/**
 * Canonical Receipt Formatter & Festival Kind Resolver
 * Single authoritative source for:
 * 1. Physical receipt code presentation (`formatReceiptCode`)
 * 2. Dynamic festival detection (`resolveFestivalKind`)
 * 3. Festival-appropriate headers, mantras, and WhatsApp closings (`getFestivalGreetings`)
 */

export interface FormatReceiptCodeInput {
  receiptNumber: number;
  receiptPrefix?: string | null;
}

/**
 * Formats a receipt number strictly using physical book prefix + physical sequence number.
 * Never synthesizes a fallback prefix like 'VP-'.
 * If prefix is provided (e.g. 'NU-', 'GU-'), returns `${prefix}${number}`.
 * If prefix is absent / empty, returns `#${number}`.
 */
export function formatReceiptCode(input: FormatReceiptCodeInput): string {
  const rawPrefix = (input.receiptPrefix || "").trim();
  if (rawPrefix) {
    return `${rawPrefix}${input.receiptNumber}`;
  }
  return `#${input.receiptNumber}`;
}

/**
 * Checks whether a receipt has a valid physical book prefix.
 */
export function isReceiptPrefixValid(prefix?: string | null): boolean {
  return Boolean(prefix && prefix.trim().length > 0);
}

export type FestivalKind = "ganesh" | "navratri" | "other";

/**
 * Resolves festival kind from event name, mandal name, and physical book prefix.
 * Maps:
 * - Navratri / Durga / Mata / Devi / Dussehra / NU-* / NR-* / DU-* -> 'navratri'
 * - Ganesh / Ganpati / Bappa / Vinayak / GU-* / GP-* -> 'ganesh'
 * - All other / unknown festivals -> 'other' (neutral)
 */
export function resolveFestivalKind(
  eventName?: string | null,
  mandalName?: string | null,
  receiptPrefix?: string | null
): FestivalKind {
  const text = `${eventName || ""} ${mandalName || ""}`.toLowerCase();

  // 1. Check explicit Navratri / Durga / Mata / Devi keywords
  if (
    text.includes("navratri") ||
    text.includes("navratra") ||
    text.includes("navaratri") ||
    text.includes("नवरात्र") ||
    text.includes("नवरात्री") ||
    text.includes("दुर्गा") ||
    text.includes("durga") ||
    text.includes("mata") ||
    text.includes("माता") ||
    text.includes("देवी") ||
    text.includes("devi") ||
    text.includes("dussehra") ||
    text.includes("दसरा") ||
    text.includes("गरबा") ||
    text.includes("garba") ||
    text.includes("dandiya") ||
    text.includes("दांडिया")
  ) {
    return "navratri";
  }

  // 2. Check explicit Ganesh / Ganpati / Bappa / Vinayak keywords
  if (
    text.includes("ganesh") ||
    text.includes("ganpati") ||
    text.includes("गणेश") ||
    text.includes("गणपती") ||
    text.includes("bappa") ||
    text.includes("बाप्पा") ||
    text.includes("चतुर्थी") ||
    text.includes("chaturthi") ||
    text.includes("विनायक") ||
    text.includes("vinayak")
  ) {
    return "ganesh";
  }

  // 3. Fallback to physical book prefix triggers if explicit event/mandal is unlisted/neutral
  const cleanPrefix = (receiptPrefix || "").trim().toUpperCase();
  if (
    cleanPrefix.startsWith("NU") ||
    cleanPrefix.startsWith("NR") ||
    cleanPrefix.startsWith("DU") ||
    cleanPrefix.startsWith("NV")
  ) {
    return "navratri";
  }

  if (
    cleanPrefix.startsWith("GU") ||
    cleanPrefix.startsWith("GN") ||
    cleanPrefix.startsWith("GP")
  ) {
    return "ganesh";
  }

  return "other";
}

export interface FestivalGreetings {
  kind: FestivalKind;
  headerDevotional: string;
  closingGreeting: string;
  mantra: string | null;
  artworkType: "ganpati" | "navratri" | "other";
}

/**
 * Returns canonical festival metadata for Pavti headers, mantras, and WhatsApp closings.
 * Unknown events get neutral greetings without Ganesh defaults.
 */
export function getFestivalGreetings(
  eventName?: string | null,
  mandalName?: string | null,
  receiptPrefix?: string | null
): FestivalGreetings {
  const kind = resolveFestivalKind(eventName, mandalName, receiptPrefix);
  switch (kind) {
    case "navratri":
      return {
        kind: "navratri",
        headerDevotional: "🚩 जय माता दी 🚩",
        closingGreeting: "आपल्या सहकार्याबद्दल धन्यवाद!\nजय माता दी! 🌺",
        mantra: "॥ श्री कुलस्वामिनी प्रसन्न ॥",
        artworkType: "navratri",
      };
    case "ganesh":
      return {
        kind: "ganesh",
        headerDevotional: "🚩 श्री गणेश उत्सव 🚩",
        closingGreeting: "आपल्या सहकार्याबद्दल धन्यवाद!\nगणपती बाप्पा मोरया! 🌺",
        mantra: "॥ श्री गणेशाय नमः ॥",
        artworkType: "ganpati",
      };
    case "other":
    default:
      return {
        kind: "other",
        headerDevotional: "🚩 उत्सव वर्गणी पावती 🚩",
        closingGreeting: "आपल्या सहकार्याबद्दल धन्यवाद! 🙏",
        mantra: null,
        artworkType: "other",
      };
  }
}

export interface NormalizedLocalReceipt {
  clientReceiptId: string;
  receiptBookId: string;
  organizationId: string;
  eventId: string;
  collectionSessionId: string;
  volunteerId: string;
  ownerUserId?: string | null;
  propertyId: string | null;
  receiptNumber: number;
  receiptPrefix?: string | null;
  donorName: string;
  donorMobile: string | null;
  amount: number;
  paymentMode: "cash" | "upi" | "cheque" | "bank_transfer";
  paymentReference: string | null;
  notes: string | null;
  offlineCreatedAt: string;
  syncStatus: "pending" | "synced" | "conflict";
  serverReceiptId?: string | null;
  syncedAt?: string | null;
  syncError?: string | null;
  id?: string;
  status?: string;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  buildingName?: string | null;
  buildingWing?: string | null;
  unitNumber?: string | null;
  propertyType?: string | null;
  mandalName?: string | null;
  eventName?: string | null;
  createdAt?: string;
}

/**
 * Canonical bidirectional normalizer converting search receipts (snake_case)
 * or local receipts (camelCase) into unified NormalizedLocalReceipt.
 * Eliminates undefined receipt numbers and payment mode crashes across preview and void modals.
 */
export function normalizeSearchReceiptToLocalReceipt(
  item: unknown
): NormalizedLocalReceipt {
  if (!item || typeof item !== "object") {
    return {
      clientReceiptId: "",
      receiptBookId: "",
      organizationId: "",
      eventId: "",
      collectionSessionId: "",
      volunteerId: "",
      propertyId: null,
      receiptNumber: 0,
      receiptPrefix: null,
      donorName: "",
      donorMobile: null,
      amount: 0,
      paymentMode: "cash",
      paymentReference: null,
      notes: null,
      offlineCreatedAt: new Date().toISOString(),
      syncStatus: "synced",
    };
  }

  const anyItem = item as Record<string, any>;
  const rawReceiptNumber = anyItem.receiptNumber ?? anyItem.receipt_number ?? 0;
  const rawPrefix = anyItem.receiptPrefix ?? anyItem.receipt_prefix ?? null;
  const rawPaymentMode = anyItem.paymentMode ?? anyItem.payment_mode ?? "cash";
  const rawDonorName = anyItem.donorName ?? anyItem.donor_name ?? "";
  const rawDonorMobile = anyItem.donorMobile ?? anyItem.donor_mobile ?? null;
  const rawAmount = Number(anyItem.amount ?? 0);
  const rawPaymentRef = anyItem.paymentReference ?? anyItem.payment_reference ?? null;
  const rawNotes = anyItem.notes ?? null;
  const rawPropertyId = anyItem.propertyId ?? anyItem.property_id ?? null;
  const rawOrgId = anyItem.organizationId ?? anyItem.organization_id ?? "";
  const rawEventId = anyItem.eventId ?? anyItem.event_id ?? "";
  const rawBookId = anyItem.receiptBookId ?? anyItem.receipt_book_id ?? "";
  const rawSessionId = anyItem.collectionSessionId ?? anyItem.collection_session_id ?? "";
  const rawVolunteerId = anyItem.volunteerId ?? anyItem.volunteer_id ?? "";
  const rawCreatedAt =
    anyItem.createdAt ??
    anyItem.offlineCreatedAt ??
    anyItem.created_at ??
    new Date().toISOString();
  const rawSyncStatus =
    anyItem.syncStatus ??
    (anyItem.is_synced === false ? "pending" : "synced");
  const rawClientReceiptId =
    anyItem.clientReceiptId ??
    anyItem.client_receipt_id ??
    anyItem.id ??
    "";
  const rawStatus =
    anyItem.status ??
    (anyItem.is_voided || anyItem.voided_at ? "voided" : "issued");
  const rawVoidReason = anyItem.voidReason ?? anyItem.void_reason ?? null;
  const rawVoidedAt = anyItem.voidedAt ?? anyItem.voided_at ?? null;
  const rawVoidedBy = anyItem.voidedBy ?? anyItem.voided_by_name ?? null;
  const rawBuildingName = anyItem.buildingName ?? anyItem.building_name ?? null;
  const rawBuildingWing = anyItem.buildingWing ?? anyItem.building_wing ?? null;
  const rawUnitNumber = anyItem.unitNumber ?? anyItem.unit_number ?? null;
  const rawPropertyType = anyItem.propertyType ?? anyItem.property_type ?? null;
  const rawMandalName = anyItem.mandalName ?? anyItem.mandal_name ?? null;
  const rawEventName = anyItem.eventName ?? anyItem.event_name ?? null;

  return {
    clientReceiptId: String(rawClientReceiptId),
    receiptBookId: String(rawBookId),
    organizationId: String(rawOrgId),
    eventId: String(rawEventId),
    collectionSessionId: String(rawSessionId),
    volunteerId: String(rawVolunteerId),
    propertyId: rawPropertyId ? String(rawPropertyId) : null,
    receiptNumber: Number(rawReceiptNumber),
    receiptPrefix: rawPrefix ? String(rawPrefix) : null,
    donorName: String(rawDonorName),
    donorMobile: rawDonorMobile ? String(rawDonorMobile) : null,
    amount: rawAmount,
    paymentMode: (["cash", "upi", "cheque", "bank_transfer"].includes(
      String(rawPaymentMode).toLowerCase()
    )
      ? String(rawPaymentMode).toLowerCase()
      : "cash") as "cash" | "upi" | "cheque" | "bank_transfer",
    paymentReference: rawPaymentRef ? String(rawPaymentRef) : null,
    notes: rawNotes ? String(rawNotes) : null,
    offlineCreatedAt: String(rawCreatedAt),
    syncStatus: rawSyncStatus,
    id: anyItem.id ? String(anyItem.id) : undefined,
    status: String(rawStatus),
    voidReason: rawVoidReason ? String(rawVoidReason) : null,
    voidedAt: rawVoidedAt ? String(rawVoidedAt) : null,
    voidedBy: rawVoidedBy ? String(rawVoidedBy) : null,
    buildingName: rawBuildingName ? String(rawBuildingName) : null,
    buildingWing: rawBuildingWing ? String(rawBuildingWing) : null,
    unitNumber: rawUnitNumber ? String(rawUnitNumber) : null,
    propertyType: rawPropertyType ? String(rawPropertyType) : null,
    mandalName: rawMandalName ? String(rawMandalName) : null,
    eventName: rawEventName ? String(rawEventName) : null,
    createdAt: String(rawCreatedAt),
  };
}
