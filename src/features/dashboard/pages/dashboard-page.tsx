import { useEffect, useState } from "react";

import {
  loadCurrentCollectionSession,
} from "@/features/collection/services/collection-session.service";
import type { LocalReceipt } from "@/lib/offline/offline-db";
import { setupAutoSync } from "@/lib/offline/receipt-sync";

import { AdminHandoverPanel } from "../components/admin-handover-panel";
import { BuildingFlatGrid } from "../components/building-flat-grid";
import { ContinueCollectionCard } from "../components/continue-collection-card";
import { FastReceiptModal } from "../components/fast-receipt-modal";
import { LastCreatedReceiptCard } from "../components/last-created-receipt-card";
import { PendingReasonDrawer } from "../components/pending-reason-drawer";
import { ReceiptCreationForm } from "../components/receipt-creation-form";
import { ReceiptHistoryPanel } from "../components/receipt-history-panel";
import { ReceiptPreviewDialog } from "../components/receipt-preview-dialog";
import { SessionSummaryCard } from "../components/session-summary-card";
import { StartCollectionCard } from "../components/start-collection-card";
import { ReadyToCollectScreen } from "../components/ready-to-collect-screen";
import { VolunteerHandoverCard } from "../components/volunteer-handover-card";
import { RoleNavigation, type NavigationTab } from "@/app/layouts/RoleNavigation";
import { VolunteerManagementPanel } from "@/features/admin/volunteers/components/volunteer-management-panel";
import { BuildingsManagementPanel } from "@/features/admin/master-data/components/buildings-management-panel";
import { SecretaryOverviewHero } from "@/features/analytics/components/secretary-overview-hero";
import { VolunteerFinancialLedger } from "@/features/analytics/components/volunteer-financial-ledger";
import { ReceiptSearchPanel } from "@/features/analytics/components/receipt-search-panel";
import { CampaignExportPanel } from "@/features/analytics/components/campaign-export-panel";
import { PavtiCustomizationPanel } from "@/features/pavti/components/pavti-customization-panel";
import { useSecretaryAnalytics } from "@/features/analytics/hooks/use-secretary-analytics";
import { useAdminHandovers } from "../hooks/use-admin-handovers";
import { useBuildingCollection } from "../hooks/use-building-collection";
import { useCloseSession } from "../hooks/use-close-session";
import { useDashboardBootstrap } from "../hooks/use-dashboard-bootstrap";
import { useReceiptCreation } from "../hooks/use-receipt-creation";
import { useReceiptHistory } from "../hooks/use-receipt-history";
import { useStartCollection } from "../hooks/use-start-collection";
import { useVolunteerHandover } from "../hooks/use-volunteer-handover";
import { printReceipt } from "../utils/print-receipt";
import { calculateReceiptAggregates } from "../utils/receipt-aggregates";

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<NavigationTab>("collection");
  const [receiptToView, setReceiptToView] =
    useState<LocalReceipt | null>(null);

  const {
    session,
    setSession,
    loading,
    isAdmin,
    organizationId,
    setOrganizationId,
    error,
    ensureOfflineBookState,
  } = useDashboardBootstrap({
    onSessionLoaded: async (activeSession) => {
      await loadReceiptHistory(activeSession.receiptBookId);
      await loadSessionHandover(activeSession.sessionId);
    },
  });

  const {
    adminHandovers,
    adminHandoverLoading,
    adminHandoverError,
    adminActionLoading,
    loadAdminHandovers,
    handleVerifyHandover,
    handleRejectHandover,
  } = useAdminHandovers({ isAdmin, organizationId });

  const {
    receipts,
    historyLoading,
    loadReceiptHistory,
    handleSyncNextReceipt,
  } = useReceiptHistory({
    receiptBookId: session?.receiptBookId,
    onSyncMessage: (msg) => setSyncMessage(msg),
  });

  const {
    propertyId,
    setPropertyId,
    donorName,
    donorMobile,
    amount,
    paymentMode,
    paymentReference,
    notes,
    creating,
    createError,
    setCreateError,
    createdReceipt,
    syncMessage,
    setSyncMessage,
    onDonorNameChange: setDonorName,
    onDonorMobileChange: setDonorMobile,
    onAmountChange: setAmount,
    onPaymentModeChange: setPaymentMode,
    onPaymentReferenceChange: setPaymentReference,
    onNotesChange: setNotes,
    handleCreateReceipt,
  } = useReceiptCreation({
    session,
    onReceiptHistoryRefresh: loadReceiptHistory,
    onReceiptCreated: (receipt) => {
      setSession((current) =>
        current
          ? {
              ...current,
              currentNumber: Math.max(
                current.currentNumber,
                receipt.receiptNumber + 1
              ),
            }
          : current
      );
    },
  });

  const {
    buildings,
    selectedBuilding,
    setSelectedBuilding,
    properties,
    selectedProperty,
    isFastReceiptOpen,
    setIsFastReceiptOpen,
    isPendingDrawerOpen,
    setIsPendingDrawerOpen,
    loadingBuildings,
    loadingProperties,
    fastReceiptCreating,
    fastReceiptError,
    loadBuildings,
    selectBuilding,
    openPropertyReceipt,
    startNextFlat,
    getNextProperty,
    submitFastReceipt,
    submitFollowUp,
  } = useBuildingCollection({
    session,
    onReceiptCreated: (receipt) => {
      setSession((current) =>
        current
          ? {
              ...current,
              currentNumber: Math.max(
                current.currentNumber,
                receipt.receiptNumber + 1
              ),
            }
          : current
      );
    },
    onReceiptHistoryRefresh: loadReceiptHistory,
  });

  useEffect(() => {
    if (!session?.receiptBookId) return;
    const unsubscribe = setupAutoSync(session.receiptBookId, undefined, () => {
      void loadReceiptHistory(session.receiptBookId);
    });
    return unsubscribe;
  }, [session?.receiptBookId, loadReceiptHistory]);

  const {
    handover,
    setHandover,
    creatingHandover,
    submittingHandover,
    actualCashAmount,
    setActualCashAmount,
    actualChequeAmount,
    setActualChequeAmount,
    authorizedExpenseAmount,
    setAuthorizedExpenseAmount,
    authorizedExpenseNote,
    setAuthorizedExpenseNote,
    discrepancyReason,
    setDiscrepancyReason,
    handoverNotes,
    setHandoverNotes,
    handoverMessage,
    handoverError,
    loadSessionHandover,
    handleCreateHandover,
    handleSubmitHandover,
  } = useVolunteerHandover({ session });

  const {
    issuedReceipts,
    pendingReceipts,
    conflictReceipts,
    totalAmount,
    cashAmount,
    upiAmount,
    chequeAmount,
    bankTransferAmount,
  } = calculateReceiptAggregates(receipts);

  const {
    closingSession,
    sessionCloseMessage,
    sessionCloseError,
    handleCloseSession,
  } = useCloseSession({
    session,
    pendingCount: pendingReceipts.length,
    conflictCount: conflictReceipts.length,
    receiptCount: issuedReceipts.length,
    totalAmount,
    onSessionCompleted: () => {
      setSession((current) =>
        current ? { ...current, sessionStatus: "completed" } : current
      );
    },
  });

  const {
    startSessionLoading,
    startSessionError,
    availableEvents,
    availableBooks,
    selectedEventId,
    setSelectedEventId,
    selectedBookId,
    setSelectedBookId,
    loadAvailableBooks,
    handleStartCollectionSession,
  } = useStartCollection({
    session,
    loading,
    isAdmin,
    organizationId,
    loadCurrentCollectionSession,
    onSessionStarted: async (newSession) => {
      setSession(newSession);
      setOrganizationId(newSession.organizationId);
      await ensureOfflineBookState(newSession);
      await loadReceiptHistory(newSession.receiptBookId);
      setHandover(null);
    },
  });

  const effectiveEventId =
    session?.eventId || selectedEventId || availableEvents[0]?.id || null;

  const {
    metrics: secretaryMetrics,
    ledger: secretaryLedger,
    loading: secretaryAnalyticsLoading,
    ledgerLoading: secretaryLedgerLoading,
    error: secretaryAnalyticsError,
    ledgerError: secretaryLedgerError,
    refreshOverview,
    refreshLedger,
  } = useSecretaryAnalytics({
    eventId: effectiveEventId,
    isAdmin,
  });

  function handlePrintReceipt(receipt: LocalReceipt) {
    const result = printReceipt(receipt, session);

    if (!result.success) {
      setCreateError(result.error);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>

        <p className="mt-3 text-muted-foreground">
          Loading collection session...
        </p>
      </div>
    );
  }

  if (error && !isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>

        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-700">
            Unable to initialize collection
            session
          </p>

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!session && !isAdmin) {
    return (
      <ReadyToCollectScreen
        idPrefix="start"
        events={availableEvents}
        books={availableBooks}
        selectedEventId={selectedEventId}
        selectedBookId={selectedBookId}
        loading={startSessionLoading}
        error={startSessionError}
        onEventChange={(value) => {
          setSelectedEventId(value);
          void loadAvailableBooks(value);
        }}
        onBookChange={(value) => setSelectedBookId(value)}
        onStartCollection={() => void handleStartCollectionSession()}
      />
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-28 sm:pb-12">
      <RoleNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        pendingSyncCount={pendingReceipts.length}
      />

      {/* -------------------------------------------------------------
          TAB 1: COLLECTION (DEFAULT & PRIMARY WORKFLOW)
      -------------------------------------------------------------- */}
      {activeTab === "collection" && (
        <div className="space-y-6 animate-in fade-in">
          {isAdmin && (
            <SecretaryOverviewHero
              metrics={secretaryMetrics}
              loading={secretaryAnalyticsLoading}
              error={secretaryAnalyticsError}
              onRefresh={() => void refreshOverview()}
              onReviewHandovers={() => setActiveTab("handovers")}
            />
          )}

          {isAdmin && (
            <AdminHandoverPanel
              handovers={adminHandovers}
              loading={adminHandoverLoading}
              error={adminHandoverError}
              actionLoadingId={adminActionLoading}
              onRefresh={() => void loadAdminHandovers()}
              onVerifyHandover={(id) => void handleVerifyHandover(id)}
              onRejectHandover={(id, reason) =>
                void handleRejectHandover(id, reason)
              }
            />
          )}

          {!session && isAdmin && (
            <StartCollectionCard
              idPrefix="admin-start"
              events={availableEvents}
              books={availableBooks}
              selectedEventId={selectedEventId}
              selectedBookId={selectedBookId}
              loading={startSessionLoading}
              error={startSessionError}
              onEventChange={(value) => {
                setSelectedEventId(value);
                void loadAvailableBooks(value);
              }}
              onBookChange={(value) => setSelectedBookId(value)}
              onStartCollection={() => void handleStartCollectionSession()}
            />
          )}

          {session && (
            <>
              <SessionSummaryCard
                session={session}
                receiptCount={issuedReceipts.length}
                totalAmount={totalAmount}
                pendingCount={pendingReceipts.length}
                conflictCount={conflictReceipts.length}
                cashAmount={cashAmount}
                upiAmount={upiAmount}
                chequeAmount={chequeAmount}
                bankTransferAmount={bankTransferAmount}
                closingSession={closingSession}
                sessionCloseError={sessionCloseError}
                sessionCloseMessage={sessionCloseMessage}
                onCloseSession={() => void handleCloseSession()}
              />

      {/* ----------------------------------------
          PHASE 9-2B: CONTINUE COLLECTION & FLAT GRID
      ----------------------------------------- */}

      {session.sessionStatus === "open" && (
        <>
          {!selectedBuilding ? (
            <ContinueCollectionCard
              buildings={buildings}
              loading={loadingBuildings}
              onSelectBuilding={(b) => void selectBuilding(b)}
              onRefresh={() => void loadBuildings()}
            />
          ) : (
            <BuildingFlatGrid
              building={selectedBuilding}
              properties={properties}
              loading={loadingProperties}
              onBack={() => setSelectedBuilding(null)}
              onSelectProperty={openPropertyReceipt}
              onStartNextFlat={startNextFlat}
            />
          )}

          <FastReceiptModal
            isOpen={isFastReceiptOpen}
            buildingName={selectedBuilding?.buildingName || ""}
            property={selectedProperty}
            nextProperty={getNextProperty(selectedProperty?.propertyId)}
            currentReceiptNumber={session.currentNumber}
            startNumber={session.startNumber}
            endNumber={session.endNumber}
            creating={fastReceiptCreating}
            createError={fastReceiptError}
            onClose={() => setIsFastReceiptOpen(false)}
            onNavigateToCloseSession={() => {
              setActiveTab("collection");
              setSelectedBuilding(null);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            onSubmitReceipt={submitFastReceipt}
            onOpenPendingDrawer={() => setIsPendingDrawerOpen(true)}
          />

          <PendingReasonDrawer
            unitNumber={selectedProperty?.unitNumber || ""}
            isOpen={isPendingDrawerOpen}
            onClose={() => setIsPendingDrawerOpen(false)}
            onSubmitReason={(reason, time, notes) => void submitFollowUp(reason, time, notes)}
          />
        </>
      )}

      {/* ----------------------------------------
          COLLECTION HANDOVER
      ----------------------------------------- */}

      {session.sessionStatus === "completed" && (
        <VolunteerHandoverCard
          handover={handover}
          creatingHandover={creatingHandover}
          submittingHandover={submittingHandover}
          actualCashAmount={actualCashAmount}
          actualChequeAmount={actualChequeAmount}
          authorizedExpenseAmount={authorizedExpenseAmount}
          authorizedExpenseNote={authorizedExpenseNote}
          discrepancyReason={discrepancyReason}
          handoverNotes={handoverNotes}
          handoverError={handoverError}
          handoverMessage={handoverMessage}
          onCreateHandover={() => void handleCreateHandover()}
          onSubmitHandover={() => void handleSubmitHandover()}
          onActualCashAmountChange={setActualCashAmount}
          onActualChequeAmountChange={setActualChequeAmount}
          onAuthorizedExpenseAmountChange={setAuthorizedExpenseAmount}
          onAuthorizedExpenseNoteChange={setAuthorizedExpenseNote}
          onDiscrepancyReasonChange={setDiscrepancyReason}
          onHandoverNotesChange={setHandoverNotes}
        />
      )}

      {/* ----------------------------------------
          LAST CREATED RECEIPT
      ----------------------------------------- */}

      <LastCreatedReceiptCard
        receipt={createdReceipt}
        onViewReceipt={(receipt) => setReceiptToView(receipt)}
        onPrintReceipt={(receipt) => handlePrintReceipt(receipt)}
      />

      {/* ----------------------------------------
          SYNC MESSAGE
      ----------------------------------------- */}

      {syncMessage && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-sm">
            {syncMessage}
          </p>
        </div>
      )}

      {/* ----------------------------------------
          START NEXT COLLECTION
      ----------------------------------------- */}

      {session.sessionStatus === "completed" && (
        <StartCollectionCard
          title="Start New Collection"
          description="Your previous collection is completed. Start a new session with an available receipt book."
          idPrefix="next"
          events={availableEvents}
          books={availableBooks}
          selectedEventId={selectedEventId}
          selectedBookId={selectedBookId}
          loading={startSessionLoading}
          error={startSessionError}
          onEventChange={(value) => {
            setSelectedEventId(value);
            void loadAvailableBooks(value);
          }}
          onBookChange={(value) => setSelectedBookId(value)}
          onStartCollection={() => void handleStartCollectionSession()}
        />
      )}

      {/* ----------------------------------------
          NEW RECEIPT
      ----------------------------------------- */}

      <ReceiptCreationForm
        propertyId={propertyId}
        properties={properties}
        donorName={donorName}
        donorMobile={donorMobile}
        amount={amount}
        paymentMode={paymentMode}
        paymentReference={paymentReference}
        notes={notes}
        creating={creating}
        createError={createError}
        sessionStatus={session.sessionStatus}
        currentReceiptNumber={session.currentNumber}
        startNumber={session.startNumber}
        endNumber={session.endNumber}
        onNavigateToCloseSession={() => {
          setActiveTab("collection");
          setSelectedBuilding(null);
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        onPropertyIdChange={setPropertyId}
        onDonorNameChange={setDonorName}
        onDonorMobileChange={setDonorMobile}
        onAmountChange={setAmount}
        onPaymentModeChange={setPaymentMode}
        onPaymentReferenceChange={setPaymentReference}
        onNotesChange={setNotes}
        onSubmit={handleCreateReceipt}
      />

      {/* ----------------------------------------
          RECEIPT HISTORY / SYNC QUEUE
      ----------------------------------------- */}

              <ReceiptHistoryPanel
                receipts={receipts}
                receiptPrefix={session.prefix}
                sessionStatus={session.sessionStatus}
                loading={historyLoading}
                onRefresh={() => void loadReceiptHistory(session.receiptBookId)}
                onSyncNext={() => void handleSyncNextReceipt()}
                onViewReceipt={(receipt) => setReceiptToView(receipt)}
                onPrintReceipt={(receipt) => handlePrintReceipt(receipt)}
              />
            </>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: HANDOVERS (ADMIN VERIFICATION & VOLUNTEER SUBMISSION)
      -------------------------------------------------------------- */}
      {activeTab === "handovers" && (
        <div className="space-y-6 animate-in fade-in">
          {isAdmin ? (
            <>
              <VolunteerFinancialLedger
                ledger={secretaryLedger}
                loading={secretaryLedgerLoading}
                error={secretaryLedgerError}
                onRefresh={() => void refreshLedger()}
              />
              <AdminHandoverPanel
                handovers={adminHandovers}
                loading={adminHandoverLoading}
                error={adminHandoverError}
                actionLoadingId={adminActionLoading}
                onRefresh={() => {
                  void loadAdminHandovers();
                  void refreshLedger();
                }}
                onVerifyHandover={(id) => void handleVerifyHandover(id)}
                onRejectHandover={(id, reason) =>
                  void handleRejectHandover(id, reason)
                }
              />
            </>
          ) : session && session.sessionStatus === "completed" ? (
            <VolunteerHandoverCard
              handover={handover}
              creatingHandover={creatingHandover}
              submittingHandover={submittingHandover}
              actualCashAmount={actualCashAmount}
              actualChequeAmount={actualChequeAmount}
              authorizedExpenseAmount={authorizedExpenseAmount}
              authorizedExpenseNote={authorizedExpenseNote}
              discrepancyReason={discrepancyReason}
              handoverNotes={handoverNotes}
              handoverError={handoverError}
              handoverMessage={handoverMessage}
              onCreateHandover={() => void handleCreateHandover()}
              onSubmitHandover={() => void handleSubmitHandover()}
              onActualCashAmountChange={setActualCashAmount}
              onActualChequeAmountChange={setActualChequeAmount}
              onAuthorizedExpenseAmountChange={setAuthorizedExpenseAmount}
              onAuthorizedExpenseNoteChange={setAuthorizedExpenseNote}
              onDiscrepancyReasonChange={setDiscrepancyReason}
              onHandoverNotesChange={setHandoverNotes}
            />
          ) : (
            <div className="rounded-2xl border bg-card p-8 text-center space-y-3 shadow-xs">
              <span className="text-4xl block">🤝</span>
              <h3 className="text-lg font-bold text-foreground">Session Handover</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {session
                  ? "Your current session is still active. When finished collecting, close your session on the Collection tab to submit your cash and UPI totals for verification."
                  : "No active or completed session found to handover. Start a collection session to collect Vargani."}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("collection")}
                className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline cursor-pointer pt-2"
              >
                <span>⚡ Go to Collection</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 3: RECEIPTS HISTORY & GLOBAL SEARCH
      -------------------------------------------------------------- */}
      {activeTab === "history" && (
        <div className="space-y-6 animate-in fade-in">
          {isAdmin ? (
            <ReceiptSearchPanel
              eventId={session?.eventId || null}
              onViewReceipt={(receipt) =>
                setReceiptToView(receipt as LocalReceipt)
              }
            />
          ) : (
            <>
              <LastCreatedReceiptCard
                receipt={createdReceipt}
                onViewReceipt={(receipt) => setReceiptToView(receipt)}
                onPrintReceipt={(receipt) => handlePrintReceipt(receipt)}
              />

              <ReceiptHistoryPanel
                receipts={receipts}
                receiptPrefix={session?.prefix || "VP-"}
                sessionStatus={session?.sessionStatus || "open"}
                loading={historyLoading}
                onRefresh={() => {
                  if (session?.receiptBookId) {
                    void loadReceiptHistory(session.receiptBookId);
                  }
                }}
                onSyncNext={() => void handleSyncNextReceipt()}
                onViewReceipt={(receipt) => setReceiptToView(receipt)}
                onPrintReceipt={(receipt) => handlePrintReceipt(receipt)}
              />
            </>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: VOLUNTEER MANAGEMENT (ADMIN)
      -------------------------------------------------------------- */}
      {activeTab === "volunteers" && organizationId && (
        <div className="animate-in fade-in">
          <VolunteerManagementPanel organizationId={organizationId} />
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: MASTER DATA (BUILDINGS, FLATS & SHOPS)
      -------------------------------------------------------------- */}
      {activeTab === "masterData" && organizationId && (
        <div className="animate-in fade-in">
          <BuildingsManagementPanel organizationId={organizationId} />
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: MORE & SETTINGS
      -------------------------------------------------------------- */}
      {activeTab === "more" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b">
              <span className="text-3xl">⚙️</span>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {isAdmin ? "Mandal Secretary Administration" : "App & Session Information"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  System state, offline data health, and active book details
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl bg-slate-50 border p-4">
                <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">Active Event</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">Ganesh Utsav 2026</span>
              </div>
              <div className="rounded-xl bg-slate-50 border p-4">
                <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">Your Role</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">
                  {isAdmin ? "👑 Mandal Secretary / Admin" : "👤 Collection Volunteer"}
                </span>
              </div>
              {session && (
                <div className="rounded-xl bg-slate-50 border p-4">
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">Assigned Book</span>
                  <span className="text-sm font-bold text-foreground mt-0.5 block">
                    {session.bookNumber} ({session.prefix}{session.startNumber}..{session.endNumber})
                  </span>
                </div>
              )}
              <div className="rounded-xl bg-slate-50 border p-4">
                <span className="font-semibold text-muted-foreground block text-[11px] uppercase tracking-wider">Offline Sync Status</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">
                  {pendingReceipts.length === 0 ? "✓ All local receipts synchronized" : `⚠️ ${pendingReceipts.length} pending local receipts`}
                </span>
              </div>
            </div>
          </div>

          {/* Campaign Export & Reports Center (Admin / Secretary Only) */}
          {isAdmin && (
            <>
              {/* Pavti Design Setup & Customization */}
              <PavtiCustomizationPanel
                organizationId={organizationId}
                defaultMandalName="श्री गणेश मित्र मंडळ"
                defaultEventName="सार्वजनिक गणेशोत्सव २०२६"
              />

              <CampaignExportPanel
                eventId={session?.eventId || null}
                eventName="Ganesh Utsav 2026"
              />
            </>
          )}
        </div>
      )}

      {/* Global Preview Modal */}
      <ReceiptPreviewDialog
        receipt={receiptToView}
        receiptPrefix={session?.prefix || "VP-"}
        bookNumber={session?.bookNumber || ""}
        isAdmin={isAdmin}
        onClose={() => setReceiptToView(null)}
        onPrint={handlePrintReceipt}
        onReceiptVoided={() => {
          void refreshOverview();
          void refreshLedger();
          if (session?.receiptBookId) {
            void loadReceiptHistory(session.receiptBookId);
          }
        }}
      />

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          .receipt-print-area,
          .receipt-print-area * {
            visibility: visible !important;
          }

          .receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
