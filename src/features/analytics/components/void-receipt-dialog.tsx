import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "./secretary-overview-hero";
import { voidReceipt, type VoidReceiptResult } from "../services/analytics.service";

export interface VoidReceiptTarget {
  id?: string;
  clientReceiptId?: string;
  receiptNumber: number;
  amount: number;
  donorName: string;
  donorMobile?: string | null;
  paymentMode: string;
  unitNumber?: string | null;
  status?: string;
}

export interface VoidReceiptDialogProps {
  receipt: VoidReceiptTarget | null;
  receiptPrefix: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: VoidReceiptResult) => void;
}

export function VoidReceiptDialog({
  receipt,
  receiptPrefix,
  isOpen,
  onClose,
  onSuccess,
}: VoidReceiptDialogProps) {
  const [voidReason, setVoidReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !receipt) {
    return null;
  }

  const receiptId = receipt.id || receipt.clientReceiptId;
  const isReasonValid = voidReason.trim().length >= 3;

  async function handleConfirmVoid() {
    if (!receiptId) {
      setError("पावती आयडी उपलब्ध नाही (Receipt ID missing).");
      return;
    }

    const cleanReason = voidReason.trim();
    if (cleanReason.length < 3) {
      setError("किमान ३ अक्षरे कारण लिहा (Minimum 3 characters required).");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("इंटरनेट कनेक्शन आवश्यक आहे (Internet connection required).");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await voidReceipt(receiptId, cleanReason);
      setVoidReason("");
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "पावती रद्द करता आली नाही (Unable to void receipt)."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="void-receipt-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <h3
              id="void-receipt-title"
              className="text-base font-black text-slate-900 dark:text-slate-100"
            >
              ही पावती रद्द करायची आहे? (Void Receipt)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            पावती क्रमांक: <b>{receiptPrefix}{receipt.receiptNumber}</b>
          </p>
        </div>

        {/* Receipt Snapshot Card */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">देणगीदार (Donor):</span>
            <span className="font-bold text-foreground truncate max-w-[200px]">
              👤 {receipt.donorName}
            </span>
          </div>

          {receipt.unitNumber && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">घर / गाळा (Unit):</span>
              <span className="font-semibold text-foreground">
                🏠 {receipt.unitNumber}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">रक्कम (Amount):</span>
            <span className="text-base font-black text-foreground">
              {formatCurrency(receipt.amount)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">पेमेंट पद्धत (Mode):</span>
            <span className="font-semibold text-foreground capitalize">
              {receipt.paymentMode.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Financial Consequence Notice */}
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-900 dark:text-amber-200">
          ℹ️ ही पावती वसुलीच्या एकूण रकमेतून वगळली जाईल. पावती क्रमांक कायमचा नोंद राहील.
        </div>

        {/* Reason Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="void-reason-input"
            className="text-xs font-bold text-foreground block"
          >
            रद्द करण्याचे कारण (Reason for Voiding) *
          </label>
          <Input
            id="void-reason-input"
            type="text"
            placeholder="उदा. चुकीची रक्कम नोंदवली गेली, देणगीदाराने चेक रद्द केला..."
            value={voidReason}
            disabled={loading}
            onChange={(e) => {
              setVoidReason(e.target.value);
              if (error) setError(null);
            }}
            className="h-10 text-xs rounded-xl"
            autoFocus
          />
          {!isReasonValid && voidReason.length > 0 && (
            <p className="text-[11px] text-amber-600 font-semibold">
              किमान ३ अक्षरे कारण लिहा ({voidReason.trim().length}/3).
            </p>
          )}
        </div>

        {/* Error Toast */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="h-10 text-xs font-semibold cursor-pointer rounded-xl"
          >
            रद्द करा (Cancel)
          </Button>

          <Button
            type="button"
            onClick={handleConfirmVoid}
            disabled={loading || !isReasonValid}
            className="h-10 px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer rounded-xl shadow-xs"
          >
            {loading ? "पावती रद्द करत आहे..." : "✕ पावती रद्द करा (Confirm Void)"}
          </Button>
        </div>
      </div>
    </div>
  );
}
