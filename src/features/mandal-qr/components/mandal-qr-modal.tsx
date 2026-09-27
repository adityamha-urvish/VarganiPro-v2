import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/supabase/client";
import {
  buildUpiPaymentIntentUri,
  generateUpiQrSvg,
  loadCachedMandalUpiConfig,
  saveCachedMandalUpiConfig,
  updateEventUpiConfigRemote,
} from "../services/mandal-qr.service";

export interface MandalQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId?: string | null;
  eventId?: string | null;
  mandalName?: string | null;
  eventName?: string | null;
  configuredUpiId?: string | null;
  configuredUpiName?: string | null;
  isAdmin?: boolean;
  onUpiUpdated?: (upiId: string, upiName?: string | null) => void;
}

export function MandalQrModal({
  isOpen,
  onClose,
  organizationId,
  eventId,
  mandalName,
  eventName,
  configuredUpiId,
  configuredUpiName,
  isAdmin = false,
  onUpiUpdated,
}: MandalQrModalProps) {
  const [effectiveUpiId, setEffectiveUpiId] = useState<string>("");
  const [effectiveUpiName, setEffectiveUpiName] = useState<string>("");
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isConfiguring, setIsConfiguring] = useState<boolean>(false);
  const [inputUpiId, setInputUpiId] = useState<string>("");
  const [inputUpiName, setInputUpiName] = useState<string>("");
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load and sync effective UPI configuration from props / cached storage
  useEffect(() => {
    if (!isOpen) return;

    let upi = configuredUpiId?.trim() || "";
    let name = configuredUpiName?.trim() || mandalName?.trim() || "";

    if (!upi) {
      const cached = loadCachedMandalUpiConfig(organizationId, eventId);
      if (cached.upiId) {
        upi = cached.upiId;
        if (cached.upiName) name = cached.upiName;
      }
    }

    setEffectiveUpiId(upi);
    setEffectiveUpiName(name);
    setInputUpiId(upi);
    setInputUpiName(name || mandalName || "");
    setIsConfiguring(false);
    setSaveError(null);

    // If not cached and eventId is known, fetch latest from DB
    if (!upi && eventId) {
      void (async () => {
        try {
          const { data } = await supabase
            .from("events")
            .select("upi_id, upi_name")
            .eq("id", eventId)
            .maybeSingle();

          if (data?.upi_id) {
            const fetchedUpi = data.upi_id.trim();
            const fetchedName = data.upi_name?.trim() || name;
            setEffectiveUpiId(fetchedUpi);
            setEffectiveUpiName(fetchedName);
            setInputUpiId(fetchedUpi);
            setInputUpiName(fetchedName);
            saveCachedMandalUpiConfig(organizationId, eventId, {
              upiId: fetchedUpi,
              upiName: fetchedName,
            });
          }
        } catch (err: unknown) {
          console.warn("Failed to fetch event upi config:", err);
        }
      })();
    }
  }, [isOpen, configuredUpiId, configuredUpiName, organizationId, eventId, mandalName]);

  // Generate QR SVG when effective UPI ID changes
  useEffect(() => {
    if (!isOpen || !effectiveUpiId) {
      setQrSvg(null);
      return;
    }

    let isCancelled = false;
    const uri = buildUpiPaymentIntentUri(effectiveUpiId, effectiveUpiName || mandalName || "Mandal");

    generateUpiQrSvg(uri, { size: 280 })
      .then((svg) => {
        if (!isCancelled) setQrSvg(svg);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to generate QR SVG:", err);
          setQrSvg(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, effectiveUpiId, effectiveUpiName, mandalName]);

  if (!isOpen) return null;

  async function handleCopyUpiId() {
    if (!effectiveUpiId) return;
    try {
      let copied = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(effectiveUpiId);
          copied = true;
        } catch {
          // fallback to execCommand
        }
      }
      if (!copied) {
        const textArea = document.createElement("textarea");
        textArea.value = effectiveUpiId;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }

  async function handleSaveUpiConfig(e: React.FormEvent) {
    e.preventDefault();
    const cleanUpi = inputUpiId.trim();
    if (!cleanUpi) {
      setSaveError("कृपया वैध UPI ID प्रविष्ट करा (Please enter a valid UPI ID)");
      return;
    }

    setSaveLoading(true);
    setSaveError(null);

    // Save locally first for offline availability
    saveCachedMandalUpiConfig(organizationId, eventId, {
      upiId: cleanUpi,
      upiName: inputUpiName.trim() || null,
    });

    setEffectiveUpiId(cleanUpi);
    setEffectiveUpiName(inputUpiName.trim() || mandalName || "");

    // If eventId exists, attempt remote sync
    if (eventId) {
      const res = await updateEventUpiConfigRemote(
        eventId,
        cleanUpi,
        inputUpiName.trim() || null,
        organizationId
      );
      if (!res.success && res.error) {
        // Warning only, offline config succeeded
        console.warn("Remote UPI sync failed (offline cache retained):", res.error);
      }
    }

    if (onUpiUpdated) {
      onUpiUpdated(cleanUpi, inputUpiName.trim() || null);
    }

    setSaveLoading(false);
    setIsConfiguring(false);
  }

  return (
    <div
      data-testid="mandal-qr-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-card border border-amber-500/30 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CLOSE BUTTON */}
        <button
          type="button"
          data-testid="btn-close-mandal-qr"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-base font-bold p-1.5 rounded-full hover:bg-muted/80 cursor-pointer"
          aria-label="Close QR"
        >
          ✕
        </button>

        {/* HEADER */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold">
            <span>📲</span>
            <span>मंडळ UPI QR Code</span>
          </div>
          <h3 className="text-lg font-black text-foreground pt-1 line-clamp-1">
            {effectiveUpiName || mandalName || "श्री गणेश मित्र मंडळ"}
          </h3>
          {eventName && (
            <p className="text-xs text-muted-foreground font-medium">{eventName}</p>
          )}
        </div>

        {/* QR CODE DISPLAY OR CONFIG PROMPT */}
        {effectiveUpiId ? (
          <div className="space-y-3.5">
            {/* LARGE SCAN-FRIENDLY QR CONTAINER */}
            <div className="flex justify-center items-center">
              <div
                data-testid="mandal-qr-container"
                className="bg-white p-3.5 rounded-2xl border-4 border-amber-500/40 shadow-inner flex items-center justify-center w-[270px] h-[270px]"
              >
                {qrSvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                    className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  />
                ) : (
                  <div className="text-xs text-slate-400 font-medium">
                    QR तयार होत आहे...
                  </div>
                )}
              </div>
            </div>

            {/* UPI ID PILL & COPY BUTTON */}
            <div className="rounded-xl bg-muted/60 border border-border p-2.5 flex items-center justify-between gap-2">
              <div className="text-left overflow-hidden">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Mandal UPI ID
                </p>
                <p
                  data-testid="mandal-upi-id-display"
                  className="text-xs font-mono font-bold text-foreground truncate select-all"
                >
                  {effectiveUpiId}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="btn-copy-upi-id"
                onClick={handleCopyUpiId}
                className="h-8 px-2.5 text-xs font-bold shrink-0 cursor-pointer"
              >
                {isCopied ? "✓ Copied!" : "📋 Copy"}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-tight">
              Google Pay, PhonePe, Paytm किंवा कोणत्याही UPI App वरून स्कॅन करा.
            </p>

            {isAdmin && !isConfiguring && (
              <button
                type="button"
                onClick={() => setIsConfiguring(true)}
                className="text-[11px] text-amber-700 dark:text-amber-400 underline font-medium cursor-pointer"
              >
                ⚙️ Change UPI ID / सेटिंग्स बदला
              </button>
            )}
          </div>
        ) : (
          /* NOT CONFIGURED STATE */
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/10 p-5 space-y-2 text-center">
              <span className="text-3xl">⚠️</span>
              <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                UPI ID सेट केलेले नाही
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Mandal UPI ID is not configured yet.
              </p>
            </div>

            {isAdmin || isConfiguring ? (
              <form onSubmit={handleSaveUpiConfig} className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    Mandal UPI ID (उदा. mandal@okhdfcbank):
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. mandal@upi"
                    value={inputUpiId}
                    onChange={(e) => setInputUpiId(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    Mandal Name / Display Name:
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Shree Ganesh Mitra Mandal"
                    value={inputUpiName}
                    onChange={(e) => setInputUpiName(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                {saveError && (
                  <p className="text-xs text-rose-600 font-medium">{saveError}</p>
                )}

                <Button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full h-10 text-xs font-bold cursor-pointer"
                >
                  {saveLoading ? "Saving..." : "✓ Save & Generate QR"}
                </Button>
              </form>
            ) : (
              <p className="text-xs text-muted-foreground">
                कृपया व्यवस्थापकाशी (Admin) संपर्क साधून मंडळाचा UPI ID कॉन्फिगर करा.
              </p>
            )}
          </div>
        )}

        {/* CLOSE ACTION BUTTON */}
        <div className="pt-1">
          <Button
            type="button"
            variant="secondary"
            data-testid="btn-close-mandal-qr-footer"
            onClick={onClose}
            className="w-full h-10 text-xs font-bold rounded-xl cursor-pointer"
          >
            बंद करा / Close
          </Button>
        </div>
      </div>
    </div>
  );
}
