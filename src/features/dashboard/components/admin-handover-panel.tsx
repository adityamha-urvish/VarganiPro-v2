import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/features/analytics/components/secretary-overview-hero";

export type AdminHandover = {
  id: string;
  organization_id: string;
  event_id: string;
  collection_session_id: string;
  volunteer_id: string;
  expected_receipt_count: number;
  expected_total_amount: number;
  expected_cash_amount: number;
  expected_upi_amount: number;
  expected_cheque_amount: number;
  expected_bank_transfer_amount: number;
  actual_cash_amount: number;
  actual_upi_amount: number;
  actual_cheque_amount: number;
  actual_bank_transfer_amount: number;
  authorized_expense_amount?: number;
  authorized_expense_note?: string | null;
  discrepancy_reason?: string | null;
  status: string;
  submitted_at: string | null;
  submitted_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  volunteerName?: string;
};

export type AdminHandoverPanelProps = {
  handovers: AdminHandover[];
  loading: boolean;
  error: string | null;
  actionLoadingId: string | null;
  onRefresh: () => void;
  onVerifyHandover: (handoverId: string) => void;
  onRejectHandover: (handoverId: string, reason: string) => void;
};

export function AdminHandoverPanel({
  handovers,
  loading,
  error,
  actionLoadingId,
  onRefresh,
  onVerifyHandover,
  onRejectHandover,
}: AdminHandoverPanelProps) {
  const [rejectingHandoverId, setRejectingHandoverId] = useState<string | null>(
    null
  );
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  function handleOpenRejectModal(handoverId: string) {
    setRejectingHandoverId(handoverId);
    setRejectionReasonInput("");
    setRejectionError(null);
  }

  function handleConfirmReject() {
    if (!rejectingHandoverId) return;
    const reason = rejectionReasonInput.trim();
    if (!reason || reason.length < 3) {
      setRejectionError("Please provide a rejection reason (किमान ३ अक्षरांचे कारण द्या).");
      return;
    }
    onRejectHandover(rejectingHandoverId, reason);
    setRejectingHandoverId(null);
    setRejectionReasonInput("");
  }

  return (
    <div
      data-testid="admin-handover-panel"
      className="w-full max-w-full box-border rounded-2xl border border-slate-200 bg-card p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-5 animate-in fade-in"
    >
      {/* -------------------------------------------------------------
          HEADER: ROLE CUE, TITLE & REFRESH ACTION
      -------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 sm:pb-4 min-w-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-lg sm:text-xl shrink-0">
            🤝
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground truncate">
                Handover Verification (हस्तबदल पडताळणी)
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shrink-0">
                👤 Reviewing as: Secretary (Admin)
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              Verify physical cash handed over by volunteers & deposit to Treasury (रोख तपासणी व तिजोरीत जमा)
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-9 px-3 self-start sm:self-auto cursor-pointer rounded-xl text-xs font-bold shrink-0"
        >
          {loading ? "Refreshing..." : "🔄 Refresh (रिफ्रेश)"}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 min-w-0">
          <p className="text-xs font-bold text-red-700 break-words">{error}</p>
        </div>
      )}

      {loading && handovers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-8 text-center space-y-2 animate-pulse min-w-0">
          <div className="h-4 w-40 bg-slate-200 rounded mx-auto" />
          <p className="text-xs text-muted-foreground">Loading handovers (हस्तबदल लोड होत आहेत)...</p>
        </div>
      ) : handovers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2 min-w-0">
          <span className="text-3xl block">🤝</span>
          <p className="text-sm font-bold text-foreground">
            No Pending Handovers (कोणताही हस्तबदल प्रलंबित नाही)
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Handovers will appear here when volunteers complete collection sessions and submit reconciliation. (कार्यकर्त्यांनी हिशोब सादर केल्यावर ते येथे दिसतील.)
          </p>
        </div>
      ) : (
        <div className="space-y-3.5 sm:space-y-4 min-w-0">
          {handovers.map((adminHandover) => {
            const expectedCash = Number(
              adminHandover.expected_cash_amount || 0
            );
            const expectedCheque = Number(
              adminHandover.expected_cheque_amount || 0
            );
            const expectedPhysical = expectedCash + expectedCheque;

            const actualCash = Number(adminHandover.actual_cash_amount || 0);
            const actualCheque = Number(
              adminHandover.actual_cheque_amount || 0
            );
            const actualPhysical = actualCash + actualCheque;

            const expense = Number(
              adminHandover.authorized_expense_amount || 0
            );
            const totalAccounted = actualPhysical + expense;
            const difference = totalAccounted - expectedPhysical;

            const isExactMatch = Math.abs(difference) < 0.005;
            const isShortage = difference < -0.005;

            const expectedDigital =
              Number(adminHandover.expected_upi_amount || 0) +
              Number(adminHandover.expected_bank_transfer_amount || 0);

            const isSubmitted = adminHandover.status === "submitted";
            const isVerified = adminHandover.status === "verified";
            const isRejected = adminHandover.status === "rejected";
            const actionBusy = actionLoadingId === adminHandover.id;

            return (
              <div
                key={adminHandover.id}
                data-testid={`admin-handover-card-${adminHandover.id}`}
                className="w-full max-w-full box-border rounded-xl border border-slate-200 bg-white dark:bg-slate-850 p-3.5 sm:p-5 shadow-xs space-y-3.5 sm:space-y-4 min-w-0"
              >
                {/* Header Row: Volunteer Info & Status */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 border-b border-slate-100 pb-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm sm:text-base text-foreground truncate">
                        👤 {adminHandover.volunteerName || "Volunteer (कार्यकर्ता)"}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black shrink-0 ${
                          isVerified
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : isRejected
                              ? "bg-red-100 text-red-800 border border-red-300"
                              : isSubmitted
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isVerified
                          ? "✓ In Treasury (तिजोरीत जमा)"
                          : isRejected
                            ? "⚠️ Rejected (नाकारले)"
                            : isSubmitted
                              ? "Submitted (हिशोब सादर)"
                              : adminHandover.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span>
                        Receipts (पावत्या): <b>{adminHandover.expected_receipt_count}</b>
                      </span>
                      <span>•</span>
                      {adminHandover.submitted_at && (
                        <span className="truncate">
                          Submitted (सादर):{" "}
                          {new Date(
                            adminHandover.submitted_at
                          ).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Verification Action Buttons (Online Only) */}
                  {isSubmitted && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0 shrink-0">
                      <Button
                        type="button"
                        onClick={() => onVerifyHandover(adminHandover.id)}
                        disabled={actionBusy}
                        className="w-full sm:w-auto h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-xs rounded-xl box-border"
                      >
                        {actionBusy
                          ? "Verifying..."
                          : "✓ Verify & Accept Cash (स्वीकारा व जमा करा)"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenRejectModal(adminHandover.id)}
                        disabled={actionBusy}
                        className="w-full sm:w-auto h-10 px-3 border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold cursor-pointer rounded-xl box-border"
                      >
                        ✕ Reject (नाकारा)
                      </Button>
                    </div>
                  )}
                </div>

                {/* -----------------------------------------------------
                    PHYSICAL CUSTODY RECONCILIATION BREAKDOWN
                ------------------------------------------------------ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs min-w-0">
                  {/* Expected Physical */}
                  <div className="rounded-xl bg-slate-50 border p-3 min-w-0 space-y-0.5 box-border">
                    <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider truncate">
                      EXPECTED PHYSICAL (अपेक्षित रोख)
                    </span>
                    <span className="text-base font-black text-foreground block">
                      {formatCurrency(expectedPhysical)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Cash: {formatCurrency(expectedCash)} • Cheque: {formatCurrency(expectedCheque)}
                    </span>
                  </div>

                  {/* Actual Physical Handed Over */}
                  <div className="rounded-xl bg-slate-50 border p-3 min-w-0 space-y-0.5 box-border">
                    <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider truncate">
                      ACTUAL HANDED (प्रत्यक्ष दिलेली रोख)
                    </span>
                    <span className="text-base font-black text-foreground block">
                      {formatCurrency(actualPhysical)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Cash: {formatCurrency(actualCash)} • Cheque: {formatCurrency(actualCheque)}
                    </span>
                  </div>

                  {/* Reported Collection Expenses */}
                  <div className="rounded-xl bg-slate-50 border p-3 min-w-0 space-y-0.5 box-border">
                    <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider truncate">
                      REPORTED EXPENSE (वापरलेला खर्च)
                    </span>
                    <span className="text-base font-black text-foreground block">
                      {formatCurrency(expense)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {adminHandover.authorized_expense_note || "—"}
                    </span>
                  </div>

                  {/* Reconciliation Difference Badge */}
                  <div
                    className={`rounded-xl border p-3 min-w-0 space-y-0.5 box-border ${
                      isExactMatch
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : isShortage
                          ? "border-amber-300 bg-amber-50 text-amber-950"
                          : "border-blue-300 bg-blue-50 text-blue-950"
                    }`}
                  >
                    <span className="text-[10px] font-black block uppercase tracking-wider opacity-80 truncate">
                      DIFFERENCE RESULT (जुळणी निकाल)
                    </span>
                    <span className="text-base font-black block">
                      {isExactMatch
                        ? "₹0 (✓ Matched)"
                        : isShortage
                          ? `- ${formatCurrency(Math.abs(difference))} (Shortage)`
                          : `+ ${formatCurrency(difference)} (Surplus)`}
                    </span>
                    <span className="text-[10px] font-bold block truncate">
                      {isExactMatch
                        ? "Exact Match (तंतोतंत जुळले)"
                        : isShortage
                          ? "Shortage Alert (कमी रक्कम)"
                          : "Surplus Alert (जास्त रक्कम)"}
                    </span>
                  </div>
                </div>

                {/* Discrepancy Reason Explanation If Shortage/Excess */}
                {adminHandover.discrepancy_reason && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs space-y-1 min-w-0">
                    <span className="font-bold text-amber-950 block break-words">
                      ⚠️ Volunteer Discrepancy Note (कार्यकर्त्याचे तफावत स्पष्टीकरण):
                    </span>
                    <p className="text-amber-900 font-semibold bg-white/70 p-2 rounded border border-amber-200 break-words">
                      "{adminHandover.discrepancy_reason}"
                    </p>
                  </div>
                )}

                {/* Digital Direct-Bank Deposit Row */}
                {expectedDigital > 0 && (
                  <div className="rounded-xl bg-blue-50/60 border border-blue-200 p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-blue-950 min-w-0">
                      <span className="shrink-0">📱</span>
                      <span className="break-words">UPI Recorded (थेट बँक खात्यात जमा):</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-blue-950 shrink-0">
                        {formatCurrency(expectedDigital)}
                      </span>
                      <span className="text-[11px] text-blue-800 font-semibold break-words">
                        (Direct Mandal bank deposit • No cash handover required)
                      </span>
                    </div>
                  </div>
                )}

                {/* Rejection Alert */}
                {isRejected && adminHandover.rejection_reason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs">
                    <span className="font-bold text-red-900 block">
                      Rejection Reason (नाकारण्याचे कारण):
                    </span>
                    <p className="text-red-800 mt-0.5">
                      {adminHandover.rejection_reason}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {adminHandover.notes && (
                  <div className="rounded-xl bg-slate-50 border p-3 text-xs text-muted-foreground">
                    <b>Notes (टीप):</b> {adminHandover.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------
          REJECTION REASON MODAL DIALOG
      -------------------------------------------------------------- */}
      {rejectingHandoverId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900">
              Reject Handover (हस्तबदल नाकारण्याचे कारण)
            </h3>
            <p className="text-xs text-slate-600">
              State a clear reason so the volunteer understands what to recount or correct. (स्पष्ट कारण लिहा.)
            </p>

            <div className="space-y-1.5">
              <Input
                type="text"
                placeholder="e.g. Cash is short by ₹200, please recount (उदा. रोख कमी आहे...)"
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
              {rejectionError && (
                <p className="text-[11px] text-red-600 font-semibold">
                  {rejectionError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectingHandoverId(null)}
                className="h-9 text-xs rounded-xl"
              >
                Cancel (रद्द करा)
              </Button>
              <Button
                type="button"
                onClick={handleConfirmReject}
                className="h-9 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl"
              >
                ✕ Confirm Reject (नाकारा)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
