import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "@/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  initializeCollectionSession,
  type CollectionSessionContext,
} from "@/features/collection/services/collection-session.service";

import {
  createLocalReceipt,
  type CreateLocalReceiptInput,
} from "@/lib/offline/receipt-store";

import {
  getLocalReceipts,
  mergeOfflineBookState,
  type LocalReceipt,
} from "@/lib/offline/offline-db";

import { syncNextReceipt } from "@/lib/offline/receipt-sync";

import { LastCreatedReceiptCard } from "../components/last-created-receipt-card";
import { ReceiptCreationForm, type PaymentMode } from "../components/receipt-creation-form";
import { ReceiptHistoryPanel } from "../components/receipt-history-panel";
import { ReceiptPreviewDialog } from "../components/receipt-preview-dialog";
import { printReceipt } from "../utils/print-receipt";

type AdminHandover = {
  id: string;
  organization_id: string;
  event_id: string;
  collection_session_id: string;
  volunteer_id: string;
  expected_receipt_count: number;
  expected_total_amount: number;
  expected_cash_amount: number;
  expected_upi_amount: number;
  expected_cheque_amount: number;
  expected_bank_transfer_amount: number;
  actual_cash_amount: number;
  actual_upi_amount: number;
  actual_cheque_amount: number;
  actual_bank_transfer_amount: number;
  status: string;
  submitted_at: string | null;
  submitted_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  volunteerName?: string;
};

