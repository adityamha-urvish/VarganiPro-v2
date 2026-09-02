import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { LocalReceipt } from "@/lib/offline/offline-db";
import { getStatusLabel } from "./receipt-history-panel";
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

export type LastCreatedReceiptCardProps = {
  receipt: LocalReceipt | null;
  onViewReceipt: (receipt: LocalReceipt) => void;
  onPrintReceipt: (receipt: LocalReceipt) => void;
};

export function LastCreatedReceiptCard({
  receipt,
  onViewReceipt,
  onPrintReceipt,
}: LastCreatedReceiptCardProps) {
  const [cachedPavti, setCachedPavti] = useState<{ id: string; file: File } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isDesktopFallbackOpen, setIsDesktopFallbackOpen] = useState(false);

  // Background non-blocking Pavti image generation
  useEffect(() => {
    if (!receipt) {
      setCachedPavti(null);
      setIsGenerating(false);
      setGenerateError(null);
      return;
    }

    const currentId = receipt.clientReceiptId;
    if (cachedPavti?.id === currentId) {
      return;
    }

    let isCancelled = false;
    setIsGenerating(true);
    setGenerateError(null);

    const config = loadPavtiConfig(
      receipt.organizationId,
      (receipt as unknown as { mandalName?: string }).mandalName,
      (receipt as unknown as { eventName?: string }).eventName
    );

    const filename = `Vargani-Pavti-${(receipt as unknown as { receiptPrefix?: string }).receiptPrefix || "VP-"}${receipt.receiptNumber}.jpg`;

    renderPavtiToFile(config, receipt as unknown as Parameters<typeof renderPavtiToFile>[1], filename)
      .then((file) => {
        if (!isCancelled) {
          setCachedPavti({ id: currentId, file });
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Async Pavti file generation failed:", err);
          setGenerateError("पावती इमेज तयार करण्यात अडचण आली");
          setIsGenerating(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [receipt?.clientReceiptId, receipt?.receiptNumber]);

  if (!receipt) {
    return null;
  }

  const isVoided = (receipt as unknown as { status?: string }).status === "voided" || Boolean((receipt as unknown as { voidedAt?: string }).voidedAt);
  const isFileReady = cachedPavti?.id === receipt.clientReceiptId;

  async function handleWhatsAppShare() {
    if (!receipt) return;
    setShareError(null);

    // Cache verification: ensure File belongs to this exact receipt
    if (!isFileReady || !cachedPavti) {
      return;
    }

    // Check if Web Share Level 2 is supported
    if (!canSharePavtiFile(cachedPavti.file)) {
      // Desktop / unsupported environment -> Open explicit fallback modal
      setIsDesktopFallbackOpen(true);
      return;
    }

    const caption = formatWhatsAppReceiptMessage({
      ...receipt,
      receiptPrefix: (receipt as unknown as { receiptPrefix?: string }).receiptPrefix || "VP-",
    });

    const result = await sharePavtiFile(cachedPavti.file, caption);
    if (!result.success && !result.cancelled) {
      if (result.unsupported) {
        setIsDesktopFallbackOpen(true);
      } else if (result.error) {
        setShareError(result.error);
      }
    }
  }

  function handleDownloadJpg() {
    if (!cachedPavti?.file || !receipt) return;
    downloadImageBlob(cachedPavti.file, cachedPavti.file.name);
  }

  function handleOpenWhatsAppChat() {
    if (!receipt) return;
    const shareDetails = buildWhatsAppShareUrl({
      ...receipt,
      receiptPrefix: (receipt as unknown as { receiptPrefix?: string }).receiptPrefix || "VP-",
    });
    openWhatsAppShare(shareDetails.url);
  }

  return (
    <>
      <div className="rounded-lg border border-green-200 bg-green-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">
              Receipt created
            </p>

            <p className="mt-1 text-2xl font-bold text-green-800">
              #{receipt.receiptNumber}
            </p>

            <p className="mt-1 text-sm text-green-700">
              {receipt.donorName} — ₹{receipt.amount.toFixed(2)}
            </p>

            <p className="mt-2 text-xs text-green-700">
              Status: {getStatusLabel(receipt.syncStatus)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              disabled={isVoided || isGenerating || !isFileReady}
              onClick={handleWhatsAppShare}
              title={
                isVoided
                  ? "रद्द केलेली पावती शेअर करता येत नाही"
                  : isGenerating
                  ? "पावती इमेज तयार होत आहे..."
                  : "WhatsApp वर पावती इमेज शेअर करा"
              }
              className={`text-xs font-bold ${
                !isVoided && isFileReady
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  : "opacity-60 cursor-not-allowed bg-muted text-muted-foreground"
              }`}
            >
              {isGenerating ? "⏳ तयार होत आहे..." : "📲 WhatsApp"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => onViewReceipt(receipt)}
            >
              View Receipt
            </Button>

            <Button
              type="button"
              onClick={() => onPrintReceipt(receipt)}
            >
              Print Receipt
            </Button>
          </div>
        </div>

        {shareError && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700 flex items-center justify-between">
            <span>{shareError}</span>
            <button
              type="button"
              onClick={() => setShareError(null)}
              className="text-red-800 hover:text-red-950 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {generateError && (
          <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 flex items-center justify-between">
            <span>{generateError} (पावती सुरक्षितपणे जतन झाली आहे)</span>
            <button
              type="button"
              onClick={() => setGenerateError(null)}
              className="text-amber-800 hover:text-amber-950 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Desktop / Manual Fallback Modal */}
      {isDesktopFallbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsDesktopFallbackOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-foreground">
                📲 WhatsApp पावती शेअर करा
              </h3>
              <button
                type="button"
                onClick={() => setIsDesktopFallbackOpen(false)}
                className="text-muted-foreground hover:text-foreground text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 leading-relaxed">
              💡 <b>डेस्कटॉप सूचना:</b> ब्राउझरवरून थेट इमेज पाठवता येत नाही. खालील बटणाने पावती JPG डाउनलोड करा आणि WhatsApp चॅटमध्ये जोडा (Attach करा).
            </div>

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center text-xs font-bold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 cursor-pointer h-9"
                onClick={handleDownloadJpg}
              >
                🖼️ पावती JPG डाउनलोड करा (Download JPG)
              </Button>

              <Button
                type="button"
                className="w-full justify-center text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer h-9"
                onClick={handleOpenWhatsAppChat}
              >
                💬 WhatsApp Chat उघडा (Open Chat)
              </Button>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDesktopFallbackOpen(false)}
              >
                बंद करा (Close)
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
