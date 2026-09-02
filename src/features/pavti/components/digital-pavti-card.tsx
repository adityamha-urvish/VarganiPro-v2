import type { PavtiTemplateConfig, PavtiReceiptData } from "../types/pavti.types";
import { numberToMarathiWords } from "../utils/marathi-words";
import {
  GaneshaArtwork,
  DurgaArtwork,
  NeutralMandalaArtwork,
  SaffronFlagArtwork,
  CornerFiligree,
  MarigoldFlourish,
} from "./festival-artworks";

export interface DigitalPavtiCardProps {
  config: PavtiTemplateConfig;
  receipt: PavtiReceiptData;
  className?: string;
  idPrefix?: string;
}

export function DigitalPavtiCard({
  config,
  receipt,
  className = "",
  idPrefix = "digital-pavti-card",
}: DigitalPavtiCardProps) {
  const {
    festivalType = "ganpati",
    mandalName = "श्री गणेश मित्र मंडळ",
    eventName = "सार्वजनिक गणेशोत्सव २०२६",
    yearText,
    secretaryName = "अक्षय जोशी",
    secretaryDesignation = "अध्यक्ष / खजिनदार",
  } = config;

  const {
    receiptNumber,
    receiptPrefix = "VP-",
    donorName,
    amount,
    paymentMode,
    paymentReference,
    createdAt,
    buildingName,
    buildingWing,
    unitNumber,
    propertyType,
  } = receipt;

  // Format Date & Time
  const dateObj = createdAt ? new Date(createdAt) : new Date();
  const isValidDate = !isNaN(dateObj.getTime());
  const formattedDate = isValidDate
    ? dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "31/08/2026";
  const formattedTime = isValidDate
    ? dateObj.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "07:15 PM";

  // Amount formatting
  const formattedAmount = `₹${Number(amount || 0).toLocaleString("en-IN")}/-`;
  const marathiWords = numberToMarathiWords(amount);

  // Payment Mode mapping
  const modeDisplay = (() => {
    switch (paymentMode?.toLowerCase()) {
      case "cash":
        return "रोख (CASH)";
      case "upi":
        return "UPI";
      case "cheque":
        return "धनादेश (CHEQUE)";
      case "bank_transfer":
        return "बँक ट्रान्सफर";
      default:
        return paymentMode?.toUpperCase() || "रोख (CASH)";
    }
  })();

  // Property info
  const isGeneralDonation = !buildingName && !unitNumber;
  const isShop = propertyType === "commercial";

  // Theme-specific styles
  const isGanpati = festivalType === "ganpati";
  const isNavratri = festivalType === "navratri";
  const isOther = festivalType === "other";

  const themeColors = {
    ganpati: {
      primary: "#7A0C0C", // Royal Maroon
      accent: "#D9531E", // Festive Saffron
      border: "#8B1D1D",
      gold: "#C89D3C",
      bg: "#FFFDF7",
      ribbonBg: "#7A0C0C",
      amountBg: "#D9531E",
      badgeBorder: "#8B1D1D",
      cornerColor: "#7A0C0C",
      mantra: "॥ श्री गणेशाय नमः ॥",
      greeting: "गणपती बाप्पा मोरया ! 🙏",
    },
    navratri: {
      primary: "#5A1346", // Royal Purple / Crimson
      accent: "#E11D48", // Rose Red
      border: "#5A1346",
      gold: "#D97706",
      bg: "#FFFDF9",
      ribbonBg: "#5A1346",
      amountBg: "#5A1346",
      badgeBorder: "#5A1346",
      cornerColor: "#5A1346",
      mantra: "॥ जय माता दी ॥",
      greeting: "जय माता दी! 🙏",
    },
    other: {
      primary: "#144327", // Forest Green
      accent: "#16A34A",
      border: "#166534",
      gold: "#CA8A04",
      bg: "#F8FAF8",
      ribbonBg: "#144327",
      amountBg: "#144327",
      badgeBorder: "#166534",
      cornerColor: "#144327",
      mantra: null,
      greeting: null,
    },
  }[festivalType] || {
    primary: "#7A0C0C",
    accent: "#D9531E",
    border: "#8B1D1D",
    gold: "#C89D3C",
    bg: "#FFFDF7",
    ribbonBg: "#7A0C0C",
    amountBg: "#D9531E",
    badgeBorder: "#8B1D1D",
    cornerColor: "#7A0C0C",
    mantra: "॥ श्री गणेशाय नमः ॥",
    greeting: "गणपती बाप्पा मोरया ! 🙏",
  };

  const mandalNameLen = (mandalName || "").length;
  const mandalFontSizeClass =
    mandalNameLen > 55
      ? "text-sm sm:text-base font-black tracking-tight leading-tight line-clamp-2"
      : mandalNameLen > 30
      ? "text-base sm:text-lg font-black tracking-tight leading-tight line-clamp-2"
      : "text-lg sm:text-2xl font-black tracking-tight mt-0.5 line-clamp-2";

  const eventNameLen = (eventName || "").length;
  const eventFontSizeClass =
    eventNameLen > 45
      ? "text-[10px] sm:text-[11px] font-semibold text-slate-700 line-clamp-1"
      : "text-[11px] sm:text-xs font-semibold text-slate-700 line-clamp-1";

  const donorNameLen = (donorName || "").length;
  const donorFontSizeClass =
    donorNameLen > 30
      ? "font-bold text-slate-900 text-xs leading-tight line-clamp-1"
      : "font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-1";

  const buildingLen = `${buildingName || ""} ${buildingWing || ""}`.length;
  const buildingFontSizeClass =
    buildingLen > 35
      ? "font-bold text-slate-900 text-[10px] sm:text-[11px] leading-tight line-clamp-1"
      : "font-bold text-slate-900 text-xs leading-tight line-clamp-1";

  const secNameLen = (secretaryName || "").length;
  const secFontSizeClass =
    secNameLen > 35
      ? "text-[10px] sm:text-[11px] font-bold mt-0.5 line-clamp-1"
      : "text-xs font-bold mt-0.5 line-clamp-1";

  return (
    <div
      id={idPrefix}
      className={`relative w-full max-w-[864px] aspect-[16/9] mx-auto select-none rounded-xl overflow-hidden shadow-xl text-slate-900 border-4 flex flex-col justify-between ${className}`}
      style={{
        backgroundColor: themeColors.bg,
        borderColor: themeColors.border,
        fontFamily: "'Noto Sans Devanagari', 'Mukta', 'Tiro Devanagari Marathi', sans-serif",
      }}
    >
      {/* -------------------------------------------------------------
          1. TRADITIONAL ORNAMENTAL CORNERS
      -------------------------------------------------------------- */}
      <div className="absolute top-1 left-1 pointer-events-none">
        <CornerFiligree color={themeColors.cornerColor} className="w-8 h-8" />
      </div>
      <div className="absolute top-1 right-1 pointer-events-none rotate-90">
        <CornerFiligree color={themeColors.cornerColor} className="w-8 h-8" />
      </div>
      <div className="absolute bottom-1 left-1 pointer-events-none -rotate-90">
        <CornerFiligree color={themeColors.cornerColor} className="w-8 h-8" />
      </div>
      <div className="absolute bottom-1 right-1 pointer-events-none rotate-180">
        <CornerFiligree color={themeColors.cornerColor} className="w-8 h-8" />
      </div>

      {/* Outer gold hairline inset */}
      <div
        className="m-1.5 sm:m-2 rounded-lg border-2 p-2.5 sm:p-3 relative flex flex-col justify-between flex-1 overflow-hidden"
        style={{ borderColor: `${themeColors.gold}60` }}
      >
        {/* -------------------------------------------------------------
            2. HEADER SECTION: ARTWORK + MANDAL NAME + SEAL/FLAG
        -------------------------------------------------------------- */}
        <div className="relative flex items-start justify-between gap-2 pb-1">
          {/* Top-Left: Festival Artwork / Idol */}
          <div className="shrink-0 w-16 sm:w-20 pt-0.5 flex justify-center items-center">
            {isGanpati && <GaneshaArtwork className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-sm" />}
            {isNavratri && <DurgaArtwork className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-sm" />}
            {isOther && <NeutralMandalaArtwork className="w-14 h-14 sm:w-16 sm:h-16" />}
          </div>

          {/* Top-Center: Devotional Mantra + Mandal Name + Event Name */}
          <div className="grow text-center px-1 sm:px-3">
            {themeColors.mantra && (
              <p
                className="text-[11px] sm:text-xs font-bold tracking-wider"
                style={{ color: themeColors.primary }}
              >
                {themeColors.mantra}
              </p>
            )}

            <h1
              className={mandalFontSizeClass}
              style={{ color: themeColors.primary }}
            >
              {mandalName}
            </h1>

            <p className={`mt-0.5 flex items-center justify-center gap-1.5 ${eventFontSizeClass}`}>
              <span className="opacity-60 text-[10px]">— ❖ —</span>
              <span>{eventName}</span>
              <span className="opacity-60 text-[10px]">— ❖ —</span>
            </p>

            {/* Vargani Pavti Ribbon Banner */}
            <div className="mt-1 flex justify-center">
              <div
                className="px-5 sm:px-8 py-0.5 rounded-sm text-white font-bold text-[11px] sm:text-xs tracking-wide shadow-sm flex items-center gap-1.5"
                style={{ backgroundColor: themeColors.ribbonBg }}
              >
                <span className="text-[9px] text-amber-300">★</span>
                <span>वर्गणी पावती</span>
                <span className="text-[9px] text-amber-300">★</span>
              </div>
            </div>
          </div>

          {/* Top-Right: Anniversary Seal / Bhagwa Flag */}
          <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
            {/* Optional Anniversary Badge (Only if yearText provided) */}
            {yearText && yearText.trim() && (
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex flex-col items-center justify-center text-white font-black text-[9px] sm:text-[10px] shadow-md border-2 border-amber-300/80 leading-tight text-center"
                style={{ backgroundColor: themeColors.ribbonBg }}
              >
                <span>{yearText.split(" ")[0]}</span>
                <span className="text-[7px] sm:text-[8px] font-medium opacity-90">
                  {yearText.split(" ").slice(1).join(" ") || "वर्ष"}
                </span>
              </div>
            )}

            {/* Saffron Dhwaj for Festive, hidden for Other */}
            {!isOther && (
              <div className="shrink-0">
                <SaffronFlagArtwork className="w-7 h-9 sm:w-9 sm:h-11" />
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------------
            3. RECEIPT IDENTIFICATION STRIP (NO, DATE, TIME)
        -------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-y py-1 px-2 my-1 text-[11px] sm:text-xs bg-slate-50/60 rounded"
             style={{ borderColor: `${themeColors.gold}40` }}>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">पावती क्र. :</span>
            <span
              className="font-mono font-bold px-2 py-0.5 rounded text-white text-[11px] sm:text-xs"
              style={{ backgroundColor: themeColors.primary }}
            >
              {receiptPrefix}{receiptNumber}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-700">
            <span className="flex items-center gap-1">
              <span>📅</span>
              <span>दिनांक : {formattedDate}</span>
            </span>
            <span className="flex items-center gap-1">
              <span>🕒</span>
              <span>वेळ : {formattedTime}</span>
            </span>
          </div>
        </div>

        {/* -------------------------------------------------------------
            4. DONOR DETAILS + HERO AMOUNT BADGE + PAYMENT DETAILS
        -------------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3 my-1.5 items-center">
          {/* Left Column: Donor & Property Details (5 Cols) */}
          <div className="md:col-span-5 space-y-1.5 text-xs">
            {/* Donor Name */}
            <div className="flex items-start gap-1.5">
              <span className="text-sm shrink-0">👤</span>
              <div className="min-w-0 flex-1">
                <span className="text-slate-500 text-[10px] block">देणगीदार / Donor :</span>
                <span className={donorFontSizeClass}>
                  {donorName || "—"}
                </span>
              </div>
            </div>

            {/* Address / Property Linkage */}
            <div className="flex items-start gap-1.5 pt-1 border-t border-slate-200/60">
              <span className="text-sm shrink-0">🏠</span>
              <div className="min-w-0 flex-1">
                <span className="text-slate-500 text-[10px] block">पत्ता / Address :</span>
                {isGeneralDonation ? (
                  <span className="font-semibold text-amber-800 text-[11px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                    🌺 सामान्य देणगी / General Donation
                  </span>
                ) : (
                  <span className={buildingFontSizeClass}>
                    {buildingName} {buildingWing ? `(${buildingWing})` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Wing / Flat / Shop Info (Only if property linked) */}
            {!isGeneralDonation && (
              <div className="flex items-center gap-3 pl-5 text-[11px] text-slate-700">
                {buildingWing && (
                  <div>
                    <span className="text-slate-500 text-[10px]">विंग : </span>
                    <span className="font-bold">{buildingWing}</span>
                  </div>
                )}
                {unitNumber && (
                  <div>
                    <span className="text-slate-500 text-[10px]">
                      {isShop ? "गाळा क्र. : " : "फ्लॅट क्र. : "}
                    </span>
                    <span className="font-bold">{unitNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center Column: Big Hero Amount Badge (4 Cols) */}
          <div className="md:col-span-4 text-center py-1.5 px-2.5 rounded-xl bg-slate-50/80 border flex flex-col items-center justify-center shadow-xs"
               style={{ borderColor: `${themeColors.gold}50` }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              रक्कम / Amount
            </span>

            {/* High Impact Amount Pill */}
            <div
              className="w-full py-1.5 px-3 rounded-lg text-white font-black text-xl sm:text-2xl tracking-tight shadow-md flex items-center justify-center"
              style={{ backgroundColor: themeColors.amountBg }}
            >
              {formattedAmount}
            </div>

            {/* Amount in Marathi Words */}
            <p
              className="text-[10px] sm:text-[11px] font-semibold mt-1 leading-tight line-clamp-1"
              style={{ color: themeColors.primary }}
            >
              — ❖ — {marathiWords} — ❖ —
            </p>
          </div>

          {/* Right Column: Payment Mode & Reference (3 Cols) */}
          <div className="md:col-span-3 space-y-1.5 text-xs text-right md:text-left bg-slate-50/40 p-2 rounded-lg border border-slate-200/50">
            {/* Payment Mode */}
            <div>
              <span className="text-slate-500 text-[10px] block flex items-center gap-1">
                <span>💰</span> पेमेंट पद्धत :
              </span>
              <span className="font-bold text-slate-900 text-xs block mt-0.5">
                {modeDisplay}
              </span>
            </div>

            {/* Payment Reference (If present) */}
            {paymentReference && paymentReference.trim() && paymentMode !== "cash" && (
              <div className="pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 text-[10px] block flex items-center gap-1">
                  <span>📝</span> संदर्भ क्र. :
                </span>
                <span className="font-mono font-semibold text-slate-800 text-[10px] block mt-0.5 truncate max-w-[140px]">
                  {paymentReference}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------------
            5. FOOTER: BLESSING + SECRETARY SIGNATURE
        -------------------------------------------------------------- */}
        <div className="pt-1.5 border-t flex items-center justify-between gap-2"
             style={{ borderColor: `${themeColors.gold}40` }}>
          {/* Left / Center: Devotional Greeting & Thanks */}
          <div className="text-left">
            <p className="text-[10px] sm:text-[11px] text-slate-700 font-medium">
              आपल्या सहकार्याबद्दल मनःपूर्वक धन्यवाद!
            </p>
            {themeColors.greeting && (
              <div className="flex items-center justify-start gap-1 mt-0.5">
                <MarigoldFlourish className="w-3.5 h-3.5 shrink-0" />
                <span
                  className="font-bold text-xs"
                  style={{ color: themeColors.primary }}
                >
                  {themeColors.greeting}
                </span>
                <MarigoldFlourish className="w-3.5 h-3.5 shrink-0" />
              </div>
            )}
          </div>

          {/* Right: Secretary Name & Designation */}
          <div className="text-right shrink-0 max-w-[45%]">
            <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider truncate">
              {secretaryDesignation}
            </p>
            <p
              className={secFontSizeClass}
              style={{ color: themeColors.primary }}
            >
              {secretaryName || "अध्यक्ष / खजिनदार"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
