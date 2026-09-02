import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LocalReceipt } from "@/lib/offline/offline-db";
import {
  VoidReceiptDialog,
  type VoidReceiptTarget,
} from "@/features/analytics/components/void-receipt-dialog";
import type { VoidReceiptResult } from "@/features/analytics/services/analytics.service";
import {
  checkShareEligibility,
  buildWhatsAppShareUrl,
  openWhatsAppShare,
  type WhatsAppReceiptInput,
} from "@/features/analytics/utils/whatsapp-share";
import { DigitalPavtiCard } from "@/features/pavti/components/digital-pavti-card";
import { loadPavtiConfig } from "@/features/pavti/services/pavti-config.service";
import {
  generatePavtiBlobFromElement,
  generatePavtiFileFromElement,
  canSharePavtiFile,
  sharePavtiFile,
  downloadImageBlob,
} from "@/features/pavti/services/pavti-image.service";

type ExtendedReceipt = LocalReceipt & {
  id?: string;
  status?: string;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  buildingName?: string | null;
  buildingWing?: string | null;
  unitNumber?: string | null;
  propertyType?: string | null;
  mandalName?: string | null;
  eventName?: string | null;
};

type ReceiptPreviewDialogProps = {
  receipt: ExtendedReceipt | null;
  receiptPrefix: string;
  bookNumber: string;
  isAdmin?: boolean;
  onClose: () => void;
  onPrint: (receipt: LocalReceipt) => void;
  onReceiptVoided?: (result: VoidReceiptResult) => void;
};

