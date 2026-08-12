import { supabase } from "@/supabase/client";

import {
  getPendingReceipts,
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
  receiptBookId: string
): Promise<ReceiptSyncResult | null> {
  const pendingReceipts =
    await getPendingReceipts(receiptBookId);

  if (pendingReceipts.length === 0) {
    return null;
  }

  /*
   * Always synchronize in receipt-number
   * order. This is required because the
   * server enforces sequential receipt
   * numbers.
   */
  pendingReceipts.sort(
    (a, b) =>
      a.receiptNumber -
      b.receiptNumber
  );

  const receipt = pendingReceipts[0];

  const attemptTime =
    new Date().toISOString();

  const nextAttempt =
    receipt.syncAttempts + 1;

  console.log(
    "SYNCING RECEIPT:",
    receipt.receiptNumber
  );

  /*
   * Mark the receipt as syncing before
   * contacting Supabase.
   */
  await updateLocalReceiptSyncState(
    receipt.clientReceiptId,
    "syncing",
    {
      syncAttempts:
        nextAttempt,

      lastSyncAttemptAt:
        attemptTime,

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

  console.log(
    "SYNC RESPONSE:",
    data
  );

  console.log(
    "SYNC ERROR:",
    error
  );

  /*
   * Network / Supabase RPC error.
   *
   * Keep the receipt pending so it can
   * safely be retried later.
   */
  if (error) {
    await updateLocalReceiptSyncState(
      receipt.clientReceiptId,
      "pending",
      {
        syncAttempts:
          nextAttempt,

        lastSyncAttemptAt:
          attemptTime,

        lastSyncError:
          error.message,
      }
    );

    return {
      receipt: {
        ...receipt,
        syncStatus: "pending",
        syncAttempts: nextAttempt,
        lastSyncAttemptAt:
          attemptTime,
        lastSyncError:
          error.message,
      },
      success: false,
      alreadyExists: false,
      conflict: false,
      response: error,
    };
  }

  const response =
    data as SyncResponse;

  /*
   * Server-side receipt-number conflict.
   *
   * Do NOT continue to the next receipt.
   */
  if (
    response.sync_status ===
      "conflict" ||
    response.reason ===
      "receipt_number_mismatch"
  ) {
    const conflictMessage =
      response.message ??
      response.reason ??
      "Receipt number conflict";

    await updateLocalReceiptSyncState(
      receipt.clientReceiptId,
      "conflict",
      {
        syncAttempts:
          nextAttempt,

        lastSyncAttemptAt:
          attemptTime,

        lastSyncError:
          conflictMessage,
      }
    );

    return {
      receipt: {
        ...receipt,
        syncStatus: "conflict",
        syncAttempts: nextAttempt,
        lastSyncAttemptAt:
          attemptTime,
        lastSyncError:
          conflictMessage,
      },
      success: false,
      alreadyExists: false,
      conflict: true,
      response,
    };
  }

  /*
   * Successful server response.
   *
   * This includes the idempotent
   * already_exists case.
   */
  if (
    response.success === true
  ) {
    await updateLocalReceiptSyncState(
      receipt.clientReceiptId,
      "synced",
      {
        syncAttempts:
          nextAttempt,

        lastSyncAttemptAt:
          attemptTime,

        /*
         * Clear any previous network
         * or synchronization error.
         */
        lastSyncError: null,
      }
    );

    return {
      receipt: {
        ...receipt,
        syncStatus: "synced",
        syncAttempts: nextAttempt,
        lastSyncAttemptAt:
          attemptTime,
        lastSyncError: null,
      },
      success: true,
      alreadyExists:
        response.already_exists ===
        true,
      conflict: false,
      response,
    };
  }

  /*
   * Unexpected server response.
   *
   * Treat it as retryable rather than
   * incorrectly marking the receipt
   * as synced.
   */
  const unexpectedMessage =
    response.message ??
    "Unexpected sync response from server.";

  await updateLocalReceiptSyncState(
    receipt.clientReceiptId,
    "pending",
    {
      syncAttempts:
        nextAttempt,

      lastSyncAttemptAt:
        attemptTime,

      lastSyncError:
        unexpectedMessage,
    }
  );

  return {
    receipt: {
      ...receipt,
      syncStatus: "pending",
      syncAttempts: nextAttempt,
      lastSyncAttemptAt:
        attemptTime,
      lastSyncError:
        unexpectedMessage,
    },
    success: false,
    alreadyExists: false,
    conflict: false,
    response,
  };
}