import { supabase } from "@/supabase/client";

import {
  getLocalReceipts,
  getPendingReceiptsForOwner,
  updateLocalReceiptSyncState,
  type LocalReceipt,
} from "./offline-db";

export function normalizeUUID(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return null;
    return trimmed;
  }
  return null;
}

export function isValidUUID(val: unknown): val is string {
  if (typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

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

export interface StructuredSyncError {
  isPermanent: boolean;
  message: string;
  code?: string;
}

/**
 * Classifies a sync error into permanent (non-retryable) vs transient (retryable).
 */
export function classifySyncError(error: unknown): StructuredSyncError {
  if (!error) {
    return { isPermanent: false, message: "Unknown sync error" };
  }

  const errObj = error as { message?: string; code?: string; details?: string; hint?: string; status?: number };
  const message = typeof error === "string" ? error : errObj.message || JSON.stringify(error);
  const code = String(errObj.code || errObj.status || "").toUpperCase();

  // PostgreSQL syntax / data exception codes
  // 22P02 = invalid_text_representation (e.g. invalid syntax for uuid)
  // 22001 = string_data_right_truncation
  // 22003 = numeric_value_out_of_range
  // 23503 = foreign_key_violation
  // 23514 = check_violation
  // 42P01 = undefined_table
  // 42703 = undefined_column
  const permanentCodes = new Set(["22P02", "22001", "22003", "23503", "23514", "42P01", "42703", "42883"]);
  if (code && permanentCodes.has(code)) {
    return { isPermanent: true, message, code };
  }

  // Known permanent PostgreSQL / business exception patterns
  const permanentPatterns = [
    /invalid input syntax for type uuid/i,
    /outside valid range/i,
    /Amount must be greater than zero/i,
    /Donor name is required/i,
    /Active volunteer profile not found/i,
    /Receipt book not found/i,
    /Collection session is not open/i,
    /Collection session not found/i,
    /Unauthorized/i,
    /Property not found in your organization/i,
  ];

  for (const pattern of permanentPatterns) {
    if (pattern.test(message)) {
      return { isPermanent: true, message, code };
    }
  }

  return { isPermanent: false, message, code };
}

/* -------------------------------------------------
   CONCURRENCY CONTROL & SINGLE-FLIGHT LOCKS
------------------------------------------------- */

const activeBookLocks = new Map<string, Promise<ReceiptSyncResult | null>>();
const activeDrainPromises = new Map<string, Promise<void>>();

/**
 * Synchronizes the next pending or conflict receipt sequentially.
 */
export async function syncNextReceipt(
  receiptBookId: string,
  ownerUserId?: string
): Promise<ReceiptSyncResult | null> {
  const existingBookLock = activeBookLocks.get(receiptBookId);
  if (existingBookLock) {
    return existingBookLock;
  }

  const syncPromise = (async (): Promise<ReceiptSyncResult | null> => {
    try {
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

      // 1. Defensive UUID Normalization (ensures empty strings become null, never "" passed to Postgres)
      const normalizedPropertyId = normalizeUUID(receipt.propertyId);
      const normalizedSessionId = normalizeUUID(receipt.collectionSessionId);
      const normalizedClientReceiptId = normalizeUUID(receipt.clientReceiptId);

      if (!normalizedSessionId) {
        const errorMsg = "Collection session ID is missing or empty";
        await updateLocalReceiptSyncState(receipt.clientReceiptId, "failed", {
          syncAttempts: nextAttempt,
          lastSyncAttemptAt: attemptTime,
          lastSyncError: errorMsg,
        });

        return {
          receipt,
          success: false,
          alreadyExists: false,
          conflict: false,
          response: { message: errorMsg, code: "22P02" },
        };
      }

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
          p_collection_session_id: normalizedSessionId,
          p_property_id: normalizedPropertyId,
          p_receipt_number: receipt.receiptNumber,
          p_donor_name: receipt.donorName,
          p_donor_mobile: receipt.donorMobile?.trim() || null,
          p_amount: receipt.amount,
          p_payment_mode: receipt.paymentMode,
          p_payment_reference: receipt.paymentReference?.trim() || null,
          p_notes: receipt.notes?.trim() || null,
          p_client_receipt_id: normalizedClientReceiptId,
          p_offline_created_at: receipt.offlineCreatedAt,
        }
      );

      console.log("SYNC RESPONSE:", data);
      console.log("SYNC ERROR:", error);

      if (error) {
        const classified = classifySyncError(error);
        const newStatus = classified.isPermanent ? "failed" : "pending";

        await updateLocalReceiptSyncState(
          receipt.clientReceiptId,
          newStatus,
          {
            syncAttempts: nextAttempt,
            lastSyncAttemptAt: attemptTime,
            lastSyncError: classified.message,
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

      const response = (data as SyncResponse) || null;

      if (!response || typeof response !== "object") {
        await updateLocalReceiptSyncState(
          receipt.clientReceiptId,
          "pending",
          {
            syncAttempts: nextAttempt,
            lastSyncAttemptAt: attemptTime,
            lastSyncError: "Empty or invalid response from sync RPC",
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
          alreadyExists: response.already_exists === true,
          conflict: false,
          response,
        };
      }

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
    } finally {
      activeBookLocks.delete(receiptBookId);
    }
  })();

  activeBookLocks.set(receiptBookId, syncPromise);
  return syncPromise;
}

/* -------------------------------------------------
   AUTOMATIC QUEUE DRAIN & ONLINE TRIGGER
------------------------------------------------- */

/**
 * Single-flight automatic queue drain.
 * Sequentially syncs all pending/conflict receipts for a receipt book
 * until the queue is exhausted, network is lost, or a non-retryable error occurs.
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
 * Drains all pending sync queues across all stored receipt books sequentially.
 */
export async function drainAllPendingSyncQueues(
  ownerUserId?: string,
  onProgress?: () => void
): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  try {
    const allPending = await getPendingReceiptsForOwner(ownerUserId);
    const bookIds = Array.from(new Set(allPending.map((r) => r.receiptBookId)));
    for (const bookId of bookIds) {
      await drainSyncQueue(bookId, ownerUserId, onProgress);
    }
  } catch (err) {
    console.warn("Failed to drain all pending queues:", err);
  }
}

/**
 * Sets up automatic background sync on window 'online' event.
 * Returns an unsubscribe cleanup callback.
 */
export function setupAutoSync(
  receiptBookId?: string,
  ownerUserId?: string,
  onSyncComplete?: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleOnline = () => {
    if (receiptBookId) {
      void drainSyncQueue(receiptBookId, ownerUserId, onSyncComplete).then(() => {
        onSyncComplete?.();
      });
    } else {
      void drainAllPendingSyncQueues(ownerUserId, onSyncComplete).then(() => {
        onSyncComplete?.();
      });
    }
  };

  window.addEventListener("online", handleOnline);

  // If already online at the time setup is called, trigger initial drain
  if (typeof navigator !== "undefined" && navigator.onLine) {
    if (receiptBookId) {
      void drainSyncQueue(receiptBookId, ownerUserId, onSyncComplete).then(() => {
        onSyncComplete?.();
      });
    } else {
      void drainAllPendingSyncQueues(ownerUserId, onSyncComplete).then(() => {
        onSyncComplete?.();
      });
    }
  }

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}