export function ReceiptPreviewDialog({
  receipt,
  receiptPrefix,
  bookNumber,
  isAdmin = false,
  onClose,
  onPrint,
  onReceiptVoided,
}: ReceiptPreviewDialogProps) {
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [isWhatsAppPreviewOpen, setIsWhatsAppPreviewOpen] = useState(false);
  const [shareSuccessNotice, setShareSuccessNotice] = useState<string | null>(null);
  const [voidSuccessMessage, setVoidSuccessMessage] = useState<string | null>(
    null
  );
  const [localVoidedState, setLocalVoidedState] = useState<{
    status: string;
    voidReason: string;
    voidedAt: string;
  } | null>(null);

  if (!receipt) {
    return null;
  }

  const isVoided =
    localVoidedState?.status === "voided" ||
    receipt.status === "voided" ||
    !!receipt.voidedAt;

  const displayVoidReason =
    localVoidedState?.voidReason || receipt.voidReason || "—";
  const displayVoidedAt =
    localVoidedState?.voidedAt || receipt.voidedAt || null;

  // Canonical share eligibility evaluation
  const shareEligibility = checkShareEligibility({
    ...receipt,
    status: isVoided ? "voided" : receipt.status,
    voidedAt: localVoidedState?.voidedAt || receipt.voidedAt,
    voidReason: localVoidedState?.voidReason || receipt.voidReason,
  } as WhatsAppReceiptInput);

  const shareDetails = buildWhatsAppShareUrl({
    ...receipt,
    receiptPrefix,
    status: isVoided ? "voided" : receipt.status,
  } as WhatsAppReceiptInput);

  function handleVoidSuccess(result: VoidReceiptResult) {
    setLocalVoidedState({
      status: "voided",
      voidReason: result.void_reason,
      voidedAt: result.voided_at,
    });
    setVoidSuccessMessage("पावती यशस्वीरित्या रद्द झाली (Receipt voided successfully).");
    onReceiptVoided?.(result);
  }

  function handleConfirmWhatsAppShare() {
    setIsWhatsAppPreviewOpen(false);
    const opened = openWhatsAppShare(shareDetails.url);
    if (opened) {
      setShareSuccessNotice("WhatsApp उघडले (WhatsApp opened).");
    }
  }

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  async function handleDownloadJpg() {
    if (!receipt) return;
    try {
      setIsGeneratingImage(true);
      const cardEl = document.getElementById("dialog-digital-pavti-card");
      if (!cardEl) return;
      const blob = await generatePavtiBlobFromElement(cardEl, {
        format: "jpeg",
        pixelRatio: 2,
        quality: 0.95,
      });
      const filename = `Vargani-Pavti-${receiptPrefix}${receipt.receiptNumber}.jpg`;
      downloadImageBlob(blob, filename);
    } catch (err) {
      console.error("Failed to generate JPG:", err);
    } finally {
      setIsGeneratingImage(false);
    }
  }

  async function handleWhatsAppButtonClick() {
    if (!receipt || !shareEligibility.isShareable) return;

    // Check if Web Share Level 2 with file is supported in this browser
    const cardEl = document.getElementById("dialog-digital-pavti-card");
    if (cardEl && typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator) {
      try {
        const file = await generatePavtiFileFromElement(
          cardEl,
          `Vargani-Pavti-${receiptPrefix}${receipt.receiptNumber}`
        );
        if (canSharePavtiFile(file)) {
          const caption = shareDetails.message;
          const result = await sharePavtiFile(file, caption);
          if (result.success) {
            setShareSuccessNotice("पावती शेअर केली (Receipt shared).");
            return;
          }
          if (result.cancelled) {
            return;
          }
        }
      } catch (err) {
        console.warn("Direct file share attempt failed, falling back to preview modal:", err);
      }
    }

    // Open WhatsApp Preview Modal (Desktop / Fallback)
    setIsWhatsAppPreviewOpen(true);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt ${receipt.receiptNumber}`}
        onClick={onClose}
      >
        <div
          className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-background shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Receipt Details</h2>
                {isVoided && (
                  <span className="px-2 py-0.5 rounded-md text-xs font-black bg-red-100 text-red-800 border border-red-300">
                    रद्द (VOIDED)
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {receiptPrefix}
                {receipt.receiptNumber}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* JPG Download Action */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isGeneratingImage}
                onClick={handleDownloadJpg}
                title="पावती इमेज डाउनलोड करा (Download JPG)"
                className="text-xs font-bold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 cursor-pointer"
              >
                {isGeneratingImage ? "तयार होत आहे..." : "🖼️ पावती JPG"}
              </Button>

              {/* WhatsApp Share Action with Canonical Gate */}
              <Button
                type="button"
                size="sm"
                disabled={!shareEligibility.isShareable}
                onClick={handleWhatsAppButtonClick}
                title={shareEligibility.reason || "WhatsApp वर पावती पाठवा"}
                className={`text-xs font-bold cursor-pointer ${
                  shareEligibility.isShareable
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                📲 WhatsApp
              </Button>

              {/* Void action strictly for Admin on non-voided receipts */}
              {isAdmin && !isVoided && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsVoidDialogOpen(true)}
                  className="text-xs font-bold border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  ✕ पावती रद्द करा (Void)
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPrint(receipt)}
              >
                Print
              </Button>

              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>

          {shareSuccessNotice && (
            <div className="m-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center justify-between">
              <span>✓ {shareSuccessNotice}</span>
              <button
                type="button"
                onClick={() => setShareSuccessNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Unsynced WhatsApp Info Banner */}
          {!shareEligibility.isShareable && !isVoided && (
            <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 flex items-center gap-2">
              <span>⏳</span>
              <span>
                <b>WhatsApp शेअरिंग:</b> {shareEligibility.reason}
              </span>
            </div>
          )}

          {voidSuccessMessage && (
            <div className="m-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              {voidSuccessMessage}
            </div>
          )}

          {/* Voided Banner Audit Block */}
          {isVoided && (
            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs space-y-1">
              <span className="font-extrabold text-red-900 block">
                ⚠️ ही पावती सेक्रेटरींद्वारे रद्द करण्यात आली आहे (Voided Receipt)
              </span>
              <p className="text-red-850">
                <b>कारण (Reason):</b> {displayVoidReason}
              </p>
              {displayVoidedAt && (
                <p className="text-[11px] text-red-700">
                  <b>वेळ (Voided At):</b> {new Date(displayVoidedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Locked Traditional Marathi Digital Pavti */}
          <div className="p-4 sm:p-6 flex justify-center bg-slate-100/60 border-b">
            <DigitalPavtiCard
              config={loadPavtiConfig(receipt.organizationId, receipt.mandalName, receipt.eventName)}
              receipt={receipt}
            />
          </div>

          <div id="receipt-print-area" className="receipt-print-area p-8 relative">
            {isVoided && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
                <span className="text-7xl font-black text-red-600 rotate-[-25deg] uppercase tracking-widest border-4 border-red-600 p-4 rounded-xl">
                  VOIDED
                </span>
              </div>
            )}

            <div className="text-center">
              <p className="text-2xl font-bold">VARGANIPRO</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Donation Receipt
              </p>

              <div className="mt-6 border-y py-4">
                <p className="text-sm text-muted-foreground">Receipt Number</p>
                <p className="mt-1 text-3xl font-bold">
                  {receiptPrefix}
                  {receipt.receiptNumber}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex justify-between gap-6">
                <span className="text-sm text-muted-foreground">Donor Name</span>
                <span className="text-right font-medium">{receipt.donorName}</span>
              </div>

              {receipt.donorMobile && (
                <div className="flex justify-between gap-6">
                  <span className="text-sm text-muted-foreground">Mobile</span>
                  <span className="text-right font-medium">
                    {receipt.donorMobile}
                  </span>
                </div>
              )}

              <div className="flex justify-between gap-6">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span
                  className={`text-right text-xl font-bold ${
                    isVoided ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  ₹{receipt.amount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between gap-6">
                <span className="text-sm text-muted-foreground">
                  Payment Mode
                </span>
                <span className="text-right font-medium capitalize">
                  {receipt.paymentMode.replace("_", " ")}
                </span>
              </div>

              {receipt.paymentReference && (
                <div className="flex justify-between gap-6">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="max-w-[60%] break-words text-right font-medium">
                    {receipt.paymentReference}
                  </span>
                </div>
              )}

              <div className="flex justify-between gap-6">
                <span className="text-sm text-muted-foreground">Date & Time</span>
                <span className="text-right font-medium">
                  {new Date(receipt.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {receipt.notes && (
              <div className="mt-6 border-t pt-4">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm">{receipt.notes}</p>
              </div>
            )}

            <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
              <p>Receipt Book: {bookNumber}</p>
              <p className="mt-1">Thank you for your contribution.</p>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Message Preview & Confirmation Dialog */}
      {isWhatsAppPreviewOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="WhatsApp Message Preview"
          onClick={() => setIsWhatsAppPreviewOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-4 animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📲</span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    WhatsApp पावती संदेश (Receipt Message)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {shareDetails.isTargeted
                      ? `प्राप्तकर्ता (Recipient): +${shareDetails.targetMobile}`
                      : "प्राप्तकर्ता (Recipient): WhatsApp वर संपर्क निवडा"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWhatsAppPreviewOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 leading-relaxed">
              💡 <b>डेस्कटॉप सूचना:</b> ब्राउझरवरून थेट इमेज पाठवता येत नाही. पावती JPG डाउनलोड करून ती WhatsApp चॅटमध्ये जोडा (Attach करा).
            </div>

            {/* Exact message preview box */}
            <div className="rounded-xl bg-slate-50 border p-4 text-xs font-mono whitespace-pre-wrap text-slate-800 max-h-52 overflow-y-auto leading-relaxed select-all">
              {shareDetails.message}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadJpg}
                className="text-xs font-bold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
              >
                🖼️ पावती JPG डाउनलोड करा
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsWhatsAppPreviewOpen(false)}
                >
                  रद्द करा (Cancel)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmWhatsAppShare}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  📲 WhatsApp उघडा (Open WhatsApp)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <VoidReceiptDialog
        receipt={
          isVoidDialogOpen
            ? ({
                id: (receipt as ExtendedReceipt).id || receipt.clientReceiptId,
                clientReceiptId: receipt.clientReceiptId,
                receiptNumber: receipt.receiptNumber,
                amount: receipt.amount,
                donorName: receipt.donorName,
                donorMobile: receipt.donorMobile,
                paymentMode: receipt.paymentMode,
                status: receipt.status,
              } as VoidReceiptTarget)
            : null
        }
        receiptPrefix={receiptPrefix}
        isOpen={isVoidDialogOpen}
        onClose={() => setIsVoidDialogOpen(false)}
        onSuccess={handleVoidSuccess}
      />
    </>
  );
}
