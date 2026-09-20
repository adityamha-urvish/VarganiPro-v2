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

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-between min-h-[calc(100svh-6rem)] px-1 sm:px-0 py-2 animate-in fade-in select-none">
      {/* -------------------------------------------------------------
          1. TOP BAR / BUILDING CONTEXT
      -------------------------------------------------------------- */}
      <div className="space-y-3">
        {/* Context & More Trigger Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Building / Book Context */}
          {isActiveSession ? (
            <button
              type="button"
              data-testid="volunteer-building-context"
              onClick={onChangeBuilding}
              className="flex items-center gap-2 text-left px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all cursor-pointer group flex-1 min-w-0"
            >
              <span className="text-base shrink-0">🏢</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-900 truncate flex items-center justify-between">
                  <span className="truncate">
                    {selectedBuilding
                      ? `${selectedBuilding.buildingName}${selectedBuilding.wing ? ` · Wing ${selectedBuilding.wing}` : ""}`
                      : "इमारत निवडा / Select Building"}
                  </span>
                  {session && (
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ml-1 shrink-0">
                      {session.bookNumber}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-bold text-amber-600 group-hover:text-amber-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>{selectedBuilding ? "इमारत बदला" : "इमारत निवडा"}</span>
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
            <div className="flex items-center gap-2 text-left px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex-1 min-w-0">
              <span className="text-base shrink-0">📚</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-900 truncate">
                  {session?.bookNumber || (books[0]?.book_number ?? "पावती पुस्तक निवडा")}
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  {session ? `Series ${session.prefix}${session.startNumber}..${session.endNumber}` : "सत्र सुरू करण्यासाठी तयार"}
                </div>
              </div>
            </div>
          )}

          {/* ONE Compact Secondary 'More / ⋯' Control */}
          <button
            type="button"
            data-testid="volunteer-more-trigger"
            onClick={() => setShowMoreMenu(true)}
            className="h-11 w-11 shrink-0 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-all cursor-pointer relative"
            aria-label="इतर पर्याय / More Options"
            title="इतर पर्याय"
          >
            <span className="text-lg font-black leading-none">⋯</span>
            {pendingSyncCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-white" />
            )}
          </button>
        </div>

        {/* State A Selection Controls (If Starting Collection) */}
        {!isActiveSession && books.length > 0 && (
          <div className="rounded-2xl bg-white border border-slate-200/80 p-3.5 shadow-xs space-y-2.5">
            {events.length > 1 && (
              <div>
                <label
                  htmlFor="volunteer-event-select"
                  className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1"
                >
                  उत्सव / Event
                </label>
                <select
                  id="volunteer-event-select"
                  value={selectedEventId}
                  onChange={(e) => onEventChange?.(e.target.value)}
                  disabled={startSessionLoading}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="volunteer-book-select"
                className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1"
              >
                पावती पुस्तक / Receipt Book
              </label>
              <select
                id="volunteer-book-select"
                value={selectedBookId}
                onChange={(e) => onBookChange?.(e.target.value)}
                disabled={startSessionLoading || books.length === 0}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
              >
                {books.map((bk) => (
                  <option key={bk.id} value={bk.id}>
                    {bk.book_number} ({bk.prefix}{bk.current_number ?? bk.start_number}..{bk.end_number})
                  </option>
                ))}
              </select>
            </div>

            {startSessionError && (
              <p className="text-xs text-red-600 font-medium pt-1">{startSessionError}</p>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
          2. CENTRAL TODAY'S COLLECTION SUMMARY (HERO TYPOGRAPHY)
      -------------------------------------------------------------- */}
      <div className="py-8 sm:py-12 text-center space-y-2">
        <span className="font-brand-marathi text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
          आजचे संकलन
        </span>

        <div className="font-brand-pro text-5xl sm:text-6xl font-black text-slate-950 tracking-tight">
          ₹{todayAmount.toLocaleString("en-IN")}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-slate-600 pt-1">
          <span className="font-bold text-slate-900">{receiptCount} पावत्या</span>
          {houseCount > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span>{houseCount} घरे</span>
            </>
          )}
          {pendingSyncCount > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-amber-600 font-bold">({pendingSyncCount} ऑफलाइन)</span>
            </>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. PRIMARY ACTION (DOMINANT THUMB-FRIENDLY ORANGE BUTTON)
      -------------------------------------------------------------- */}
      <div className="space-y-3 pb-2">
        {isActiveSession ? (
          <Button
            type="button"
            data-testid="volunteer-collect-btn"
            onClick={onOpenCollect}
            className="w-full h-15 sm:h-16 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-lg sm:text-xl tracking-tight shadow-md shadow-orange-600/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="font-brand-marathi font-black">पावती तयार करा</span>
            <span className="text-sm sm:text-base font-normal opacity-90">· Collect</span>
            <span className="text-xl leading-none">→</span>
          </Button>
        ) : (
          <Button
            type="button"
            data-testid="volunteer-start-btn"
            onClick={onStartCollection}
            disabled={startSessionLoading || (!selectedBookId && books.length > 0)}
            className="w-full h-15 sm:h-16 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-lg sm:text-xl tracking-tight shadow-md shadow-orange-600/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {startSessionLoading ? (
              <span>सुरू होत आहे...</span>
            ) : (
              <>
                <span className="font-brand-marathi font-black">संकलन सुरू करा</span>
                <span className="text-sm sm:text-base font-normal opacity-90">· Start</span>
                <span className="text-xl leading-none">→</span>
              </>
            )}
          </Button>
        )}

        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 px-2">
          <span>🔒 सुरक्षित ऑफलाइन कॅश</span>
          <span>⚡ जलद पावती</span>
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
              <h3 className="text-base font-black text-slate-900 font-brand-marathi">
                इतर पर्याय · Options
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
                    <span className="block font-brand-marathi font-bold">इमारती आणि फ्लॅट्स</span>
                    <span className="text-[11px] font-normal text-slate-500">Buildings & Corridor</span>
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
                      <span className="font-brand-marathi font-bold">पावत्यांचा इतिहास</span>
                      {pendingSyncCount > 0 && (
                        <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2">
                          {pendingSyncCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-normal text-slate-500">Receipts & Reprints</span>
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
                    <span className="font-brand-marathi font-bold">संकलन हस्तांतरण</span>
                    <span className="text-[11px] font-normal text-slate-500">Session Handover</span>
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
                    <span className="font-brand-marathi font-bold">सत्र तपशील / बंद करा</span>
                    <span className="text-[11px] font-normal text-slate-500">Session & Close</span>
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
