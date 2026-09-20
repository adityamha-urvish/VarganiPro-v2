import { useState } from "react";
import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { CachedBuildingSummary } from "@/lib/offline/offline-db";
import type { StartCollectionEvent, StartCollectionBook } from "./start-collection-card";
import { Button } from "@/components/ui/button";

export interface VolunteerHomeProps {
  session: CollectionSessionContext | null;
  selectedBuilding: CachedBuildingSummary | null;
  todayAmount: number;
  receiptCount: number;
  houseCount: number;
  pendingSyncCount: number;
  isOnline: boolean;
  onOpenCollect: () => void;
  onChangeBuilding: () => void;
  onNavigateToHistory: () => void;
  onNavigateToHandover: () => void;
  onNavigateToSessionDetails: () => void;
  onStartCollection?: () => void;
  onBackToHome?: () => void;
  // State A session start selection props
  events?: StartCollectionEvent[];
  books?: StartCollectionBook[];
  selectedEventId?: string;
  selectedBookId?: string;
  onEventChange?: (eventId: string) => void;
  onBookChange?: (bookId: string) => void;
  startSessionLoading?: boolean;
  startSessionError?: string | null;
}

export function VolunteerHome({
  session,
  selectedBuilding,
  todayAmount,
  receiptCount,
  houseCount,
  pendingSyncCount,
  onOpenCollect,
  onChangeBuilding,
  onNavigateToHistory,
  onNavigateToHandover,
  onNavigateToSessionDetails,
  onStartCollection,
  onBackToHome,
  events = [],
  books = [],
  selectedEventId = "",
  selectedBookId = "",
  onEventChange,
  onBookChange,
  startSessionLoading = false,
  startSessionError = null,
}: VolunteerHomeProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isActiveSession = Boolean(session && session.sessionStatus === "open");

  // Determine active book for State A display
  const activeBook =
    books.find((b) => b.id === selectedBookId) ||
    books[0] ||
    null;

  return (
    <div className="w-full max-w-md mx-auto space-y-5 px-1 sm:px-0 py-2 sm:py-4 animate-in fade-in select-none">
      {/* -------------------------------------------------------------
          0. BACK TO DASHBOARD (WHEN IN COLLECTION MODE)
      -------------------------------------------------------------- */}
      {onBackToHome && (
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            data-testid="volunteer-back-to-home-btn"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-200/90 px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer transition-all hover:bg-slate-50"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </button>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            ⚡ Collection Mode
          </span>
        </div>
      )}

      {/* -------------------------------------------------------------
          1. TOP CONTEXT BAR & MORE TRIGGER
      -------------------------------------------------------------- */}
      <div className="space-y-2">
        {/* Optional Multi-Event Switcher Pill */}
        {!isActiveSession && events.length > 1 && (
          <div className="flex items-center justify-between px-2 text-xs">
            <label
              htmlFor="volunteer-event-select"
              className="text-[10px] uppercase font-bold tracking-wider text-slate-400"
            >
              Event
            </label>
            <div className="relative inline-flex items-center">
              <select
                id="volunteer-event-select"
                value={selectedEventId}
                onChange={(e) => onEventChange?.(e.target.value)}
                disabled={startSessionLoading}
                className="bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Top Context Card & More Button */}
        <div className="flex items-stretch justify-between gap-2">
          {isActiveSession ? (
            /* STATE B: Active Building & Session Context */
            <button
              type="button"
              data-testid="volunteer-building-context"
              onClick={onChangeBuilding}
              className="flex items-center gap-2.5 text-left px-3.5 py-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all cursor-pointer group flex-1 min-w-0"
            >
              <span className="text-xl shrink-0">🏢</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-900 truncate flex items-center justify-between">
                  <span className="truncate">
                    {selectedBuilding
                      ? `${selectedBuilding.buildingName}${selectedBuilding.wing ? ` · Wing ${selectedBuilding.wing}` : ""}`
                      : "Select Building"}
                  </span>
                  {session && (
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ml-1 shrink-0">
                      {session.bookNumber}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-bold text-amber-600 group-hover:text-amber-700 flex items-center justify-between mt-0.5">
                  <span className="flex items-center gap-1">
                    <span>{selectedBuilding ? "Change Building" : "Select Building"}</span>
                    <span className="text-xs">›</span>
                  </span>
                  {session && (
                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      {session.prefix}{session.currentNumber}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ) : (
            /* STATE A: Consolidated Sleek Receipt Book Context Card */
            <div className="relative flex items-center gap-2.5 text-left px-3.5 py-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex-1 min-w-0 group">
              <span className="text-xl shrink-0">📚</span>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="volunteer-book-select"
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate cursor-pointer"
                >
                  Receipt Book
                </label>
                <div className="text-xs font-black text-slate-900 truncate font-mono mt-0.5 flex items-center justify-between">
                  <span className="truncate">
                    {session?.bookNumber || activeBook?.book_number || "Select Receipt Book"}
                  </span>
                  {books.length > 1 && (
                    <span className="text-slate-400 text-xs font-bold shrink-0 ml-1">⌄</span>
                  )}
                </div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                  {session
                    ? `Series ${session.prefix}${session.startNumber}..${session.endNumber}`
                    : activeBook
                    ? `${activeBook.prefix}${activeBook.current_number ?? activeBook.start_number}..${activeBook.end_number}`
                    : "Ready to start session"}
                </div>
              </div>

              {/* Underlying Accessible Native Select for changing books */}
              {books.length > 0 && (
                <select
                  id="volunteer-book-select"
                  value={selectedBookId || activeBook?.id || ""}
                  onChange={(e) => onBookChange?.(e.target.value)}
                  disabled={startSessionLoading || books.length <= 1}
                  className={`absolute inset-0 w-full h-full opacity-0 ${books.length > 1 ? "cursor-pointer" : "cursor-default"}`}
                  aria-label="Select Receipt Book"
                >
                  {books.map((bk) => (
                    <option key={bk.id} value={bk.id}>
                      {bk.book_number} ({bk.prefix}{bk.current_number ?? bk.start_number}..{bk.end_number})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Compact More '⋯' Control */}
          <button
            type="button"
            data-testid="volunteer-more-trigger"
            onClick={() => setShowMoreMenu(true)}
            className="w-12 shrink-0 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-all cursor-pointer relative"
            aria-label="Options"
            title="Options"
          >
            <span className="text-lg font-black leading-none">⋯</span>
            {pendingSyncCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-white" />
            )}
          </button>
        </div>

        {/* Start Session Error Alert (if any) */}
        {!isActiveSession && startSessionError && (
          <p className="text-xs text-red-600 font-medium px-2 pt-1">{startSessionError}</p>
        )}
      </div>

      {/* -------------------------------------------------------------
          2. CENTRAL TODAY'S COLLECTION SUMMARY (HERO TYPOGRAPHY)
      -------------------------------------------------------------- */}
      <div className="py-5 sm:py-7 text-center space-y-2 rounded-3xl bg-gradient-to-b from-slate-50/80 to-transparent border border-slate-100/80 shadow-2xs">
        <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
          Today's Collection
        </span>

        <div className="font-brand-pro text-5xl sm:text-6xl font-black text-slate-950 tracking-tight">
          ₹{todayAmount.toLocaleString("en-IN")}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-slate-600 pt-0.5">
          <span className="font-bold text-slate-900">{receiptCount} {receiptCount === 1 ? "receipt" : "receipts"}</span>
          {houseCount > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span>{houseCount} {houseCount === 1 ? "unit" : "units"}</span>
            </>
          )}
          {pendingSyncCount > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-amber-600 font-bold">({pendingSyncCount} offline)</span>
            </>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. PRIMARY ACTION (DOMINANT THUMB-FRIENDLY ORANGE BUTTON)
      -------------------------------------------------------------- */}
      <div className="space-y-3">
        {isActiveSession ? (
          <Button
            type="button"
            data-testid="volunteer-collect-btn"
            onClick={onOpenCollect}
            className="w-full h-15 sm:h-16 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-lg sm:text-xl tracking-tight shadow-md shadow-orange-600/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Create Receipt · Collect</span>
            <span className="text-xl leading-none">→</span>
          </Button>
        ) : (
          <Button
            type="button"
            data-testid="volunteer-start-btn"
            onClick={onStartCollection}
            disabled={startSessionLoading || (!selectedBookId && books.length > 0 && !activeBook)}
            className="w-full h-15 sm:h-16 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-lg sm:text-xl tracking-tight shadow-md shadow-orange-600/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {startSessionLoading ? (
              <span>Starting session...</span>
            ) : (
              <>
                <span>Start Collection</span>
                <span className="text-xl leading-none">→</span>
              </>
            )}
          </Button>
        )}

        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 px-2">
          <span>🔒 Secure Offline Cash</span>
          <span>⚡ Instant Receipts</span>
        </div>
      </div>

      {/* -------------------------------------------------------------
          4. SECONDARY ACTION DRAWER / MORE SHEET (ONE COMPACT TRIGGER)
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
                  onChangeBuilding();
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
                  onNavigateToHistory();
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
                  onNavigateToHandover();
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
                  onNavigateToSessionDetails();
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
