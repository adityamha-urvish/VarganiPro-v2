import { useState } from "react";
import { supabase } from "@/supabase/client";
import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";

export type VolunteerHandoverData = {
  id: string;
  receiptCount: number;
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  chequeAmount: number;
  bankTransferAmount: number;
  expectedPhysicalAmount: number;
  expectedDigitalAmount: number;
  actualCashAmount: number;
  actualChequeAmount: number;
  actualUpiAmount: number;
  actualBankTransferAmount: number;
  authorizedExpenseAmount: number;
  authorizedExpenseNote: string | null;
  discrepancyReason: string | null;
  rejectionReason: string | null;
  status: string;
  notes: string | null;
};

export interface UseVolunteerHandoverOptions {
  session: CollectionSessionContext | null;
}

export function useVolunteerHandover({
  session,
}: UseVolunteerHandoverOptions) {
  const [creatingHandover, setCreatingHandover] = useState(false);
  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [actualCashAmount, setActualCashAmount] = useState("");
  const [actualChequeAmount, setActualChequeAmount] = useState("");
  const [actualUpiAmount, setActualUpiAmount] = useState("");
  const [actualBankTransferAmount, setActualBankTransferAmount] = useState("");
  const [authorizedExpenseAmount, setAuthorizedExpenseAmount] = useState("");
  const [authorizedExpenseNote, setAuthorizedExpenseNote] = useState("");
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [isReviewStage, setIsReviewStage] = useState(false);
  const [handoverMessage, setHandoverMessage] = useState<string | null>(null);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [handover, setHandover] = useState<VolunteerHandoverData | null>(null);

  async function loadSessionHandover(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from("collection_handovers")
        .select("*")
        .eq("collection_session_id", sessionId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        setHandover(null);
        return null;
      }

      const expectedCash = Number(data.expected_cash_amount ?? 0);
      const expectedCheque = Number(data.expected_cheque_amount ?? 0);
      const expectedUpi = Number(data.expected_upi_amount ?? 0);
      const expectedBankTransfer = Number(
        data.expected_bank_transfer_amount ?? 0
      );

      const restoredHandover: VolunteerHandoverData = {
        id: data.id,
        receiptCount: Number(data.expected_receipt_count ?? 0),
        totalAmount: Number(data.expected_total_amount ?? 0),
        cashAmount: expectedCash,
        upiAmount: expectedUpi,
        chequeAmount: expectedCheque,
        bankTransferAmount: expectedBankTransfer,
        expectedPhysicalAmount: expectedCash + expectedCheque,
        expectedDigitalAmount: expectedUpi + expectedBankTransfer,
        actualCashAmount: Number(data.actual_cash_amount ?? 0),
        actualChequeAmount: Number(data.actual_cheque_amount ?? 0),
        actualUpiAmount: Number(data.actual_upi_amount ?? 0),
        actualBankTransferAmount: Number(
          data.actual_bank_transfer_amount ?? 0
        ),
        authorizedExpenseAmount: Number(
          data.authorized_expense_amount ?? 0
        ),
        authorizedExpenseNote: data.authorized_expense_note ?? null,
        discrepancyReason: data.discrepancy_reason ?? null,
        rejectionReason: data.rejection_reason ?? null,
        status: data.status ?? "pending",
        notes: data.notes ?? null,
      };

      setHandover(restoredHandover);

      // Restore inputs
      setActualCashAmount(
        Number(data.actual_cash_amount ?? 0) > 0
          ? String(data.actual_cash_amount)
          : ""
      );
      setActualChequeAmount(
        Number(data.actual_cheque_amount ?? 0) > 0
          ? String(data.actual_cheque_amount)
          : ""
      );
      setActualUpiAmount(
        Number(data.actual_upi_amount ?? 0) > 0
          ? String(data.actual_upi_amount)
          : ""
      );
      setActualBankTransferAmount(
        Number(data.actual_bank_transfer_amount ?? 0) > 0
          ? String(data.actual_bank_transfer_amount)
          : ""
      );
      setAuthorizedExpenseAmount(
        Number(data.authorized_expense_amount ?? 0) > 0
          ? String(data.authorized_expense_amount)
          : ""
      );
      setAuthorizedExpenseNote(data.authorized_expense_note ?? "");
      setDiscrepancyReason(data.discrepancy_reason ?? "");
      setHandoverNotes(data.notes ?? "");

      if (data.status === "submitted" || data.status === "verified") {
        setIsReviewStage(true);
      }

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
        throw new Error("Handover was created without an identifier.");
      }

      const cash = Number(response.cash_amount ?? 0);
      const cheque = Number(response.cheque_amount ?? 0);
      const upi = Number(response.upi_amount ?? 0);
      const bankTransfer = Number(response.bank_transfer_amount ?? 0);

      setHandover({
        id: response.handover_id,
        receiptCount: response.receipt_count ?? 0,
        totalAmount: Number(response.total_amount ?? 0),
        cashAmount: cash,
        upiAmount: upi,
        chequeAmount: cheque,
        bankTransferAmount: bankTransfer,
        expectedPhysicalAmount: cash + cheque,
        expectedDigitalAmount: upi + bankTransfer,
        actualCashAmount: 0,
        actualChequeAmount: 0,
        actualUpiAmount: 0,
        actualBankTransferAmount: 0,
        authorizedExpenseAmount: 0,
        authorizedExpenseNote: null,
        discrepancyReason: null,
        rejectionReason: null,
        status: response.status ?? "pending",
        notes: null,
      });

      setIsReviewStage(false);
      setHandoverMessage("हिशोब मोजणी सुरू करा (Enter your physical count).");
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
      setHandoverError("This handover is no longer available for submission.");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setHandoverError("इंटरनेट कनेक्शन आवश्यक आहे (Internet connection required to submit handover).");
      return;
    }

    const cash = Number(actualCashAmount || 0);
    const cheque = Number(actualChequeAmount || 0);
    const upi = Number(actualUpiAmount || 0);
    const bankTransfer = Number(actualBankTransferAmount || 0);
    const expense = Number(authorizedExpenseAmount || 0);

    if (
      !Number.isFinite(cash) ||
      !Number.isFinite(cheque) ||
      !Number.isFinite(upi) ||
      !Number.isFinite(bankTransfer) ||
      !Number.isFinite(expense)
    ) {
      setHandoverError("कृपया वैध रक्कम भरा (Please enter valid amounts).");
      return;
    }

    if (cash < 0 || cheque < 0 || upi < 0 || bankTransfer < 0 || expense < 0) {
      setHandoverError("रक्कम ऋण (negative) असू शकत नाही.");
      return;
    }

    setHandoverError(null);
    setHandoverMessage(null);
    setSubmittingHandover(true);

    try {
      const { data, error } = await supabase.rpc(
        "submit_collection_handover",
        {
          p_handover_id: handover.id,
          p_actual_cash_amount: cash,
          p_actual_cheque_amount: cheque,
          p_actual_upi_amount: upi,
          p_actual_bank_transfer_amount: bankTransfer,
          p_authorized_expense_amount: expense,
          p_authorized_expense_note: authorizedExpenseNote.trim() || null,
          p_discrepancy_reason: discrepancyReason.trim() || null,
          p_notes: handoverNotes.trim() || null,
        }
      );

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
        difference?: number;
        discrepancy_type?: string;
        status?: string;
      };

      setHandover((current) =>
        current
          ? {
              ...current,
              status: response.status ?? "submitted",
              actualCashAmount: cash,
              actualChequeAmount: cheque,
              authorizedExpenseAmount: expense,
              authorizedExpenseNote: authorizedExpenseNote.trim() || null,
            }
      : current
      );

      setIsReviewStage(true);
      setHandoverMessage("हिशोब जमा झाला! सेक्रेटरी पडताळणीची प्रतीक्षा आहे (Handover submitted successfully).");
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

  return {
    handover,
    setHandover,
    creatingHandover,
    submittingHandover,
    actualCashAmount,
    setActualCashAmount,
    actualChequeAmount,
    setActualChequeAmount,
    actualUpiAmount,
    setActualUpiAmount,
    actualBankTransferAmount,
    setActualBankTransferAmount,
    authorizedExpenseAmount,
    setAuthorizedExpenseAmount,
    authorizedExpenseNote,
    setAuthorizedExpenseNote,
    discrepancyReason,
    setDiscrepancyReason,
    handoverNotes,
    setHandoverNotes,
    isReviewStage,
    setIsReviewStage,
    handoverMessage,
    setHandoverMessage,
    handoverError,
    setHandoverError,
    loadSessionHandover,
    handleCreateHandover,
    handleSubmitHandover,
  };
}
