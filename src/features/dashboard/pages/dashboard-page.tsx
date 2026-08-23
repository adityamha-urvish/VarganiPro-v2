import { useEffect, useState } from "react";

import { supabase } from "@/supabase/client";

import {
  initializeCollectionSession,
  type CollectionSessionContext,
} from "@/features/collection/services/collection-session.service";

import {
  getLocalReceipts,
  mergeOfflineBookState,
  type LocalReceipt,
} from "@/lib/offline/offline-db";

import { syncNextReceipt } from "@/lib/offline/receipt-sync";

import { AdminHandoverPanel } from "../components/admin-handover-panel";
import { LastCreatedReceiptCard } from "../components/last-created-receipt-card";
import { ReceiptCreationForm } from "../components/receipt-creation-form";
import { ReceiptHistoryPanel } from "../components/receipt-history-panel";
import { ReceiptPreviewDialog } from "../components/receipt-preview-dialog";
import { SessionSummaryCard } from "../components/session-summary-card";
import { StartCollectionCard } from "../components/start-collection-card";
import { VolunteerHandoverCard } from "../components/volunteer-handover-card";
import { useAdminHandovers } from "../hooks/use-admin-handovers";
import { useReceiptCreation } from "../hooks/use-receipt-creation";
import { printReceipt } from "../utils/print-receipt";
import { calculateReceiptAggregates } from "../utils/receipt-aggregates";

