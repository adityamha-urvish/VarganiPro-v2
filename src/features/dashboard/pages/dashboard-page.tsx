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
import { VolunteerHandoverCard } from "../components/volunteer-handover-card";
import { VolunteerHome } from "../components/volunteer-home";
import { MandalHomeScreen } from "../components/mandal-home-screen";
import { BuildingsCollectionScreen } from "../components/buildings-collection-screen";
import { RoleNavigation, type NavigationTab } from "@/app/layouts/RoleNavigation";
import { VolunteerManagementPanel } from "@/features/admin/volunteers/components/volunteer-management-panel";
import { BuildingsManagementPanel } from "@/features/admin/master-data/components/buildings-management-panel";
import { createBuilding } from "@/features/admin/master-data/services/master-data.service";
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
import { useDashboardNavigation } from "../hooks/use-dashboard-navigation";
import { useVolunteerHandover } from "../hooks/use-volunteer-handover";
import { printReceipt } from "../utils/print-receipt";
import { calculateReceiptAggregates } from "../utils/receipt-aggregates";

export function DashboardPage() {
  const nav = useDashboardNavigation();
  const activeTab: NavigationTab =
    nav.tab === "buildings" ? "masterData" : nav.tab;
  const collectionMode = nav.mode === "collect";

  const [volunteerSubView, setVolunteerSubView] = useState<"home" | "buildings" | "history" | "handover" | "session">("home");
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
    setSelectedProperty,
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
    addPropertyDirect,
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

  // Sync nav.buildingId with selectedBuilding
  useEffect(() => {
    if (nav.buildingId && buildings.length > 0) {
      if (selectedBuilding?.buildingId !== nav.buildingId) {
        const found = buildings.find((b) => b.buildingId === nav.buildingId);
        if (found) {
          void selectBuilding(found);
        }
      }
    } else if (!nav.buildingId && selectedBuilding) {
      setSelectedBuilding(null);
    }
  }, [nav.buildingId, buildings, selectedBuilding, selectBuilding, setSelectedBuilding]);

  // Sync nav.flatId with selectedProperty & isFastReceiptOpen
  useEffect(() => {
    if (nav.flatId && properties.length > 0) {
      if (selectedProperty?.propertyId !== nav.flatId) {
        const found = properties.find((p) => p.propertyId === nav.flatId);
        if (found) {
          openPropertyReceipt(found);
        }
      }
    } else if (!nav.flatId && isFastReceiptOpen) {
      setIsFastReceiptOpen(false);
      setSelectedProperty(null);
    }
  }, [nav.flatId, properties, selectedProperty, isFastReceiptOpen, openPropertyReceipt, setIsFastReceiptOpen, setSelectedProperty]);

  function handleTabChange(tab: NavigationTab) {
    setIsFastReceiptOpen(false);
    setSelectedProperty(null);
    setSelectedBuilding(null);
    if (tab === "collection") {
      nav.resetToHome();
      setVolunteerSubView("home");
    } else if (tab === "masterData" || tab === "buildings") {
      nav.setTab("masterData");
    } else {
      nav.setTab(tab);
    }
  }

  function handleSelectBuilding(b: typeof selectedBuilding) {
    if (!b) return;
    void selectBuilding(b);
    nav.selectBuildingId(b.buildingId);
  }

  function handleBackFromBuilding() {
    setSelectedBuilding(null);
    nav.selectBuildingId(null);
  }

  function handleSelectProperty(p: typeof selectedProperty) {
    if (!p) return;
    openPropertyReceipt(p);
    nav.selectFlatId(p.propertyId);
  }

  function handleCloseFastReceipt() {
    setIsFastReceiptOpen(false);
    setSelectedProperty(null);
    nav.selectFlatId(null);
  }

  function handleBackToDashboard() {
    setSelectedBuilding(null);
    setSelectedProperty(null);
    setIsFastReceiptOpen(false);
    nav.resetToHome();
    setVolunteerSubView("home");
  }

  useEffect(() => {
    if (!session?.receiptBookId) return;
    const unsubscribe = setupAutoSync(session.receiptBookId, undefined, () => {
      void loadReceiptHistory(session.receiptBookId);
    });
    return unsubscribe;
  }, [session?.receiptBookId, loadReceiptHistory]);

  useEffect(() => {
    if (isAdmin && organizationId) {
      void loadBuildings();
    }
  }, [isAdmin, organizationId, loadBuildings]);

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
      nav.openCollectMode();
    },
  });

  const effectiveEventId =
    session?.eventId || selectedEventId || availableEvents[0]?.id || null;

  const {
    metrics: secretaryMetrics,
    ledger: secretaryLedger,
    ledgerLoading: secretaryLedgerLoading,
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Role Navigation (Desktop tabs for all, Mobile bottom bar for Admin) */}
      <RoleNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isAdmin={isAdmin}
        pendingSyncCount={pendingReceipts.length}
      />

      {/* -------------------------------------------------------------
          TAB 1: COLLECTION (DEFAULT & PRIMARY WORKFLOW)
      -------------------------------------------------------------- */}
      {activeTab === "collection" && (
        <div className="space-y-6 animate-in fade-in">
          {/* SHARED MANDAL HOME SCREEN (WHEN NOT IN ACTIVE FIELD COLLECTION WORKSPACE) */}
          {!collectionMode && (
            <>
              <MandalHomeScreen
                userName={isAdmin ? "Mandal Secretary" : "Volunteer"}
                mandalName="श्री गणेश मित्र मंडळ"
                eventName={availableEvents.find((e) => e.id === effectiveEventId)?.name || "Ganesh Utsav 2026"}
                eventCode={availableEvents.find((e) => e.id === effectiveEventId)?.code || "GU-26"}
                eventDates="10 Sep – 20 Sep 2026"
                eventProgressPct={secretaryMetrics?.property_progress?.completion_percentage ?? 68}
                sessionBookNumber={session?.bookNumber}
                sessionReceiptNumber={session ? `${session.prefix || "VP-"}${session.currentNumber}` : undefined}
                sessionStatus={session?.sessionStatus}
                totalAmount={totalAmount || secretaryMetrics?.today?.total_amount || 0}
                cashAmount={cashAmount || secretaryMetrics?.today?.cash_amount || 0}
                upiAmount={upiAmount || secretaryMetrics?.today?.upi_amount || 0}
                receiptCount={issuedReceipts.length || secretaryMetrics?.today?.receipt_count || 0}
                isLive={true}
                isAdmin={isAdmin}
                hasActiveSession={Boolean(session && session.sessionStatus === "open")}
                pendingSyncCount={pendingReceipts.length}
                onStartCollection={() => {
                  setIsFastReceiptOpen(false);
                  setSelectedProperty(null);
                  nav.openCollectMode(session && session.sessionStatus === "open" && selectedBuilding ? selectedBuilding.buildingId : null);
                  if (session && session.sessionStatus === "open" && !selectedBuilding) {
                    setVolunteerSubView("buildings");
                  } else {
                    setVolunteerSubView("home");
                  }
                }}
                onStartGeneralReceipt={() => {
                  setIsFastReceiptOpen(false);
                  setSelectedProperty(null);
                  setSelectedBuilding(null);
                  nav.openCollectMode(null);
                }}
                onNavigateTab={(tab) => handleTabChange(tab)}
                onNavigateToHistory={() => handleTabChange("history")}
                onNavigateToHandover={() => handleTabChange("handovers")}
                onNavigateToBooks={() => {
                  nav.setTab("masterData");
                }}
                onNavigateToSessionDetails={() => {
                  nav.openCollectMode();
                  setVolunteerSubView("session");
                }}
                onChangeBuilding={() => {
                  nav.setTab("masterData");
                }}
              />
            </>
          )}

          {/* FOCUSED COLLECTION MODE WORKSPACE */}
          {collectionMode && (
            <>
              {/* ADMIN IN ACTIVE COLLECTION MODE */}
              {isAdmin && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <button
                      type="button"
                      data-testid="admin-back-dashboard"
                      onClick={handleBackToDashboard}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                    >
                      <span>←</span>
                      <span>Dashboard (मुख्य पृष्ठ)</span>
                    </button>
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                      👑 Secretary Collection Mode
                    </span>
                  </div>

                  {!session && (
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
                </div>
              )}

              {/* VOLUNTEER FIELD VIEW */}
              {!isAdmin && (
                <>
                  {/* SUBVIEW: HOME (FOCUSED ZERO-SCROLL VOLUNTEER WORKSPACE) */}
                  {volunteerSubView === "home" && !selectedBuilding && (
                    <VolunteerHome
                      session={session}
                      selectedBuilding={selectedBuilding}
                      todayAmount={totalAmount}
                      receiptCount={issuedReceipts.length}
                      houseCount={0}
                      pendingSyncCount={pendingReceipts.length}
                      isOnline={true}
                      onBackToHome={handleBackToDashboard}
                      onOpenCollect={() => {
                        if (selectedBuilding) {
                          setIsFastReceiptOpen(true);
                        } else {
                          setVolunteerSubView("buildings");
                        }
                      }}
                      onChangeBuilding={() => setVolunteerSubView("buildings")}
                      onNavigateToHistory={() => setVolunteerSubView("history")}
                      onNavigateToHandover={() => setVolunteerSubView("handover")}
                      onNavigateToSessionDetails={() => setVolunteerSubView("session")}
                      onStartCollection={() => void handleStartCollectionSession()}
                      events={availableEvents}
                      books={availableBooks}
                      selectedEventId={selectedEventId}
                      selectedBookId={selectedBookId}
                      onEventChange={(value) => {
                        setSelectedEventId(value);
                        void loadAvailableBooks(value);
                      }}
                      onBookChange={(value) => setSelectedBookId(value)}
                      startSessionLoading={startSessionLoading}
                      startSessionError={startSessionError}
                    />
                  )}

                  {/* SUBVIEW: BUILDINGS & CORRIDOR */}
                  {(volunteerSubView === "buildings" || (volunteerSubView === "home" && selectedBuilding)) && (
                    <div className="space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between pb-2 border-b">
                        <button
                          type="button"
                          data-testid="volunteer-back-home"
                          onClick={() => {
                            if (selectedBuilding) {
                              handleBackFromBuilding();
                            } else {
                              handleBackToDashboard();
                            }
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                        >
                          <span>←</span>
                          <span>मुख्य पृष्ठ (Home)</span>
                        </button>
                        {selectedBuilding && (
                          <span className="text-xs font-black text-slate-900 truncate max-w-[200px]">
                            🏢 {selectedBuilding.buildingName}
                          </span>
                        )}
                      </div>

                      {!selectedBuilding ? (
                        <>
                          <ContinueCollectionCard
                            buildings={buildings}
                            loading={loadingBuildings}
                            hasActiveSession={Boolean(session && session.sessionStatus === "open")}
                            onSelectBuilding={(b) => handleSelectBuilding(b)}
                            onRefresh={() => void loadBuildings()}
                            onStartSession={() => {
                              setVolunteerSubView("home");
                            }}
                          />

                          {session && (
                            <ReceiptCreationForm
                              propertyId={propertyId}
                              properties={properties}
                              buildings={buildings}
                              selectedBuildingId={null}
                              onBuildingIdChange={(bId) => {
                                if (!bId) {
                                  setSelectedBuilding(null);
                                  setPropertyId(null);
                                } else {
                                  const found = buildings.find((b) => b.buildingId === bId);
                                  if (found) {
                                    handleSelectBuilding(found);
                                  }
                                }
                              }}
                              onAddBuilding={async (name, wing) => {
                                if (!organizationId) return;
                                const res = await createBuilding({
                                  organizationId,
                                  name,
                                  wing,
                                });
                                await loadBuildings();
                                return res.buildingId;
                              }}
                              onAddProperty={async (input) => {
                                if (!selectedBuilding) return;
                                const p = await addPropertyDirect(input);
                                return p?.propertyId;
                              }}
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
                                setVolunteerSubView("session");
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
                          )}

                          <LastCreatedReceiptCard
                            receipt={createdReceipt}
                            onViewReceipt={(receipt) => setReceiptToView(receipt)}
                            onPrintReceipt={(receipt) => handlePrintReceipt(receipt)}
                          />

                          {syncMessage && (
                            <div className="rounded-lg border bg-muted/40 p-4">
                              <p className="text-sm">{syncMessage}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <BuildingFlatGrid
                          building={selectedBuilding}
                          properties={properties}
                          loading={loadingProperties}
                          onBack={handleBackFromBuilding}
                          onSelectProperty={(p) => handleSelectProperty(p)}
                          onStartNextFlat={startNextFlat}
                          onAddProperty={addPropertyDirect}
                        />
                      )}
                    </div>
                  )}

                  {/* SUBVIEW: HISTORY */}
                  {volunteerSubView === "history" && (
                    <div className="space-y-4 animate-in fade-in">
                      <div className="pb-2 border-b">
                        <button
                          type="button"
                          onClick={() => setVolunteerSubView("home")}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                        >
                          <span>←</span>
                          <span>मुख्य पृष्ठ (Home)</span>
                        </button>
                      </div>

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
                    </div>
                  )}

                  {/* SUBVIEW: HANDOVER */}
                  {volunteerSubView === "handover" && (
                    <div className="space-y-4 animate-in fade-in">
                      <div className="pb-2 border-b">
                        <button
                          type="button"
                          onClick={() => setVolunteerSubView("home")}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                        >
                          <span>←</span>
                          <span>मुख्य पृष्ठ (Home)</span>
                        </button>
                      </div>

                      {session && session.sessionStatus === "completed" ? (
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
                          unsyncedCount={pendingReceipts.length}
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
                        <div className="rounded-2xl border bg-white p-6 text-center space-y-3 shadow-xs">
                          <span className="text-4xl block">🤝</span>
                          <h3 className="text-base font-bold text-slate-900 font-brand-marathi">
                            सत्र हस्तांतरण · Handover
                          </h3>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            {session
                              ? "तुमचे सध्याचे संकलन सत्र चालू आहे. संकलन पूर्ण झाल्यावर सत्र समाप्त करून रोख रक्कम जमा करा."
                              : "कोणतेही पूर्ण झालेले सत्र सापडले नाही."}
                          </p>
                          {session && session.sessionStatus === "open" && (
                            <button
                              type="button"
                              onClick={() => setVolunteerSubView("session")}
                              className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:underline cursor-pointer pt-1"
                            >
                              <span>⚙️ सत्र तपशील आणि बंद करा</span>
                              <span>→</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBVIEW: SESSION DETAILS & CLOSE */}
                  {volunteerSubView === "session" && session && (
                    <div className="space-y-4 animate-in fade-in">
                      <div className="pb-2 border-b">
                        <button
                          type="button"
                          onClick={() => setVolunteerSubView("home")}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                        >
                          <span>←</span>
                          <span>मुख्य पृष्ठ (Home)</span>
                        </button>
                      </div>

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

                      <ReceiptCreationForm
                        propertyId={propertyId}
                        properties={properties}
                        buildings={buildings}
                        selectedBuildingId={selectedBuilding?.buildingId || null}
                        onBuildingIdChange={(bId) => {
                          if (!bId) {
                            setSelectedBuilding(null);
                            setPropertyId(null);
                          } else {
                            const found = buildings.find((b) => b.buildingId === bId);
                            if (found) {
                              void selectBuilding(found);
                            }
                          }
                        }}
                        onAddBuilding={async (name, wing) => {
                          if (!organizationId) return;
                          const res = await createBuilding({
                            organizationId,
                            name,
                            wing,
                          });
                          await loadBuildings();
                          return res.buildingId;
                        }}
                        onAddProperty={async (input) => {
                          if (!selectedBuilding) return;
                          const p = await addPropertyDirect(input);
                          return p?.propertyId;
                        }}
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
                          setVolunteerSubView("session");
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
                    </div>
                  )}
                </>
              )}

              {/* ADMIN ACTIVE SESSION WORKFLOW */}
              {isAdmin && session && (
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
                          onAddProperty={addPropertyDirect}
                        />
                      )}
                    </>
                  )}

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

                  <ReceiptCreationForm
                    propertyId={propertyId}
                    properties={properties}
                    buildings={buildings}
                    selectedBuildingId={selectedBuilding?.buildingId || null}
                    onBuildingIdChange={(bId) => {
                      if (!bId) {
                        setSelectedBuilding(null);
                        setPropertyId(null);
                      } else {
                        const found = buildings.find((b) => b.buildingId === bId);
                        if (found) {
                          void selectBuilding(found);
                        }
                      }
                    }}
                    onAddBuilding={async (name, wing) => {
                      if (!organizationId) return;
                      const res = await createBuilding({
                        organizationId,
                        name,
                        wing,
                      });
                      await loadBuildings();
                      return res.buildingId;
                    }}
                    onAddProperty={async (input) => {
                      if (!selectedBuilding) return;
                      const p = await addPropertyDirect(input);
                      return p?.propertyId;
                    }}
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
                      setSelectedBuilding(null);
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
                onClick={() => handleTabChange("collection")}
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
              onNavigateToBuilding={(buildingId) => {
                handleTabChange("collection");
                const b = buildings.find(
                  (item) => item.buildingId === buildingId || item.buildingName === buildingId
                );
                if (b) {
                  handleSelectBuilding(b);
                }
              }}
              receiptPrefix={session?.prefix || "VP-"}
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
      {activeTab === "masterData" && (
        <div className="animate-in fade-in">
          {isAdmin && organizationId ? (
            <BuildingsManagementPanel
              organizationId={organizationId}
              eventId={effectiveEventId}
              onStartCollection={(b, p) => {
                nav.openCollectMode(b.id);
                handleSelectBuilding({
                  buildingId: b.id,
                  eventId: session?.eventId || "",
                  organizationId,
                  buildingName: b.name,
                  code: b.code || null,
                  wing: b.wing || null,
                  areaName: b.areaName || null,
                  totalUnits: 0,
                  collectedCount: 0,
                  pendingCount: 0,
                  refusedCount: 0,
                  notVisitedCount: 0,
                  remainingCount: 0,
                  totalAmountCollected: 0,
                  lastActivityAt: null,
                  cachedAt: new Date().toISOString(),
                });
                if (p) {
                  handleSelectProperty({
                    propertyId: p.id,
                    buildingId: b.id,
                    eventId: session?.eventId || "",
                    organizationId,
                    propertyType: p.propertyType || "flat",
                    unitNumber: p.unitNumber || p.flatNumber || "",
                    flatNumber: p.flatNumber || p.unitNumber || "",
                    floorNumber: p.floorNumber ?? null,
                    shopName: p.shopName || null,
                    ownerName: p.ownerName ?? null,
                    contactMobile: p.contactMobile ?? null,
                    status: "not_visited",
                    receiptCount: 0,
                    totalCollectedAmount: 0,
                    latestReceiptNumber: null,
                    lastReceiptAt: null,
                    pendingReason: null,
                    followUpTime: null,
                    followUpNotes: null,
                    followUpAt: null,
                    cachedAt: new Date().toISOString(),
                  });
                }
              }}
              onStartGeneralReceipt={() => {
                setSelectedBuilding(null);
                nav.openCollectMode(null);
              }}
            />
          ) : !selectedBuilding ? (
            <BuildingsCollectionScreen
              buildings={buildings}
              loading={loadingBuildings}
              eventCode={availableEvents.find((e) => e.id === effectiveEventId)?.code || "GU-26"}
              onSelectBuilding={(b) => handleSelectBuilding(b)}
              onViewFlats={(b) => handleSelectBuilding(b)}
              onOpenCollect={(b) => {
                handleSelectBuilding(b);
                setIsFastReceiptOpen(true);
              }}
              onRefresh={() => void loadBuildings()}
              onStartCollection={() => {
                nav.openCollectMode();
              }}
              isAdmin={false}
            />
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <BuildingFlatGrid
                building={selectedBuilding}
                properties={properties}
                loading={loadingProperties}
                onBack={handleBackFromBuilding}
                onSelectProperty={(p) => handleSelectProperty(p)}
                onStartNextFlat={startNextFlat}
                onAddProperty={addPropertyDirect}
              />
            </div>
          )}
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

      {/* Global Fast Receipt Modal */}
      <FastReceiptModal
        isOpen={isFastReceiptOpen}
        buildingName={selectedBuilding?.buildingName || ""}
        property={selectedProperty}
        nextProperty={getNextProperty(selectedProperty?.propertyId)}
        currentReceiptNumber={session?.currentNumber || 1}
        startNumber={session?.startNumber || 1}
        endNumber={session?.endNumber || 100}
        hasActiveSession={Boolean(session && session.sessionStatus === "open")}
        creating={fastReceiptCreating}
        createError={fastReceiptError}
        onClose={handleCloseFastReceipt}
        onNavigateToCloseSession={() => {
          setVolunteerSubView("session");
        }}
        onStartSession={() => {
          nav.openCollectMode();
          setVolunteerSubView("home");
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
