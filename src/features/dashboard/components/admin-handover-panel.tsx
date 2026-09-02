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
      setRejectionError("कृपया नाकारण्याचे स्पष्ट कारण भरा (किमान ३ अक्षरे).");
      return;
    }
    onRejectHandover(rejectingHandoverId, reason);
    setRejectingHandoverId(null);
    setRejectionReasonInput("");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-card p-5 sm:p-6 shadow-xs space-y-5">
      {/* -------------------------------------------------------------
          HEADER: TITLE & REFRESH ACTION
      -------------------------------------------------------------- */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🤝</span>
          <div>
            <h2 className="text-sm font-black tracking-tight text-foreground sm:text-base">
              हस्तबदल पडताळणी (Handover Verification)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              कार्यकर्त्यांनी सादर केलेल्या रकमेची तपासणी व तिजोरीत जमा
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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-bold text-red-700">{error}</p>
        </div>
      )}

      {loading && handovers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-8 text-center space-y-2 animate-pulse">
          <div className="h-4 w-40 bg-slate-200 rounded mx-auto" />
          <p className="text-xs text-muted-foreground">हस्तबदल लोड होत आहेत...</p>
        </div>
      ) : handovers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2">
          <span className="text-3xl block">🤝</span>
          <p className="text-sm font-bold text-foreground">
            कोणताही हस्तबदल प्रलंबित नाही
          </p>
          <p className="text-xs text-muted-foreground">
            कार्यकर्त्यांनी कलेक्शन सत्र पूर्ण करून हिशोब सादर केल्यावर ते येथे दिसतील.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
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
                className="rounded-xl border border-slate-200 bg-white dark:bg-slate-850 p-5 shadow-2xs space-y-4"
              >
                {/* Header Row: Volunteer Info & Status */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm sm:text-base text-foreground">
                        👤 {adminHandover.volunteerName || "कार्यकर्ता (Volunteer)"}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
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
                          ? "✓ तिजोरीत जमा (Verified)"
                          : isRejected
                            ? "⚠️ नाकारले (Rejected)"
                            : isSubmitted
                              ? "हस्तबदल सादर (Submitted)"
                              : adminHandover.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span>
                        पावत्या: <b>{adminHandover.expected_receipt_count}</b>
                      </span>
                      <span>•</span>
                      {adminHandover.submitted_at && (
                        <span>
                          सादर:{" "}
                          {new Date(
                            adminHandover.submitted_at
                          ).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Verification Action Buttons (Online Only) */}
                  {isSubmitted && (
                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                      <Button
                        type="button"
                        onClick={() => onVerifyHandover(adminHandover.id)}
                        disabled={actionBusy}
                        className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                      >
                        {actionBusy
                          ? "तपासत आहे..."
                          : "✓ स्वीकारा व जमा करा (Verify)"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenRejectModal(adminHandover.id)}
                        disabled={actionBusy}
                        className="h-9 px-3 border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold cursor-pointer"
                      >
                        ✕ नाकारा (Reject)
                      </Button>
                    </div>
                  )}
                </div>

                {/* -----------------------------------------------------
                    PHYSICAL CUSTODY RECONCILIATION BREAKDOWN
                ------------------------------------------------------ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  {/* Expected Physical */}
                  <div className="rounded-lg bg-slate-50 border p-3">
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      अपेक्षित रोख व चेक (Expected)
                    </span>
                    <span className="text-base font-black text-foreground block mt-0.5">
                      {formatCurrency(expectedPhysical)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      रोख: {formatCurrency(expectedCash)} • चेक: {formatCurrency(expectedCheque)}
                    </span>
                  </div>

                  {/* Actual Physical Handed Over */}
                  <div className="rounded-lg bg-slate-50 border p-3">
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      प्रत्यक्षात दिलेली रोख (Actual Handed)
                    </span>
                    <span className="text-base font-black text-foreground block mt-0.5">
                      {formatCurrency(actualPhysical)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      रोख: {formatCurrency(actualCash)} • चेक: {formatCurrency(actualCheque)}
                    </span>
                  </div>

                  {/* Reported Collection Expenses */}
                  <div className="rounded-lg bg-slate-50 border p-3">
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      वापरलेला खर्च (Reported Expense)
                    </span>
                    <span className="text-base font-black text-foreground block mt-0.5">
                      {formatCurrency(expense)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                      {adminHandover.authorized_expense_note || "—"}
                    </span>
                  </div>

                  {/* Reconciliation Difference Badge */}
                  <div
                    className={`rounded-lg border p-3 ${
                      isExactMatch
                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
                        : isShortage
                          ? "border-amber-300 bg-amber-50 text-amber-950"
                          : "border-blue-200 bg-blue-50 text-blue-950"
                    }`}
                  >
                    <span className="text-[10px] font-bold block opacity-80">
                      जुळणी निकाल (Difference)
                    </span>
                    <span className="text-base font-black block mt-0.5">
                      {isExactMatch
                        ? "₹0 (✓ जुळले)"
                        : isShortage
                          ? `- ${formatCurrency(Math.abs(difference))} (कमी)`
                          : `+ ${formatCurrency(difference)} (जास्त)`}
                    </span>
                    <span className="text-[10px] font-semibold block mt-0.5">
                      {isExactMatch
                        ? "Exact Match"
                        : isShortage
                          ? "Shortage Alert"
                          : "Surplus"}
                    </span>
                  </div>
                </div>

                {/* Discrepancy Reason Explanation If Shortage */}
                {adminHandover.discrepancy_reason && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs space-y-1">
                    <span className="font-bold text-amber-950 block">
                      ⚠️ कार्यकर्त्याचे तफावत स्पष्टीकरण (Discrepancy Note):
                    </span>
                    <p className="text-amber-900 font-medium">
                      "{adminHandover.discrepancy_reason}"
                    </p>
                  </div>
                )}

                {/* Digital Direct-Bank Deposit Row */}
                {expectedDigital > 0 && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground font-semibold">
                      📱 UPI / डिजिटल वर्गणी (Mandal Bank थेट जमा):
                    </span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(expectedDigital)} (
                      रोख हस्तबदल आवश्यक नाही)
                    </span>
                  </div>
                )}

                {/* Rejection Alert */}
                {isRejected && adminHandover.rejection_reason && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs">
                    <span className="font-bold text-red-900 block">
                      नाकारण्याचे कारण (Rejection Reason):
                    </span>
                    <p className="text-red-800 mt-0.5">
                      {adminHandover.rejection_reason}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {adminHandover.notes && (
                  <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-muted-foreground">
                    <b>टीप:</b> {adminHandover.notes}
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
              हस्तबदल नाकारण्याचे कारण (Reason for Rejection)
            </h3>
            <p className="text-xs text-slate-600">
              हा हस्तबदल का नाकारला जात आहे ते कार्यकर्त्यास समजण्यासाठी स्पष्ट कारण लिहा.
            </p>

            <div className="space-y-1.5">
              <Input
                type="text"
                placeholder="उदा. रोख ₹२०० कमी आहे, मोजणी पुन्हा करा..."
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
                className="h-9 text-xs"
              >
                रद्द करा (Cancel)
              </Button>
              <Button
                type="button"
                onClick={handleConfirmReject}
                className="h-9 text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                ✕ नाकारा (Confirm Reject)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
