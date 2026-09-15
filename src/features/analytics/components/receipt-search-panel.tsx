/**
 * Global Receipt Search & Donor/Property Context Hub (Phase 2J - Direction C)
 * Production implementation of Receipt History, Multi-criteria Search,
 * Donor Identity Safety (Phone match vs Possible unlinked name matches),
 * Property / Building Coverage Context, and Digital Pavti Actions.
 */

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatReceiptDateTime,
  formatPaymentModeLabel,
  checkShareEligibility,
  buildWhatsAppShareUrl,
  openWhatsAppShare,
  normalizeIndianMobile,
} from "../utils/whatsapp-share";
import { useReceiptSearch } from "../hooks/use-receipt-search";
import type { SearchReceiptItem } from "../services/receipt-search.service";
import type { LocalReceipt } from "@/lib/offline/offline-db";
import { DigitalPavtiCard } from "@/features/pavti/components/digital-pavti-card";
import {
  renderPavtiToBlob,
  downloadImageBlob,
} from "@/features/pavti/services/pavti-image.service";
import type { PavtiTemplateConfig, PavtiReceiptData } from "@/features/pavti/types/pavti.types";
import { VoidReceiptDialog, type VoidReceiptTarget } from "./void-receipt-dialog";
import type { VoidReceiptResult } from "../services/analytics.service";

export interface VolunteerOption {
  id: string;
  name: string;
}

export interface ReceiptSearchPanelProps {
  eventId: string | null;
  volunteers?: VolunteerOption[];
  onViewReceipt?: (receipt: LocalReceipt | SearchReceiptItem) => void;
  onNavigateToBuilding?: (buildingId: string, propertyId?: string | null) => void;
  receiptPrefix?: string;
  mandalName?: string;
  eventName?: string;
  secretaryName?: string;
  secretaryDesignation?: string;
  festivalType?: "ganpati" | "navratri" | "other";
  className?: string;
}

