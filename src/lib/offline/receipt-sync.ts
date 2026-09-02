import { supabase } from "@/supabase/client";

import {
  getLocalReceipts,
  updateLocalReceiptSyncState,
  type LocalReceipt,
} from "./offline-db";

export interface ReceiptSyncResult {
  receipt: LocalReceipt;
  success: boolean;
  alreadyExists: boolean;
  conflict: boolean;
  response: unknown;
}

interface SyncResponse {
  success?: boolean;
  already_exists?: boolean;
  sync_status?: string;
  reason?: string;
  message?: string;
  receipt_number?: number;
  next_receipt_number?: number;
}

export async function syncNextReceipt(
  receiptBookId: string,
  ownerUserId?: string
): Promise<ReceiptSyncResult | null> {
  /*
   * Sync Next must consider BOTH pending receipts and
   * previously-conflicted receipts.
   *
   * A receipt-number conflict is not permanent. Once the
   * missing previous receipt has synchronized, the conflicted
   * receipt becomes eligible for retry.
   */
  const localReceipts = await getLocalReceipts(receiptBookId, ownerUserId);

  const syncCandidates = localReceipts.filter(
    (receipt) =>
      receipt.syncStatus === "pending" ||
      receipt.syncStatus === "conflict"
  );

  if (syncCandidates.length === 0) {
    return null;
  }

  /*
   * Always synchronize in receipt-number order.
   * The server enforces sequential receipt numbers.
   */
  syncCandidates.sort(
    (a, b) => a.receiptNumber - b.receiptNumber
  );

  const receipt = syncCandidates[0];

  const attemptTime = new Date().toISOString();
  const nextAttempt = receipt.syncAttempts + 1;

  console.log(
    "SYNCING RECEIPT:",
    receipt.receiptNumber,
    receipt.syncStatus
  );

  await updateLocalReceiptSyncState(
    receipt.clientReceiptId,
    "syncing",
    {
      syncAttempts: nextAttempt,
      lastSyncAttemptAt: attemptTime,
      lastSyncError: null,
    }
  );

  const {
    data,
    error,
  } = await supabase.rpc(
    "sync_offline_receipt",
    {
      p_collection_session_id:
        receipt.collectionSessionId,
      p_property_id:
        receipt.propertyId,
      p_receipt_number:
        receipt.receiptNumber,
      p_donor_name:
        receipt.donorName,
      p_donor_mobile:
        receipt.donorMobile,
      p_amount:
        receipt.amount,
      p_payment_mode:
        receipt.paymentMode,
      p_payment_reference:
        receipt.paymentReference,
      p_notes:
        receipt.notes,
      p_client_receipt_id:
        receipt.clientReceiptId,
      p_offline_created_at:
        receipt.offlineCreatedAt,
    }
  );

  console.log("SYNC RESPONSE:", data);
  console.log("SYNC ERROR:", error);

  /*
   * Network / Supabase RPC error.
   * Keep the receipt pending so it can be retried.
   */
  if (error) {
    await updateLocalReceiptSyncState(
      receipt.clientReceiptId,
      "pending",
      {
        syncAttempts: nextAttempt,
        lastSyncAttemptAt: attemptTime,
        lastSyncError: error.message,
      }
    );

    return {
      receipt,
      success: false,
      alreadyExists: false,
      conflict: false,
      response: error,
    };
  }

  const response = data as SyncResponse;

  /*
   * Receipt-number conflict.
   *
   * Keep it as conflict. The important change is that
   * syncNextReceipt can select it again on a later click,
   * after the previous receipt has synchronized.
   */
  if (
    response.sync_status === "conflict" ||
    response.reason === "receipt_number_mismatch"
  ) {
    await updateLocalReceiptSyncState(
      receipt.clientReceiptId,
      "conflict",
      {
        syncAttempts: nextAttempt,
        lastSyncAttemptAt: attemptTime,
        lastSyncError:
          response.message ??
          response.reason ??
          "Receipt number conflict",
      }
    );

    return {
      receipt,
      success: false,
      alreadyExists: false,
      conflict: true,
      response,
    };
  }

  /*
   * Successful server response, including the idempotent
   * already_exists case.
   */
  if (response.success === true) {
    await updateLocalReceiptSyncState(
      receipt.clientReceiptId,
      "synced",
      {
        syncAttempts: nextAttempt,
        lastSyncAttemptAt: attemptTime,
        lastSyncError: null,
      }
    );

    return {
      receipt,
      success: true,
      alreadyExists:
        response.already_exists === true,
      conflict: false,
      response,
    };
  }

  /*
   * Unexpected server response.
   * Treat it as retryable.
   */
  const unexpectedMessage =
    response.message ??
    "Unexpected sync response from server.";

  await updateLocalReceiptSyncState(
    receipt.clientReceiptId,
    "pending",
    {
      syncAttempts: nextAttempt,
      lastSyncAttemptAt: attemptTime,
      lastSyncError: unexpectedMessage,
    }
  );

  return {
    receipt,
    success: false,
    alreadyExists: false,
    conflict: false,
    response,
  };
}

/* -------------------------------------------------
   AUTOMATIC QUEUE DRAIN & ONLINE TRIGGER
------------------------------------------------- */

const activeDrainPromises = new Map<string, Promise<void>>();

/**
 * Single-flight automatic queue drain.
 * Sequentially syncs all pending/conflict receipts for a receipt book
 * until the queue is exhausted, network is lost, or an error occurs.
 */
export async function drainSyncQueue(
  receiptBookId: string,
  ownerUserId?: string,
  onProgress?: () => void
): Promise<void> {
  const existing = activeDrainPromises.get(receiptBookId);
  if (existing) {
    return existing;
  }

  const drainPromise = (async () => {
    try {
      let keepDraining = true;
      while (keepDraining) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          break;
        }

        const result = await syncNextReceipt(receiptBookId, ownerUserId);
        if (!result) {
          // No more candidates waiting to sync
          break;
        }

        onProgress?.();

        // If sync failed due to network or non-retryable reason, stop draining loop
        if (!result.success && !result.alreadyExists) {
          keepDraining = false;
        }
      }
    } finally {
      activeDrainPromises.delete(receiptBookId);
    }
  })();

  activeDrainPromises.set(receiptBookId, drainPromise);
  return drainPromise;
}

/**
 * Sets up automatic background sync on window 'online' event.
 * Returns an unsubscribe cleanup callback.
 */
export function setupAutoSync(
  receiptBookId: string,
  ownerUserId?: string,
  onSyncComplete?: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleOnline = () => {
    void drainSyncQueue(receiptBookId, ownerUserId, onSyncComplete).then(() => {
      onSyncComplete?.();
    });
  };

  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}


