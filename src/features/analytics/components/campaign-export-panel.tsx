/**
 * Campaign Export & Download Panel
 * Phase 9-4 Step 4D: Admin export center for Full Donations Register, Daily Summary, and Penetration Reports
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchCompleteCampaignExport,
  buildDonationsCsv,
  buildDailySummaryCsv,
  buildPenetrationCsv,
  downloadCsvBlob,
  type ExportType,
  type ExportProgress,
  type DonationExportRow,
  type DailySummaryExportRow,
  type PenetrationExportRow,
} from "../services/campaign-export.service";

export interface CampaignExportPanelProps {
  eventId: string | null;
  eventName?: string;
}

export function CampaignExportPanel({
  eventId,
  eventName = "VarganiPro Event",
}: CampaignExportPanelProps) {
  const [activeExport, setActiveExport] = useState<ExportType | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  async function handleExport(exportType: ExportType) {
    if (!eventId) {
      setError("इव्हेंट निवडलेला नाही (No event selected).");
      return;
    }

    setError(null);
    setSuccessNotice(null);
    setActiveExport(exportType);
    setProgress({ current: 0, total: 0, percentage: 0 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const now = new Date();
      const dateSuffix = now.toISOString().slice(0, 10);
      const timeSuffix = now.toTimeString().slice(0, 5).replace(":", "");
      const cleanEventName = eventName.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, "_");

      if (exportType === "donations") {
        const records = await fetchCompleteCampaignExport<DonationExportRow>({
          eventId,
          exportType: "donations",
          batchSize: 500,
          onProgress: setProgress,
          signal: controller.signal,
        });

        if (records.length === 0) {
          setError("या अहवालासाठी कोणतीही नोंद उपलब्ध नाही (No records found to export).");
          return;
        }

        const csv = buildDonationsCsv(records, {
          eventName,
          exportedAt: now.toISOString(),
        });
        const filename = `VarganiPro_Donations_${cleanEventName}_${dateSuffix}_${timeSuffix}.csv`;
        downloadCsvBlob(filename, csv);
        setSuccessNotice(`✓ संपूर्ण देणगीदार यादी (${records.length} नोंदी) यशस्वीरित्या डाउनलोड झाली.`);
      } else if (exportType === "daily_summary") {
        const records = await fetchCompleteCampaignExport<DailySummaryExportRow>({
          eventId,
          exportType: "daily_summary",
          batchSize: 500,
          onProgress: setProgress,
          signal: controller.signal,
        });

        if (records.length === 0) {
          setError("या अहवालासाठी कोणतीही नोंद उपलब्ध नाही (No records found to export).");
          return;
        }

        const csv = buildDailySummaryCsv(records, {
          eventName,
          exportedAt: now.toISOString(),
        });
        const filename = `VarganiPro_DailySummary_${cleanEventName}_${dateSuffix}_${timeSuffix}.csv`;
        downloadCsvBlob(filename, csv);
        setSuccessNotice(`✓ दैनंदिन संकलन अहवाल (${records.length} दिवस) यशस्वीरित्या डाउनलोड झाला.`);
      } else if (exportType === "penetration") {
        const records = await fetchCompleteCampaignExport<PenetrationExportRow>({
          eventId,
          exportType: "penetration",
          batchSize: 500,
          onProgress: setProgress,
          signal: controller.signal,
        });

        if (records.length === 0) {
          setError("या अहवालासाठी कोणतीही नोंद उपलब्ध नाही (No records found to export).");
          return;
        }

        const csv = buildPenetrationCsv(records, {
          eventName,
          exportedAt: now.toISOString(),
        });
        const filename = `VarganiPro_Penetration_${cleanEventName}_${dateSuffix}_${timeSuffix}.csv`;
        downloadCsvBlob(filename, csv);
        setSuccessNotice(`✓ इमारत प्रगती अहवाल (${records.length} इमारती) यशस्वीरित्या डाउनलोड झाला.`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("cancelled")) {
        setError("डेटा निर्यात वापरकर्त्याद्वारे रद्द करण्यात आली (Export cancelled).");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "डेटा निर्यात करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा."
        );
      }
    } finally {
      setActiveExport(null);
      setProgress(null);
      abortControllerRef.current = null;
    }
  }

  function handleCancelExport() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  return (
    <div className="space-y-6">
      {/* -----------------------------------------------------------------
          1. HEADER
      ------------------------------------------------------------------ */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📊</span>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              अहवाल आणि डेटा निर्यात (Reports & Data Export)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              मंडळाचा संपूर्ण देणगी डेटा, दैनंदिन हिशोब आणि इमारतींची प्रगती CSV स्वरूपात डाउनलोड करा
            </p>
          </div>
        </div>
      </div>

      {/* -----------------------------------------------------------------
          2. NOTIFICATIONS (SUCCESS / ERROR)
      ------------------------------------------------------------------ */}
      {successNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center justify-between animate-in fade-in">
          <span>{successNotice}</span>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800 flex items-center justify-between animate-in fade-in">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* -----------------------------------------------------------------
          3. THREE EXPORT REPORT CARDS
      ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: Full Donations Register */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📜</span>
              <h3 className="text-base font-bold text-foreground">
                संपूर्ण देणगीदार यादी
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              सर्व पावत्या, देणगीदार नाव, मोबाईल नंबर, पत्ता, पेमेंट पद्धत, शेरा व रद्द पावत्यांचा संपूर्ण तपशील.
            </p>
            <div className="pt-2 text-[11px] font-semibold text-slate-600 space-y-1">
              <p>• स्वरूप: Excel / CSV (UTF-8)</p>
              <p>• समावेश: वैध व रद्द पावत्या</p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => handleExport("donations")}
            disabled={activeExport !== null || !eventId}
            className="w-full min-h-[44px] text-xs font-bold bg-primary text-primary-foreground shadow-xs cursor-pointer"
          >
            📥 CSV डाउनलोड करा (Donations)
          </Button>
        </div>

        {/* CARD 2: Daily Treasury Summary */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <h3 className="text-base font-bold text-foreground">
                दैनंदिन संकलन अहवाल
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              दररोज जमा झालेली रोख, UPI, धनादेश रक्कम, तिजोरी जमा आणि सेक्रेटरी पडताळणीचा एकत्रित हिशोब.
            </p>
            <div className="pt-2 text-[11px] font-semibold text-slate-600 space-y-1">
              <p>• स्वरूप: Excel / CSV (UTF-8)</p>
              <p>• समावेश: रोजचा जमा व रद्द हिशोब</p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => handleExport("daily_summary")}
            disabled={activeExport !== null || !eventId}
            className="w-full min-h-[44px] text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
          >
            📥 CSV डाउनलोड करा (Daily Summary)
          </Button>
        </div>

        {/* CARD 3: Building Penetration Report */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏢</span>
              <h3 className="text-base font-bold text-foreground">
                इमारत प्रगती अहवाल
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              प्रत्येक इमारत व गल्लीतील एकूण फ्लॅट, संकलन झालेले, बाकी आणि नकार मिळालेल्या फ्लॅट्सची आकडेवारी.
            </p>
            <div className="pt-2 text-[11px] font-semibold text-slate-600 space-y-1">
              <p>• स्वरूप: Excel / CSV (UTF-8)</p>
              <p>• समावेश: इमारत व गल्ली प्रगती</p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => handleExport("penetration")}
            disabled={activeExport !== null || !eventId}
            className="w-full min-h-[44px] text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer"
          >
            📥 CSV डाउनलोड करा (Penetration)
          </Button>
        </div>
      </div>

      {/* -----------------------------------------------------------------
          4. LIVE EXPORT PROGRESS MODAL
      ------------------------------------------------------------------ */}
      {activeExport !== null && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Export Progress"
        >
          <div className="w-full max-w-md rounded-2xl bg-card border p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-bounce">📥</span>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  डेटा तयार होत आहे (Generating Export...)
                </h3>
                <p className="text-xs text-muted-foreground">
                  कृपया विंडो बंद करू नका. सर्व नोंदी गोळा केल्या जात आहेत.
                </p>
              </div>
            </div>

            {/* Progress status */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-foreground">
                <span>
                  {progress && progress.total > 0
                    ? `नोंदी: ${progress.current} / ${progress.total}`
                    : "डेटा तपासत आहे..."}
                </span>
                <span>{progress ? `${progress.percentage}%` : "0%"}</span>
              </div>

              {/* Progress bar */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 border">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progress?.percentage || 5}%` }}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelExport}
                className="text-xs font-bold border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
              >
                रद्द करा (Cancel)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
