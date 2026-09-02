import { useRef, useState } from "react";
import type { FormEvent } from "react";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { LocalReceipt } from "@/lib/offline/offline-db";
import {
  createLocalReceipt,
  type CreateLocalReceiptInput,
} from "@/lib/offline/receipt-store";
import { drainSyncQueue, syncNextReceipt } from "@/lib/offline/receipt-sync";

import type { PaymentMode } from "../components/receipt-creation-form";

export interface UseReceiptCreationOptions {
  session: CollectionSessionContext | null;
  onReceiptHistoryRefresh?: (receiptBookId: string) => Promise<void>;
  onReceiptCreated?: (receipt: LocalReceipt) => void;
}

export function useReceiptCreation({
  session,
  onReceiptHistoryRefresh,
  onReceiptCreated,
}: UseReceiptCreationOptions) {
  const isSubmittingRef = useRef(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [donorName, setDonorName] = useState("");
  const [donorMobile, setDonorMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<LocalReceipt | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  /*
   * Create the next local receipt.
   */
  async function handleCreateReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingRef.current || creating) {
      return;
    }

    if (!session) {
      setCreateError("Collection session is not initialized.");
      return;
    }

    isSubmittingRef.current = true;
    setCreateError(null);
    setSyncMessage(null);
    setCreating(true);

    try {
      const parsedAmount = Number(amount);

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Amount must be greater than zero.");
      }

      if (!donorName.trim()) {
        throw new Error("Donor name is required.");
      }

      const input: CreateLocalReceiptInput = {
        organizationId: session.organizationId,
        eventId: session.eventId,
        collectionSessionId: session.sessionId,
        receiptBookId: session.receiptBookId,
        volunteerId: session.volunteerId,
        propertyId: propertyId || null,
        donorName: donorName.trim(),
        donorMobile: donorMobile.trim() || null,
        amount: parsedAmount,
        paymentMode,
        paymentReference: paymentReference.trim() || null,
        notes: notes.trim() || null,
      };

      /*
       * Same tested local receipt creation
       * path used for receipts #104 and #105.
       */
      const receipt = await createLocalReceipt(input);

      console.log("LOCAL RECEIPT CREATED:", receipt);

      setCreatedReceipt(receipt);

      /*
       * Update the session's next receipt number immediately upon local allocation,
       * ensuring offline tolerance and real-time counter advancement before network sync.
       */
      onReceiptCreated?.(receipt);

      /*
       * Show the receipt immediately in local
       * history before attempting synchronization.
       */
      await onReceiptHistoryRefresh?.(session.receiptBookId);

      /*
       * Clear form for next receipt.
       */
      setPropertyId(null);
      setDonorName("");
      setDonorMobile("");
      setAmount("");
      setPaymentMode("cash");
      setPaymentReference("");
      setNotes("");

      /*
       * Automatic single-flight background sync.
       */
      try {
        void drainSyncQueue(session.receiptBookId).then(async () => {
          await onReceiptHistoryRefresh?.(session.receiptBookId);
        });

        const syncResult = await syncNextReceipt(session.receiptBookId);

        /*
         * syncNextReceipt can legitimately
         * return null when there is nothing
         * pending to synchronize.
         */
        if (!syncResult) {
          await onReceiptHistoryRefresh?.(session.receiptBookId);

          setSyncMessage(
            "Receipt created locally."
          );

          return;
        }

        console.log("SYNC RESULT:", syncResult);

        /*
         * Reload history so the UI reflects
         * the final synchronization state.
         */
        await onReceiptHistoryRefresh?.(session.receiptBookId);

        if (syncResult.success) {
          if (syncResult.alreadyExists) {
            setSyncMessage(
              "Receipt already existed on the server. No duplicate was created."
            );
          } else {
            setSyncMessage("Receipt created and synced successfully.");
          }
        } else if (syncResult.conflict) {
          setSyncMessage(
            "Receipt created locally, but synchronization requires attention."
          );
        } else {
          setSyncMessage("Receipt created locally and is waiting to sync.");
        }
      } catch (syncError) {
        console.error("SYNC ERROR:", syncError);
        setSyncMessage(
          "Receipt created locally. It will remain available for synchronization."
        );
      }
    } catch (err: unknown) {
      console.error("CREATE LOCAL RECEIPT ERROR:", err);

      setCreateError(
        err instanceof Error
          ? err.message
          : "Unable to create local receipt."
      );
    } finally {
      isSubmittingRef.current = false;
      setCreating(false);
    }
  }

  return {
    propertyId,
    setPropertyId,
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
    createdReceipt,
    createError,
    setCreateError,
    syncMessage,
    setSyncMessage,
    onDonorNameChange: setDonorName,
    onDonorMobileChange: setDonorMobile,
    onAmountChange: setAmount,
    onPaymentModeChange: setPaymentMode,
    onPaymentReferenceChange: setPaymentReference,
    onNotesChange: setNotes,
    handleCreateReceipt,
  };
}