export function ReceiptSearchPanel({
  eventId,
  volunteers = [],
  onViewReceipt,
  onNavigateToBuilding,
  receiptPrefix = "VP-",
  mandalName = "श्री गणेश मित्र मंडळ",
  eventName = "सार्वजनिक गणेशोत्सव २०२६",
  secretaryName = "अक्षय जोशी",
  secretaryDesignation = "अध्यक्ष / खजिनदार",
  festivalType = "ganpati",
  className = "",
}: ReceiptSearchPanelProps) {
  const {
    query,
    setQuery,
    paymentMode,
    setPaymentMode,
    status,
    setStatus,
    volunteerId,
    setVolunteerId,
    dateFilter,
    setDateFilter,
    receipts,
    filteredReceipts,
    totalCount,
    hasMore,
    loading,
    loadingMore,
    error,
    hasSearched,
    loadMore,
    triggerSearch,
    resetFilters,
  } = useReceiptSearch({ eventId, pageSize: 25 });

  // Selected receipt state for Inspector Hub
  const [selectedReceipt, setSelectedReceipt] = useState<SearchReceiptItem | null>(null);
  const [activeContextTab, setActiveContextTab] = useState<"receipt" | "donor" | "property">("receipt");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Void Receipt Dialog state
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<VoidReceiptTarget | null>(null);
  const [voidSuccessBanner, setVoidSuccessBanner] = useState<string | null>(null);

  // JPG generation state
  const [downloadingJpg, setDownloadingJpg] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const hasActiveFilter =
    query.trim().length > 0 ||
    paymentMode !== "all" ||
    status !== "all" ||
    volunteerId !== null ||
    dateFilter !== "all";

  // When clicking a receipt from the list
  const handleSelectReceipt = useCallback(
    (receipt: SearchReceiptItem) => {
      setSelectedReceipt(receipt);
      setIsMobileDrawerOpen(true);
      if (onViewReceipt) {
        onViewReceipt(receipt);
      }
    },
    [onViewReceipt]
  );

  // ---------------------------------------------------------------------------
  // DONOR IDENTITY SAFETY DISAMBIGUATION
  // ---------------------------------------------------------------------------
  const donorContext = useMemo(() => {
    if (!selectedReceipt) return null;

    const normalizedMobile = normalizeIndianMobile(selectedReceipt.donor_mobile);
    const selectedNameClean = (selectedReceipt.donor_name || "").trim().toLowerCase();

    // A. Strong Phone Match: receipts sharing the exact 10-digit mobile
    const phoneMatches = normalizedMobile
      ? receipts.filter((r) => normalizeIndianMobile(r.donor_mobile) === normalizedMobile)
      : [];

    const phoneMatchCount = phoneMatches.length;
    const phoneMatchValidTotal = phoneMatches
      .filter((r) => r.status !== "voided" && !r.voided_at)
      .reduce((sum, r) => sum + r.amount, 0);

    // B. Possible Name Matches: matching name but different or missing mobile
    const possibleNameMatches = receipts.filter((r) => {
      if (r.id === selectedReceipt.id) return false;
      const rNameClean = (r.donor_name || "").trim().toLowerCase();
      if (rNameClean !== selectedNameClean || selectedNameClean.length < 2) return false;

      const rMobileNorm = normalizeIndianMobile(r.donor_mobile);
      if (normalizedMobile && rMobileNorm === normalizedMobile) {
        // Already counted in verified phone matches
        return false;
      }
      return true;
    });

    return {
      normalizedMobile,
      phoneMatches,
      phoneMatchCount,
      phoneMatchValidTotal,
      possibleNameMatches,
      possibleCount: possibleNameMatches.length,
    };
  }, [selectedReceipt, receipts]);

  // ---------------------------------------------------------------------------
  // PROPERTY & FLAT CONTEXT
  // ---------------------------------------------------------------------------
  const propertyContext = useMemo(() => {
    if (!selectedReceipt) return null;

    const hasProperty = Boolean(
      selectedReceipt.building_name ||
      selectedReceipt.unit_number ||
      selectedReceipt.property_id
    );

    if (!hasProperty) {
      return { hasProperty: false, propertyReceipts: [], propertyTotal: 0 };
    }

    const bldClean = (selectedReceipt.building_name || "").trim().toLowerCase();
    const unitClean = (selectedReceipt.unit_number || "").trim().toLowerCase();

    const propertyReceipts = receipts.filter((r) => {
      if (selectedReceipt.property_id && r.property_id) {
        return r.property_id === selectedReceipt.property_id;
      }
      const rBld = (r.building_name || "").trim().toLowerCase();
      const rUnit = (r.unit_number || "").trim().toLowerCase();
      return rBld === bldClean && rUnit === unitClean;
    });

    const propertyTotal = propertyReceipts
      .filter((r) => r.status !== "voided" && !r.voided_at)
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      hasProperty: true,
      propertyReceipts,
      propertyTotal,
    };
  }, [selectedReceipt, receipts]);

  // ---------------------------------------------------------------------------
  // ACTIONS: WhatsApp, JPG, Print, Void
  // ---------------------------------------------------------------------------
  const handleWhatsAppClick = useCallback((receipt: SearchReceiptItem) => {
    const eligibility = checkShareEligibility({
      receiptNumber: receipt.receipt_number,
      receiptPrefix: receipt.receipt_prefix || receiptPrefix,
      amount: receipt.amount,
      paymentMode: receipt.payment_mode,
      paymentReference: receipt.payment_reference,
      donorName: receipt.donor_name,
      donorMobile: receipt.donor_mobile,
      createdAt: receipt.created_at,
      status: receipt.status,
      voidReason: receipt.void_reason,
      voidedAt: receipt.voided_at,
      id: receipt.id,
    });

    if (!eligibility.isShareable) {
      setActionFeedback(`⚠️ WhatsApp शेअर करता येत नाही: ${eligibility.reason}`);
      setTimeout(() => setActionFeedback(null), 4000);
      return;
    }

    const shareDetails = buildWhatsAppShareUrl({
      receiptNumber: receipt.receipt_number,
      receiptPrefix: receipt.receipt_prefix || receiptPrefix,
      amount: receipt.amount,
      paymentMode: receipt.payment_mode,
      paymentReference: receipt.payment_reference,
      donorName: receipt.donor_name,
      donorMobile: receipt.donor_mobile,
      createdAt: receipt.created_at,
      buildingName: receipt.building_name,
      buildingWing: receipt.building_wing,
      unitNumber: receipt.unit_number,
      propertyType: receipt.property_type,
      mandalName,
      eventName,
      id: receipt.id,
      status: receipt.status,
    });

    const opened = openWhatsAppShare(shareDetails.url);
    if (opened) {
      setActionFeedback("✅ WhatsApp पावती उघडली!");
    } else {
      setActionFeedback("⚠️ पॉपअप ब्लॉक झाले. कृपया परवानगी द्या.");
    }
    setTimeout(() => setActionFeedback(null), 3000);
  }, [receiptPrefix, mandalName, eventName]);

  const handleDownloadJpg = useCallback(async (receipt: SearchReceiptItem) => {
    try {
      setDownloadingJpg(true);
      const config: PavtiTemplateConfig = {
        festivalType: festivalType as "ganpati" | "navratri" | "other",
        mandalName,
        eventName,
        yearText: "२०२६",
        secretaryName,
        secretaryDesignation,
      };

      const pavtiData: PavtiReceiptData = {
        receiptNumber: receipt.receipt_number,
        receiptPrefix: receipt.receipt_prefix || receiptPrefix,
        donorName: receipt.donor_name,
        amount: receipt.amount,
        paymentMode: receipt.payment_mode,
        paymentReference: receipt.payment_reference,
        createdAt: receipt.created_at,
        buildingName: receipt.building_name,
        buildingWing: receipt.building_wing,
        unitNumber: receipt.unit_number,
        propertyType: receipt.property_type,
        notes: receipt.notes,
      };

      const blob = await renderPavtiToBlob(config, pavtiData, { quality: 0.95, pixelRatio: 2 });
      const filename = `Pavti-${receipt.receipt_prefix || receiptPrefix}${receipt.receipt_number}.jpg`;
      downloadImageBlob(blob, filename);

      setActionFeedback("✅ पावती JPG डाऊनलोड झाली!");
    } catch (err) {
      setActionFeedback(
        `⚠️ JPG डाऊनलोड अयशस्वी: ${err instanceof Error ? err.message : "त्रुटी आली"}`
      );
    } finally {
      setDownloadingJpg(false);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  }, [festivalType, mandalName, eventName, secretaryName, secretaryDesignation, receiptPrefix]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  const handleOpenVoidDialog = useCallback((receipt: SearchReceiptItem) => {
    setVoidTarget({
      id: receipt.id,
      receiptNumber: receipt.receipt_number,
      amount: receipt.amount,
      donorName: receipt.donor_name,
      donorMobile: receipt.donor_mobile,
      paymentMode: receipt.payment_mode,
      unitNumber: receipt.unit_number,
      status: receipt.status,
    });
    setVoidDialogOpen(true);
  }, []);

  const handleVoidSuccess = useCallback((result: VoidReceiptResult) => {
    setVoidDialogOpen(false);
    setVoidTarget(null);
    setVoidSuccessBanner(
      `✅ पावती क्र. ${result.receipt_number} (₹${result.amount}) यशस्वीरित्या रद्द करण्यात आली.`
    );
    setTimeout(() => setVoidSuccessBanner(null), 5000);

    // Update selected receipt if currently open
    setSelectedReceipt((current) => {
      if (!current || current.id !== result.receipt_id) return current;
      return {
        ...current,
        status: "voided",
        void_reason: result.void_reason,
        voided_at: result.voided_at,
        voided_by_name: result.voided_by || "Admin",
      };
    });

    // Re-fetch search results to ensure authoritative state
    triggerSearch();
  }, [triggerSearch]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* -----------------------------------------------------------------
          1. TOP SEARCH & AUDIT HEADER
      ------------------------------------------------------------------ */}
      <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
              <span className="text-xl">📜</span>
              <span>पावती शोध व इतिहास (Receipt Search & History)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              मंडळाच्या सर्व पावत्या, देणगीदार व इमारत इतिहास तपासा
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {hasActiveFilter && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="text-xs font-semibold h-9"
              >
                ↺ रिसेट (Reset)
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={triggerSearch}
              disabled={loading || !eventId}
              className="text-xs font-bold bg-primary text-primary-foreground h-9 px-4 shadow-xs cursor-pointer"
            >
              {loading ? "शोधत आहे..." : "🔍 शोधा (Search)"}
            </Button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 देणगीदार नाव, मोबाईल, पावती क्र., इमारत, फ्लॅट शोधा..."
            className="w-full text-sm rounded-xl py-2.5 pl-4 pr-10 min-h-[46px] bg-slate-50/80 focus:bg-white transition-all shadow-inner"
            aria-label="Search receipts input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm font-bold p-1 cursor-pointer"
              aria-label="Clear query"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick Date Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
            कालावधी (Period):
          </span>
          <button
            type="button"
            onClick={() => setDateFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              dateFilter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            सर्व पावत्या (All)
          </button>
          <button
            type="button"
            onClick={() => setDateFilter("today")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              dateFilter === "today"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100"
            }`}
          >
            <span>📅 आज (Today)</span>
          </button>
          <button
            type="button"
            onClick={() => setDateFilter("yesterday")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              dateFilter === "yesterday"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-indigo-50 text-indigo-800 border border-indigo-200/60 hover:bg-indigo-100"
            }`}
          >
            <span>⏪ काल (Yesterday)</span>
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          {/* Payment Mode */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              पेमेंट पद्धत (Payment Mode)
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full rounded-lg border bg-white p-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[38px]"
              aria-label="Filter by payment mode"
            >
              <option value="all">सर्व पद्धती (All)</option>
              <option value="cash">रोख (Cash)</option>
              <option value="upi">UPI</option>
              <option value="cheque">धनादेश (Cheque)</option>
              <option value="bank_transfer">बँक ट्रान्सफर (Bank Transfer)</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              पावती स्थिती (Status)
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border bg-white p-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[38px]"
              aria-label="Filter by receipt status"
            >
              <option value="all">सर्व स्थिती (All)</option>
              <option value="active">वैध पावत्या (Valid / Active)</option>
              <option value="voided">रद्द पावत्या (Voided)</option>
            </select>
          </div>

          {/* Volunteer (Admin Only) */}
          {volunteers.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                कार्यकर्ता (Volunteer)
              </label>
              <select
                value={volunteerId || ""}
                onChange={(e) =>
                  setVolunteerId(e.target.value ? e.target.value : null)
                }
                className="w-full rounded-lg border bg-white p-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[38px]"
                aria-label="Filter by volunteer"
              >
                <option value="">सर्व कार्यकर्ते (All Volunteers)</option>
                {volunteers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* -----------------------------------------------------------------
          NOTIFICATIONS & ERROR BANNERS
      ------------------------------------------------------------------ */}
      {voidSuccessBanner && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 animate-in fade-in">
          {voidSuccessBanner}
        </div>
      )}

      {actionFeedback && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900 animate-in fade-in">
          {actionFeedback}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={triggerSearch}
            className="text-xs font-bold"
          >
            पुन्हा प्रयत्न करा (Retry)
          </Button>
        </div>
      )}

      {/* -----------------------------------------------------------------
          2. RESULTS & DIRECTION C SPLIT VIEW
      ------------------------------------------------------------------ */}
      {loading && !hasSearched ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground space-y-3 shadow-xs">
          <span className="text-3xl animate-spin block">⏳</span>
          <p className="font-bold text-foreground">पावत्या शोधत आहे... (Searching receipts...)</p>
        </div>
      ) : !hasSearched ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground space-y-2 shadow-xs">
          <span className="text-4xl block">🔍</span>
          <h3 className="text-base font-bold text-foreground">
            पावती शोधण्यासाठी वरील सर्च बॉक्स वापरा
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            देणगीदाराचे नाव, मोबाईल नंबर, पावती क्रमांक किंवा इमारत/फ्लॅट टाकून थेट शोधा.
          </p>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground space-y-2 shadow-xs">
          <span className="text-4xl block">📭</span>
          <h3 className="text-base font-bold text-foreground">
            पावत्या सापडल्या नाहीत (No receipts found)
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            आपण निवडलेल्या निकषांशी जुळणारी एकही पावती आढळली नाही. कृपया फिल्टर तपासा.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="text-xs font-bold mt-2"
          >
            सर्व फिल्टर्स काढा (Clear Filters)
          </Button>
        </div>
      ) : (
        /* MAIN SPLIT-VIEW GRID (Desktop >= 1024px: Left 45% List, Right 55% Inspector) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* =============================================================
              LEFT COLUMN: RESULTS STREAM (45% / lg:col-span-5)
          ============================================================== */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-muted-foreground">
              <span>
                {dateFilter === "all"
                  ? `${totalCount} पैकी ${receipts.length} पावत्या`
                  : `${filteredReceipts.length} पावत्या (${dateFilter === "today" ? "आज" : "काल"})`}
              </span>
              <span>(Showing {filteredReceipts.length} receipts)</span>
            </div>

            <div className="space-y-2.5">
              {filteredReceipts.map((r) => {
                const isVoided = r.status === "voided" || Boolean(r.voided_at);
                const receiptCode = `${r.receipt_prefix || receiptPrefix}${r.receipt_number}`;
                const formattedDate = formatReceiptDateTime(r.created_at);
                const isSelected = selectedReceipt?.id === r.id;

                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectReceipt(r)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-xs"
                        : isVoided
                        ? "border-red-200 bg-red-50/40 hover:bg-red-50/70"
                        : "border-border bg-card hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-foreground">
                            {receiptCode}
                          </span>

                          {isVoided ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-800 border border-red-200">
                              रद्द (VOIDED)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              वैध (Valid)
                            </span>
                          )}

                          <span className="text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {formatPaymentModeLabel(r.payment_mode)}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-foreground truncate">
                          {r.donor_name}
                        </div>

                        {r.donor_mobile && (
                          <div className="text-xs text-muted-foreground">
                            📱 {r.donor_mobile}
                          </div>
                        )}

                        {/* Location / Property */}
                        {(r.building_name || r.unit_number) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <span>🏢</span>
                            <span>
                              {r.building_name}
                              {r.building_wing && ` (${r.building_wing})`}
                              {r.unit_number &&
                                (r.property_type === "commercial"
                                  ? `, गाळा ${r.unit_number}`
                                  : `, फ्लॅट ${r.unit_number}`)}
                            </span>
                          </p>
                        )}

                        {/* Volunteer & Date */}
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap pt-0.5">
                          <span>👤 {r.volunteer_name || "Volunteer"}</span>
                          <span>•</span>
                          <span>📅 {formattedDate}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch">
                        <div
                          className={`text-base font-black ${
                            isVoided
                              ? "line-through text-muted-foreground"
                              : "text-emerald-700"
                          }`}
                        >
                          ₹{r.amount.toFixed(2)}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectReceipt(r);
                          }}
                          className="text-[11px] font-bold text-primary hover:text-primary hover:bg-primary/10 h-7 px-2 mt-2"
                        >
                          पहा →
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={loadMore}
                  className="w-full min-h-[40px] text-xs font-bold shadow-xs cursor-pointer"
                >
                  {loadingMore
                    ? "लोड होत आहे... (Loading...)"
                    : "⬇️ आणखी पावत्या पहा (Load More)"}
                </Button>
              </div>
            )}
          </div>

          {/* =============================================================
              RIGHT COLUMN: RECEIPT & CONTEXT INSPECTOR (55% / lg:col-span-7)
              Visible on Desktop; rendered in drawer on Mobile
          ============================================================== */}
          <div className="hidden lg:block lg:col-span-7 sticky top-6">
            {selectedReceipt ? (
              <ReceiptInspectorCard
                receipt={selectedReceipt}
                receiptPrefix={receiptPrefix}
                mandalName={mandalName}
                eventName={eventName}
                secretaryName={secretaryName}
                secretaryDesignation={secretaryDesignation}
                festivalType={festivalType}
                donorContext={donorContext}
                propertyContext={propertyContext}
                activeContextTab={activeContextTab}
                setActiveContextTab={setActiveContextTab}
                downloadingJpg={downloadingJpg}
                onWhatsAppClick={handleWhatsAppClick}
                onDownloadJpg={handleDownloadJpg}
                onPrint={handlePrint}
                onOpenVoidDialog={handleOpenVoidDialog}
                onNavigateToBuilding={onNavigateToBuilding}
                onSelectReceiptFromContext={handleSelectReceipt}
              />
            ) : (
              <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground space-y-3 shadow-xs min-h-[380px] flex flex-col items-center justify-center">
                <span className="text-4xl block">👈</span>
                <h3 className="text-base font-bold text-foreground">
                  तपशील पाहण्यासाठी डाव्या बाजूची पावती निवडा
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  पावतीचे संपूर्ण तपशील, देणगीदार इतिहास, इमारत कव्हरेज आणि डिजिटल पावती पाहण्यासाठी कोणत्याही पावतीवर क्लिक करा.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------------
          3. MOBILE INSPECTOR DRAWER / SHEET (< 1024px)
      ------------------------------------------------------------------ */}
      {isMobileDrawerOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/40" onClick={() => setIsMobileDrawerOpen(false)} />
          <div className="relative mt-auto h-[90vh] w-full rounded-t-3xl bg-card border-t shadow-2xl flex flex-col overflow-hidden z-10 animate-in slide-in-from-bottom duration-300">
            {/* Drawer Header */}
            <div className="px-5 py-3 border-b flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-foreground">
                  {selectedReceipt.receipt_prefix || receiptPrefix}{selectedReceipt.receipt_number}
                </span>
                {selectedReceipt.status === "voided" ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-800">
                    रद्द (VOIDED)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ₹{selectedReceipt.amount.toFixed(2)}
                  </span>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="text-xs font-bold h-8 px-3"
              >
                ✕ बंद करा (Close)
              </Button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <ReceiptInspectorCard
                receipt={selectedReceipt}
                receiptPrefix={receiptPrefix}
                mandalName={mandalName}
                eventName={eventName}
                secretaryName={secretaryName}
                secretaryDesignation={secretaryDesignation}
                festivalType={festivalType}
                donorContext={donorContext}
                propertyContext={propertyContext}
                activeContextTab={activeContextTab}
                setActiveContextTab={setActiveContextTab}
                downloadingJpg={downloadingJpg}
                onWhatsAppClick={handleWhatsAppClick}
                onDownloadJpg={handleDownloadJpg}
                onPrint={handlePrint}
                onOpenVoidDialog={handleOpenVoidDialog}
                onNavigateToBuilding={(bId, pId) => {
                  setIsMobileDrawerOpen(false);
                  onNavigateToBuilding?.(bId, pId);
                }}
                onSelectReceiptFromContext={handleSelectReceipt}
              />
            </div>
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------------
          4. VOID RECEIPT DIALOG
      ------------------------------------------------------------------ */}
      <VoidReceiptDialog
        receipt={voidTarget}
        receiptPrefix={receiptPrefix}
        isOpen={voidDialogOpen}
        onClose={() => {
          setVoidDialogOpen(false);
          setVoidTarget(null);
        }}
        onSuccess={handleVoidSuccess}
      />
    </div>
  );
}

