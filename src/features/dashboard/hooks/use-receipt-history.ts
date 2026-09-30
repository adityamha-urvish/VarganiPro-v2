import { useState, useCallback } from "react";

import {
  getLocalReceipts,
  getLocalReceiptsForSession,
  type LocalReceipt,
} from "@/lib/offline/offline-db";
import { syncNextReceipt } from "@/lib/offline/receipt-sync";

export interface UseReceiptHistoryOptions {
  receiptBookId?: string | null;
  collectionSessionId?: string | null;
  onSyncMessage?: (message: string | null) => void;
}

export function useReceiptHistory({
  receiptBookId,
  collectionSessionId,
  onSyncMessage,
}: UseReceiptHistoryOptions = {}) {
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /*
   * Load all locally stored receipts
   * scoped by collectionSessionId (if provided) or receiptBookId.
   */
  const loadReceiptHistory = useCallback(
    async (bookId?: string, sessionId?: string) => {
      const targetSessionId = sessionId ?? collectionSessionId;
      const targetBookId = bookId ?? receiptBookId;

      if (!targetSessionId && !targetBookId) {
        return;
      }

      setHistoryLoading(true);

      try {
        let localReceipts: LocalReceipt[];
        if (targetSessionId) {
          localReceipts = await getLocalReceiptsForSession(targetSessionId);
        } else if (targetBookId) {
          localReceipts = await getLocalReceipts(targetBookId);
        } else {
          localReceipts = [];
        }

        console.log("LOCAL RECEIPT HISTORY:", localReceipts);

        setReceipts(localReceipts);
      } catch (err) {
        console.error("RECEIPT HISTORY ERROR:", err);
      } finally {
        setHistoryLoading(false);
      }
    },
    [collectionSessionId, receiptBookId]
  );

  /*
   * Manually synchronize the next pending receipt.
   */
  const handleSyncNextReceipt = useCallback(
    async () => {
      if (!receiptBookId) {
        return;
      }

      onSyncMessage?.(null);

      try {
        const result = await syncNextReceipt(receiptBookId);

        /*
         * No pending receipt is a valid state.
         */
        if (!result) {
          await loadReceiptHistory(receiptBookId, collectionSessionId ?? undefined);

          onSyncMessage?.(
            "No pending receipts to synchronize."
          );

          return;
        }

        console.log("MANUAL SYNC RESULT:", result);

        await loadReceiptHistory(receiptBookId, collectionSessionId ?? undefined);

        if (result.success) {
          onSyncMessage?.(
            result.alreadyExists
              ? "Receipt was already synchronized."
              : "Receipt synchronized successfully."
          );
        } else if (result.conflict) {
          onSyncMessage?.(
            "Receipt synchronization encountered a conflict."
          );
        } else {
          onSyncMessage?.(
            "No receipt was synchronized."
          );
        }
      } catch (err) {
        console.error("MANUAL SYNC ERROR:", err);

        onSyncMessage?.(
          err instanceof Error
            ? err.message
            : "Unable to synchronize receipt."
        );
      }
    },
    [receiptBookId, collectionSessionId, onSyncMessage, loadReceiptHistory]
  );

  return {
    receipts,
    setReceipts,
    historyLoading,
    loadReceiptHistory,
    handleSyncNextReceipt,
  };
}
