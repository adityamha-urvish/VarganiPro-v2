import React from "react";
import { BrandMonogram } from "@/components/brand/brand-monogram";
import { MandalBackground } from "@/components/brand/mandal-background";
import type { StartCollectionEvent, StartCollectionBook } from "./start-collection-card";

export type ReadyToCollectState = "new" | "paused" | "low_stock" | "exhausted";

export interface ReadyToCollectScreenProps {
  /** Operational state */
  state?: ReadyToCollectState;
  
  /** Card heading title (defaults to "Ready to Collect?") */
  title?: string;
  /** Subtitle / Description override */
  description?: string;
  /** Marathi subtitle override */
  marathiSubtitle?: string;
  /** ID prefix for form controls */
  idPrefix?: string;

  /** Active Events list */
  events?: StartCollectionEvent[];
  /** Selected Event ID */
  selectedEventId?: string;
  /** Event display name (fallback if events array not used) */
  eventName?: string;
  /** Event code */
  eventCode?: string;
  /** Event change handler */
  onEventChange?: (eventId: string) => void;

  /** Available Books list */
  books?: StartCollectionBook[];
  /** Selected Book ID */
  selectedBookId?: string;
  /** Book number display */
  bookNumber?: string;
  /** Book prefix */
  bookPrefix?: string;
  /** Start number */
  startNumber?: number;
  /** End number */
  endNumber?: number;
  /** Current active number */
  currentNumber?: number | null;
  /** Remaining count override */
  remainingCount?: number;
  /** Book change handler */
  onBookChange?: (bookId: string) => void;

  /** Current Area / Sector / Building */
  areaName?: string;
  buildingName?: string;
  collectedFlats?: number;
  totalFlats?: number;

  /** Volunteer / User info */
  userName?: string;
  userRole?: string;

  /** Operational states */
  loading?: boolean;
  error?: string | null;

  /** Primary Action Click handler */
  onStartCollection?: () => void;
  /** Next book request handler */
  onRequestNextBook?: () => void;

  /** Standalone full-page wrapper mode (default true) */
  standalone?: boolean;
}

