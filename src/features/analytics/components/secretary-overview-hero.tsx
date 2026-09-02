import { Button } from "@/components/ui/button";
import type { SecretaryOverviewMetrics } from "../types/analytics.types";

export interface SecretaryOverviewHeroProps {
  metrics: SecretaryOverviewMetrics | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onReviewHandovers?: () => void;
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

export function SecretaryOverviewHero({
  metrics,
  loading,
  error,
  onRefresh,
  onReviewHandovers,
}: SecretaryOverviewHeroProps) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-red-900">
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
            className="border-red-300 text-red-800 hover:bg-red-100"
          >
            {loading ? "पुन्हा प्रयत्न..." : "पुन्हा प्रयत्न करा"}
          </Button>
        </div>
      </div>
    );
  }

  if (loading && !metrics) {
    return (
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="h-8 w-20 rounded bg-slate-200" />
        </div>
        <div className="h-10 w-48 rounded bg-slate-200" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-20 rounded-xl bg-slate-100" />
          <div className="h-20 rounded-xl bg-slate-100" />
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

  const festivalPhysical =
    Number(festival_total.cash_amount) + Number(festival_total.cheque_amount);
  const festivalDigital =
    Number(festival_total.upi_amount) +
    Number(festival_total.bank_transfer_amount);

  return (
    <div className="rounded-2xl border border-slate-200 bg-card p-5 sm:p-6 shadow-xs space-y-5 animate-in fade-in">
      {/* -------------------------------------------------------------
          HEADER: TITLE & REFRESH ACTION
      -------------------------------------------------------------- */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛕</span>
          <div>
            <h2 className="text-sm font-black tracking-tight text-foreground sm:text-base">
              हिशोब व वसुली स्थिती (Mandal Financial Pulse)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              सद्यस्थिती आणि तिजोरीचा हिशोब (Real-time Overview)
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 cursor-pointer rounded-lg text-xs font-semibold"
        >
          {loading ? "ताजे करत आहे..." : "🔄 रिफ्रेश"}
        </Button>
      </div>

      {/* -------------------------------------------------------------
          HERO CARD: TODAY'S COLLECTION (आजची वसुली)
      -------------------------------------------------------------- */}
      <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-4 sm:p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
            <span>🌅</span> आजची वसुली (Today's Collection)
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {today.receipt_count} {today.receipt_count === 1 ? "पावती" : "पावत्या"} (Receipts)
          </span>
        </div>

        <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {formatCurrency(today.total_amount)}
        </div>

        {/* Physical vs Digital Sub-grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div className="rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-3">
            <span className="text-[11px] font-bold text-muted-foreground block">
              💵 रोख व चेक (Physical Cash & Cheques)
            </span>
            <span className="text-lg font-bold text-foreground block mt-0.5">
              {formatCurrency(todayPhysical)}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              रोख: {formatCurrency(today.cash_amount)} • चेक: {formatCurrency(today.cheque_amount)}
            </span>
          </div>

          <div className="rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-3">
            <span className="text-[11px] font-bold text-muted-foreground block">
              📱 UPI / डिजिटल (Digital - Direct Bank)
            </span>
            <span className="text-lg font-bold text-foreground block mt-0.5">
              {formatCurrency(todayDigital)}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
              ✓ थेट मंडळ बँक खात्यात जमा (Direct Deposit)
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          FESTIVAL GRAND TOTAL (उत्सव एकूण वर्गणी)
      -------------------------------------------------------------- */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-850 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <span>📊</span> उत्सव एकूण वर्गणी (Festival Total)
          </span>
          <span className="text-xs font-bold text-foreground">
            {festival_total.receipt_count} एकूण पावत्या
          </span>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-2xl font-black text-foreground">
            {formatCurrency(festival_total.total_amount)}
          </span>
          <div className="text-xs text-muted-foreground space-x-2">
            <span>💵 रोख/चेक: <b>{formatCurrency(festivalPhysical)}</b></span>
            <span>•</span>
            <span>📱 डिजिटल: <b>{formatCurrency(festivalDigital)}</b></span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          TREASURY & VOLUNTEER CASH CUSTODY (तिजोरी व रोख स्थिती)
      -------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Treasury Received */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
              <span>🏛️</span> तिजोरीत जमा (Treasury Received)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              ✓ सुरक्षित जमा
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
            {formatCurrency(treasury.treasury_cash_received)}
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
            {treasury.total_authorized_expenses > 0
              ? `(+ ${formatCurrency(treasury.total_authorized_expenses)} मान्य खर्च वजावट / Approved expenses)`
              : "हस्तबदल पूर्ण झालेली रोख (Verified cash)"}
          </p>
        </div>

        {/* Volunteer Custody Balance */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <span>👥</span> कार्यकर्त्यांकडे रोख (In Custody)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {treasury.volunteers_holding_cash_count}{" "}
              {treasury.volunteers_holding_cash_count === 1
                ? "कार्यकर्ता"
                : "कार्यकर्ते"}
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {formatCurrency(treasury.total_physical_cash_held)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            हस्तबदल बाकी असलेली रोख (Pending handover to treasury)
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------------
          DOOR-TO-DOOR RESIDENTIAL COVERAGE PROGRESS
      -------------------------------------------------------------- */}
      {property_progress.total_residential_units > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-850 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>🏢</span> घरपोच वर्गणी प्रगती (Door-to-Door Progress)
            </span>
            <span className="text-xs font-extrabold text-primary">
              {property_progress.completion_percentage}% पूर्ण
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, property_progress.completion_percentage))}%`,
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
            <span>
              ✅ जमा: <b>{property_progress.collected_count}</b>
            </span>
            <span>
              ⏳ बाकी: <b>{property_progress.pending_count}</b>
            </span>
            <span>
              🚫 नकार: <b>{property_progress.refused_count}</b>
            </span>
            <span>
              🚪 बाकी घरे: <b>{property_progress.not_visited_count}</b>
            </span>
            <span>
              एकूण: <b>{property_progress.total_residential_units} घरे</b>
            </span>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          PENDING HANDOVER REVIEW BANNER (IF ANY WAITING)
      -------------------------------------------------------------- */}
      {treasury.pending_handover_count > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                {treasury.pending_handover_count}{" "}
                {treasury.pending_handover_count === 1
                  ? "हस्तबदल तपासणीसाठी बाकी"
                  : "हस्तबदल तपासणीसाठी बाकी आहेत"}
              </h4>
              <p className="text-xs text-amber-800">
                एकूण रक्कम: <b>{formatCurrency(treasury.pending_handover_amount)}</b> जमा करण्यासाठी तयार आहे.
              </p>
            </div>
          </div>

          {onReviewHandovers && (
            <Button
              type="button"
              onClick={onReviewHandovers}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 cursor-pointer shrink-0"
            >
              हिशोब तपासा (Review) →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
