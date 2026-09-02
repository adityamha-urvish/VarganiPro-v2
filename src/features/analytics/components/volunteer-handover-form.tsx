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

  const cash = Number(actualCashAmount || 0);
  const cheque = Number(actualChequeAmount || 0);
  const expense = Number(authorizedExpenseAmount || 0);
  const countedPhysical = cash + cheque;
  const totalAccounted = countedPhysical + expense;

  const expectedPhysical = Number(handover?.expectedPhysicalAmount ?? 0);
  const difference = totalAccounted - expectedPhysical;
  const isExactMatch = Math.abs(difference) < 0.005;
  const isShortage = difference < -0.005;

  const isSubmitted = handover?.status === "submitted";
  const isVerified = handover?.status === "verified";
  const isRejected = handover?.status === "rejected";

  return (
    <div className="rounded-2xl border border-slate-200 bg-card p-5 sm:p-6 shadow-xs space-y-5 animate-in fade-in">
      {/* -------------------------------------------------------------
          HEADER: TITLE & STATUS
      -------------------------------------------------------------- */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🤝</span>
          <div>
            <h2 className="text-base font-black tracking-tight text-foreground sm:text-lg">
              जमा वर्गणी हिशोब (Session Handover)
            </h2>
            <p className="text-xs text-muted-foreground">
              गोळा केलेली रोख रक्कम सेक्रेटरींकडे जमा करा
            </p>
          </div>
        </div>

        <div className="self-start sm:self-auto">
          {isVerified ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              ✓ पडताळणी झाली (Verified)
            </span>
          ) : isSubmitted ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
              हिशोब सादर (Submitted)
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
              ⚠️ नाकारले (Rejected)
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              हिशोब बाकी (Pending)
            </span>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          INITIAL STAGE: CREATE HANDOVER BUTTON
      -------------------------------------------------------------- */}
      {!handover && (
        <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            तुमचे कलेक्शन पूर्ण झाले आहे. हस्तबदल सुरू करण्यासाठी खालील बटण दाबा.
          </p>
          <Button
            type="button"
            onClick={onCreateHandover}
            disabled={creatingHandover}
            className="font-bold text-xs h-9 cursor-pointer"
          >
            {creatingHandover
              ? "हस्तबदल तयार करत आहे..."
              : "हस्तबदल सुरू करा (Prepare Handover)"}
          </Button>
        </div>
      )}

      {/* -------------------------------------------------------------
          ACTIVE HANDOVER ENTRY OR REVIEW
      -------------------------------------------------------------- */}
      {handover && !isSubmitted && !isVerified && (
        <>
          {/* Rejection Alert If Previous Submission Was Rejected */}
          {isRejected && handover.rejectionReason && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-1">
              <span className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                <span>⚠️</span> सेक्रेटरींनी हस्तबदल नाकारला आहे (Reason):
              </span>
              <p className="text-xs font-semibold text-red-800">
                "{handover.rejectionReason}"
              </p>
              <p className="text-[11px] text-red-700 pt-1">
                कृपया मोजणी तपासून पुन्हा रक्कम सादर करा.
              </p>
            </div>
          )}

          {/* ---------------------------------------------------------
              STEP 1: INDEPENDENT PHYSICAL COUNT & EXPENSE ENTRY
              (Expected amount is strictly hidden here!)
          ---------------------------------------------------------- */}
          {!isReviewStage ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <span>💵</span> किती रोख जमा करताय? (Enter Physical Count)
                </span>
                <p className="text-[11px] text-amber-850 mt-0.5">
                  तुमच्याकडे प्रत्यक्षात मोजलेली रोख व चेक रक्कम भरा.
                </p>
              </div>

              {/* Cash Counted Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="actual-cash-count"
                  className="text-xs font-bold text-foreground block"
                >
                  💵 मोजलेली रोख रक्कम (Cash Counted)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="actual-cash-count"
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={actualCashAmount}
                    onChange={(e) => onActualCashAmountChange(e.target.value)}
                    className="h-11 pl-8 text-base font-bold rounded-xl"
                  />
                </div>
              </div>

              {/* Cheque Counted Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="actual-cheque-count"
                  className="text-xs font-bold text-foreground block"
                >
                  📄 चेक रक्कम (Cheques Counted)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="actual-cheque-count"
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={actualChequeAmount}
                    onChange={(e) => onActualChequeAmountChange(e.target.value)}
                    className="h-11 pl-8 text-base font-bold rounded-xl"
                  />
                </div>
              </div>

              {/* Reported Collection Expenses (खर्च झाला का?) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>🧾</span> खर्च झाला का? (Any Collection Expenses?)
                </span>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reported-expense-amount"
                    className="text-[11px] font-semibold text-muted-foreground block"
                  >
                    खर्च रक्कम (Expense Amount - Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      id="reported-expense-amount"
                      type="number"
                      inputMode="decimal"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={authorizedExpenseAmount}
                      onChange={(e) =>
                        onAuthorizedExpenseAmountChange(e.target.value)
                      }
                      className="h-10 pl-8 text-sm font-bold rounded-xl bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reported-expense-note"
                    className="text-[11px] font-semibold text-muted-foreground block"
                  >
                    खर्चाचे कारण (Expense Reason / Details)
                  </label>
                  <Input
                    id="reported-expense-note"
                    type="text"
                    placeholder="उदा. रिक्षा भाडे, चहा-पाणी..."
                    value={authorizedExpenseNote}
                    onChange={(e) =>
                      onAuthorizedExpenseNoteChange(e.target.value)
                    }
                    className="h-10 text-xs rounded-xl bg-white"
                  />
                </div>
              </div>

              {/* Optional Notes */}
              <div className="space-y-1.5">
                <label
                  htmlFor="volunteer-handover-notes"
                  className="text-xs font-bold text-muted-foreground block"
                >
                  📝 टीप (Optional Notes)
                </label>
                <Input
                  id="volunteer-handover-notes"
                  type="text"
                  placeholder="हस्तबदलाबाबत काही टीप..."
                  value={handoverNotes}
                  onChange={(e) => onHandoverNotesChange(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              {/* Advance to Review Button */}
              <Button
                type="button"
                onClick={() => setIsReviewStage(true)}
                className="w-full h-11 text-xs sm:text-sm font-bold bg-primary hover:bg-primary/90 text-white rounded-xl cursor-pointer"
              >
                📊 हिशोब तपासा (Review Reconciliation) →
              </Button>
            </div>
          ) : (
            /* ---------------------------------------------------------
                STEP 2: RECONCILIATION REVIEW (Revealed After Count)
            ---------------------------------------------------------- */
            <div className="space-y-4 animate-in fade-in">
              <div className="rounded-xl bg-slate-50 border p-4 space-y-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  📊 हिशोब जुळणी (Reconciliation Summary)
                </span>

                <div className="space-y-2 text-xs divide-y divide-slate-200">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">
                      सिस्टममधील अपेक्षित रोख/चेक (Expected):
                    </span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(expectedPhysical)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">
                      मोजलेली रोख व चेक (Counted):
                    </span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(countedPhysical)}
                    </span>
                  </div>

                  {expense > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">
                        वापरलेला खर्च (Expense):
                      </span>
                      <span className="font-bold text-foreground">
                        + {formatCurrency(expense)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 font-bold text-sm">
                    <span>एकूण हिशोब दिला (Total Accounted):</span>
                    <span>{formatCurrency(totalAccounted)}</span>
                  </div>
                </div>

                {/* Discrepancy Alert */}
                <div
                  className={`rounded-lg p-3 text-xs font-bold border ${
                    isExactMatch
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : isShortage
                        ? "bg-amber-50 text-amber-900 border-amber-300"
                        : "bg-blue-50 text-blue-900 border-blue-200"
                  }`}
                >
                  {isExactMatch ? (
                    <p>✓ सगळं जुळलं! (Exact Match — ₹0 Difference)</p>
                  ) : isShortage ? (
                    <div>
                      <p>
                        ⚠️ {formatCurrency(Math.abs(difference))} कमी आहे (Shortage)
                      </p>
                      <div className="mt-2">
                        <label
                          htmlFor="discrepancy-reason-input"
                          className="text-[11px] font-semibold block text-amber-950 mb-1"
                        >
                          तफावतीचे कारण सांगा (Explain difference):
                        </label>
                        <Input
                          id="discrepancy-reason-input"
                          type="text"
                          placeholder="उदा. सुट्टे पैसे कमी, देणगीदाराने चेक दिला..."
                          value={discrepancyReason}
                          onChange={(e) =>
                            onDiscrepancyReasonChange(e.target.value)
                          }
                          className="h-8 text-xs bg-white text-foreground"
                        />
                      </div>
                    </div>
                  ) : (
                    <p>
                      ℹ️ {formatCurrency(difference)} जास्त जमा (Surplus)
                    </p>
                  )}
                </div>
              </div>

              {/* Digital UPI Summary */}
              {handover.expectedDigitalAmount > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1">
                  <span className="font-bold text-muted-foreground block">
                    📱 UPI / डिजिटल वर्गणी
                  </span>
                  <span className="text-sm font-bold text-foreground block">
                    {formatCurrency(handover.expectedDigitalAmount)}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold block">
                    ✓ थेट मंडळ बँक खात्यात जमा (Direct Bank Deposit)
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReviewStage(false)}
                  disabled={submittingHandover}
                  className="flex-1 h-11 text-xs font-bold cursor-pointer"
                >
                  ✏️ बदल करा (Edit Count)
                </Button>

                <Button
                  type="button"
                  onClick={onSubmitHandover}
                  disabled={submittingHandover}
                  className="flex-1 h-11 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  {submittingHandover
                    ? "हिशोब जमा करत आहे..."
                    : "🤝 हिशोब जमा करा (Submit Handover)"}
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
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-3 text-center animate-in fade-in">
          <span className="text-3xl block">🤝</span>
          <h3 className="text-sm sm:text-base font-black text-blue-950">
            हिशोब सेक्रेटरींकडे सादर झाला आहे!
          </h3>
          <p className="text-xs text-blue-850 max-w-md mx-auto">
            तुम्ही जमा केलेली रोख रक्कम: <b>{formatCurrency(cash)}</b>, चेक: <b>{formatCurrency(cheque)}</b>, खर्च: <b>{formatCurrency(expense)}</b>.
          </p>
          <p className="text-[11px] text-muted-foreground">
            सेक्रेटरी पडताळणी पूर्ण झाल्यावर हा हिशोब तिजोरीत अधिकृतपणे जमा होईल.
          </p>
        </div>
      )}

      {isVerified && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3 text-center animate-in fade-in">
          <span className="text-3xl block">✓</span>
          <h3 className="text-sm sm:text-base font-black text-emerald-950">
            हस्तबदल पडताळणी पूर्ण झाली!
          </h3>
          <p className="text-xs text-emerald-800 max-w-md mx-auto">
            सेक्रेटरींनी हा हिशोब स्वीकारला असून रक्कम मंडळ तिजोरीत जमा झाली आहे.
          </p>
        </div>
      )}

      {/* Error & Message Toasts */}
      {handoverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
          <p className="text-xs font-bold text-red-700">{handoverError}</p>
        </div>
      )}

      {handoverMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
          <p className="text-xs font-bold text-emerald-700">{handoverMessage}</p>
        </div>
      )}
    </div>
  );
}