export const ReadyToCollectScreen: React.FC<ReadyToCollectScreenProps> = ({
  state = "new",
  title,
  description,
  marathiSubtitle,
  idPrefix = "start",
  events = [],
  selectedEventId = "",
  eventName,
  eventCode,
  onEventChange,
  books = [],
  selectedBookId = "",
  bookNumber,
  bookPrefix,
  startNumber,
  endNumber,
  currentNumber,
  remainingCount,
  onBookChange,
  areaName = "Sector 4 · Prabhadevi",
  buildingName,
  collectedFlats,
  totalFlats,
  userName = "Volunteer",
  userRole = "Volunteer",
  loading = false,
  error = null,
  onStartCollection,
  onRequestNextBook,
  standalone = true,
}) => {
  // Find selected event & book from lists if available
  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];
  const effectiveEventName = eventName || selectedEvent?.name || "Ganesh Utsav 2026";
  const effectiveEventCode = eventCode || selectedEvent?.code || "GU26";

  const selectedBook = books.find((b) => b.id === selectedBookId) || books[0];
  const effectiveBookNumber = bookNumber || selectedBook?.book_number || "BOOK-01";
  const effectivePrefix = bookPrefix || selectedBook?.prefix || "VP-";
  const effectiveStart = startNumber ?? selectedBook?.start_number ?? 1;
  const effectiveEnd = endNumber ?? selectedBook?.end_number ?? 100;
  const effectiveCurrent = currentNumber ?? selectedBook?.current_number ?? effectiveStart;

  // Calculate remaining
  const calculatedRemaining =
    remainingCount !== undefined
      ? remainingCount
      : Math.max(0, effectiveEnd - effectiveCurrent + 1);

  // Dynamic state inference if not explicitly provided
  const inferredState: ReadyToCollectState =
    state !== "new"
      ? state
      : calculatedRemaining === 0
      ? "exhausted"
      : calculatedRemaining <= 5 && calculatedRemaining > 0
      ? "low_stock"
      : "new";

  // State-specific badges, titles and button labels
  let badgeLabel = effectiveEventName;
  let defaultTitle = "Ready to Collect?";
  let defaultMarathi = "सुरू करायचे?";
  let buttonMainText = "Start Collection";
  let buttonMarathi = "· सुरू करा";
  let buttonClass = "btn-fest-gold";
  let showNextBookAction = false;

  if (inferredState === "paused") {
    badgeLabel = "⚡ Active In-Progress";
    defaultTitle = "Welcome Back";
    defaultMarathi = "पुढे सुरू ठेवा";
    buttonMainText = "Continue Collection";
    buttonMarathi = "· पुढे सुरू ठेवा";
    buttonClass = "bg-gradient-to-r from-sky-600 to-sky-700 shadow-lg shadow-sky-600/30";
  } else if (inferredState === "low_stock") {
    badgeLabel = `⚠️ Low Stock · ${calculatedRemaining} Left`;
    defaultTitle = "Receipt Book Low";
    defaultMarathi = `${calculatedRemaining} पावत्या शिल्लक आहेत`;
    buttonMainText = "Start Collection";
    buttonMarathi = "· सुरू करा";
    buttonClass = "btn-fest-gold";
  } else if (inferredState === "exhausted") {
    badgeLabel = "✓ Book Completed";
    defaultTitle = "Book Completed";
    defaultMarathi = "पावती पुस्तक पूर्ण भरले आहे";
    buttonMainText = "Get Next Book";
    buttonMarathi = "· पुढील पुस्तक घ्या";
    buttonClass = "bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-lg shadow-emerald-600/30";
    showNextBookAction = true;
  }

  const effectiveTitle = title || defaultTitle;
  const effectiveMarathiSubtitle = marathiSubtitle || defaultMarathi;

  // Main UI Content Panel
  const contentPanel = (
    <div className="w-full max-w-[395px] frosted-glass-teal rounded-3xl p-5 sm:p-7 space-y-4 text-slate-100 transition-all shadow-2xl">
      {/* Panel Header */}
      <div className="border-b border-white/10 pb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-300/90 bg-amber-400/10 border border-amber-400/25 px-2.5 py-0.5 rounded-full">
            {badgeLabel}
          </span>
          <span className="text-[11px] text-slate-400 font-mono font-medium">
            {effectiveEventCode}
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight pt-1">
          {effectiveTitle}
        </h2>
        <p className="font-marathi-bold text-xs text-amber-300/90 font-bold">
          {effectiveMarathiSubtitle}
        </p>

        {description && (
          <p className="text-xs text-slate-300 pt-0.5">{description}</p>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-950/50 p-3 text-xs text-red-200">
          <p className="font-semibold text-red-300">Notice</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* 2x2 Structured Information Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Cell 1: Event */}
        <div className="bg-[#051117]/70 border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
          <div>
            <label
              htmlFor={`${idPrefix}-event`}
              className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1"
            >
              Event
            </label>
            {events.length > 0 ? (
              <select
                id={`${idPrefix}-event`}
                value={selectedEventId}
                onChange={(e) => onEventChange?.(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-900/90 border border-white/15 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-slate-900 text-white">
                    {ev.name} ({ev.code})
                  </option>
                ))}
              </select>
            ) : (
              <>
                <span className="text-xs font-black text-white block truncate">
                  {effectiveEventName}
                </span>
                <span className="text-[10px] text-amber-300/80 font-mono block">
                  {effectiveEventCode} · Active
                </span>
              </>
            )}
          </div>
        </div>

        {/* Cell 2: Current Area */}
        <div className="bg-[#051117]/70 border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Current Area
            </span>
            <span className="text-xs font-black text-white block truncate">
              {buildingName ? buildingName : areaName}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              {buildingName && totalFlats
                ? `${collectedFlats ?? 0}/${totalFlats} Flats Done`
                : "Assigned Sector"}
            </span>
          </div>
        </div>

        {/* Cell 3: Receipt Book */}
        <div className="bg-[#051117]/70 border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
          <div>
            <label
              htmlFor={`${idPrefix}-receipt-book`}
              className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1"
            >
              Receipt Book
            </label>
            {books.length > 0 ? (
              <select
                id={`${idPrefix}-receipt-book`}
                value={selectedBookId}
                onChange={(e) => onBookChange?.(e.target.value)}
                disabled={loading || !selectedEventId || books.length === 0}
                className="w-full bg-slate-900/90 border border-white/15 rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
              >
                {books.length === 0 && (
                  <option value="" className="bg-slate-900 text-white">
                    No available receipt books
                  </option>
                )}
                {books.map((bk) => (
                  <option key={bk.id} value={bk.id} className="bg-slate-900 text-white">
                    {bk.book_number} — {bk.prefix}{bk.current_number ?? bk.start_number}-{bk.end_number}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <span className="text-xs font-black text-white font-mono block">
                  {effectiveBookNumber}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Series {effectivePrefix}{effectiveStart}–{effectivePrefix}{effectiveEnd}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Cell 4: Remaining Receipts */}
        <div className="bg-[#051117]/70 border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
              Remaining
            </span>
            <span
              className={`text-xs font-black font-mono block ${
                inferredState === "exhausted"
                  ? "text-slate-400"
                  : inferredState === "low_stock"
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {calculatedRemaining} Receipts
            </span>
            <span className="text-[10px] text-slate-400 block">
              {inferredState === "exhausted"
                ? "Book Full (50/50)"
                : inferredState === "low_stock"
                ? "Request next series"
                : "Active & Ready"}
            </span>
          </div>
        </div>
      </div>

      {/* Selected Book Range Details (Characterization & Quick Review) */}
      {selectedBook && (
        <div className="rounded-xl border border-white/10 bg-[#051117]/50 p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Receipt Range</span>
            <span className="font-mono font-bold text-amber-300">
              {selectedBook.prefix}
              {selectedBook.current_number ?? selectedBook.start_number} –{" "}
              {selectedBook.prefix}
              {selectedBook.end_number}
            </span>
          </div>
        </div>
      )}

      {/* Primary Action Button */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={showNextBookAction && onRequestNextBook ? onRequestNextBook : onStartCollection}
          disabled={loading || (!selectedEventId && events.length > 0) || (!selectedBookId && books.length > 0)}
          className={`w-full ${buttonClass} text-white font-black h-12 rounded-2xl text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <span>Starting Collection...</span>
          ) : (
            <>
              <span>{buttonMainText}</span>
              <span className="text-amber-200 text-xs sm:text-sm font-marathi-bold">
                {buttonMarathi}
              </span>
              <span className="text-base sm:text-lg leading-none">→</span>
            </>
          )}
        </button>

        {/* Security & Sync Status / Subtext Footer */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1">
          <span className="flex items-center gap-1">🔒 Safe Offline Cache</span>
          <span className="flex items-center gap-1 text-slate-300">
            ⚡ Fast Pāvtī · Offline Ready
          </span>
        </div>
      </div>
    </div>
  );

  // If embedded/non-standalone mode (e.g. inside an existing container), return panel directly
  if (!standalone) {
    return contentPanel;
  }

  // Full-bleed standalone visual-world experience
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#06151c] text-slate-100 overflow-x-hidden select-none p-4 sm:p-6 lg:p-10">
      {/* Canonical Locked Mandal Background */}
      <MandalBackground />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto flex items-center justify-between shrink-0 pb-2 sm:pb-3">
        {/* Left: Brand Signature */}
        <div className="flex items-center gap-2.5">
          <BrandMonogram variant="golden-arch" size="sm" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-marathi-bold font-black text-white text-lg leading-none tracking-tight">
              वर्गणी
            </span>
            <span className="font-pro-luxe font-black text-amber-400 text-xs leading-none tracking-wider uppercase">
              PRO
            </span>
          </div>
        </div>

        {/* Right: Active Event Badge & Volunteer Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/25 text-xs font-mono font-bold text-amber-300 backdrop-blur-sm">
            <span>🛕 {effectiveEventName}</span>
          </div>

          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs font-medium text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{userName}</span>
            <span className="text-slate-400 text-[10px]">· {userRole}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area: Responsive Asymmetrical Split on Desktop, Stack on Mobile */}
      <main className="relative z-10 w-full max-w-7xl mx-auto my-auto py-2 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end lg:items-center">
        {/* Left Narrative Zone (Desktop) */}
        <div className="hidden lg:block lg:col-span-7 space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-xs font-bold text-amber-300 backdrop-blur-sm">
            <span>🏮</span>
            <span>मंडळ तयारी • MANDAL PREPARATION</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight drop-shadow-md leading-tight">
            The stage is being set.
            <br />
            <span className="text-amber-300 font-normal text-2xl lg:text-3xl">
              Your receipt book is ready.
            </span>
          </h1>

          <p className="font-marathi-bold text-slate-300 text-sm max-w-lg leading-relaxed drop-shadow">
            मंडळाची तयारी सुरू आहे. तुमचे पावती पुस्तक तयार आहे.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#091820]/75 border border-white/10 backdrop-blur-md text-xs text-slate-200">
              <span className="text-amber-400 font-black">⚡</span>
              <span>Fast Pāvtī</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#091820]/75 border border-white/10 backdrop-blur-md text-xs text-slate-200">
              <span className="text-emerald-400 font-black">📶</span>
              <span>Offline Ready</span>
            </div>
          </div>
        </div>

        {/* Right Floating Frosted Control Panel */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
          {contentPanel}
        </div>
      </main>

      {/* Global Footer */}
      <footer className="relative z-20 w-full text-center text-[11px] text-slate-400/80 font-medium shrink-0 pt-2">
        <p>Shree Ganesh Mandal Prabhadevi • Powered by VarganiPro</p>
      </footer>
    </div>
  );
};
