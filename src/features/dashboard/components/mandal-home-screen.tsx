import { useState } from "react";
import type { NavigationTab } from "@/app/layouts/RoleNavigation";

export interface MetricsBreakdown {
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  receiptCount: number;
  pendingSyncCount?: number;
}

export interface MandalHomeScreenProps {
  userName?: string;
  mandalName?: string;
  eventName?: string;
  eventCode?: string;
  eventDates?: string;
  eventProgressPct?: number;
  sessionBookNumber?: string;
  sessionReceiptNumber?: string;
  sessionStatus?: string;
  // Fallback flat props for backward compatibility
  totalAmount?: number;
  cashAmount?: number;
  upiAmount?: number;
  receiptCount?: number;
  isLive?: boolean;
  isAdmin?: boolean;
  hasActiveSession?: boolean;
  pendingSyncCount?: number;
  // Structured carousel metrics & expenses
  adminTotalMetrics?: MetricsBreakdown;
  adminTodayMetrics?: MetricsBreakdown;
  volunteerMyTodayMetrics?: MetricsBreakdown;
  volunteerMandalMetrics?: MetricsBreakdown;
  totalExpenses?: number;
  todayExpenses?: number;
  // Session aggregates for active contextual banner
  sessionReceiptCount?: number;
  sessionTotalAmount?: number;
  onStartCollection: () => void;
  onStartGeneralReceipt?: () => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onNavigateToHistory?: () => void;
  onNavigateToHandover?: () => void;
  onNavigateToBooks?: () => void;
  onNavigateToSessionDetails?: () => void;
  onNavigateToCloseSession?: () => void;
  onChangeBuilding?: () => void;
  onShowMandalQr?: () => void;
}