// =============================================================================
// SUB-COMPONENT: RECEIPT INSPECTOR CARD (DIRECTION C HUB)
// =============================================================================

interface ReceiptInspectorCardProps {
  receipt: SearchReceiptItem;
  receiptPrefix: string;
  mandalName: string;
  eventName: string;
  secretaryName: string;
  secretaryDesignation: string;
  festivalType: string;
  donorContext: {
    normalizedMobile: string | null;
    phoneMatches: SearchReceiptItem[];
    phoneMatchCount: number;
    phoneMatchValidTotal: number;
    possibleNameMatches: SearchReceiptItem[];
    possibleCount: number;
  } | null;
  propertyContext: {
    hasProperty: boolean;
    propertyReceipts: SearchReceiptItem[];
    propertyTotal: number;
  } | null;
  activeContextTab: "receipt" | "donor" | "property";
  setActiveContextTab: (tab: "receipt" | "donor" | "property") => void;
  downloadingJpg: boolean;
  onWhatsAppClick: (receipt: SearchReceiptItem) => void;
  onDownloadJpg: (receipt: SearchReceiptItem) => void;
  onPrint: () => void;
  onOpenVoidDialog: (receipt: SearchReceiptItem) => void;
  onNavigateToBuilding?: (buildingId: string, propertyId?: string | null) => void;
  onSelectReceiptFromContext: (receipt: SearchReceiptItem) => void;
}

