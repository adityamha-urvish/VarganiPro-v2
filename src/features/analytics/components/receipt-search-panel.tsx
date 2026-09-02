/**
 * Global Receipt Search Panel
 * Phase 9-4 Step 4C: Mobile-first multi-criteria receipt search & audit panel for Secretary/Admin
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatReceiptDateTime } from "../utils/whatsapp-share";
import { useReceiptSearch } from "../hooks/use-receipt-search";
import type { SearchReceiptItem } from "../services/receipt-search.service";
import type { LocalReceipt } from "@/lib/offline/offline-db";

export interface VolunteerOption {
  id: string;
  name: string;
}

export interface ReceiptSearchPanelProps {
  eventId: string | null;
  volunteers?: VolunteerOption[];
  onViewReceipt: (receipt: LocalReceipt | SearchReceiptItem) => void;
}

export function ReceiptSearchPanel({
  eventId,
  volunteers = [],
  onViewReceipt,
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
    receipts,
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

  const hasActiveFilter =
    query.trim().length > 0 ||
    paymentMode !== "all" ||
    status !== "all" ||
    volunteerId !== null;

  return (
    <div className="space-y-6">
      {/* -----------------------------------------------------------------
          1. HEADER
      ------------------------------------------------------------------ */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span>📜</span>
              <span>सर्व पावत्या शोधा (Search All Receipts)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              मंडळाच्या सर्व पावत्या, देणगीदार व फ्लॅटनुसार शोधा
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilter && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="text-xs font-semibold"
              >
                ↺ Clear
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={triggerSearch}
              disabled={loading || !eventId}
              className="text-xs font-bold bg-primary text-primary-foreground"
            >
              {loading ? "शोधत आहे..." : "🔍 शोधा (Search)"}
            </Button>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            2. SEARCH INPUT
        ------------------------------------------------------------------ */}
        <div className="relative">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 देणगीदार नाव, मोबाईल, पावती क्र., इमारत, फ्लॅट शोधा..."
            className="w-full text-sm rounded-xl py-2.5 pl-4 pr-10 min-h-[48px] bg-slate-50/70 focus:bg-white transition-all"
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

        {/* -----------------------------------------------------------------
            3. FILTER CHIPS
        ------------------------------------------------------------------ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
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
          4. ERROR / OFFLINE BANNER
      ------------------------------------------------------------------ */}
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
          5. RESULTS LIST
      ------------------------------------------------------------------ */}
      {loading && !hasSearched ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground space-y-3 shadow-xs">
          <span className="text-3xl animate-spin block">⏳</span>
          <p className="font-semibold">पावत्या शोधत आहे... (Searching receipts...)</p>
        </div>
      ) : !hasSearched ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground space-y-2 shadow-xs">
          <span className="text-4xl block">🔍</span>
          <h3 className="text-base font-bold text-foreground">
            पावती शोधण्यासाठी वरील सर्च बॉक्स वापरा
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            देणगीदाराचे नाव, मोबाईल नंबर, पावती क्रमांक किंवा फ्लॅट नंबर टाकून थेट शोधा.
          </p>
        </div>
      ) : receipts.length === 0 ? (
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
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-muted-foreground">
            <span>
              {totalCount} पैकी {receipts.length} पावत्या सापडल्या
            </span>
            <span>(Showing {receipts.length} of {totalCount})</span>
          </div>

          <div className="divide-y rounded-2xl border bg-card shadow-xs overflow-hidden">
            {receipts.map((r) => {
              const isVoided = r.status === "voided" || Boolean(r.voided_at);
              const receiptCode = `${r.receipt_prefix || "VP-"}${r.receipt_number}`;
              const formattedDate = formatReceiptDateTime(r.created_at);

              return (
                <div
                  key={r.id}
                  className={`p-4 sm:p-5 transition-colors ${
                    isVoided ? "bg-red-50/40" : "hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left: Identity & Donor */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-foreground">
                          {receiptCode}
                        </span>

                        {isVoided ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-red-100 text-red-800 border border-red-300">
                            रद्द (VOIDED)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            वैध (Valid)
                          </span>
                        )}

                        <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {r.payment_mode.replace("_", " ")}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-foreground">
                        {r.donor_name}
                        {r.donor_mobile && (
                          <span className="text-xs font-normal text-muted-foreground ml-2">
                            📱 {r.donor_mobile}
                          </span>
                        )}
                      </div>

                      {/* Location / Property */}
                      {(r.building_name || r.unit_number) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
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
                        {r.book_number && (
                          <>
                            <span>•</span>
                            <span>Book: {r.book_number}</span>
                          </>
                        )}
                      </p>

                      {/* Void Audit Metadata */}
                      {isVoided && (
                        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-900 space-y-0.5">
                          <p className="font-bold">
                            ⚠️ रद्द करण्याचे कारण: {r.void_reason || "—"}
                          </p>
                          {r.voided_by_name && (
                            <p className="text-[11px] text-red-700">
                              रद्द केले: {r.voided_by_name}{" "}
                              {r.voided_at &&
                                `(${formatReceiptDateTime(r.voided_at)})`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                      <div
                        className={`text-lg font-black ${
                          isVoided
                            ? "line-through text-muted-foreground"
                            : "text-emerald-700"
                        }`}
                      >
                        ₹{r.amount.toFixed(2)}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onViewReceipt({
                              id: r.id,
                              clientReceiptId: r.id,
                              organizationId: "",
                              eventId: r.collection_session_id,
                              collectionSessionId: r.collection_session_id,
                              receiptBookId: "",
                              volunteerId: r.volunteer_id,
                              propertyId: r.property_id,
                              receiptNumber: r.receipt_number,
                              amount: r.amount,
                              paymentMode: r.payment_mode as
                                | "cash"
                                | "upi"
                                | "cheque"
                                | "bank_transfer",
                              paymentReference: r.payment_reference,
                              donorName: r.donor_name,
                              donorMobile: r.donor_mobile,
                              notes: r.notes,
                              createdAt: r.created_at,
                              syncStatus: "synced",
                              syncAttempts: 1,
                              lastSyncError: null,
                              serverReceiptId: r.id,
                              status: r.status,
                              voidReason: r.void_reason,
                              voidedAt: r.voided_at,
                              voidedBy: r.voided_by_name,
                              buildingName: r.building_name,
                              buildingWing: r.building_wing,
                              unitNumber: r.unit_number,
                              propertyType: r.property_type,
                            } as unknown as LocalReceipt)
                          }
                          className="text-xs font-bold min-h-[38px] cursor-pointer"
                        >
                          👁️ पावती पहा (View)
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ---------------------------------------------------------------
              6. BOUNDED LOAD MORE BUTTON
          ---------------------------------------------------------------- */}
          {hasMore && (
            <div className="text-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={loadingMore}
                onClick={loadMore}
                className="w-full sm:w-auto min-h-[48px] px-8 text-xs font-bold shadow-xs cursor-pointer"
              >
                {loadingMore
                  ? "लोड होत आहे... (Loading...)"
                  : "⬇️ आणखी पावत्या पहा (Load More)"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
