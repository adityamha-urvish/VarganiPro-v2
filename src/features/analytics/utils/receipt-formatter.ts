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
 * Resolves festival kind from event name and mandal name.
 * Maps:
 * - Navratri / Durga / Mata / Devi / Dussehra -> 'navratri'
 * - Ganesh / Ganpati / Bappa / Vinayak -> 'ganesh'
 * - All other / unknown festivals -> 'other' (neutral)
 */
export function resolveFestivalKind(
  eventName?: string | null,
  mandalName?: string | null
): FestivalKind {
  const text = `${eventName || ""} ${mandalName || ""}`.toLowerCase();

  // 1. Check Navratri / Durga / Mata / Devi
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

  // 2. Check Ganesh / Ganpati / Bappa / Vinayak
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
  mandalName?: string | null
): FestivalGreetings {
  const kind = resolveFestivalKind(eventName, mandalName);
  switch (kind) {
    case "navratri":
      return {
        kind: "navratri",
        headerDevotional: "🚩 जय माता दी 🚩",
        closingGreeting: "आपल्या सहकार्याबद्दल धन्यवाद!\nजय माता दी! 🙏🌺",
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
