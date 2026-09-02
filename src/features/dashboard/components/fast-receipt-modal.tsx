import { useState, useEffect, type FormEvent } from "react";
import type { CachedPropertyProgress } from "@/lib/offline/offline-db";
import type { PaymentMode } from "./receipt-creation-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FastReceiptModalProps {
  isOpen: boolean;
  buildingName: string;
  property: CachedPropertyProgress | null;
  nextProperty: CachedPropertyProgress | null;
  currentReceiptNumber: number;
  startNumber?: number;
  endNumber?: number;
  creating: boolean;
  createError: string | null;
  onClose: () => void;
  onNavigateToCloseSession?: () => void;
  onSubmitReceipt: (input: {
    propertyId: string;
    amount: number;
    paymentMode: PaymentMode;
    donorName: string;
    donorMobile: string | null;
    paymentReference: string | null;
  }) => Promise<void>;
  onOpenPendingDrawer: () => void;
}

export function FastReceiptModal({
  isOpen,
  buildingName,
  property,
  nextProperty,
  currentReceiptNumber,
  startNumber,
  endNumber,
  creating,
  createError,
  onClose,
  onNavigateToCloseSession,
  onSubmitReceipt,
  onOpenPendingDrawer,
}: FastReceiptModalProps) {
  const [amount, setAmount] = useState<string>("501");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [showDonorDetails, setShowDonorDetails] = useState<boolean>(false);
  const [customDonorName, setCustomDonorName] = useState<string>("");
  const [donorMobile, setDonorMobile] = useState<string>("");
  const [isAddingAdditional, setIsAddingAdditional] = useState<boolean>(false);

  useEffect(() => {
    if (property) {
      setAmount("501");
      setPaymentMode("cash");
      setPaymentReference("");
      setCustomDonorName(property.ownerName || "");
      setDonorMobile(property.contactMobile || "");
      setShowDonorDetails(false);
      setIsAddingAdditional(false);
    }
  }, [property]);

  if (!isOpen || !property) return null;

  const isExhausted = endNumber !== undefined && currentReceiptNumber > endNumber;
  const isCollected = property.status === "collected";
  const defaultDonorName = property.ownerName || `Flat ${property.unitNumber} Resident`;
  const effectiveDonorName = customDonorName.trim() || defaultDonorName;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isExhausted) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    await onSubmitReceipt({
      propertyId: property!.propertyId,
      amount: parsedAmount,
      paymentMode,
      donorName: effectiveDonorName,
      donorMobile: donorMobile.trim() || null,
      paymentReference: paymentReference.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
        {/* -------------------------------------------------------------
            HEADER: CONTEXT
        -------------------------------------------------------------- */}
        <div className="flex items-start justify-between pb-3 border-b">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                isExhausted
                  ? "bg-amber-500/20 text-amber-900 dark:text-amber-300"
                  : "bg-primary/10 text-primary"
              }`}>
                {isExhausted ? "Book Completed" : `Receipt #${currentReceiptNumber}`}
              </span>
              <span className="text-xs text-muted-foreground">{buildingName}</span>
            </div>
            <h3 className="text-2xl font-black text-foreground mt-1">
              Flat {property.unitNumber}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* -------------------------------------------------------------
            EXHAUSTED RECEIPT BOOK VIEW
        -------------------------------------------------------------- */}
        {isExhausted ? (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl" role="img" aria-label="Book completed">📕</span>
                <div>
                  <h4 className="text-base font-black text-amber-950 dark:text-amber-100">
                    पावती पुस्तक पूर्ण झाले
                  </h4>
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Receipt Book Completed
                  </p>
                </div>
              </div>

              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1.5 border-t border-amber-500/20 pt-2.5">
                <p className="font-semibold text-sm">
                  पावती क्रमांक #{startNumber ?? "—"}–#{endNumber ?? "—"} पर्यंत सर्व पावत्या वापरल्या आहेत.
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  All receipts in this book have been issued. Please close this collection session and complete the handover before starting with another receipt book.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {onNavigateToCloseSession && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    onClose();
                    onNavigateToCloseSession();
                  }}
                  className="w-full h-12 rounded-xl text-sm font-bold shadow-xs cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
                >
                  संकलन बंद करा / Close Collection →
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="w-full h-11 text-xs font-semibold text-muted-foreground cursor-pointer"
              >
                मागे जा / Back to Grid
              </Button>
            </div>
          </div>
        ) : isCollected && !isAddingAdditional ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  🟢 Already Collected
                </span>
                <span className="text-xs font-mono bg-emerald-600 text-white px-2 py-0.5 rounded font-bold">
                  {property.receiptCount} {property.receiptCount === 1 ? "Receipt" : "Receipts"}
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
                ₹{property.totalCollectedAmount}
              </div>
              <div className="text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between pt-1 border-t border-emerald-500/20">
                <span>Latest Receipt #{property.latestReceiptNumber}</span>
                {property.lastReceiptAt && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {new Date(property.lastReceiptAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                onClick={() => setIsAddingAdditional(true)}
                className="w-full h-12 rounded-xl text-sm font-bold shadow-xs cursor-pointer"
              >
                ➕ Add Additional Contribution
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="w-full h-11 text-xs font-semibold text-muted-foreground cursor-pointer"
              >
                Done / Return to Grid
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
          {/* -------------------------------------------------------------
              1. AMOUNT & 4 PRESET CHIPS (PAPER-SPEED)
          -------------------------------------------------------------- */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Amount (₹) *
            </label>

            {/* Quick Amount Chips */}
            <div className="grid grid-cols-4 gap-2">
              {["101", "251", "501", "1001"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className={`h-11 rounded-xl font-bold text-sm border-2 transition-all active:scale-95 cursor-pointer ${
                    amount === val
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-muted bg-muted/40 text-foreground hover:border-primary/50"
                  }`}
                >
                  ₹{val}
                </button>
              ))}
            </div>

            {/* Manual Amount Input */}
            <div className="relative mt-2">
              <span className="absolute left-3 top-2.5 text-lg font-bold text-muted-foreground">₹</span>
              <Input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter custom amount"
                className="pl-8 text-xl font-black h-12 rounded-xl"
                required
              />
            </div>
          </div>

          {/* -------------------------------------------------------------
              2. PAYMENT MODE
          -------------------------------------------------------------- */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Payment Mode *
            </label>

            <div className="grid grid-cols-3 gap-2">
              {(["cash", "upi", "cheque"] as PaymentMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`h-10 rounded-xl font-bold text-xs uppercase tracking-wider border-2 transition-all cursor-pointer ${
                    paymentMode === mode
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted bg-background text-muted-foreground hover:border-border"
                  }`}
                >
                  {mode === "cash" && "💵 Cash"}
                  {mode === "upi" && "📱 UPI / QR"}
                  {mode === "cheque" && "📑 Cheque"}
                </button>
              ))}
            </div>

            {paymentMode !== "cash" && (
              <Input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={paymentMode === "upi" ? "UPI Reference / UTR" : "Cheque Number"}
                className="mt-2 text-xs h-9 rounded-lg"
              />
            )}
          </div>

          {/* -------------------------------------------------------------
              3. COLLAPSED OPTIONAL DONOR DETAILS
          -------------------------------------------------------------- */}
          <div className="border-t pt-3">
            {!showDonorDetails ? (
              <button
                type="button"
                onClick={() => setShowDonorDetails(true)}
                className="text-xs text-primary font-semibold hover:underline"
              >
                ＋ Add Custom Donor Name / Phone ({defaultDonorName})
              </button>
            ) : (
              <div className="space-y-3 bg-muted/20 p-3 rounded-xl border">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground">Donor Details (Optional)</span>
                  <button
                    type="button"
                    onClick={() => setShowDonorDetails(false)}
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    Hide
                  </button>
                </div>

                <Input
                  type="text"
                  value={customDonorName}
                  onChange={(e) => setCustomDonorName(e.target.value)}
                  placeholder={`Donor name (default: ${defaultDonorName})`}
                  className="text-xs h-9 rounded-lg"
                />

                <Input
                  type="tel"
                  value={donorMobile}
                  onChange={(e) => setDonorMobile(e.target.value)}
                  placeholder="Mobile number for WhatsApp receipt"
                  className="text-xs h-9 rounded-lg"
                />
              </div>
            )}
          </div>

          {createError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">
              {createError}
            </div>
          )}

          {/* -------------------------------------------------------------
              4. PRIMARY & SECONDARY ACTIONS (PAPER-SPEED)
          -------------------------------------------------------------- */}
          <div className="space-y-2 pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={creating}
              className="w-full h-14 rounded-xl text-base font-black tracking-wide shadow-md cursor-pointer"
            >
              {creating
                ? "Creating Receipt..."
                : isAddingAdditional
                ? `➕ Issue Additional Receipt #${currentReceiptNumber} ✓`
                : nextProperty
                ? `⚡ Collect & Next: Flat ${nextProperty.unitNumber} →`
                : `⚡ Collect Receipt #${currentReceiptNumber} ✓`}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 text-xs font-semibold text-amber-700 dark:text-amber-400 border-amber-300"
                onClick={onOpenPendingDrawer}
              >
                ⏰ Mark Pending / Refused
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="h-10 text-xs font-medium text-muted-foreground"
                onClick={isAddingAdditional ? () => setIsAddingAdditional(false) : onClose}
              >
                {isAddingAdditional ? "← Back to Summary" : "Cancel / Grid"}
              </Button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