export function DashboardPage() {
  const [session, setSession] =
    useState<CollectionSessionContext | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [organizationId, setOrganizationId] =
    useState<string | null>(null);

  const [adminHandovers, setAdminHandovers] =
    useState<AdminHandover[]>([]);

  const [adminHandoverLoading, setAdminHandoverLoading] =
    useState(false);

  const [adminHandoverError, setAdminHandoverError] =
    useState<string | null>(null);

  const [adminActionLoading, setAdminActionLoading] =
    useState<string | null>(null);

  const [startSessionLoading, setStartSessionLoading] = useState(false);
  const [startSessionError, setStartSessionError] = useState<string | null>(null);
  const [availableEvents, setAvailableEvents] = useState<Array<{ id: string; name: string; code: string; start_date: string; end_date: string }>>([]);
  const [availableBooks, setAvailableBooks] = useState<Array<{ id: string; book_number: string; prefix: string; start_number: number; end_number: number; current_number: number | null; status: string; event_id: string }>>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');

  const [error, setError] =
    useState<string | null>(null);

  const [donorName, setDonorName] =
    useState("");

  const [donorMobile, setDonorMobile] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [paymentMode, setPaymentMode] =
    useState<PaymentMode>("cash");

  const [paymentReference, setPaymentReference] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [creating, setCreating] =
    useState(false);

  const [createdReceipt, setCreatedReceipt] =
    useState<LocalReceipt | null>(null);

  const [receiptToView, setReceiptToView] =
    useState<LocalReceipt | null>(null);

  const [createError, setCreateError] =
    useState<string | null>(null);

  const [syncMessage, setSyncMessage] =
    useState<string | null>(null);

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

  const issuedReceipts = receipts.filter(
    (receipt) => receipt.syncStatus === "synced"
  );

  const pendingReceipts = receipts.filter(
    (receipt) =>
      receipt.syncStatus === "pending" ||
      receipt.syncStatus === "syncing"
  );

  const conflictReceipts = receipts.filter(
    (receipt) => receipt.syncStatus === "conflict"
  );

  const totalAmount = issuedReceipts.reduce(
    (total, receipt) => total + receipt.amount,
    0
  );

  const cashAmount = issuedReceipts
    .filter((receipt) => receipt.paymentMode === "cash")
    .reduce((total, receipt) => total + receipt.amount, 0);

  const upiAmount = issuedReceipts
    .filter((receipt) => receipt.paymentMode === "upi")
    .reduce((total, receipt) => total + receipt.amount, 0);

  const chequeAmount = issuedReceipts
    .filter((receipt) => receipt.paymentMode === "cheque")
    .reduce((total, receipt) => total + receipt.amount, 0);

  const bankTransferAmount = issuedReceipts
    .filter(
      (receipt) =>
        receipt.paymentMode === "bank_transfer"
    )
    .reduce((total, receipt) => total + receipt.amount, 0);

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
    } finally { setStartSessionLoading(false); }
  }

  async function loadAdminHandovers() {
    if (!isAdmin || !organizationId) {
      return;
    }

    setAdminHandoverLoading(true);
    setAdminHandoverError(null);

    try {
      const { data, error: handoverError } = await supabase
        .from("collection_handovers")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (handoverError) {
        throw new Error(handoverError.message);
      }

      const handoverRows = (data ?? []) as AdminHandover[];
      const volunteerIds = Array.from(
        new Set(handoverRows.map((row) => row.volunteer_id))
      );

      let volunteerNames = new Map<string, string>();

      if (volunteerIds.length > 0) {
        const { data: volunteers, error: volunteersError } =
          await supabase
            .from("volunteers")
            .select("id, name")
            .in("id", volunteerIds);

        if (volunteersError) {
          throw new Error(volunteersError.message);
        }

        volunteerNames = new Map(
          (volunteers ?? []).map((volunteer) => [
            volunteer.id,
            volunteer.name,
          ])
        );
      }

      setAdminHandovers(
        handoverRows.map((row) => ({
          ...row,
          volunteerName:
            volunteerNames.get(row.volunteer_id) ?? "Volunteer",
        }))
      );
    } catch (err) {
      console.error("ADMIN HANDOVER LOAD ERROR:", err);
      setAdminHandoverError(
        err instanceof Error
          ? err.message
          : "Unable to load collection handovers."
      );
    } finally {
      setAdminHandoverLoading(false);
    }
  }

  /*
   * Verify a submitted collection handover.
   */
  async function handleVerifyHandover(handoverId: string) {
    if (!window.confirm("Verify this collection handover?")) {
      return;
    }

    setAdminActionLoading(handoverId);
    setAdminHandoverError(null);

    try {
      const { data, error: verifyError } = await supabase.rpc(
        "verify_collection_handover",
        { p_handover_id: handoverId }
      );

      if (verifyError) {
        throw new Error(verifyError.message);
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true
      ) {
        throw new Error(
          "Unexpected response while verifying collection handover."
        );
      }

      await loadAdminHandovers();
    } catch (err) {
      console.error("VERIFY HANDOVER ERROR:", err);
      setAdminHandoverError(
        err instanceof Error
          ? err.message
          : "Unable to verify collection handover."
      );
    } finally {
      setAdminActionLoading(null);
    }
  }

  /*
   * Reject a submitted collection handover.
   */
  async function handleRejectHandover(handoverId: string) {
    const input = window.prompt(
      "Enter the reason for rejecting this handover:"
    );

    if (input === null) {
      return;
    }

    const reason = input.trim();

    if (!reason) {
      setAdminHandoverError("A rejection reason is required.");
      return;
    }

    setAdminActionLoading(handoverId);
    setAdminHandoverError(null);

    try {
      const { data, error: rejectError } = await supabase.rpc(
        "reject_collection_handover",
        {
          p_handover_id: handoverId,
          p_rejection_reason: reason,
        }
      );

      if (rejectError) {
        throw new Error(rejectError.message);
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true
      ) {
        throw new Error(
          "Unexpected response while rejecting collection handover."
        );
      }

      await loadAdminHandovers();
    } catch (err) {
      console.error("REJECT HANDOVER ERROR:", err);
      setAdminHandoverError(
        err instanceof Error
          ? err.message
          : "Unable to reject collection handover."
      );
    } finally {
      setAdminActionLoading(null);
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

  useEffect(() => {
    if (isAdmin && organizationId) {
      void loadAdminHandovers();
    }
  }, [isAdmin, organizationId]);

  /*
   * Create the next local receipt.
   */
  async function handleCreateReceipt(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!session) {
      setCreateError(
        "Collection session is not initialized."
      );

      return;
    }

    setCreateError(null);
    setSyncMessage(null);
    setCreating(true);

    try {
      const parsedAmount = Number(amount);

      if (
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0
      ) {
        throw new Error(
          "Amount must be greater than zero."
        );
      }

      if (!donorName.trim()) {
        throw new Error(
          "Donor name is required."
        );
      }

      const input: CreateLocalReceiptInput = {
        organizationId:
          session.organizationId,

        eventId:
          session.eventId,

        collectionSessionId:
          session.sessionId,

        receiptBookId:
          session.receiptBookId,

        volunteerId:
          session.volunteerId,

        propertyId: null,

        donorName:
          donorName.trim(),

        donorMobile:
          donorMobile.trim() || null,

        amount:
          parsedAmount,

        paymentMode,

        paymentReference:
          paymentReference.trim() || null,

        notes:
          notes.trim() || null,
      };

      /*
       * Same tested local receipt creation
       * path used for receipts #104 and #105.
       */
      const receipt =
        await createLocalReceipt(input);

      console.log(
        "LOCAL RECEIPT CREATED:",
        receipt
      );

      setCreatedReceipt(receipt);

      /*
       * Show the receipt immediately in local
       * history before attempting synchronization.
       */
      await loadReceiptHistory(
        session.receiptBookId
      );

      /*
       * Clear form for next receipt.
       */
      setDonorName("");
      setDonorMobile("");
      setAmount("");
      setPaymentMode("cash");
      setPaymentReference("");
      setNotes("");

      /*
       * Try synchronization.
       */
      try {
        const syncResult =
          await syncNextReceipt(
            session.receiptBookId
          );

        /*
         * syncNextReceipt can legitimately
         * return null when there is nothing
         * pending to synchronize.
         */
        if (!syncResult) {
          await loadReceiptHistory(
            session.receiptBookId
          );

          setSyncMessage(
            "Receipt created locally. There are no receipts currently waiting to sync."
          );

          return;
        }

        console.log(
          "SYNC RESULT:",
          syncResult
        );

        /*
         * Reload history so the UI reflects
         * the final synchronization state.
         */
        await loadReceiptHistory(
          session.receiptBookId
        );

        if (syncResult.success) {
          if (syncResult.alreadyExists) {
            setSyncMessage(
              "Receipt already existed on the server. No duplicate was created."
            );
          } else {
            setSyncMessage(
              "Receipt created and synced successfully."
            );
          }
        } else if (syncResult.conflict) {
          setSyncMessage(
            "Receipt created locally, but synchronization requires attention."
          );
        } else {
          setSyncMessage(
            "Receipt created locally and is waiting to sync."
          );
        }
      } catch (syncError) {
        console.error(
          "SYNC ERROR:",
          syncError
        );

        /*
         * The receipt is already safely stored
         * locally, so it remains available for
         * later synchronization.
         */
        await loadReceiptHistory(
          session.receiptBookId
        );

        setSyncMessage(
          "Receipt created locally. It will remain available for synchronization."
        );
      }
    } catch (err) {
      console.error(
        "CREATE RECEIPT ERROR:",
        err
      );

      setCreateError(
        err instanceof Error
          ? err.message
          : "Unable to create receipt."
      );
    } finally {
      setCreating(false);
    }
  }

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
        <div>
          <h1 className="text-2xl font-semibold">Start Collection</h1>
          <p className="mt-1 text-sm text-muted-foreground">Select an active event and an available receipt book to begin collecting.</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          {startSessionError && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-700">{startSessionError}</p></div>}
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label htmlFor="start-event" className="mb-2 block text-sm font-medium">Event</label>
              <select id="start-event" value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); void loadAvailableBooks(e.target.value); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" disabled={startSessionLoading}>
                <option value="">Select an event</option>{availableEvents.map((event) => <option key={event.id} value={event.id}>{event.name} ({event.code})</option>)}
              </select>
            </div>
            <div><label htmlFor="start-receipt-book" className="mb-2 block text-sm font-medium">Receipt Book</label>
              <select id="start-receipt-book" value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" disabled={startSessionLoading || !selectedEventId || availableBooks.length===0}>
                <option value="">{availableBooks.length===0 ? 'No available receipt books' : 'Select a receipt book'}</option>{availableBooks.map((book) => <option key={book.id} value={book.id}>{book.book_number} — {book.prefix}{book.current_number ?? book.start_number}-{book.end_number}</option>)}
              </select>
            </div>
          </div>
          {selectedBookId && <div className="mt-5 rounded-lg border bg-muted/30 p-4">{(() => { const book=availableBooks.find((item)=>item.id===selectedBookId); return book ? <div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Book Number</p><p className="font-semibold">{book.book_number}</p></div><div><p className="text-xs text-muted-foreground">Receipt Range</p><p className="font-semibold">{book.prefix}{book.current_number ?? book.start_number} – {book.prefix}{book.end_number}</p></div><div><p className="text-xs text-muted-foreground">Status</p><p className="font-semibold capitalize">{book.status}</p></div></div> : null; })()}</div>}
          <div className="mt-6 flex justify-end"><Button type="button" onClick={() => void handleStartCollectionSession()} disabled={startSessionLoading || !selectedEventId || !selectedBookId}>{startSessionLoading ? 'Starting Collection...' : 'Start Collection'}</Button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {isAdmin && (
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Collection Handover Verification</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review submitted handovers and verify or reject them.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadAdminHandovers()}
              disabled={adminHandoverLoading}
            >
              {adminHandoverLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {adminHandoverError && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{adminHandoverError}</p>
            </div>
          )}

          {adminHandoverLoading && adminHandovers.length === 0 ? (
            <div className="mt-5 text-sm text-muted-foreground">
              Loading handovers...
            </div>
          ) : adminHandovers.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No collection handovers found.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {adminHandovers.map((adminHandover) => {
                const actualTotal =
                  Number(adminHandover.actual_cash_amount) +
                  Number(adminHandover.actual_upi_amount) +
                  Number(adminHandover.actual_cheque_amount) +
                  Number(adminHandover.actual_bank_transfer_amount);

                const difference =
                  actualTotal - Number(adminHandover.expected_total_amount);

                const submitted = adminHandover.status === "submitted";
                const actionBusy = adminActionLoading === adminHandover.id;

                return (
                  <div key={adminHandover.id} className="rounded-lg border p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-semibold">
                            {adminHandover.volunteerName || "Volunteer"}
                          </p>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            adminHandover.status === "verified"
                              ? "bg-green-100 text-green-800"
                              : adminHandover.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : adminHandover.status === "submitted"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-muted text-muted-foreground"
                          }`}>
                            {adminHandover.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Handover ID: {adminHandover.id}
                        </p>
                        {adminHandover.submitted_at && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Submitted: {new Date(adminHandover.submitted_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      {submitted && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => void handleVerifyHandover(adminHandover.id)}
                            disabled={actionBusy}
                          >
                            {actionBusy ? "Processing..." : "Verify"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleRejectHandover(adminHandover.id)}
                            disabled={actionBusy}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Expected Receipts</p>
                        <p className="mt-1 text-lg font-bold">{adminHandover.expected_receipt_count}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Expected Total</p>
                        <p className="mt-1 text-lg font-bold">₹{Number(adminHandover.expected_total_amount).toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Actual Total</p>
                        <p className="mt-1 text-lg font-bold">₹{actualTotal.toFixed(2)}</p>
                      </div>
                      <div className={`rounded-lg border p-3 ${Math.abs(difference) > 0.005 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                        <p className="text-xs text-muted-foreground">Difference</p>
                        <p className="mt-1 text-lg font-bold">₹{difference.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><p className="text-muted-foreground">Expected Cash</p><p className="font-semibold">₹{Number(adminHandover.expected_cash_amount).toFixed(2)}</p></div>
                      <div><p className="text-muted-foreground">Actual Cash</p><p className="font-semibold">₹{Number(adminHandover.actual_cash_amount).toFixed(2)}</p></div>
                      <div><p className="text-muted-foreground">Expected UPI</p><p className="font-semibold">₹{Number(adminHandover.expected_upi_amount).toFixed(2)}</p></div>
                      <div><p className="text-muted-foreground">Actual UPI</p><p className="font-semibold">₹{Number(adminHandover.actual_upi_amount).toFixed(2)}</p></div>
                      <div><p className="text-muted-foreground">Expected Cheque</p><p className="font-semibold">₹{Number(adminHandover.expected_cheque_amount).toFixed(2)}</p></div>
                      <div><p className="text-muted-foreground">Actual Cheque</p><p className="font-semibold">₹{Number(adminHandover.actual_cheque_amount).toFixed(2)}</p></div>
                      <div><p className="text-muted-foreground">Expected Bank Transfer</p><p className="font-semibold">₹{Number(adminHandover.expected_bank_transfer_amount).toFixed(2)}</p></div>
                      <div><p className="text-muted-foreground">Actual Bank Transfer</p><p className="font-semibold">₹{Number(adminHandover.actual_bank_transfer_amount).toFixed(2)}</p></div>
                    </div>

                    {adminHandover.rejection_reason && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-xs font-medium text-red-700">Rejection Reason</p>
                        <p className="mt-1 text-sm text-red-700">{adminHandover.rejection_reason}</p>
                      </div>
                    )}

                    {adminHandover.notes && (
                      <div className="mt-4 rounded-lg bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="mt-1 text-sm">{adminHandover.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!session && isAdmin && (
        <div className="rounded-lg border bg-card p-5">
          <div>
            <h2 className="text-xl font-semibold">Start Collection</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select an active event and an available receipt book to begin collecting.
            </p>
          </div>

          {startSessionError && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{startSessionError}</p>
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="admin-start-event" className="mb-2 block text-sm font-medium">
                Event
              </label>
              <select
                id="admin-start-event"
                value={selectedEventId}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedEventId(value);
                  void loadAvailableBooks(value);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={startSessionLoading}
              >
                <option value="">Select an event</option>
                {availableEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({event.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admin-start-book" className="mb-2 block text-sm font-medium">
                Receipt Book
              </label>
              <select
                id="admin-start-book"
                value={selectedBookId}
                onChange={(event) => setSelectedBookId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={startSessionLoading || !selectedEventId || availableBooks.length === 0}
              >
                <option value="">
                  {availableBooks.length === 0 ? "No available receipt books" : "Select a receipt book"}
                </option>
                {availableBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.book_number} — {book.prefix}{book.current_number ?? book.start_number}-{book.end_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => void handleStartCollectionSession()}
              disabled={startSessionLoading || !selectedEventId || !selectedBookId}
            >
              {startSessionLoading ? "Starting Collection..." : "Start Collection"}
            </Button>
          </div>
        </div>
      )}

      {session && (<>
      {/* ----------------------------------------
          COLLECTION SESSION
      ----------------------------------------- */}

      <div>
        <h1 className="text-2xl font-semibold">
          Collection
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          {session.bookNumber}
        </p>
      </div>

      {/* Session information */}

      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Receipt Book
            </p>

            <p className="text-lg font-semibold">
              {session.prefix}
              {session.currentNumber}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              Available Range
            </p>

            <p className="font-medium">
              {session.startNumber} –{" "}
              {session.endNumber}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              Status
            </p>

            <p className="font-medium">
              {session.bookStatus}
            </p>
          </div>
        </div>
      </div>

      {/* ----------------------------------------
          SESSION SUMMARY
      ----------------------------------------- */}

      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Session Summary</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Collection summary for this session
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              session.sessionStatus === "open"
                ? "bg-green-100 text-green-800"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {session.sessionStatus === "open" ? "Open" : "Completed"}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Receipts</p>
            <p className="mt-1 text-2xl font-bold">
              {issuedReceipts.length}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Collection</p>
            <p className="mt-1 text-2xl font-bold">
              ₹{totalAmount.toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Pending Sync</p>
            <p className="mt-1 text-2xl font-bold">
              {pendingReceipts.length}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Conflicts</p>
            <p className="mt-1 text-2xl font-bold">
              {conflictReceipts.length}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Cash</p>
            <p className="font-semibold">₹{cashAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">UPI</p>
            <p className="font-semibold">₹{upiAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cheque</p>
            <p className="font-semibold">₹{chequeAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Bank Transfer</p>
            <p className="font-semibold">
              ₹{bankTransferAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {sessionCloseError && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{sessionCloseError}</p>
          </div>
        )}

        {sessionCloseMessage && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-700">{sessionCloseMessage}</p>
          </div>
        )}

        {session.sessionStatus === "open" && (
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCloseSession()}
              disabled={
                closingSession ||
                pendingReceipts.length > 0 ||
                conflictReceipts.length > 0
              }
            >
              {closingSession
                ? "Closing Session..."
                : "Close Collection Session"}
            </Button>
          </div>
        )}
      </div>

      {/* ----------------------------------------
          COLLECTION HANDOVER
      ----------------------------------------- */}

      {session.sessionStatus === "completed" && (
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Collection Handover</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the handover record from the completed collection session.
              </p>
            </div>

            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
              {handover?.status ?? "Not Created"}
            </span>
          </div>

          {!handover && (
            <div className="mt-5">
              <p className="text-sm text-muted-foreground">
                Expected collection will be calculated directly from the server receipts.
              </p>

              <div className="mt-4">
                <Button
                  type="button"
                  onClick={() => void handleCreateHandover()}
                  disabled={creatingHandover}
                >
                  {creatingHandover
                    ? "Creating Handover..."
                    : "Create Handover"}
                </Button>
              </div>
            </div>
          )}

          {handover && (
            <div className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Expected Receipts</p>
                  <p className="mt-1 text-2xl font-bold">{handover.receiptCount}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Expected Total</p>
                  <p className="mt-1 text-2xl font-bold">₹{handover.totalAmount.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Expected Cash</p>
                  <p className="mt-1 text-xl font-bold">₹{handover.cashAmount.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Expected UPI</p>
                  <p className="mt-1 text-xl font-bold">₹{handover.upiAmount.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Expected Cheque</p>
                  <p className="font-semibold">₹{handover.chequeAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Bank Transfer</p>
                  <p className="font-semibold">₹{handover.bankTransferAmount.toFixed(2)}</p>
                </div>
                <div className="lg:col-span-2">
                  <p className="text-sm text-muted-foreground">Handover ID</p>
                  <p className="truncate font-mono text-xs">{handover.id}</p>
                </div>
              </div>

              {(handover.status === "pending" || handover.status === "rejected") && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-semibold">Actual Handover</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter the amounts actually handed over.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {[
                      ["actual-cash-amount", "Actual Cash", actualCashAmount, setActualCashAmount, handover.cashAmount],
                      ["actual-upi-amount", "Actual UPI", actualUpiAmount, setActualUpiAmount, handover.upiAmount],
                      ["actual-cheque-amount", "Actual Cheque", actualChequeAmount, setActualChequeAmount, handover.chequeAmount],
                      ["actual-bank-transfer-amount", "Actual Bank Transfer", actualBankTransferAmount, setActualBankTransferAmount, handover.bankTransferAmount],
                    ].map(([id, label, value, setter, expected]) => (
                      <div key={String(id)}>
                        <label htmlFor={String(id)} className="mb-2 block text-sm font-medium">
                          {String(label)}
                        </label>
                        <Input
                          id={String(id)}
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(value)}
                          onChange={(event) =>
                            (setter as (value: string) => void)(event.target.value)
                          }
                          placeholder="0.00"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Expected: ₹{Number(expected).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Actual Total</span>
                      <span className="text-xl font-bold">
                        ₹{(
                          Number(actualCashAmount || 0) +
                          Number(actualUpiAmount || 0) +
                          Number(actualChequeAmount || 0) +
                          Number(actualBankTransferAmount || 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Difference</span>
                      <span className="font-semibold">
                        ₹{(
                          Number(actualCashAmount || 0) +
                          Number(actualUpiAmount || 0) +
                          Number(actualChequeAmount || 0) +
                          Number(actualBankTransferAmount || 0) -
                          handover.totalAmount
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label htmlFor="handover-notes" className="mb-2 block text-sm font-medium">
                      Notes
                    </label>
                    <textarea
                      id="handover-notes"
                      value={handoverNotes}
                      onChange={(event) => setHandoverNotes(event.target.value)}
                      rows={3}
                      placeholder="Optional notes about the handover"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="mt-5 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void handleSubmitHandover()}
                      disabled={submittingHandover}
                    >
                      {submittingHandover ? "Submitting Handover..." : "Submit Handover"}
                    </Button>
                  </div>
                </div>
              )}

              {handover.status === "submitted" && (
                <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="font-medium text-blue-800">
                    Handover submitted and awaiting admin verification.
                  </p>
                </div>
              )}

              {handover.status === "verified" && (
                <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="font-medium text-green-800">
                    Handover has been verified.
                  </p>
                </div>
              )}
            </div>
          )}

          {handoverError && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{handoverError}</p>
            </div>
          )}

          {handoverMessage && (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-700">{handoverMessage}</p>
            </div>
          )}
        </div>
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
        <div className="rounded-lg border bg-card p-5">
          <div>
            <h2 className="text-xl font-semibold">Start New Collection</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your previous collection is completed. Start a new session with an available receipt book.
            </p>
          </div>

          {startSessionError && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{startSessionError}</p>
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="next-event" className="mb-2 block text-sm font-medium">
                Event
              </label>
              <select
                id="next-event"
                value={selectedEventId}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedEventId(value);
                  void loadAvailableBooks(value);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={startSessionLoading}
              >
                <option value="">Select an event</option>
                {availableEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({event.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="next-receipt-book" className="mb-2 block text-sm font-medium">
                Receipt Book
              </label>
              <select
                id="next-receipt-book"
                value={selectedBookId}
                onChange={(event) => setSelectedBookId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={startSessionLoading || !selectedEventId || availableBooks.length === 0}
              >
                <option value="">
                  {availableBooks.length === 0 ? "No available receipt books" : "Select a receipt book"}
                </option>
                {availableBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.book_number} — {book.prefix}{book.current_number ?? book.start_number}-{book.end_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedBookId && (
            <div className="mt-5 rounded-lg border bg-muted/30 p-4">
              {(() => {
                const book = availableBooks.find((item) => item.id === selectedBookId);
                if (!book) return null;
                return (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Book Number</p>
                      <p className="font-semibold">{book.book_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Receipt Range</p>
                      <p className="font-semibold">
                        {book.prefix}{book.current_number ?? book.start_number} – {book.prefix}{book.end_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="font-semibold capitalize">{book.status}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => void handleStartCollectionSession()}
              disabled={startSessionLoading || !selectedEventId || !selectedBookId}
            >
              {startSessionLoading ? "Starting Collection..." : "Start Collection"}
            </Button>
          </div>
        </div>
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
