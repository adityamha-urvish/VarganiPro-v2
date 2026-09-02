import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  VolunteerFinancialLedgerResponse,
} from "../types/analytics.types";
import { formatCurrency } from "./secretary-overview-hero";

export interface VolunteerFinancialLedgerProps {
  ledger: VolunteerFinancialLedgerResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onReviewHandover?: (volunteerId: string) => void;
}

export function VolunteerFinancialLedger({
  ledger,
  loading,
  error,
  onRefresh,
  onReviewHandover,
}: VolunteerFinancialLedgerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedVolunteerIds, setExpandedVolunteerIds] = useState<Set<string>>(
    new Set()
  );

  function toggleExpand(volunteerId: string) {
    setExpandedVolunteerIds((prev) => {
      const next = new Set(prev);
      if (next.has(volunteerId)) {
        next.delete(volunteerId);
      } else {
        next.add(volunteerId);
      }
      return next;
    });
  }

  const filteredVolunteers = useMemo(() => {
    if (!ledger?.volunteers) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ledger.volunteers;
    return ledger.volunteers.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.mobile && v.mobile.includes(q))
    );
  }, [ledger?.volunteers, searchQuery]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-red-900">
              कार्यकर्त्यांचा हिशोब लोड करता आला नाही (Unable to load ledger)
            </h3>
            <p className="mt-1 text-xs text-red-700">{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="border-red-300 text-red-800 hover:bg-red-100"
          >
            {loading ? "पुन्हा प्रयत्न..." : "पुन्हा प्रयत्न करा"}
          </Button>
        </div>
      </div>
    );
  }

  if (loading && !ledger) {
    return (
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 rounded bg-slate-200" />
          <div className="h-8 w-20 rounded bg-slate-200" />
        </div>
        <div className="h-10 w-full rounded-xl bg-slate-100" />
        <div className="space-y-3 pt-2">
          <div className="h-20 rounded-xl bg-slate-100" />
          <div className="h-20 rounded-xl bg-slate-100" />
          <div className="h-20 rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!ledger) {
    return null;
  }

  const { summary, volunteers } = ledger;

  return (
    <div className="rounded-2xl border border-slate-200 bg-card p-5 sm:p-6 shadow-xs space-y-5 animate-in fade-in">
      {/* -------------------------------------------------------------
          HEADER: TITLE, SUMMARY STATS & REFRESH ACTION
      -------------------------------------------------------------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">👥</span>
          <div>
            <h2 className="text-sm font-black tracking-tight text-foreground sm:text-base">
              कार्यकर्ते हिशोब व रोख स्थिती (Volunteer Financial Custody)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              प्रत्येक कार्यकर्त्याकडील वसुली आणि रोख शिल्लक (Per-volunteer balance)
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 self-start sm:self-auto cursor-pointer rounded-lg text-xs font-semibold"
        >
          {loading ? "ताजे करत आहे..." : "🔄 रिफ्रेश"}
        </Button>
      </div>

      {/* -------------------------------------------------------------
          SUMMARY STRIP
      -------------------------------------------------------------- */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 dark:bg-slate-800/40 p-3">
            <span className="text-[11px] font-bold text-muted-foreground block">
              सक्रिय कार्यकर्ते
            </span>
            <span className="text-base font-extrabold text-foreground block mt-0.5">
              {summary.active_volunteers} / {summary.total_volunteers}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 dark:bg-slate-800/40 p-3">
            <span className="text-[11px] font-bold text-muted-foreground block">
              एकूण गोळा रक्कम
            </span>
            <span className="text-base font-extrabold text-foreground block mt-0.5">
              {formatCurrency(summary.grand_total_collected)}
            </span>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">
              तिजोरीत जमा
            </span>
            <span className="text-base font-extrabold text-emerald-900 dark:text-emerald-100 block mt-0.5">
              {formatCurrency(summary.total_verified_handed_over)}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-100/80 dark:bg-slate-800/80 p-3">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
              कार्यकर्त्यांकडे रोख
            </span>
            <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 block mt-0.5">
              {formatCurrency(summary.total_outstanding_physical_held)}
            </span>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SEARCH BAR
      -------------------------------------------------------------- */}
      {volunteers.length > 0 && (
        <div className="relative">
          <Input
            type="text"
            placeholder="🔍 कार्यकर्त्याचे नाव किंवा मोबाईल नंबर शोधा..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 text-xs sm:text-sm pl-3 pr-8 rounded-xl"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          VOLUNTEERS LIST / EMPTY STATES
      -------------------------------------------------------------- */}
      {volunteers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2">
          <span className="text-3xl block">👥</span>
          <p className="text-sm font-bold text-foreground">
            सध्या कोणतेही कार्यकर्ते नाहीत
          </p>
          <p className="text-xs text-muted-foreground">
            या उत्सवासाठी कार्यकर्ते नियुक्त झाल्यावर त्यांचा हिशोब येथे दिसेल.
          </p>
        </div>
      ) : summary.grand_total_collected === 0 && !searchQuery ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2">
          <span className="text-3xl block">⚡</span>
          <p className="text-sm font-bold text-foreground">
            अजून वर्गणी जमा झालेली नाही
          </p>
          <p className="text-xs text-muted-foreground">
            कार्यकर्त्यांनी पावत्या फाडण्यास सुरुवात केल्यावर थेट हिशोब येथे अद्ययावत होईल.
          </p>
        </div>
      ) : filteredVolunteers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-xs font-semibold text-muted-foreground">
            "{searchQuery}" नावाचा कोणताही कार्यकर्ता सापडला नाही.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVolunteers.map((vol) => {
            const isExpanded = expandedVolunteerIds.has(vol.volunteer_id);
            const hasOutstanding = Number(vol.outstanding_physical_held) > 0;
            const hasPendingHandover =
              vol.latest_handover_status === "submitted" ||
              vol.pending_handover_count > 0;
            const isRejectedHandover =
              vol.latest_handover_status === "rejected";

            return (
              <div
                key={vol.volunteer_id}
                data-testid={`volunteer-ledger-card-${vol.volunteer_id}`}
                className="rounded-xl border border-slate-200 bg-white dark:bg-slate-850 overflow-hidden shadow-2xs transition-all"
              >
                {/* ---------------------------------------------------------
                    COLLAPSED HEADER ROW (TAP TO TOGGLE)
                ---------------------------------------------------------- */}
                <button
                  type="button"
                  onClick={() => toggleExpand(vol.volunteer_id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Left: Volunteer Info & Receipts */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm sm:text-base text-foreground truncate">
                        👤 {vol.name}
                      </span>
                      {vol.mobile && (
                        <span className="text-xs text-muted-foreground">
                          ({vol.mobile})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>
                        एकूण: <b>{formatCurrency(vol.total_collected)}</b>
                      </span>
                      <span>•</span>
                      <span>
                        {vol.receipt_count}{" "}
                        {vol.receipt_count === 1 ? "पावती" : "पावत्या"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Custody Badge & Handover Pill */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0">
                    {/* Normal Outstanding Physical Cash Badge - NEUTRAL STYLING */}
                    {hasOutstanding ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                        {formatCurrency(vol.outstanding_physical_held)} रोख बाकी
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        ✓ हिशोब पूर्ण
                      </span>
                    )}

                    {/* Handover State Indicator */}
                    {hasPendingHandover ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        हस्तबदल सादर (Submitted)
                      </span>
                    ) : isRejectedHandover ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-800 border border-red-200">
                        ⚠️ नाकारले (Rejected)
                      </span>
                    ) : null}

                    {/* Chevron Indicator */}
                    <span className="text-xs text-muted-foreground ml-1">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {/* ---------------------------------------------------------
                    EXPANDED FINANCIAL DETAILS (INLINE)
                ---------------------------------------------------------- */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-3 animate-in fade-in duration-200">
                    {/* Collection Breakdown Sub-Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-lg bg-white dark:bg-slate-800 border p-2.5">
                        <span className="text-[10px] font-semibold text-muted-foreground block">
                          💵 रोख (Cash)
                        </span>
                        <span className="text-sm font-bold text-foreground block mt-0.5">
                          {formatCurrency(vol.cash_collected)}
                        </span>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-slate-800 border p-2.5">
                        <span className="text-[10px] font-semibold text-muted-foreground block">
                          📄 चेक (Cheque)
                        </span>
                        <span className="text-sm font-bold text-foreground block mt-0.5">
                          {formatCurrency(vol.cheque_collected)}
                        </span>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-slate-800 border p-2.5">
                        <span className="text-[10px] font-semibold text-muted-foreground block">
                          📱 UPI (Digital)
                        </span>
                        <span className="text-sm font-bold text-foreground block mt-0.5">
                          {formatCurrency(vol.upi_collected)}
                        </span>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-slate-800 border p-2.5">
                        <span className="text-[10px] font-semibold text-muted-foreground block">
                          🏦 बँक ट्रान्सफर
                        </span>
                        <span className="text-sm font-bold text-foreground block mt-0.5">
                          {formatCurrency(vol.bank_transfer_collected)}
                        </span>
                      </div>
                    </div>

                    {/* Settlement & Treasury Position Sub-Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                      <div className="rounded-lg bg-emerald-50/40 border border-emerald-200 p-2.5">
                        <span className="text-[11px] font-bold text-emerald-900 block">
                          🏛️ तिजोरीत जमा रक्कम (Handed Over)
                        </span>
                        <span className="text-sm font-black text-emerald-950 block mt-0.5">
                          {formatCurrency(vol.verified_handed_over)}
                        </span>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-slate-800 border p-2.5">
                        <span className="text-[11px] font-bold text-muted-foreground block">
                          🧾 मान्य खर्च (Approved Expenses)
                        </span>
                        <span className="text-sm font-black text-foreground block mt-0.5">
                          {formatCurrency(vol.verified_expenses)}
                        </span>
                      </div>

                      <div className="rounded-lg bg-slate-100 border border-slate-300 p-2.5">
                        <span className="text-[11px] font-bold text-slate-800 block">
                          👥 रोख शिल्लक (Cash In Hand)
                        </span>
                        <span className="text-sm font-black text-slate-900 block mt-0.5">
                          {formatCurrency(vol.outstanding_physical_held)}
                        </span>
                      </div>
                    </div>

                    {/* Pending Handover Callout */}
                    {hasPendingHandover && onReviewHandover && (
                      <div className="flex items-center justify-between gap-3 pt-2">
                        <span className="text-xs text-blue-900 font-semibold">
                          हस्तबदल तपासणी बाकी:{" "}
                          <b>{formatCurrency(vol.pending_handover_amount)}</b>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onReviewHandover(vol.volunteer_id)}
                          className="h-7 text-xs font-bold bg-primary cursor-pointer"
                        >
                          हस्तबदल तपासा (Review) →
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
