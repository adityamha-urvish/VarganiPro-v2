import { useState, useEffect } from "react";
import type { LocalReceipt, CachedPropertyProgress } from "@/lib/offline/offline-db";
import { Button } from "@/components/ui/button";
import {
  buildWhatsAppShareUrl,
  formatWhatsAppReceiptMessage,
  openWhatsAppShare,
} from "@/features/analytics/utils/whatsapp-share";
import { loadPavtiConfig } from "@/features/pavti/services/pavti-config.service";
import {
  renderPavtiToFile,
  canSharePavtiFile,
  sharePavtiFile,
  downloadImageBlob,
} from "@/features/pavti/services/pavti-image.service";

export interface ReceiptCreationConfirmationProps {
  receipt: LocalReceipt | null;
  buildingName?: string | null;
  unitNumber?: string | null;
  nextProperty?: CachedPropertyProgress | null;
  onClose: () => void;
  onViewReceipt: (receipt: LocalReceipt) => void;
  onNextFlat?: (property: CachedPropertyProgress) => void;
}

export function ReceiptCreationConfirmation({
  receipt,
  buildingName,
  unitNumber,
  nextProperty,
  onClose,
  onViewReceipt,
  onNextFlat,
}: ReceiptCreationConfirmationProps) {
  const [cachedPavti, setCachedPavti] = useState<{ id: string; file: File } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isDesktopFallbackOpen, setIsDesktopFallbackOpen] = useState(false);

  useEffect(() => {
    if (!receipt) {
      setCachedPavti(null);
      setIsGenerating(false);
      return;
    }

    const currentId = receipt.clientReceiptId;
    if (cachedPavti?.id === currentId) return;

    let isCancelled = false;
    setIsGenerating(true);

    const config = loadPavtiConfig(
      receipt.organizationId,
      (receipt as unknown as { mandalName?: string }).mandalName,
      (receipt as unknown as { eventName?: string }).eventName
    );

    const prefix = (receipt as unknown as { receiptPrefix?: string }).receiptPrefix || "VP-";
    const filename = `Vargani-Pavti-${prefix}${receipt.receiptNumber}.jpg`;

    renderPavtiToFile(config, receipt as unknown as Parameters<typeof renderPavtiToFile>[1], filename)
      .then((file) => {
        if (!isCancelled) {
          setCachedPavti({ id: currentId, file });
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Async Pavti file generation error:", err);
          setIsGenerating(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [receipt?.clientReceiptId, receipt?.receiptNumber]);

  if (!receipt) return null;

  const prefix = (receipt as unknown as { receiptPrefix?: string }).receiptPrefix || "VP-";
  const formattedNumber = `${prefix}${receipt.receiptNumber}`;
  const isFileReady = cachedPavti?.id === receipt.clientReceiptId;

  // Sync state badge
  const isSynced = receipt.syncStatus === "synced";
  const isPending = receipt.syncStatus === "pending" || !receipt.syncStatus;
  const isSyncing = receipt.syncStatus === "syncing";
  const isConflict = receipt.syncStatus === "conflict";

  async function handleWhatsAppShare() {
    if (!receipt) return;
    setShareError(null);

    // If Pavti file is ready and Web Share Level 2 is supported, share image file
    if (isFileReady && cachedPavti && canSharePavtiFile(cachedPavti.file)) {
      const caption = formatWhatsAppReceiptMessage({
        ...receipt,
        receiptPrefix: prefix,
        buildingName: buildingName || undefined,
        unitNumber: unitNumber || undefined,
      });

      const result = await sharePavtiFile(cachedPavti.file, caption);
      if (!result.success && !result.cancelled) {
        if (result.unsupported) {
          setIsDesktopFallbackOpen(true);
        } else if (result.error) {
          setShareError(result.error);
        }
      }
      return;
    }

    // Direct WhatsApp web / universal URL fallback
    const shareDetails = buildWhatsAppShareUrl({
      ...receipt,
      receiptPrefix: prefix,
      buildingName: buildingName || undefined,
      unitNumber: unitNumber || undefined,
    });
    const opened = openWhatsAppShare(shareDetails.url);
    if (!opened) {
      setIsDesktopFallbackOpen(true);
    }
  }

  function handleDownloadJpg() {
    if (!cachedPavti?.file) return;
    downloadImageBlob(cachedPavti.file, cachedPavti.file.name);
  }

  function handleOpenWhatsAppChat() {
    if (!receipt) return;
    const shareDetails = buildWhatsAppShareUrl({
      ...receipt,
      receiptPrefix: prefix,
      buildingName: buildingName || undefined,
      unitNumber: unitNumber || undefined,
    });
    openWhatsAppShare(shareDetails.url);
  }

  return (
    <div
      data-testid="receipt-creation-confirmation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in"
    >
      <div className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
        {/* HEADER: Confirmation Title */}
        <div className="flex items-start justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="text-lg font-black text-foreground">
                Receipt Generated
              </h3>
              <p className="text-xs text-muted-foreground">
                पावती यशस्वीरित्या तयार झाली
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1 cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* RECEIPT SUMMARY CARD */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
              Receipt #{formattedNumber}
            </span>

            {/* SYNC STATUS BADGE */}
            {isSynced && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300">
                ✓ Synced
              </span>
            )}
            {isPending && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300">
                ⏳ Waiting to sync
              </span>
            )}
            {isSyncing && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border border-sky-300 animate-pulse">
                🔄 Syncing...
              </span>
            )}
            {isConflict && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 border border-rose-300">
                ⚠️ Sync conflict
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <div className="text-3xl font-black text-foreground tracking-tight font-brand-pro">
                ₹{receipt.amount.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                Mode: {receipt.paymentMode}
              </div>
            </div>

            <div className="text-right">
              {(buildingName || unitNumber) ? (
                <div className="text-sm font-bold text-foreground">
                  {buildingName ? `🏢 ${buildingName}` : ""}{" "}
                  {unitNumber ? `(Flat ${unitNumber})` : ""}
                </div>
              ) : (
                <div className="text-xs font-semibold text-muted-foreground">
                  General Donation
                </div>
              )}
              <div className="text-xs text-foreground/90 font-medium mt-0.5">
                👤 {receipt.donorName}
              </div>
              {receipt.donorMobile && (
                <div className="text-[11px] text-muted-foreground font-mono">
                  📱 {receipt.donorMobile}
                </div>
              )}
            </div>
          </div>
        </div>

        {shareError && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-700 dark:text-rose-300">
            {shareError}
          </div>
        )}

        {/* PRIMARY ACTIONS: WhatsApp, View Receipt, Done */}
        <div className="space-y-2.5 pt-1">
          <Button
            type="button"
            data-testid="confirmation-whatsapp-btn"
            onClick={() => void handleWhatsAppShare()}
            className="w-full h-12 rounded-xl text-sm font-black bg-[#25D366] hover:bg-[#1EBE5D] text-white shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="text-lg">💬</span>
            <span>Send on WhatsApp</span>
            {isGenerating && <span className="text-xs opacity-75">(Preparing Pavti...)</span>}
          </Button>

          <div className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              data-testid="confirmation-view-receipt-btn"
              onClick={() => {
                onClose();
                onViewReceipt(receipt);
              }}
              className="h-11 rounded-xl text-xs font-bold border-slate-300 hover:bg-slate-100 dark:border-slate-700 cursor-pointer"
            >
              👁️ View Receipt
            </Button>

            <Button
              type="button"
              variant="secondary"
              data-testid="confirmation-done-btn"
              onClick={onClose}
              className="h-11 rounded-xl text-xs font-bold cursor-pointer"
            >
              ✓ Done
            </Button>
          </div>

          {/* OPTIONAL EXPLICIT SECONDARY ACTION: Next Flat */}
          {nextProperty && onNextFlat && (
            <Button
              type="button"
              variant="ghost"
              data-testid="confirmation-next-flat-btn"
              onClick={() => {
                onClose();
                onNextFlat(nextProperty);
              }}
              className="w-full h-10 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 border border-dashed border-primary/30 cursor-pointer mt-1"
            >
              ⚡ Next Flat: Flat {nextProperty.unitNumber} →
            </Button>
          )}
        </div>
      </div>

      {/* DESKTOP / UNSUPPORTED WEB SHARE MODAL */}
      {isDesktopFallbackOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-card border p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-sm font-bold text-foreground">WhatsApp Sharing</h4>
              <button
                type="button"
                onClick={() => setIsDesktopFallbackOpen(false)}
                className="text-muted-foreground text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              To send the digital Pavti card on WhatsApp Desktop:
            </p>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadJpg}
                className="w-full text-xs font-semibold h-10 flex items-center justify-center gap-1.5"
              >
                <span>💾</span>
                <span>1. Download Pavti Image</span>
              </Button>

              <Button
                type="button"
                onClick={() => {
                  handleOpenWhatsAppChat();
                  setIsDesktopFallbackOpen(false);
                }}
                className="w-full text-xs font-semibold h-10 bg-[#25D366] hover:bg-[#1EBE5D] text-white flex items-center justify-center gap-1.5"
              >
                <span>💬</span>
                <span>2. Open WhatsApp Web</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