export function DashboardPage() {
  const [session, setSession] =
    useState<CollectionSessionContext | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [organizationId, setOrganizationId] =
    useState<string | null>(null);

  const {
    adminHandovers,
    adminHandoverLoading,
    adminHandoverError,
    adminActionLoading,
    loadAdminHandovers,
    handleVerifyHandover,
    handleRejectHandover,
  } = useAdminHandovers({ isAdmin, organizationId });

  const [startSessionLoading, setStartSessionLoading] = useState(false);
  const [startSessionError, setStartSessionError] = useState<string | null>(null);
  const [availableEvents, setAvailableEvents] = useState<Array<{ id: string; name: string; code: string; start_date: string; end_date: string }>>([]);
  const [availableBooks, setAvailableBooks] = useState<Array<{ id: string; book_number: string; prefix: string; start_number: number; end_number: number; current_number: number | null; status: string; event_id: string }>>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');

  const [error, setError] =
    useState<string | null>(null);

  const {
    donorName,
    setDonorName,
    donorMobile,
    setDonorMobile,
    amount,
    setAmount,
    paymentMode,
    setPaymentMode,
    paymentReference,
    setPaymentReference,
    notes,
    setNotes,
    creating,
    createError,
    setCreateError,
    createdReceipt,
    syncMessage,
    setSyncMessage,
    handleCreateReceipt,
  } = useReceiptCreation({
    session,
    onReceiptHistoryRefresh: loadReceiptHistory,
  });

  const [receiptToView, setReceiptToView] =
    useState<LocalReceipt | null>(null);

  const [receipts, setReceipts] =
    useState<LocalReceipt[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [closingSession, setClosingSession] =
    useState(false);

  const [sessionCloseMessage, setSessionCloseMessage] =
    useState<string | null>(null);

  const [sessionCloseError, setSessionCloseError] =
    useState<string | null>(null);

  const [creatingHandover, setCreatingHandover] =
    useState(false);

  const [handoverMessage, setHandoverMessage] =
    useState<string | null>(null);

  const [handoverError, setHandoverError] =
    useState<string | null>(null);

  const [submittingHandover, setSubmittingHandover] =
    useState(false);

  const [actualCashAmount, setActualCashAmount] =
    useState("");

  const [actualUpiAmount, setActualUpiAmount] =
    useState("");

  const [actualChequeAmount, setActualChequeAmount] =
    useState("");

  const [actualBankTransferAmount, setActualBankTransferAmount] =
    useState("");

  const [handoverNotes, setHandoverNotes] =
    useState("");

  const [handover, setHandover] =
    useState<{
      id: string;
      receiptCount: number;
      totalAmount: number;
      cashAmount: number;
      upiAmount: number;
      chequeAmount: number;
      bankTransferAmount: number;
      status: string;
    } | null>(null);

  /*
   * Load all locally stored receipts
   * for the active receipt book.
   */
  async function loadReceiptHistory(
    receiptBookId: string
  ) {
    setHistoryLoading(true);

    try {
      const localReceipts =
        await getLocalReceipts(receiptBookId);

      console.log(
        "LOCAL RECEIPT HISTORY:",
        localReceipts
      );

      setReceipts(localReceipts);
    } catch (err) {
      console.error(
        "RECEIPT HISTORY ERROR:",
        err
      );
    } finally {
      setHistoryLoading(false);
    }
  }

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

  /*
   * Load collection handovers for the current admin's organization.
   */
  async function loadAvailableBooks(eventId: string) {
    setStartSessionError(null);
    setSelectedBookId('');
    try {
      const { data, error } = await supabase.from('receipt_books').select('id, book_number, prefix, start_number, end_number, current_number, status, event_id').eq('event_id', eventId).eq('status', 'available').order('book_number', { ascending: true });
      if (error) throw new Error(error.message);
      const books = data ?? [];
      setAvailableBooks(books);
      if (books.length === 1) setSelectedBookId(books[0].id);
    } catch (err) {
      console.error('AVAILABLE BOOKS ERROR:', err);
      setStartSessionError(err instanceof Error ? err.message : 'Unable to load available receipt books.');
      setAvailableBooks([]);
    }
  }

  async function loadStartSessionOptions() {
    setStartSessionError(null);
    try {
      const { data, error } = await supabase.from('events').select('id, name, code, start_date, end_date').eq('is_active', true).order('start_date', { ascending: true });
      if (error) throw new Error(error.message);
      const events = data ?? [];
      setAvailableEvents(events);
      if (events.length > 0) {
        const preferred = events.find((event) => event.id === session?.eventId) ?? events[0];
        setSelectedEventId(preferred.id);
        await loadAvailableBooks(preferred.id);
      } else {
        setAvailableBooks([]);
      }
    } catch (err) {
      console.error('START SESSION OPTIONS ERROR:', err);
      setStartSessionError(err instanceof Error ? err.message : 'Unable to load events and receipt books.');
    }
  }

  async function handleStartCollectionSession() {
    if (!selectedEventId) { setStartSessionError('Please select an event.'); return; }
    if (!selectedBookId) { setStartSessionError('Please select a receipt book.'); return; }
    if (!window.confirm('Start this collection session?\n\nThe selected receipt book will be checked out to you.')) return;
    setStartSessionError(null);
    setStartSessionLoading(true);
    try {
      const { data, error } = await supabase.rpc('start_collection_session', { p_event_id: selectedEventId, p_receipt_book_id: selectedBookId });
      if (error) throw new Error(error.message);
      if (!data || typeof data !== 'object' || !('success' in data) || data.success !== true) throw new Error('Unexpected response while starting collection session.');
      const newSession = await loadCurrentCollectionSession(
        selectedBookId
      );

      if (!newSession) {
        throw new Error(
          "Collection session was created, but the new open session could not be loaded."
        );
      }

      setSession(newSession);
      setOrganizationId(newSession.organizationId);
      setAvailableBooks([]);
      setSelectedBookId("");
      setStartSessionError(null);

      /*
       * The session is server-side, but receipt creation is
       * intentionally offline-first. The local IndexedDB book
       * state must therefore be initialized at session checkout.
       *
       * initializeCollectionSession() normally does this for
       * an existing session. Because Start Collection loads the
       * newly-created session directly, save the same book state
       * here before allowing the user to create a receipt.
       */
      await ensureOfflineBookState(newSession);

      await loadReceiptHistory(newSession.receiptBookId);
      setHandover(null);
    } catch (err) {
      console.error('START SESSION ERROR:', err);
      setStartSessionError(err instanceof Error ? err.message : 'Unable to start collection session.');
    } finally {
      setStartSessionLoading(false);
    }
  }

  async function loadCurrentCollectionSession(
    preferredReceiptBookId?: string
  ): Promise<CollectionSessionContext | null> {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      return null;
    }

    const { data: appUser, error: appUserError } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (appUserError || !appUser) {
      return null;
    }

    const { data: volunteer, error: volunteerError } = await supabase
      .from("volunteers")
      .select("id, organization_id")
      .eq("user_id", appUser.id)
      .eq("status", "active")
      .maybeSingle();

    if (volunteerError || !volunteer) {
      return null;
    }

    // Restore either the currently open session or the most recent
    // completed session. Completed sessions must remain visible after
    // refresh so receipt history and rejected/pending handovers are not lost.
    let sessionQuery = supabase
      .from("collection_sessions")
      .select(
        "id, organization_id, event_id, volunteer_id, receipt_book_id, status, started_at"
      )
      .eq("volunteer_id", volunteer.id)
      .in("status", ["open", "completed"])
      .order("started_at", { ascending: false })
      .limit(1);

    if (preferredReceiptBookId) {
      sessionQuery = sessionQuery.eq(
        "receipt_book_id",
        preferredReceiptBookId
      );
    }

    const { data: sessionRows, error: sessionError } =
      await sessionQuery;

    if (sessionError) {
      console.error("DIRECT SESSION LOAD ERROR:", sessionError);
      return null;
    }

    const sessionRow = sessionRows?.[0];

    if (!sessionRow?.receipt_book_id) {
      return null;
    }

    const { data: book, error: bookError } = await supabase
      .from("receipt_books")
      .select(
        "id, book_number, prefix, start_number, end_number, current_number, status"
      )
      .eq("id", sessionRow.receipt_book_id)
      .maybeSingle();

    if (bookError || !book) {
      console.error("DIRECT BOOK LOAD ERROR:", bookError);
      return null;
    }

    return {
      sessionId: sessionRow.id,
      organizationId: sessionRow.organization_id,
      eventId: sessionRow.event_id,
      volunteerId: sessionRow.volunteer_id,
      receiptBookId: book.id,
      bookNumber: book.book_number,
      prefix: book.prefix,
      startNumber: book.start_number,
      endNumber: book.end_number,
      currentNumber: book.current_number,
      sessionStatus: sessionRow.status,
      bookStatus: book.status,
    };
  }

  async function loadSessionHandover(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from("collection_handovers")
        .select(
          "id, expected_receipt_count, expected_total_amount, expected_cash_amount, expected_upi_amount, expected_cheque_amount, expected_bank_transfer_amount, actual_cash_amount, actual_upi_amount, actual_cheque_amount, actual_bank_transfer_amount, status, notes"
        )
        .eq("collection_session_id", sessionId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        setHandover(null);
        return null;
      }

      const restoredHandover = {
        id: data.id,
        receiptCount: Number(data.expected_receipt_count ?? 0),
        totalAmount: Number(data.expected_total_amount ?? 0),
        cashAmount: Number(data.expected_cash_amount ?? 0),
        upiAmount: Number(data.expected_upi_amount ?? 0),
        chequeAmount: Number(data.expected_cheque_amount ?? 0),
        bankTransferAmount: Number(data.expected_bank_transfer_amount ?? 0),
        status: data.status ?? "pending",
      };

      setHandover(restoredHandover);

      // Restore the previously entered actual amounts after a refresh,
      // especially important when an admin has rejected the handover.
      setActualCashAmount(
        Number(data.actual_cash_amount ?? 0) > 0
          ? String(data.actual_cash_amount)
          : ""
      );
      setActualUpiAmount(
        Number(data.actual_upi_amount ?? 0) > 0
          ? String(data.actual_upi_amount)
          : ""
      );
      setActualChequeAmount(
        Number(data.actual_cheque_amount ?? 0) > 0
          ? String(data.actual_cheque_amount)
          : ""
      );
      setActualBankTransferAmount(
        Number(data.actual_bank_transfer_amount ?? 0) > 0
          ? String(data.actual_bank_transfer_amount)
          : ""
      );
      setHandoverNotes(data.notes ?? "");

      return restoredHandover;
    } catch (err) {
      console.error("SESSION HANDOVER LOAD ERROR:", err);
      setHandoverError(
        err instanceof Error
          ? err.message
          : "Unable to restore collection handover."
      );
      return null;
    }
  }

  async function ensureOfflineBookState(
    activeSession: CollectionSessionContext
  ) {
    await mergeOfflineBookState({
      receiptBookId: activeSession.receiptBookId,
      organizationId: activeSession.organizationId,
      eventId: activeSession.eventId,
      collectionSessionId: activeSession.sessionId,
      volunteerId: activeSession.volunteerId,
      bookNumber: activeSession.bookNumber,
      prefix: activeSession.prefix,
      startNumber: activeSession.startNumber,
      endNumber: activeSession.endNumber,
      nextLocalNumber: activeSession.currentNumber,
      updatedAt: new Date().toISOString(),
    });
  }

  /*
   * Initialize collection session.
   */
  useEffect(() => {
    async function initialize() {
      try {
        const { data: roleData, error: roleError } =
          await supabase.rpc("current_user_role");

        if (roleError) {
          console.warn("CURRENT USER ROLE ERROR:", roleError);
        }

        const admin =
          String(roleData ?? "").toLowerCase() === "admin";

        setIsAdmin(admin);

        const { data: authData } = await supabase.auth.getUser();
        const authUserId = authData.user?.id;

        if (authUserId) {
          const { data: membership } = await supabase
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", authUserId)
            .limit(1)
            .maybeSingle();

          if (membership?.organization_id) {
            setOrganizationId(membership.organization_id);
          }
        }

        try {
          console.log("Initializing collection session...");

          const result =
            await initializeCollectionSession();

          console.log("COLLECTION SESSION:", result);

          setSession(result);
          setOrganizationId(result.organizationId);

          /*
           * Receipt creation is offline-first. Every active
           * session must have its checked-out receipt book
           * persisted in IndexedDB, including sessions that
           * were created before the latest frontend build.
           */
          await ensureOfflineBookState(result);

          await loadReceiptHistory(result.receiptBookId);
          await loadSessionHandover(result.sessionId);
        } catch (sessionError) {
          console.error("COLLECTION SESSION ERROR:", sessionError);

          // The service performs additional validation (including receipt-book
          // ownership). For the dashboard, retry the current user's open
          // session directly so an existing open session is never hidden.
          const directSession = await loadCurrentCollectionSession();

          if (directSession) {
            console.log(
              "DIRECT COLLECTION SESSION:",
              directSession
            );
            setSession(directSession);
            setOrganizationId(directSession.organizationId);

            /*
             * Recover the offline book state for an already-open
             * server session as well.
             */
            await ensureOfflineBookState(directSession);

            await loadReceiptHistory(directSession.receiptBookId);
            await loadSessionHandover(directSession.sessionId);
          } else if (!admin) {
            throw sessionError;
          } else {
            setSession(null);
            console.log(
              "No current open collection session. Showing admin dashboard and Start Collection."
            );
          }
        }
      } catch (err) {
        console.error("DASHBOARD INITIALIZATION ERROR:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to initialize dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, []);

  useEffect(() => {
    if (!loading && (!session || session.sessionStatus === "completed")) {
      void loadStartSessionOptions();
    }
  }, [loading, session?.sessionId, isAdmin, organizationId]);

  /*
   * Manually synchronize the next pending receipt.
   */
  async function handleSyncNextReceipt() {
    if (!session) {
      return;
    }

    setSyncMessage(null);

    try {
      const result =
        await syncNextReceipt(
          session.receiptBookId
        );

      /*
       * No pending receipt is a valid state.
       */
      if (!result) {
        await loadReceiptHistory(
          session.receiptBookId
        );

        setSyncMessage(
          "No pending receipts to synchronize."
        );

        return;
      }

      console.log(
        "MANUAL SYNC RESULT:",
        result
      );

      await loadReceiptHistory(
        session.receiptBookId
      );

      if (result.success) {
        setSyncMessage(
          result.alreadyExists
            ? "Receipt was already synchronized."
            : "Receipt synchronized successfully."
        );
      } else if (result.conflict) {
        setSyncMessage(
          "Receipt synchronization encountered a conflict."
        );
      } else {
        setSyncMessage(
          "No receipt was synchronized."
        );
      }
    } catch (err) {
      console.error(
        "MANUAL SYNC ERROR:",
        err
      );

      setSyncMessage(
        err instanceof Error
          ? err.message
          : "Unable to synchronize receipt."
      );
    }
  }

  async function handleCloseSession() {
    if (!session || session.sessionStatus !== "open") {
      return;
    }

    setSessionCloseMessage(null);
    setSessionCloseError(null);

    if (pendingReceipts.length > 0) {
      setSessionCloseError(
        `Cannot close session. ${pendingReceipts.length} receipt(s) are still waiting to sync.`
      );
      return;
    }

    if (conflictReceipts.length > 0) {
      setSessionCloseError(
        `Cannot close session. ${conflictReceipts.length} receipt(s) have synchronization conflicts.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Close this collection session?\n\n` +
        `Receipts: ${issuedReceipts.length}\n` +
        `Total: ₹${totalAmount.toFixed(2)}\n\n` +
        `Once completed, this session cannot be used to create more receipts.`
    );

    if (!confirmed) return;

    setClosingSession(true);

    try {
      const { data, error } = await supabase.rpc(
        "complete_collection_session",
        { p_collection_session_id: session.sessionId }
      );

      console.log("COMPLETE SESSION RESPONSE:", data);
      console.log("COMPLETE SESSION ERROR:", error);

      if (error) throw new Error(error.message);

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true
      ) {
        throw new Error(
          "Unexpected response while completing collection session."
        );
      }

      setSession((current) =>
        current
          ? { ...current, sessionStatus: "completed" }
          : current
      );

      setSessionCloseMessage(
        "Collection session completed successfully."
      );
    } catch (err) {
      console.error("COMPLETE SESSION ERROR:", err);
      setSessionCloseError(
        err instanceof Error
          ? err.message
          : "Unable to complete collection session."
      );
    } finally {
      setClosingSession(false);
    }
  }

  async function handleCreateHandover() {
    if (!session) return;

    if (session.sessionStatus !== "completed") {
      setHandoverError(
        "The collection session must be completed before creating a handover."
      );
      return;
    }

    setHandoverMessage(null);
    setHandoverError(null);
    setCreatingHandover(true);

    try {
      const { data, error } = await supabase.rpc(
        "create_collection_handover",
        {
          p_collection_session_id: session.sessionId,
        }
      );

      console.log("CREATE HANDOVER RESPONSE:", data);
      console.log("CREATE HANDOVER ERROR:", error);

      if (error) throw new Error(error.message);

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true
      ) {
        throw new Error(
          "Unexpected response while creating collection handover."
        );
      }

      const response = data as {
        success: boolean;
        handover_id?: string;
        receipt_count?: number;
        total_amount?: number;
        cash_amount?: number;
        upi_amount?: number;
        cheque_amount?: number;
        bank_transfer_amount?: number;
        status?: string;
      };

      if (!response.handover_id) {
        throw new Error(
          "Handover was created without an identifier."
        );
      }

      setHandover({
        id: response.handover_id,
        receiptCount: response.receipt_count ?? 0,
        totalAmount: Number(response.total_amount ?? 0),
        cashAmount: Number(response.cash_amount ?? 0),
        upiAmount: Number(response.upi_amount ?? 0),
        chequeAmount: Number(response.cheque_amount ?? 0),
        bankTransferAmount: Number(
          response.bank_transfer_amount ?? 0
        ),
        status: response.status ?? "pending",
      });

      setHandoverMessage(
        "Handover created successfully. Expected collection has been calculated from the server receipts."
      );
    } catch (err) {
      console.error("CREATE HANDOVER ERROR:", err);
      setHandoverError(
        err instanceof Error
          ? err.message
          : "Unable to create collection handover."
      );
    } finally {
      setCreatingHandover(false);
    }
  }

  async function handleSubmitHandover() {
    if (!handover) {
      setHandoverError("Create the handover before submitting it.");
      return;
    }

    if (handover.status !== "pending" && handover.status !== "rejected") {
      setHandoverError(
        "This handover is no longer available for submission."
      );
      return;
    }

    const cash = Number(actualCashAmount || 0);
    const upi = Number(actualUpiAmount || 0);
    const cheque = Number(actualChequeAmount || 0);
    const bankTransfer = Number(actualBankTransferAmount || 0);

    if (
      !Number.isFinite(cash) ||
      !Number.isFinite(upi) ||
      !Number.isFinite(cheque) ||
      !Number.isFinite(bankTransfer)
    ) {
      setHandoverError(
        "Please enter valid amounts for all payment modes."
      );
      return;
    }

    if (cash < 0 || upi < 0 || cheque < 0 || bankTransfer < 0) {
      setHandoverError("Actual handover amounts cannot be negative.");
      return;
    }

    const actualTotal = cash + upi + cheque + bankTransfer;
    const difference = actualTotal - handover.totalAmount;

    const confirmed = window.confirm(
      `Submit this collection handover?\n\n` +
        `Expected: ₹${handover.totalAmount.toFixed(2)}\n` +
        `Actual: ₹${actualTotal.toFixed(2)}\n` +
        `Difference: ₹${difference.toFixed(2)}`
    );

    if (!confirmed) return;

    setHandoverError(null);
    setHandoverMessage(null);
    setSubmittingHandover(true);

    try {
      const { data, error } = await supabase.rpc(
        "submit_collection_handover",
        {
          p_handover_id: handover.id,
          p_actual_cash_amount: cash,
          p_actual_upi_amount: upi,
          p_actual_cheque_amount: cheque,
          p_actual_bank_transfer_amount: bankTransfer,
          p_notes: handoverNotes.trim() || null,
        }
      );

      console.log("SUBMIT HANDOVER RESPONSE:", data);
      console.log("SUBMIT HANDOVER ERROR:", error);

      if (error) {
        throw new Error(error.message);
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true
      ) {
        throw new Error(
          "Unexpected response while submitting collection handover."
        );
      }

      const response = data as {
        success: boolean;
        handover_id?: string;
        expected_total?: number;
        actual_total?: number;
        difference?: number;
        status?: string;
      };

      setHandover((current) =>
        current
          ? {
              ...current,
              status: response.status ?? "submitted",
            }
          : current
      );

      setHandoverMessage(
        `Handover submitted successfully. Actual total ₹${Number(
          response.actual_total ?? actualTotal
        ).toFixed(2)}, difference ₹${Number(
          response.difference ?? difference
        ).toFixed(2)}.`
      );
    } catch (err) {
      console.error("SUBMIT HANDOVER ERROR:", err);
      setHandoverError(
        err instanceof Error
          ? err.message
          : "Unable to submit collection handover."
      );
    } finally {
      setSubmittingHandover(false);
    }
  }

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
      <div className="space-y-6 p-6">
        <StartCollectionCard
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
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {isAdmin && (
        <AdminHandoverPanel
          handovers={adminHandovers}
          loading={adminHandoverLoading}
          error={adminHandoverError}
          actionLoadingId={adminActionLoading}
          onRefresh={() => void loadAdminHandovers()}
          onVerifyHandover={(id) => void handleVerifyHandover(id)}
          onRejectHandover={(id) => void handleRejectHandover(id)}
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

      {session && (<>
      {/* ----------------------------------------
          COLLECTION SESSION
      ----------------------------------------- */}

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
          COLLECTION HANDOVER
      ----------------------------------------- */}

      {session.sessionStatus === "completed" && (
        <VolunteerHandoverCard
          handover={handover}
          creatingHandover={creatingHandover}
          submittingHandover={submittingHandover}
          actualCashAmount={actualCashAmount}
          actualUpiAmount={actualUpiAmount}
          actualChequeAmount={actualChequeAmount}
          actualBankTransferAmount={actualBankTransferAmount}
          handoverNotes={handoverNotes}
          handoverError={handoverError}
          handoverMessage={handoverMessage}
          onCreateHandover={() => void handleCreateHandover()}
          onSubmitHandover={() => void handleSubmitHandover()}
          onActualCashAmountChange={setActualCashAmount}
          onActualUpiAmountChange={setActualUpiAmount}
          onActualChequeAmountChange={setActualChequeAmount}
          onActualBankTransferAmountChange={setActualBankTransferAmount}
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

      <ReceiptPreviewDialog
        receipt={receiptToView}
        receiptPrefix={session.prefix}
        bookNumber={session.bookNumber}
        onClose={() => setReceiptToView(null)}
        onPrint={handlePrintReceipt}
      />

      </>)}

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
