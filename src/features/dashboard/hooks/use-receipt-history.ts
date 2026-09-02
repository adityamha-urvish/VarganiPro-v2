import { useState } from "react";

import {
  getLocalReceipts,
  type LocalReceipt,
} from "@/lib/offline/offline-db";
import { syncNextReceipt } from "@/lib/offline/receipt-sync";

export interface UseReceiptHistoryOptions {
  receiptBookId?: string | null;
  onSyncMessage?: (message: string | null) => void;
}

export function useReceiptHistory({
  receiptBookId,
  onSyncMessage,
}: UseReceiptHistoryOptions = {}) {
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /*
   * Load all locally stored receipts
   * for the active receipt book.
   */
  async function loadReceiptHistory(bookId?: string) {
    const targetBookId = bookId ?? receiptBookId;

    if (!targetBookId) {
      return;
    }

    setHistoryLoading(true);

    try {
      const localReceipts = await getLocalReceipts(targetBookId);

      console.log("LOCAL RECEIPT HISTORY:", localReceipts);

      setReceipts(localReceipts);
    } catch (err) {
      console.error("RECEIPT HISTORY ERROR:", err);
    } finally {
      setHistoryLoading(false);
    }
  }

  /*
   * Manually synchronize the next pending receipt.
   */
  async function handleSyncNextReceipt() {
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
        await loadReceiptHistory(receiptBookId);

        onSyncMessage?.(
          "No pending receipts to synchronize."
        );

        return;
      }

      console.log("MANUAL SYNC RESULT:", result);

      await loadReceiptHistory(receiptBookId);

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
  }

  return {
    receipts,
    setReceipts,
    historyLoading,
    loadReceiptHistory,
    handleSyncNextReceipt,
  };
}