export function MandalHomeScreen({
  userName = "Volunteer",
  mandalName = "उत्सव मंडळ",
  eventName = "उत्सव २०२६",
  eventCode = "UTSAV",
  eventDates = "",
  eventProgressPct = 0,
  sessionBookNumber,
  sessionReceiptNumber,
  sessionStatus,
  totalAmount = 0,
  cashAmount = 0,
  upiAmount = 0,
  receiptCount = 0,
  isLive = true,
  isAdmin = false,
  hasActiveSession = false,
  pendingSyncCount = 0,
  adminTotalMetrics,
  adminTodayMetrics,
  volunteerMyTodayMetrics,
  volunteerMandalMetrics,
  totalExpenses = 0,
  todayExpenses = 0,
  sessionReceiptCount,
  sessionTotalAmount,
  onStartCollection,
  onStartGeneralReceipt: _onStartGeneralReceipt,
  onNavigateTab,
  onNavigateToHistory: _onNavigateToHistory,
  onNavigateToHandover: _onNavigateToHandover,
  onNavigateToBooks: _onNavigateToBooks,
  onNavigateToSessionDetails,
  onNavigateToCloseSession,
  onChangeBuilding: _onChangeBuilding,
  onShowMandalQr: _onShowMandalQr,
}: MandalHomeScreenProps) {
  const [activeSlide, setActiveSlide] = useState<0 | 1>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Extract first name for warm greeting
  const firstName = userName ? userName.split(" ")[0] : "Mitra";

  // Handle Touch Swipe Gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    if (deltaX < -35) {
      // Swiped Left -> go to slide 1
      setActiveSlide(1);
    } else if (deltaX > 35) {
      // Swiped Right -> go to slide 0
      setActiveSlide(0);
    }
    setTouchStartX(null);
  };

  // Determine active slide content based on role
  let tabLabel0 = "Total Mandal";
  let tabLabel1 = "Today's";
  let headerLabel = "TOTAL MANDAL COLLECTION";
  let statusBadge = "LIVE";
  let displayAmount = totalAmount;
  let displayCash = cashAmount;
  let displayUpi = upiAmount;
  let displayReceipts = receiptCount;
  let displayOfflineCount = 0;
  let expenseText = `Total Expenses: ₹${totalExpenses.toLocaleString("en-IN")}`;

  if (isAdmin) {
    tabLabel0 = "Total Mandal";
    tabLabel1 = "Today's";
    if (activeSlide === 0) {
      headerLabel = "TOTAL MANDAL COLLECTION";
      statusBadge = isLive ? "LIVE" : "ALL";
      displayAmount = adminTotalMetrics?.totalAmount ?? totalAmount;
      displayCash = adminTotalMetrics?.cashAmount ?? cashAmount;
      displayUpi = adminTotalMetrics?.upiAmount ?? upiAmount;
      displayReceipts = adminTotalMetrics?.receiptCount ?? receiptCount;
      expenseText = `Total Expenses: ₹${totalExpenses.toLocaleString("en-IN")}`;
    } else {
      headerLabel = "TODAY'S MANDAL COLLECTION";
      statusBadge = "TODAY";
      displayAmount = adminTodayMetrics?.totalAmount ?? 0;
      displayCash = adminTodayMetrics?.cashAmount ?? 0;
      displayUpi = adminTodayMetrics?.upiAmount ?? 0;
      displayReceipts = adminTodayMetrics?.receiptCount ?? 0;
      expenseText = `Today's Expenses: ₹${todayExpenses.toLocaleString("en-IN")}`;
    }
  } else {
    // VOLUNTEER
    tabLabel0 = "My Today";
    tabLabel1 = "Total Mandal";
    if (activeSlide === 0) {
      headerLabel = "MY TODAY'S COLLECTION";
      statusBadge = "⚡ TODAY";
      displayAmount = volunteerMyTodayMetrics?.totalAmount ?? totalAmount;
      displayCash = volunteerMyTodayMetrics?.cashAmount ?? cashAmount;
      displayUpi = volunteerMyTodayMetrics?.upiAmount ?? upiAmount;
      displayReceipts = volunteerMyTodayMetrics?.receiptCount ?? receiptCount;
      displayOfflineCount = volunteerMyTodayMetrics?.pendingSyncCount ?? pendingSyncCount;
      expenseText = "";
    } else {
      headerLabel = "TOTAL MANDAL'S COLLECTION";
      statusBadge = isLive ? "LIVE" : "MANDAL";
      displayAmount = volunteerMandalMetrics?.totalAmount ?? totalAmount;
      displayCash = volunteerMandalMetrics?.cashAmount ?? cashAmount;
      displayUpi = volunteerMandalMetrics?.upiAmount ?? upiAmount;
      displayReceipts = volunteerMandalMetrics?.receiptCount ?? receiptCount;
      expenseText = `Total Expenses: ₹${totalExpenses.toLocaleString("en-IN")}`;
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 sm:space-y-5 px-1 sm:px-0 py-1 sm:py-2 animate-in fade-in select-none">
      {/* -------------------------------------------------------------
          1. GREETING & MANDAL IDENTITY
      -------------------------------------------------------------- */}
      <div className="flex items-start justify-between gap-2 px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Namaste, {firstName}!
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-amber-800/80 mt-0.5">
            {mandalName} · {eventName}
          </p>
          {sessionBookNumber && (
            <div className="flex items-center gap-1.5 pt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-white/90 text-slate-800 border border-slate-200/80 shadow-2xs">
                <span>📖</span>
                <span>{sessionBookNumber}</span>
              </span>
              {sessionReceiptNumber && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-100/90 text-amber-950 border border-amber-300/60 shadow-2xs">
                  <span>Next:</span>
                  <span>{sessionReceiptNumber}</span>
                </span>
              )}
              {sessionStatus === "completed" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300/60">
                  Completed
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pt-1">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100/80 text-amber-900 border border-amber-300/60 shadow-2xs">
            <span>🪔</span>
            <span>{eventCode}</span>
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. DARK NAVY HERO COLLECTION SUMMARY CAROUSEL CARD
      -------------------------------------------------------------- */}
      <div
        data-testid="collection-summary-carousel"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#061820] via-[#0B2530] to-[#0F3240] text-white p-4 sm:p-5 shadow-xl border border-teal-800/30 transition-all duration-300"
      >
        {/* Subtle decorative background stars / mandala shimmer */}
        <div className="absolute top-2 right-3 text-amber-400/20 text-4xl pointer-events-none select-none font-serif">
          ✦
        </div>
        <div className="absolute bottom-1 right-12 text-teal-400/10 text-6xl pointer-events-none select-none font-serif">
          ❋
        </div>

        {/* Top Control Bar: Segmented Switcher + Dot Indicators */}
        <div className="flex items-center justify-between gap-2 pb-2 mb-1 border-b border-teal-800/30">
          <div className="inline-flex items-center bg-black/40 p-0.5 rounded-xl border border-teal-700/40">
            <button
              type="button"
              data-testid="carousel-tab-0"
              onClick={() => setActiveSlide(0)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSlide === 0
                  ? "bg-amber-500 text-slate-950 shadow-xs font-black"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {tabLabel0}
            </button>
            <button
              type="button"
              data-testid="carousel-tab-1"
              onClick={() => setActiveSlide(1)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSlide === 1
                  ? "bg-amber-500 text-slate-950 shadow-xs font-black"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {tabLabel1}
            </button>
          </div>

          <div className="flex items-center gap-1.5 pr-1">
            <button
              type="button"
              onClick={() => setActiveSlide(0)}
              className={`h-2 rounded-full transition-all ${
                activeSlide === 0 ? "w-5 bg-amber-400" : "w-2 bg-slate-600"
              }`}
              aria-label="Slide 1"
            />
            <button
              type="button"
              onClick={() => setActiveSlide(1)}
              className={`h-2 rounded-full transition-all ${
                activeSlide === 1 ? "w-5 bg-amber-400" : "w-2 bg-slate-600"
              }`}
              aria-label="Slide 2"
            />
          </div>
        </div>

        {/* Header Row: Current Slide Label + Status Pill */}
        <div className="flex items-center justify-between pt-1">
          <span
            data-testid="carousel-slide-title"
            className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-amber-300/90 font-mono"
          >
            {headerLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 backdrop-blur-xs">
            {statusBadge === "LIVE" && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
            {statusBadge}
          </span>
        </div>

        {/* Central Currency Figure */}
        <div className="my-2.5 sm:my-3.5">
          <div
            data-testid="carousel-main-amount"
            className="text-4xl sm:text-5xl font-black text-white tracking-tight font-brand-pro"
          >
            ₹{displayAmount.toLocaleString("en-IN")}
          </div>
          {displayOfflineCount > 0 && (
            <div className="text-[11px] font-bold text-amber-400 mt-0.5 flex items-center gap-1">
              <span>⚡</span>
              <span>({displayOfflineCount} offline receipts captured)</span>
            </div>
          )}
        </div>

        {/* Subtle Divider */}
        <div className="h-px w-full bg-gradient-to-r from-teal-500/20 via-teal-400/30 to-transparent my-2.5" />

        {/* 3-Column Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-left">
          {/* Cash */}
          <div className="space-y-0.5">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <span>💵</span>
              <span>Cash</span>
            </div>
            <div
              data-testid="carousel-cash-amount"
              className="text-xs sm:text-sm font-black text-emerald-300 font-mono"
            >
              ₹{displayCash.toLocaleString("en-IN")}
            </div>
          </div>

          {/* UPI */}
          <div className="space-y-0.5">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <span>📱</span>
              <span>UPI</span>
            </div>
            <div
              data-testid="carousel-upi-amount"
              className="text-xs sm:text-sm font-black text-sky-300 font-mono"
            >
              ₹{displayUpi.toLocaleString("en-IN")}
            </div>
          </div>

          {/* Receipts */}
          <div className="space-y-0.5">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <span>📜</span>
              <span>Receipts</span>
            </div>
            <div
              data-testid="carousel-receipt-count"
              className="text-xs sm:text-sm font-black text-amber-200 font-mono"
            >
              {displayReceipts} {displayReceipts === 1 ? "receipt" : "receipts"}
            </div>
          </div>
        </div>

        {/* Secondary Figure: Expenses Row (if available) */}
        {expenseText && (
          <div className="mt-3 pt-2.5 border-t border-teal-800/40 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onNavigateTab("expenses")}
              className="inline-flex items-center gap-1.5 font-bold text-amber-200/90 hover:text-amber-100 transition-colors cursor-pointer group"
            >
              <span>💸</span>
              <span data-testid="carousel-expense-text" className="group-hover:underline">
                {expenseText}
              </span>
              <span className="text-[10px] text-amber-400 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </button>
            <span className="text-[10px] text-slate-400 font-medium">Festival Scope</span>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
          CONTEXTUAL ACTIVE SESSION STRIP (LIGHTWEIGHT & THUMB-FRIENDLY)
      -------------------------------------------------------------- */}
      {hasActiveSession && (
        <div
          data-testid="active-session-banner"
          className="rounded-2xl bg-emerald-950 text-white border border-emerald-500/40 px-3.5 py-2.5 shadow-sm flex items-center justify-between gap-2.5 animate-in fade-in"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-black text-emerald-300 block truncate">
                🟢 Collection Active
              </span>
              <span className="text-[11px] font-bold text-slate-200 block truncate font-mono">
                {sessionReceiptCount ?? receiptCount} {((sessionReceiptCount ?? receiptCount) === 1) ? "receipt" : "receipts"} · ₹{(sessionTotalAmount ?? totalAmount).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="banner-btn-continue-session"
              onClick={onStartCollection}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors cursor-pointer shadow-2xs flex items-center gap-0.5"
            >
              <span>Continue</span>
              <span>→</span>
            </button>
            <button
              type="button"
              data-testid="banner-btn-end-session"
              onClick={onNavigateToCloseSession || onNavigateToSessionDetails}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white border border-emerald-500/30 font-bold text-xs transition-colors cursor-pointer"
            >
              End Session
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. QUICK ACTIONS GRID (5 CLEAN STATE-AWARE TILES)
      -------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Quick Actions
          </h2>
          {pendingSyncCount > 0 && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              {pendingSyncCount} offline receipts
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {/* TILE 1: State-Aware Collection Tile */}
          <button
            type="button"
            data-testid="home-tile-start-collection"
            onClick={onStartCollection}
            className={`flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-xs cursor-pointer group min-h-[92px] ${
              hasActiveSession
                ? "bg-emerald-100/90 hover:bg-emerald-100 border-emerald-300 text-emerald-950"
                : "bg-rose-100/90 hover:bg-rose-100 border-rose-200/90 text-rose-950"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl group-hover:scale-110 transition-transform">
                {hasActiveSession ? "🟢" : "⚡"}
              </span>
              <span className={`text-sm font-black ${hasActiveSession ? "text-emerald-700" : "text-rose-400 group-hover:text-rose-700"}`}>
                →
              </span>
            </div>
            <div>
              <span className="block font-black text-sm leading-tight">
                {hasActiveSession ? "Collection Active" : "Start Collection"}
              </span>
              <span className={`text-[11px] font-semibold ${hasActiveSession ? "text-emerald-800" : "text-rose-800/80"}`}>
                {hasActiveSession
                  ? `${sessionReceiptCount ?? receiptCount} receipts · ₹${(sessionTotalAmount ?? totalAmount).toLocaleString("en-IN")}`
                  : "New receipt session"}
              </span>
            </div>
          </button>

          {/* TILE 2: Buildings / Residential Coverage */}
          <button
            type="button"
            data-testid="home-tile-buildings"
            onClick={() => onNavigateTab("masterData")}
            className="flex flex-col justify-between p-3.5 rounded-2xl bg-cyan-100/90 hover:bg-cyan-100 border border-cyan-200/90 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-xs cursor-pointer group min-h-[92px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl group-hover:scale-110 transition-transform">🏢</span>
              <span className="text-cyan-400 group-hover:text-cyan-700 text-sm font-black">→</span>
            </div>
            <div>
              <span className="block font-black text-sm text-cyan-950 leading-tight">
                Buildings
              </span>
              <span className="text-[11px] font-semibold text-cyan-800/80">
                Buildings & Shops
              </span>
            </div>
          </button>

          {/* TILE 3: Recent Receipts */}
          <button
            type="button"
            data-testid="home-tile-receipts"
            onClick={() => onNavigateTab("history")}
            className="flex flex-col justify-between p-3.5 rounded-2xl bg-orange-100/90 hover:bg-orange-100 border border-orange-200/90 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-xs cursor-pointer group min-h-[92px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl group-hover:scale-110 transition-transform">📜</span>
              <span className="text-orange-400 group-hover:text-orange-700 text-sm font-black">→</span>
            </div>
            <div>
              <span className="block font-black text-sm text-orange-950 leading-tight">
                Recent Receipts
              </span>
              <span className="text-[11px] font-semibold text-orange-800/80">
                History & Reprints
              </span>
            </div>
          </button>

          {/* TILE 4: Handovers */}
          <button
            type="button"
            data-testid="home-tile-handovers"
            onClick={() => onNavigateTab("handovers")}
            className="flex flex-col justify-between p-3.5 rounded-2xl bg-purple-100/90 hover:bg-purple-100 border border-purple-200/90 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-xs cursor-pointer group min-h-[92px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl group-hover:scale-110 transition-transform">🤝</span>
              <span className="text-purple-400 group-hover:text-purple-700 text-sm font-black">→</span>
            </div>
            <div>
              <span className="block font-black text-sm text-purple-950 leading-tight">
                Handovers
              </span>
              <span className="text-[11px] font-semibold text-purple-800/80">
                {isAdmin ? "Verify & Settle" : "Cash Handover"}
              </span>
            </div>
          </button>

          {/* TILE 5: Expenses */}
          <button
            type="button"
            data-testid="home-tile-expenses"
            onClick={() => onNavigateTab("expenses")}
            className="flex flex-col justify-between p-3.5 rounded-2xl bg-emerald-100/90 hover:bg-emerald-100 border border-emerald-200/90 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-xs cursor-pointer group min-h-[92px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl group-hover:scale-110 transition-transform">💸</span>
              <span className="text-emerald-500 group-hover:text-emerald-700 text-sm font-black">→</span>
            </div>
            <div>
              <span className="block font-black text-sm text-emerald-950 leading-tight">
                Expenses
              </span>
              <span className="text-[11px] font-semibold text-emerald-800/80">
                Festival Expenses
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          4. EVENT INFO & PROGRESS CARD
      -------------------------------------------------------------- */}
      <div className="rounded-2xl bg-white/95 border border-slate-200/90 p-4 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900">
              {eventName} ({eventCode})
            </h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              📅 {eventDates}
            </p>
          </div>
          <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-mono">
            {eventProgressPct}% Complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
          <div
            className="bg-gradient-to-r from-amber-500 to-orange-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, eventProgressPct))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
