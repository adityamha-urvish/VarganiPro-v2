import { Button } from "@/components/ui/button";
import type { NavigationTab } from "@/app/layouts/RoleNavigation";
import type {
  SecretaryOverviewMetrics,
  VolunteerFinancialLedgerResponse,
  VolunteerFinancialRow,
} from "../types/analytics.types";
import type { CachedBuildingSummary } from "@/lib/offline/offline-db";
import type { LocalReceipt } from "@/lib/offline/offline-db";

export interface SecretaryCommandCenterProps {
  metrics: SecretaryOverviewMetrics | null;
  ledger?: VolunteerFinancialLedgerResponse | null;
  buildings?: CachedBuildingSummary[] | null;
  recentReceipts?: LocalReceipt[] | null;
  pendingSyncCount?: number;
  loading: boolean;
  ledgerLoading?: boolean;
  error: string | null;
  ledgerError?: string | null;
  onRefresh: () => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onViewReceipt?: (receipt: LocalReceipt) => void;
  onSync?: () => void;
}

export function formatCurrency(amount: number): string {
  const num = Number(amount || 0);
  if (num % 1 === 0) {
    return `₹${num.toLocaleString("en-IN")}`;
  }
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SecretaryCommandCenter({
  metrics,
  ledger,
  buildings = [],
  recentReceipts = [],
  pendingSyncCount = 0,
  loading,
  ledgerLoading = false,
  error,
  onRefresh,
  onNavigateTab,
  onViewReceipt,
  onSync,
}: SecretaryCommandCenterProps) {
  // Safe array references
  const safeBuildings = buildings || [];
  const safeReceipts = recentReceipts || [];

  // 1. Error State
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-xs w-full box-border">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-red-900 text-sm sm:text-base">
              आकडेवारी लोड करता आली नाही (Unable to load overview)
            </h3>
            <p className="mt-1 text-xs text-red-700">{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="border-red-300 text-red-800 hover:bg-red-100 shrink-0"
          >
            {loading ? "पुन्हा प्रयत्न..." : "पुन्हा प्रयत्न करा (Retry)"}
          </Button>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading && !metrics) {
    return (
      <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-xs space-y-4 animate-pulse w-full box-border">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 rounded bg-slate-200" />
          <div className="h-8 w-24 rounded bg-slate-200" />
        </div>
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-28 rounded-xl bg-slate-100" />
          <div className="h-28 rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const { today, festival_total, property_progress, treasury } = metrics;
  const todayPhysical = Number(today.cash_amount) + Number(today.cheque_amount);
  const todayDigital =
    Number(today.upi_amount) + Number(today.bank_transfer_amount);
  const totalPhysicalCustody =
    Number(treasury.treasury_cash_received) +
    Number(treasury.total_physical_cash_held);

  const volunteers: VolunteerFinancialRow[] = ledger?.volunteers || [];
  const activeVolunteers = volunteers.filter(
    (v) => v.receipt_count > 0 || v.outstanding_physical_held > 0 || v.status === "active"
  );

  // Needs Attention Items Calculation
  const hasPendingHandovers = treasury.pending_handover_count > 0;
  const hasSyncIssues = pendingSyncCount > 0;
  const hasAttentionItems = hasPendingHandovers || hasSyncIssues;

  return (
    <div className="space-y-4 sm:space-y-5 w-full max-w-full box-border animate-in fade-in">
      
      {/* -------------------------------------------------------------
          1. HEADER & REFRESH ACTION
      -------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛕</span>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Secretary Command Center
            </h2>
            <p className="text-xs text-muted-foreground">
              हिशोब व वसुली सद्यस्थिती (Real-time Financial & Field Overview)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 cursor-pointer rounded-lg text-xs font-semibold"
          >
            {loading ? "ताजे करत आहे..." : "🔄 रिफ्रेश (Refresh)"}
          </Button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. HERO CARD: VARGANIPRO PREMIUM COMMAND (TODAY & CUSTODY)
      -------------------------------------------------------------- */}
      <div className="rounded-2xl bg-gradient-to-br from-[#081E26] via-[#0B2530] to-[#0F2D38] border border-teal-900/40 text-white shadow-md p-4 sm:p-6 relative overflow-hidden w-full box-border">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-orange-500/10 blur-2xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
          
          {/* Main Hero: Today Total Collection */}
          <div className="lg:col-span-6 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>🌅</span> Today's Total Collection (आजची वर्गणी)
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                LIVE
              </span>
            </div>

            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono" data-testid="today-total-collection">
              {formatCurrency(today.total_amount)}
            </div>

            {/* Breakdown line */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-1">
              <span>
                💵 Cash: <strong className="font-mono text-amber-300 font-bold">{formatCurrency(todayPhysical)}</strong>
              </span>
              <span>•</span>
              <span>
                📱 Digital UPI: <strong className="font-mono text-cyan-300 font-bold">{formatCurrency(todayDigital)}</strong>
              </span>
              <span>•</span>
              <span className="text-slate-400">
                {today.receipt_count} {today.receipt_count === 1 ? "Receipt" : "Receipts"}
              </span>
            </div>
          </div>

          {/* Physical Cash Custody Dual-Gauge */}
          <div className="lg:col-span-3 rounded-xl bg-white/5 border border-white/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              <span>Physical Cash Custody</span>
              <span className="text-amber-300 font-mono">{formatCurrency(totalPhysicalCustody)}</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 text-[11px] flex items-center gap-1">
                  <span>🏛️</span> Safe (Verified):
                </span>
                <span className="font-bold font-mono text-emerald-400">
                  {formatCurrency(treasury.treasury_cash_received)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300 text-[11px] flex items-center gap-1">
                  <span>🚶</span> Field Custody:
                </span>
                <span className="font-bold font-mono text-amber-400">
                  {formatCurrency(treasury.total_physical_cash_held)}
                </span>
              </div>
            </div>
          </div>

          {/* Festival Overall Total */}
          <div className="lg:col-span-3 rounded-xl bg-white/5 border border-white/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              <span>Festival Overall</span>
              <span className="text-slate-400 text-[10px]">{festival_total.receipt_count} Rcpts</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {formatCurrency(festival_total.total_amount)}
            </div>
            {property_progress.total_residential_units > 0 && (
              <div className="space-y-1 pt-0.5">
                <div className="flex justify-between text-[10px] text-slate-300">
                  <span>Area Coverage</span>
                  <span className="font-bold text-orange-400">{property_progress.completion_percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, property_progress.completion_percentage))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* -------------------------------------------------------------
          3. HIGH-PRIORITY "NEEDS ATTENTION" TRIAGE DOCK
      -------------------------------------------------------------- */}
      {hasAttentionItems ? (
        <div className="rounded-xl bg-amber-50/90 border border-amber-200/90 p-3.5 sm:p-4 shadow-xs space-y-2.5 w-full box-border" data-testid="needs-attention-dock">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔔</span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-2">
                  <span>Needs Secretary Action (कारवाई आवश्यक)</span>
                  <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                    {(hasPendingHandovers ? 1 : 0) + (hasSyncIssues ? 1 : 0)} items
                  </span>
                </h4>
                <p className="text-[11px] text-amber-800">
                  {hasPendingHandovers && (
                    <span>
                      • <strong>{treasury.pending_handover_count} Handover</strong> awaiting verification ({formatCurrency(treasury.pending_handover_amount)})
                    </span>
                  )}
                  {hasPendingHandovers && hasSyncIssues && <span> • </span>}
                  {hasSyncIssues && (
                    <span>
                      • <strong>{pendingSyncCount} Receipts</strong> pending local synchronization
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 sm:pt-0">
              {hasPendingHandovers && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onNavigateTab("handovers")}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-8 cursor-pointer shrink-0"
                >
                  Verify Handover →
                </Button>
              )}
              {hasSyncIssues && onSync && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onSync}
                  className="border-amber-300 text-amber-900 hover:bg-amber-100 text-xs h-8 cursor-pointer shrink-0"
                >
                  Sync Now 🔄
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* -------------------------------------------------------------
          4. MAIN 2-COLUMN OPERATIONAL GRID
      -------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full box-border">
        
        {/* LEFT COLUMN (7 Cols on desktop): Volunteer Fleet & Recent Receipts */}
        <div className="lg:col-span-7 space-y-4 w-full box-border">
          
          {/* Volunteer Fleet Card */}
          <div className="rounded-2xl border border-slate-200 bg-card p-4 sm:p-5 shadow-xs space-y-3 w-full box-border" data-testid="volunteer-fleet-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>👥</span> Volunteer Field Fleet (स्वयंसेवक हिशोब)
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Active collectors, custody cash, and digital totals
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("handovers")}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 p-0 h-auto cursor-pointer"
              >
                View Full Ledger →
              </Button>
            </div>

            {ledgerLoading && volunteers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
                Loading volunteer statuses...
              </div>
            ) : activeVolunteers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No active collection volunteers recorded for today yet.
              </div>
            ) : (
              <div className="space-y-2">
                {activeVolunteers.slice(0, 4).map((vol) => (
                  <div
                    key={vol.volunteer_id}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 dark:bg-slate-800/40 p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                        {vol.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-slate-900 dark:text-white font-bold truncate max-w-[130px] sm:max-w-none">
                            {vol.name}
                          </strong>
                          {vol.pending_handover_count > 0 ? (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Handover Pending
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Collecting
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {vol.receipt_count} receipts • {vol.mobile || "No phone"}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-amber-700 dark:text-amber-400">
                        {formatCurrency(vol.outstanding_physical_held)} Cash
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        +{formatCurrency(vol.digital_settled)} UPI
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Receipts Stream Card */}
          <div className="rounded-2xl border border-slate-200 bg-card p-4 sm:p-5 shadow-xs space-y-3 w-full box-border" data-testid="recent-receipts-stream">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>📜</span> Recent Receipts (थेट पावत्या प्रवाह)
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Latest recorded donations
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("history")}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 p-0 h-auto cursor-pointer"
              >
                View All ({today.receipt_count}) →
              </Button>
            </div>

            {safeReceipts.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No recent receipts created in current session yet.
              </div>
            ) : (
              <div className="space-y-2">
                {safeReceipts.slice(0, 3).map((r) => (
                  <div
                    key={r.clientReceiptId || r.receiptNumber}
                    onClick={() => onViewReceipt && onViewReceipt(r)}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 dark:bg-slate-800/40 p-3 flex items-center justify-between gap-3 text-xs cursor-pointer hover:border-slate-300 transition-all"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-slate-900 dark:text-white font-bold truncate">
                          {r.donorName}
                        </strong>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700">
                          #{r.receiptNumber}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {r.paymentMode.toUpperCase()} • {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-slate-900 dark:text-white text-sm">
                        {formatCurrency(r.amount)}
                      </div>
                      <span
                        className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          r.paymentMode === "cash"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-cyan-100 text-cyan-800"
                        }`}
                      >
                        {r.paymentMode.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN (5 Cols on desktop): Coverage & Quick Actions */}
        <div className="lg:col-span-5 space-y-4 w-full box-border">
          
          {/* Residential Building Coverage Card */}
          <div className="rounded-2xl border border-slate-200 bg-card p-4 sm:p-5 shadow-xs space-y-3 w-full box-border" data-testid="building-coverage-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>🏢</span> Residential Coverage (इमारत प्रगती)
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Door-to-door progress by building wing
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("masterData")}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 p-0 h-auto cursor-pointer"
              >
                All Buildings →
              </Button>
            </div>

            {safeBuildings.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No residential buildings mapped yet.
              </div>
            ) : (
              <div className="space-y-3">
                {safeBuildings.slice(0, 3).map((b) => {
                  const pct = b.totalUnits > 0 ? Math.round((b.collectedCount / b.totalUnits) * 100) : 0;
                  return (
                    <div key={b.buildingId} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <strong className="text-slate-900 dark:text-white font-semibold truncate max-w-[180px]">
                          {b.buildingName} {b.wing ? `(${b.wing})` : ""}
                        </strong>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {b.collectedCount}/{b.totalUnits} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground pt-0.5">
                        <span>{b.pendingCount} follow-ups • {b.remainingCount} remaining</span>
                        <span className="font-mono">{formatCurrency(b.totalAmountCollected)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="rounded-2xl border border-slate-200 bg-card p-4 sm:p-5 shadow-xs space-y-3 w-full box-border">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span>⚡</span> Quick Actions (जलद पर्याय)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab("handovers")}
                className="justify-start gap-1.5 text-xs font-semibold h-9 cursor-pointer"
              >
                <span>🤝</span> Verify Handover
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab("history")}
                className="justify-start gap-1.5 text-xs font-semibold h-9 cursor-pointer"
              >
                <span>🔍</span> Find Receipt
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab("volunteers")}
                className="justify-start gap-1.5 text-xs font-semibold h-9 cursor-pointer"
              >
                <span>👥</span> Volunteers
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab("more")}
                className="justify-start gap-1.5 text-xs font-semibold h-9 cursor-pointer"
              >
                <span>⚙️</span> Export & Setup
              </Button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
