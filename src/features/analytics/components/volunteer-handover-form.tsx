import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VolunteerHandoverData } from "@/features/dashboard/hooks/use-volunteer-handover";
import { formatCurrency } from "./secretary-overview-hero";

export interface VolunteerHandoverFormProps {
  handover: VolunteerHandoverData | null;
  creatingHandover: boolean;
  submittingHandover: boolean;
  actualCashAmount: string;
  actualChequeAmount: string;
  authorizedExpenseAmount: string;
  authorizedExpenseNote: string;
  discrepancyReason: string;
  handoverNotes: string;
  handoverError: string | null;
  handoverMessage: string | null;
  unsyncedCount?: number;
  pendingFollowUpCount?: number;
  onCreateHandover: () => void;
  onSubmitHandover: () => void;
  onActualCashAmountChange: (value: string) => void;
  onActualChequeAmountChange: (value: string) => void;
  onAuthorizedExpenseAmountChange: (value: string) => void;
  onAuthorizedExpenseNoteChange: (value: string) => void;
  onDiscrepancyReasonChange: (value: string) => void;
  onHandoverNotesChange: (value: string) => void;
}

export function VolunteerHandoverForm({
  handover,
  creatingHandover,
  submittingHandover,
  actualCashAmount,
  actualChequeAmount,
  authorizedExpenseAmount,
  authorizedExpenseNote,
  discrepancyReason,
  handoverNotes,
  handoverError,
  handoverMessage,
  unsyncedCount = 0,
  pendingFollowUpCount = 0,
  onCreateHandover,
  onSubmitHandover,
  onActualCashAmountChange,
  onActualChequeAmountChange,
  onAuthorizedExpenseAmountChange,
  onAuthorizedExpenseNoteChange,
  onDiscrepancyReasonChange,
  onHandoverNotesChange,
}: VolunteerHandoverFormProps) {
  const [isReviewStage, setIsReviewStage] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const cash = Number(actualCashAmount || 0);
  const cheque = Number(actualChequeAmount || 0);
  const expense = Number(authorizedExpenseAmount || 0);
  const countedPhysical = cash + cheque;
  const totalAccounted = countedPhysical + expense;

  const expectedPhysical = Number(handover?.expectedPhysicalAmount ?? 0);
  const expectedTotal = Number(handover?.totalAmount ?? 0);
  const expectedDigital = Number(handover?.expectedDigitalAmount ?? 0);
  const difference = totalAccounted - expectedPhysical;
  const isExactMatch = Math.abs(difference) < 0.005;
  const isShortage = difference < -0.005;
  const isExcess = difference > 0.005;

  const isSubmitted = handover?.status === "submitted";
  const isVerified = handover?.status === "verified";
  const isRejected = handover?.status === "rejected";

  const hasUnsynced = unsyncedCount > 0;
  const isDiscrepancyValid =
    !isShortage && !isExcess ? true : discrepancyReason.trim().length >= 3;

  function handleProceedToReview() {
    setValidationError(null);
    if (!actualCashAmount && !actualChequeAmount && actualCashAmount !== "0") {
      setValidationError(
        "Please enter the cash counted (कृपया मोजलेली रोख रक्कम भरा)."
      );
      return;
    }
    setIsReviewStage(true);
  }

  return (
    <div
      data-testid="volunteer-handover-form"
      className="w-full max-w-full box-border rounded-2xl border border-slate-200 bg-card p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-5 animate-in fade-in"
    >
      {/* -------------------------------------------------------------
          HEADER: TITLE & STATUS BADGE
      -------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 sm:pb-4 min-w-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg sm:text-xl shrink-0">
            🤝
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-lg font-black tracking-tight text-foreground truncate">
              Session Handover (जमा वर्गणी हिशोब)
            </h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              Submit collected physical cash & reconcile session (गोळा केलेली रोख जमा करा)
            </p>
          </div>
        </div>

        <div className="self-start sm:self-auto shrink-0 max-w-full">
          {isVerified ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
              ✓ In Treasury · Session Closed (तिजोरीत जमा)
            </span>
          ) : isSubmitted ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-black bg-blue-100 text-blue-800 border border-blue-300">
              Submitted — Awaiting Verification (हिशोब सादर)
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-black bg-red-100 text-red-800 border border-red-300">
              ⚠️ Rejected (नाकारले)
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Pending Count (मोजणी बाकी)
            </span>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          INITIAL STATE: CREATE HANDOVER BUTTON
      -------------------------------------------------------------- */}
      {!handover && (
        <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-6 sm:p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto text-2xl font-bold">
            📋
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              Session Ready for Handover (कलेक्शन सत्र पूर्ण)
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Count physical cash in hand and submit reconciliation to Secretary. (रोख मोजणी सुरू करा.)
            </p>
          </div>
          <Button
            type="button"
            onClick={onCreateHandover}
            disabled={creatingHandover}
            className="font-bold text-xs sm:text-sm h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs cursor-pointer"
          >
            {creatingHandover
              ? "Preparing Handover... (तयार करत आहे...)"
              : "Start Handover (हस्तबदल सुरू करा) →"}
          </Button>
        </div>
      )}

      {/* -------------------------------------------------------------
          ACTIVE HANDOVER ENTRY OR REVIEW
      -------------------------------------------------------------- */}
      {handover && !isSubmitted && !isVerified && (
        <>
          {/* Rejection Alert If Previous Submission Was Rejected */}
          {isRejected && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                  <span>⚠️</span> Handover Rejected by Secretary (नाकारले):
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-200/80 text-red-900 px-2 py-0.5 rounded">
                  Recount Cash (पुन्हा मोजा)
                </span>
              </div>
              <p className="text-xs font-bold text-red-800 bg-white/70 p-2.5 rounded-lg border border-red-200">
                "{handover.rejectionReason || "Please verify physical cash count and submit again."}"
              </p>
              <p className="text-[11px] text-red-700">
                Please enter exact counted cash below and resubmit handover. (कृपया अचूक मोजणी करून पुन्हा हिशोब सादर करा.)
              </p>
            </div>
          )}

          {/* Sync Warning Gate Alert */}
          {hasUnsynced && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <span>⚠️</span> Unsynced Receipts Pending ({unsyncedCount} पावत्या सिंक बाकी)
              </div>
              <p className="text-[11px] text-amber-800">
                All receipts must be synced to server before submitting handover. Check internet connection. (सर्व पावत्या सिंक होणे आवश्यक आहे.)
              </p>
            </div>
          )}

          {/* ---------------------------------------------------------
              STEP 1: INDEPENDENT BLIND CASH COUNT & EXPENSE ENTRY
              (Expected amount is strictly hidden here!)
          ---------------------------------------------------------- */}
          {!isReviewStage ? (
            <div className="space-y-3.5 sm:space-y-4 min-w-0">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 sm:p-4 space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0">💵</span>
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                    CASH COUNT (BLIND COUNT) — रोख मोजणी
                  </span>
                </div>
                <p className="text-xs text-amber-900">
                  Count physical cash in hand independently and enter below. (तुमच्या हातातील प्रत्यक्ष रोख मोजा आणि भरा.)
                </p>
              </div>

              {/* Cash Counted Input */}
              <div className="space-y-1.5 min-w-0">
                <label
                  htmlFor="actual-cash-count"
                  className="text-xs font-bold text-foreground flex items-center justify-between gap-1"
                >
                  <span className="truncate">💵 Cash Counted (मोजलेली रोख) *</span>
                  <span className="text-[10px] text-muted-foreground font-normal shrink-0">Required (आवश्यक)</span>
                </label>
                <div className="relative w-full">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="actual-cash-count"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={actualCashAmount}
                    onChange={(e) => {
                      setValidationError(null);
                      onActualCashAmountChange(e.target.value);
                    }}
                    className="w-full h-12 pl-9 text-base sm:text-lg font-black rounded-xl bg-background border-slate-300 focus-visible:ring-primary box-border"
                  />
                </div>
              </div>

              {/* Cheque Counted Input */}
              <div className="space-y-1.5 min-w-0">
                <label
                  htmlFor="actual-cheque-count"
                  className="text-xs font-bold text-foreground flex items-center justify-between gap-1"
                >
                  <span className="truncate">📄 Cheques Counted (चेक रक्कम)</span>
                  <span className="text-[10px] text-muted-foreground font-normal shrink-0">Optional (ऐच्छिक)</span>
                </label>
                <div className="relative w-full">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="actual-cheque-count"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={actualChequeAmount}
                    onChange={(e) => onActualChequeAmountChange(e.target.value)}
                    className="w-full h-11 pl-9 text-sm sm:text-base font-bold rounded-xl bg-background box-border"
                  />
                </div>
              </div>

              {/* Reported Collection Expenses */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 min-w-0">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>🧾</span> Collection Expenses (खर्च झाला का?)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="reported-expense-amount"
                      className="text-[11px] font-semibold text-muted-foreground block truncate"
                    >
                      Expense Amount (खर्च रक्कम)
                    </label>
                    <div className="relative w-full">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        id="reported-expense-amount"
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="0"
                        placeholder="0"
                        value={authorizedExpenseAmount}
                        onChange={(e) =>
                          onAuthorizedExpenseAmountChange(e.target.value)
                        }
                        className="w-full h-10 pl-8 text-sm font-bold rounded-xl bg-white box-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="reported-expense-note"
                      className="text-[11px] font-semibold text-muted-foreground block truncate"
                    >
                      Expense Reason (खर्चाचे कारण)
                    </label>
                    <Input
                      id="reported-expense-note"
                      type="text"
                      placeholder="e.g. Rickshaw fare, tea (उदा. रिक्षा भाडे, चहा-पाणी...)"
                      value={authorizedExpenseNote}
                      onChange={(e) =>
                        onAuthorizedExpenseNoteChange(e.target.value)
                      }
                      className="w-full h-10 text-xs rounded-xl bg-white box-border"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Notes */}
              <div className="space-y-1.5 min-w-0">
                <label
                  htmlFor="volunteer-handover-notes"
                  className="text-xs font-bold text-muted-foreground block truncate"
                >
                  📝 Handover Notes (टीप / शेरा)
                </label>
                <Input
                  id="volunteer-handover-notes"
                  type="text"
                  placeholder="e.g. Operational remarks (हस्तबदलाबाबत टीप...)"
                  value={handoverNotes}
                  onChange={(e) => onHandoverNotesChange(e.target.value)}
                  className="w-full h-10 text-xs rounded-xl box-border"
                />
              </div>

              {validationError && (
                <p className="text-xs font-bold text-red-600 animate-in fade-in">
                  {validationError}
                </p>
              )}

              {/* Advance to Review Button */}
              <Button
                type="button"
                onClick={handleProceedToReview}
                className="w-full h-12 text-xs sm:text-sm font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs cursor-pointer transition-all box-border"
              >
                📊 Review Reconciliation (हिशोब तपासा) →
              </Button>
            </div>
          ) : (
            /* ---------------------------------------------------------
                STEP 2: DIRECTION B RECONCILIATION DESK (Revealed After Count)
            ---------------------------------------------------------- */
            <div className="space-y-3.5 sm:space-y-4 animate-in fade-in min-w-0">
              {/* PRIMARY FINANCIAL HEADLINE: CASH TO HAND OVER */}
              <div className="rounded-xl bg-[#0B1E26] text-white p-4 sm:p-5 space-y-1.5 sm:space-y-2 shadow-md min-w-0">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    💵 CASH TO HAND OVER (प्रत्यक्ष रोख स्वाधीन करा)
                  </span>
                  <span className="text-[10px] font-semibold bg-white/10 px-2 py-0.5 rounded text-slate-200 shrink-0">
                    Receipts: {handover.receiptCount} (पावत्या)
                  </span>
                </div>
                <div className="text-2xl sm:text-4xl font-black text-amber-400 tracking-tight">
                  {formatCurrency(expectedPhysical)}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-300 break-words">
                  Physical cash to be handed over to Secretary. (सेक्रेटरींकडे ही रोख रक्कम जमा करणे अपेक्षित आहे.)
                </p>
              </div>

              {/* SECONDARY ROW: TOTAL COLLECTION & DIGITAL UPI TILES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs min-w-0">
                {/* Total Collection Tile */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 sm:p-3.5 space-y-1 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    TOTAL COLLECTION VALUE (एकूण संकलन)
                  </span>
                  <span className="text-base sm:text-lg font-black text-foreground block">
                    {formatCurrency(expectedTotal)}
                  </span>
                  <span className="text-[11px] text-muted-foreground block break-words">
                    Cash {formatCurrency(expectedPhysical)} + UPI {formatCurrency(expectedDigital)}
                  </span>
                </div>

                {/* Digital UPI Tile */}
                <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-3 sm:p-3.5 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                      📱 UPI RECORDED (डिजिटल वर्गणी)
                    </span>
                    <span className="text-[9px] font-bold bg-blue-200/80 text-blue-900 px-1.5 py-0.5 rounded shrink-0">
                      Direct Bank
                    </span>
                  </div>
                  <span className="text-base sm:text-lg font-black text-blue-950 block">
                    {formatCurrency(expectedDigital)}
                  </span>
                  <span className="text-[11px] text-blue-800 font-semibold block break-words">
                    ✓ Deposited directly to Mandal bank • No cash handover (थेट बँक खात्यात जमा • रोख हस्तांतरण नको)
                  </span>
                </div>
              </div>

              {/* Pending Follow-ups Reassurance Chip */}
              {pendingFollowUpCount > 0 && (
                <div className="rounded-lg bg-amber-50/80 border border-amber-200/80 px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-amber-900 min-w-0">
                  <span className="font-semibold break-words">
                    🚪 {pendingFollowUpCount} Pending Follow-ups (पाठपुरावा बाकी)
                  </span>
                  <span className="font-bold text-[11px] shrink-0">
                    ₹0 collected • Not in cash (रोख जमा ₹०)
                  </span>
                </div>
              )}

              {/* RECONCILIATION SUMMARY BOX */}
              <div className="rounded-xl bg-card border border-slate-200 p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 min-w-0">
                <span className="text-[11px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  📊 RECONCILIATION SUMMARY (हिशोब जुळणी)
                </span>

                <div className="space-y-1.5 text-xs divide-y divide-slate-100">
                  <div className="flex justify-between items-center py-1 gap-2">
                    <span className="text-muted-foreground break-words">
                      Expected Physical Cash / Cheque (अपेक्षित रोख/चेक):
                    </span>
                    <span className="font-bold text-foreground shrink-0">
                      {formatCurrency(expectedPhysical)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 gap-2">
                    <span className="text-muted-foreground break-words">
                      Physical Cash & Cheques Counted (मोजलेली रोख व चेक):
                    </span>
                    <span className="font-bold text-foreground shrink-0">
                      {formatCurrency(countedPhysical)}
                    </span>
                  </div>

                  {expense > 0 && (
                    <div className="flex justify-between items-center py-1 gap-2">
                      <span className="text-muted-foreground break-words">
                        Authorized Collection Expense (वापरलेला खर्च):
                      </span>
                      <span className="font-bold text-foreground shrink-0">
                        + {formatCurrency(expense)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-1.5 font-bold text-xs sm:text-sm border-t border-slate-200 gap-2">
                    <span className="break-words">Total Accounted (एकूण हिशोब दिला):</span>
                    <span className="shrink-0">{formatCurrency(totalAccounted)}</span>
                  </div>
                </div>

                {/* DISCREPANCY / MATCH ALERT */}
                <div
                  className={`rounded-xl p-3 sm:p-3.5 text-xs font-bold border transition-all min-w-0 ${
                    isExactMatch
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : isShortage
                        ? "bg-amber-50 text-amber-950 border-amber-300"
                        : "bg-blue-50 text-blue-950 border-blue-300"
                  }`}
                >
                  {isExactMatch ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">✓</span>
                      <div className="min-w-0">
                        <p className="font-black">✓ CASH COUNT MATCHED</p>
                        <p className="text-[11px] font-medium text-emerald-800 break-words">
                          ✓ Exact Match — ₹0 Difference (रोख मोजणी तंतोतंत जुळली!)
                        </p>
                      </div>
                    </div>
                  ) : isShortage ? (
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-1.5 text-amber-950 font-black flex-wrap">
                        <span>⚠️</span>
                        <span className="break-words">
                          SHORTAGE ALERT: -{formatCurrency(Math.abs(difference))} (कमी रक्कम)
                        </span>
                      </div>
                      <div className="space-y-1 min-w-0">
                        <label
                          htmlFor="discrepancy-reason-input"
                          className="text-[11px] font-bold block text-amber-950 break-words"
                        >
                          Discrepancy Reason (तफावतीचे कारण सांगा): *
                        </label>
                        <Input
                          id="discrepancy-reason-input"
                          type="text"
                          placeholder="e.g. Change shortage, unpaid balance (उदा. सुट्टे पैसे कमी...)"
                          value={discrepancyReason}
                          onChange={(e) =>
                            onDiscrepancyReasonChange(e.target.value)
                          }
                          className="w-full h-9 text-xs bg-white text-foreground rounded-lg border-amber-300 box-border"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-1.5 text-blue-950 font-black flex-wrap">
                        <span>ℹ️</span>
                        <span className="break-words">
                          SURPLUS ALERT: +{formatCurrency(difference)} (जास्त रक्कम जमा)
                        </span>
                      </div>
                      <div className="space-y-1 min-w-0">
                        <label
                          htmlFor="discrepancy-reason-input"
                          className="text-[11px] font-bold block text-blue-950 break-words"
                        >
                          Surplus Reason (जास्त रकमेचे कारण सांगा): *
                        </label>
                        <Input
                          id="discrepancy-reason-input"
                          type="text"
                          placeholder="e.g. Extra donor contribution (उदा. देणगीदाराने अधिक रक्कम दिली...)"
                          value={discrepancyReason}
                          onChange={(e) =>
                            onDiscrepancyReasonChange(e.target.value)
                          }
                          className="w-full h-9 text-xs bg-white text-foreground rounded-lg border-blue-300 box-border"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS: Full width stack on mobile, side-by-side row on desktop */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1 w-full min-w-0">
                <Button
                  type="button"
                  onClick={onSubmitHandover}
                  disabled={submittingHandover || hasUnsynced || !isDiscrepancyValid}
                  className="w-full sm:flex-1 h-12 text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer disabled:opacity-50 box-border order-1 sm:order-2"
                >
                  {submittingHandover
                    ? "Submitting Handover... (जमा करत आहे...)"
                    : hasUnsynced
                      ? "🔒 Sync Pending (सिंक प्रलंबित)"
                      : "🤝 Submit Handover (हिशोब जमा करा) →"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReviewStage(false)}
                  disabled={submittingHandover}
                  className="w-full sm:flex-1 h-11 sm:h-12 text-xs sm:text-sm font-bold rounded-xl cursor-pointer box-border order-2 sm:order-1"
                >
                  ✏️ Recount Cash (पुन्हा मोजा)
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* -------------------------------------------------------------
          SUBMITTED / VERIFIED SUCCESS STATE
      -------------------------------------------------------------- */}
      {isSubmitted && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 space-y-3 text-center animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-2xl">
            🤝
          </div>
          <h3 className="text-base sm:text-lg font-black text-blue-950">
            Handover Submitted to Secretary! (हिशोब सादर झाला)
          </h3>
          <p className="text-xs text-blue-900 max-w-md mx-auto">
            Submitted Cash: <b>{formatCurrency(cash)}</b>
            {cheque > 0 && <>, Cheque: <b>{formatCurrency(cheque)}</b></>}
            {expense > 0 && <>, Expense: <b>{formatCurrency(expense)}</b></>}.
          </p>
          <div className="rounded-lg bg-white/80 border border-blue-200 p-3 text-xs text-blue-900 max-w-md mx-auto">
            <span>👤 Official custody transfer will complete once Secretary verifies physical cash. (सेक्रेटरी पडताळणी पूर्ण झाल्यावर हा हिशोब तिजोरीत अधिकृतपणे जमा होईल.)</span>
          </div>
        </div>
      )}

      {isVerified && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 space-y-3 text-center animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>
          <h3 className="text-base sm:text-lg font-black text-emerald-950">
            ✓ Handover Verified & Completed! (हस्तबदल पडताळणी पूर्ण)
          </h3>
          <p className="text-xs text-emerald-800 max-w-md mx-auto">
            Secretary has verified the handover and funds are safely recorded in Mandal Treasury. (रक्कम मंडळ तिजोरीत जमा झाली आहे.)
          </p>
          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300">
            ✓ In Treasury · Session Closed (तिजोरीत जमा · सत्र पूर्ण)
          </span>
        </div>
      )}

      {/* Error & Message Toasts */}
      {handoverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 animate-in fade-in">
          <p className="text-xs font-bold text-red-700">{handoverError}</p>
        </div>
      )}

      {handoverMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 animate-in fade-in">
          <p className="text-xs font-bold text-emerald-700">{handoverMessage}</p>
        </div>
      )}
    </div>
  );
}
