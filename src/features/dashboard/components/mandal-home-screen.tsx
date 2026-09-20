import { useState } from "react";
import type { NavigationTab } from "@/app/layouts/RoleNavigation";

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
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  receiptCount: number;
  isLive?: boolean;
  isAdmin?: boolean;
  hasActiveSession?: boolean;
  pendingSyncCount?: number;
  onStartCollection: () => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onNavigateToHistory?: () => void;
  onNavigateToHandover?: () => void;
  onNavigateToSessionDetails?: () => void;
  onChangeBuilding?: () => void;
}

export function MandalHomeScreen({
  userName = "Volunteer",
  mandalName = "श्री गणेश मित्र मंडळ",
  eventName = "Ganesh Utsav 2026",
  eventCode = "GU-26",
  eventDates = "10 Sep – 20 Sep 2026",
  eventProgressPct = 68,
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
  onStartCollection,
  onNavigateTab,
  onNavigateToHistory,
  onNavigateToHandover,
  onNavigateToSessionDetails,
  onChangeBuilding,
}: MandalHomeScreenProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // Extract first name for warm greeting
  const firstName = userName ? userName.split(" ")[0] : "Mitra";

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

          {/* Compact More '⋯' Control */}
          <button
            type="button"
            data-testid="volunteer-more-trigger"
            onClick={() => setShowMoreMenu(true)}
            className="w-8 h-8 rounded-full bg-white border border-amber-900/15 shadow-2xs flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-all cursor-pointer relative"
            aria-label="Options"
            title="Options"
          >
            <span className="text-base font-black leading-none">⋯</span>
            {pendingSyncCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 border border-white" />
            )}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. DARK NAVY HERO COLLECTION SUMMARY CARD
      -------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#061820] via-[#0B2530] to-[#0F3240] text-white p-5 sm:p-6 shadow-xl border border-teal-800/30">
        {/* Subtle decorative background stars / mandala shimmer */}
        <div className="absolute top-2 right-3 text-amber-400/20 text-4xl pointer-events-none select-none font-serif">
          ✦
        </div>
        <div className="absolute bottom-1 right-12 text-teal-400/10 text-6xl pointer-events-none select-none font-serif">
          ❋
        </div>

        {/* Header Row: Label + LIVE Pill */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-amber-300/90 font-mono">
            TOTAL COLLECTION
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 backdrop-blur-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Central Currency Figure */}
        <div className="my-3 sm:my-4">
          <div className="text-4xl sm:text-5xl font-black text-white tracking-tight font-brand-pro">
            ₹{totalAmount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* Subtle Divider */}
        <div className="h-px w-full bg-gradient-to-r from-teal-500/20 via-teal-400/30 to-transparent my-3.5" />

        {/* 3-Column Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-left">
          {/* Cash */}
          <div className="space-y-0.5">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <span>💵</span>
              <span>Cash</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-emerald-300 font-mono">
              ₹{cashAmount.toLocaleString("en-IN")}
            </div>
          </div>

          {/* UPI */}
          <div className="space-y-0.5">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <span>📱</span>
              <span>UPI</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-sky-300 font-mono">
              ₹{upiAmount.toLocaleString("en-IN")}
            </div>
          </div>

          {/* Receipts */}
          <div className="space-y-0.5">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <span>📜</span>
              <span>Receipts</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-amber-200 font-mono">
              {receiptCount} {receiptCount === 1 ? "receipt" : "receipts"}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. QUICK ACTIONS GRID (PASTEL TILES)
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

        <div className={`grid gap-2.5 ${isAdmin ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
          {/* Action 1: Start Collection */}
          <button
            type="button"
            data-testid="home-tile-start-collection"
            onClick={onStartCollection}
            className="flex flex-col justify-between p-3.5 rounded-2xl bg-rose-100/90 hover:bg-rose-100 border border-rose-200/90 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-xs cursor-pointer group min-h-[92px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl group-hover:scale-110 transition-transform">⚡</span>
              <span className="text-rose-400 group-hover:text-rose-700 text-sm font-black">→</span>
            </div>
            <div>
              <span className="block font-black text-sm text-rose-950 leading-tight">
                Start Collection
              </span>
              <span className="text-[11px] font-semibold text-rose-800/80">
                New receipt session
              </span>
            </div>
          </button>

          {/* Action 2: Buildings */}
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
                Flats & Units
              </span>
            </div>
          </button>

          {/* Action 3: Volunteers (Admin Only) */}
          {isAdmin && (
            <button
              type="button"
              data-testid="home-tile-volunteers"
              onClick={() => onNavigateTab("volunteers")}
              className="flex flex-col justify-between p-3.5 rounded-2xl bg-lime-100/90 hover:bg-lime-100 border border-lime-200/90 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-xs cursor-pointer group min-h-[92px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl group-hover:scale-110 transition-transform">👥</span>
                <span className="text-lime-500 group-hover:text-lime-700 text-sm font-black">→</span>
              </div>
              <div>
                <span className="block font-black text-sm text-lime-950 leading-tight">
                  Volunteers
                </span>
                <span className="text-[11px] font-semibold text-lime-800/80">
                  Team & Access
                </span>
              </div>
            </button>
          )}

          {/* Action 4: Handovers */}
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

          {/* Action 5: Recent Receipts */}
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

          {/* Action 6: Reports (Admin Only) */}
          {isAdmin && (
            <button
              type="button"
              data-testid="home-tile-reports"
              onClick={() => onNavigateTab("more")}
              className="flex flex-col justify-between p-3.5 rounded-2xl bg-amber-100/90 hover:bg-amber-100 border border-amber-200/90 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-xs cursor-pointer group min-h-[92px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
                <span className="text-amber-500 group-hover:text-amber-700 text-sm font-black">→</span>
              </div>
              <div>
                <span className="block font-black text-sm text-amber-950 leading-tight">
                  Reports & More
                </span>
                <span className="text-[11px] font-semibold text-amber-800/80">
                  Analytics & Export
                </span>
              </div>
            </button>
          )}
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

      {/* -------------------------------------------------------------
          5. DOMINANT MAROON-ORANGE 'START COLLECTION' CTA
      -------------------------------------------------------------- */}
      <div className="pt-1">
        <button
          type="button"
          data-testid={hasActiveSession ? "volunteer-collect-btn" : "volunteer-start-btn"}
          onClick={onStartCollection}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#800020] via-[#A82400] to-[#E05300] hover:from-[#6B001B] hover:to-[#C74900] text-white font-extrabold text-base sm:text-lg tracking-tight shadow-lg shadow-orange-950/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>⚡</span>
          <span>
            {hasActiveSession ? "Collect" : "Start Collection"}
          </span>
          <span className="text-lg leading-none">→</span>
        </button>

        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 px-2 pt-2">
          <span>🔒 Secure Offline Cash</span>
          <span>⚡ Instant Receipts</span>
        </div>
      </div>

      {/* -------------------------------------------------------------
          6. MORE OPTIONS MODAL / SHEET
      -------------------------------------------------------------- */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200 animate-in slide-in-from-bottom-4 duration-200"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                Options
              </h3>
              <button
                type="button"
                onClick={() => setShowMoreMenu(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center text-sm font-bold cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Menu Options List */}
            <div className="space-y-2">
              <button
                type="button"
                data-testid="more-opt-buildings"
                onClick={() => {
                  setShowMoreMenu(false);
                  if (onChangeBuilding) onChangeBuilding();
                  else onNavigateTab("masterData");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-sm transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🏢</span>
                  <div className="text-left">
                    <span className="block font-bold">Buildings & Flats</span>
                    <span className="text-[11px] font-normal text-slate-500">Corridors & Units</span>
                  </div>
                </div>
                <span className="text-slate-400">→</span>
              </button>

              <button
                type="button"
                data-testid="more-opt-history"
                onClick={() => {
                  setShowMoreMenu(false);
                  if (onNavigateToHistory) onNavigateToHistory();
                  else onNavigateTab("history");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-sm transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">📜</span>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="block font-bold">Receipt History</span>
                      {pendingSyncCount > 0 && (
                        <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2">
                          {pendingSyncCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-normal text-slate-500">View & Reprints</span>
                  </div>
                </div>
                <span className="text-slate-400">→</span>
              </button>

              <button
                type="button"
                data-testid="more-opt-handover"
                onClick={() => {
                  setShowMoreMenu(false);
                  if (onNavigateToHandover) onNavigateToHandover();
                  else onNavigateTab("handovers");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-sm transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🤝</span>
                  <div className="text-left">
                    <span className="block font-bold">Session Handover</span>
                    <span className="text-[11px] font-normal text-slate-500">Submit cash & closing</span>
                  </div>
                </div>
                <span className="text-slate-400">→</span>
              </button>

              <button
                type="button"
                data-testid="more-opt-session-details"
                onClick={() => {
                  setShowMoreMenu(false);
                  if (onNavigateToSessionDetails) onNavigateToSessionDetails();
                  else onNavigateTab("collection");
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-sm transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚙️</span>
                  <div className="text-left">
                    <span className="block font-bold">Session Details & Close</span>
                    <span className="text-[11px] font-normal text-slate-500">Summary & Close</span>
                  </div>
                </div>
                <span className="text-slate-400">→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