function ReceiptInspectorCard({
  receipt,
  receiptPrefix,
  mandalName,
  eventName,
  secretaryName,
  secretaryDesignation,
  festivalType,
  donorContext,
  propertyContext,
  activeContextTab,
  setActiveContextTab,
  downloadingJpg,
  onWhatsAppClick,
  onDownloadJpg,
  onPrint,
  onOpenVoidDialog,
  onNavigateToBuilding,
  onSelectReceiptFromContext,
}: ReceiptInspectorCardProps) {
  const isVoided = receipt.status === "voided" || Boolean(receipt.voided_at);
  const receiptCode = `${receipt.receipt_prefix || receiptPrefix}${receipt.receipt_number}`;
  const formattedDate = formatReceiptDateTime(receipt.created_at);

  const pavtiConfig: PavtiTemplateConfig = {
    festivalType: festivalType as "ganpati" | "navratri" | "other",
    mandalName,
    eventName,
    yearText: "२०२६",
    secretaryName,
    secretaryDesignation,
  };

  const pavtiData: PavtiReceiptData = {
    receiptNumber: receipt.receipt_number,
    receiptPrefix: receipt.receipt_prefix || receiptPrefix,
    donorName: receipt.donor_name,
    amount: receipt.amount,
    paymentMode: receipt.payment_mode,
    paymentReference: receipt.payment_reference,
    createdAt: receipt.created_at,
    buildingName: receipt.building_name,
    buildingWing: receipt.building_wing,
    unitNumber: receipt.unit_number,
    propertyType: receipt.property_type,
    notes: receipt.notes,
  };

  return (
    <div className="rounded-2xl border bg-card shadow-xs overflow-hidden divide-y divide-slate-100">
      {/* -----------------------------------------------------------------
          A. INSPECTOR TOP ACTION HEADER
      ------------------------------------------------------------------ */}
      <div className="p-4 sm:p-5 bg-slate-50/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-black text-foreground">
                {receiptCode}
              </span>

              {isVoided ? (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-red-100 text-red-800 border border-red-300">
                  रद्द (VOIDED)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  वैध (Valid)
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground mt-0.5">
              नोंदणी: {formattedDate}
            </div>
          </div>

          <div
            className={`text-2xl font-black ${
              isVoided ? "line-through text-muted-foreground" : "text-emerald-700"
            }`}
          >
            ₹{receipt.amount.toFixed(2)}
          </div>
        </div>

        {/* Quick Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Button
            type="button"
            size="sm"
            onClick={() => onWhatsAppClick(receipt)}
            disabled={isVoided}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[36px] shadow-xs cursor-pointer"
          >
            🟢 WhatsApp
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDownloadJpg(receipt)}
            disabled={downloadingJpg}
            className="text-xs font-bold min-h-[36px] cursor-pointer"
          >
            {downloadingJpg ? "तयार होत आहे..." : "🖼️ JPG पावती"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrint}
            className="text-xs font-bold min-h-[36px] cursor-pointer"
          >
            🖨️ प्रिंट (Print)
          </Button>

          {!isVoided && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenVoidDialog(receipt)}
              className="text-xs font-bold text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800 min-h-[36px] ml-auto cursor-pointer"
            >
              ⚠️ रद्द करा (Void)
            </Button>
          )}
        </div>
      </div>

      {/* -----------------------------------------------------------------
          B. SEGMENTED CONTEXT TABS
      ------------------------------------------------------------------ */}
      <div className="px-4 py-2 bg-white flex items-center gap-1 border-b overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveContextTab("receipt")}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeContextTab === "receipt"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          📜 पावती तपशील (Receipt)
        </button>

        <button
          type="button"
          onClick={() => setActiveContextTab("donor")}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeContextTab === "donor"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          <span>👤 देणगीदार इतिहास (Donor)</span>
          {donorContext && donorContext.phoneMatchCount > 1 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-black">
              {donorContext.phoneMatchCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveContextTab("property")}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeContextTab === "property"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          }`}
        >
          <span>🏢 इमारत व फ्लॅट (Property)</span>
        </button>
      </div>

      {/* -----------------------------------------------------------------
          C. TAB CONTENT AREA
      ------------------------------------------------------------------ */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* TAB 1: RECEIPT DETAILS */}
        {activeContextTab === "receipt" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Void Audit Details if Voided */}
            {isVoided && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-sm">
                  <span>⚠️ पावती रद्द करण्यात आली आहे</span>
                </p>
                <p className="font-semibold">
                  रद्द करण्याचे कारण: <span className="font-normal">{receipt.void_reason || "—"}</span>
                </p>
                {receipt.voided_by_name && (
                  <p className="text-[11px] text-red-700">
                    रद्द केले: {receipt.voided_by_name}{" "}
                    {receipt.voided_at && `(${formatReceiptDateTime(receipt.voided_at)})`}
                  </p>
                )}
              </div>
            )}

            {/* Key-Value Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border bg-slate-50/60 p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  देणगीदार नाव (Donor Name)
                </span>
                <p className="text-sm font-bold text-foreground">{receipt.donor_name}</p>
              </div>

              <div className="rounded-lg border bg-slate-50/60 p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  मोबाईल क्रमांक (Mobile)
                </span>
                <p className="text-sm font-bold text-foreground">
                  {receipt.donor_mobile ? (
                    <a
                      href={`tel:${receipt.donor_mobile}`}
                      className="text-primary hover:underline"
                    >
                      📱 {receipt.donor_mobile}
                    </a>
                  ) : (
                    <span className="text-muted-foreground italic">उपलब्ध नाही (Not provided)</span>
                  )}
                </p>
              </div>

              <div className="rounded-lg border bg-slate-50/60 p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  पेमेंट पद्धत व संदर्भ (Payment Mode & Ref)
                </span>
                <p className="text-sm font-bold text-foreground">
                  {formatPaymentModeLabel(receipt.payment_mode)}
                  {receipt.payment_reference && (
                    <span className="block text-xs font-mono font-normal text-muted-foreground mt-0.5">
                      Ref: {receipt.payment_reference}
                    </span>
                  )}
                </p>
              </div>

              <div className="rounded-lg border bg-slate-50/60 p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  इमारत व फ्लॅट (Property / Flat)
                </span>
                <p className="text-sm font-bold text-foreground">
                  {receipt.building_name ? (
                    <span>
                      {receipt.building_name}
                      {receipt.building_wing && ` (${receipt.building_wing})`}
                      {receipt.unit_number &&
                        (receipt.property_type === "commercial"
                          ? `, गाळा ${receipt.unit_number}`
                          : `, फ्लॅट ${receipt.unit_number}`)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      सामान्य / थेट देणगी (General / Ad-hoc)
                    </span>
                  )}
                </p>
              </div>

              <div className="rounded-lg border bg-slate-50/60 p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  कार्यकर्ता व पुस्तक (Volunteer & Book)
                </span>
                <p className="text-xs font-bold text-foreground">
                  👤 {receipt.volunteer_name || "Volunteer"}
                  {receipt.book_number && (
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      Book No: {receipt.book_number}
                    </span>
                  )}
                </p>
              </div>

              <div className="rounded-lg border bg-slate-50/60 p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  शेरा / टीप (Notes)
                </span>
                <p className="text-xs font-medium text-foreground">
                  {receipt.notes || "—"}
                </p>
              </div>
            </div>

            {/* Embedded Digital Pavti Preview */}
            <div className="pt-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                डिजिटल पावती पूर्वावलोकन (Digital Pavti Preview)
              </label>
              <div className="rounded-xl border p-2 bg-slate-100/60 overflow-hidden">
                <DigitalPavtiCard
                  config={pavtiConfig}
                  receipt={pavtiData}
                  className="shadow-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DONOR HISTORY (IDENTITY-SAFE) */}
        {activeContextTab === "donor" && donorContext && (
          <div className="space-y-5 animate-in fade-in duration-150 text-xs">
            {/* SECTION A: VERIFIED PHONE MATCH */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span>✅</span>
                  <span>प्रमाणित फोन जुळणी (Verified Phone Match)</span>
                </h4>
                {donorContext.normalizedMobile && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    +{donorContext.normalizedMobile}
                  </span>
                )}
              </div>

              {donorContext.phoneMatches.length > 0 ? (
                <>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-emerald-950">
                        एकूण {donorContext.phoneMatchCount} पावत्या या मोबाईलवर
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        समान १०-अंकी मोबाईल क्रमांकाशी जुळलेल्या सर्व नोंदी
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-emerald-900">
                        ₹{donorContext.phoneMatchValidTotal.toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-emerald-700">वैध रक्कम</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {donorContext.phoneMatches.map((item) => {
                      const isItemVoided = item.status === "voided" || Boolean(item.voided_at);
                      const isCurrent = item.id === receipt.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => onSelectReceiptFromContext(item)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            isCurrent
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>{item.receipt_prefix || receiptPrefix}{item.receipt_number}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-primary text-white font-bold">
                                  सध्याची
                                </span>
                              )}
                              {isItemVoided && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-100 text-red-800 font-bold">
                                  रद्द
                                </span>
                              )}
                            </div>
                            <div
                              className={`font-black ${
                                isItemVoided ? "line-through text-muted-foreground" : "text-emerald-700"
                              }`}
                            >
                              ₹{item.amount.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1">
                            <span>📅 {formatReceiptDateTime(item.created_at)}</span>
                            <span>•</span>
                            <span>{formatPaymentModeLabel(item.payment_mode)}</span>
                            {item.building_name && (
                              <>
                                <span>•</span>
                                <span>🏢 {item.building_name} {item.unit_number || ""}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border bg-slate-50 p-4 text-center text-muted-foreground space-y-1">
                  <p className="font-medium">
                    या पावतीमध्ये मोबाईल नंबर उपलब्ध नाही किंवा इतर कोणतीही जुळणी सापडली नाही.
                  </p>
                </div>
              )}
            </div>

            {/* SECTION B: POSSIBLE NAME MATCHES (UNLINKED) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between pb-1 border-b">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>संभाव्य नाव जुळणी (Possible Name Matches — Unlinked)</span>
                </h4>
                {donorContext.possibleCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {donorContext.possibleCount} नोंदी
                  </span>
                )}
              </div>

              {donorContext.possibleNameMatches.length > 0 ? (
                <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 leading-relaxed">
                    <strong>सुरक्षा सूचना:</strong> &ldquo;{receipt.donor_name}&rdquo; या नावाची इतर खाती आढळली आहेत, परंतु त्यांचा मोबाईल क्रमांक वेगळा किंवा उपलब्ध नाही. हे स्वतंत्र व्यक्ती असू शकतात, त्यामुळे त्यांचे रेकॉर्ड एकत्र केलेले नाहीत.
                  </div>

                  <div className="space-y-2">
                    {donorContext.possibleNameMatches.map((item) => {
                      const isItemVoided = item.status === "voided" || Boolean(item.voided_at);
                      return (
                        <div
                          key={item.id}
                          onClick={() => onSelectReceiptFromContext(item)}
                          className="p-3 rounded-lg border border-amber-200/70 bg-white hover:bg-amber-50/40 transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>{item.receipt_prefix || receiptPrefix}{item.receipt_number}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                ({item.donor_name})
                              </span>
                              {isItemVoided && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-100 text-red-800 font-bold">
                                  रद्द
                                </span>
                              )}
                            </div>
                            <div
                              className={`font-black ${
                                isItemVoided ? "line-through text-muted-foreground" : "text-slate-800"
                              }`}
                            >
                              ₹{item.amount.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1">
                            <span>📱 {item.donor_mobile || "मोबाईल नाही"}</span>
                            <span>•</span>
                            <span>📅 {formatReceiptDateTime(item.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border bg-slate-50 p-3 text-center text-muted-foreground">
                  समान नावाची इतर कोणतीही स्वतंत्र पावती नाही.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PROPERTY CONTEXT & BUILDING NAVIGATION */}
        {activeContextTab === "property" && (
          <div className="space-y-4 animate-in fade-in duration-150 text-xs">
            {propertyContext?.hasProperty ? (
              <>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h4 className="text-base font-black text-indigo-950 flex items-center gap-1.5">
                        <span>🏢</span>
                        <span>
                          {receipt.building_name}
                          {receipt.building_wing && ` (${receipt.building_wing})`}
                        </span>
                      </h4>
                      <p className="text-xs font-bold text-indigo-800 mt-0.5">
                        {receipt.property_type === "commercial" ? "गाळा क्र. " : "फ्लॅट क्र. "}
                        {receipt.unit_number || "—"}
                      </p>
                    </div>

                    <div className="text-right sm:self-center">
                      <span className="text-base font-black text-indigo-950">
                        ₹{propertyContext.propertyTotal.toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-indigo-700">या युनिटकडून एकूण</span>
                    </div>
                  </div>

                  {/* View Building Grid Action */}
                  <div className="pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        onNavigateToBuilding?.(
                          receipt.property_id || receipt.building_name || "",
                          receipt.property_id
                        )
                      }
                      className="w-full sm:w-auto text-xs font-bold bg-indigo-700 hover:bg-indigo-800 text-white min-h-[36px] shadow-xs cursor-pointer"
                    >
                      🏢 इमारतीचे ग्रिड पहा (View Building Grid →)
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    या इमारतीमधील इतर पावत्या (Receipts in this building/flat):
                  </label>

                  {propertyContext.propertyReceipts.map((item) => {
                    const isItemVoided = item.status === "voided" || Boolean(item.voided_at);
                    const isCurrent = item.id === receipt.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectReceiptFromContext(item)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          isCurrent
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <span>{item.receipt_prefix || receiptPrefix}{item.receipt_number}</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              — {item.donor_name}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-primary text-white font-bold">
                                सध्याची
                              </span>
                            )}
                            {isItemVoided && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-100 text-red-800 font-bold">
                                रद्द
                              </span>
                            )}
                          </div>
                          <div
                            className={`font-black ${
                              isItemVoided ? "line-through text-muted-foreground" : "text-emerald-700"
                            }`}
                          >
                            ₹{item.amount.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1">
                          <span>📅 {formatReceiptDateTime(item.created_at)}</span>
                          <span>•</span>
                          <span>👤 {item.volunteer_name || "Volunteer"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-xl border bg-slate-50 p-6 text-center space-y-2">
                <span className="text-3xl block">🏷️</span>
                <h4 className="text-sm font-bold text-foreground">
                  सामान्य / थेट देणगी (General / Ad-hoc Donation)
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  ही पावती थेट किंवा मंडपात तयार करण्यात आली असून कोणत्याही विशिष्ट इमारतीशी किंवा फ्लॅटशी जोडलेली नाही.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

