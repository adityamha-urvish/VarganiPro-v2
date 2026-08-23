import { useState } from "react";

import { supabase } from "@/supabase/client";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";

export interface UseCloseSessionOptions {
  session: CollectionSessionContext | null;
  pendingCount: number;
  conflictCount: number;
  receiptCount: number;
  totalAmount: number;
  onSessionCompleted?: () => void;
}

export function useCloseSession({
  session,
  pendingCount,
  conflictCount,
  receiptCount,
  totalAmount,
  onSessionCompleted,
}: UseCloseSessionOptions) {
  const [closingSession, setClosingSession] = useState(false);
  const [sessionCloseMessage, setSessionCloseMessage] = useState<string | null>(null);
  const [sessionCloseError, setSessionCloseError] = useState<string | null>(null);

  async function handleCloseSession() {
    if (!session || session.sessionStatus !== "open") {
      return;
    }

    setSessionCloseMessage(null);
    setSessionCloseError(null);

    if (pendingCount > 0) {
      setSessionCloseError(
        `Cannot close session. ${pendingCount} receipt(s) are still waiting to sync.`
      );
      return;
    }

    if (conflictCount > 0) {
      setSessionCloseError(
        `Cannot close session. ${conflictCount} receipt(s) have synchronization conflicts.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Close this collection session?\n\n` +
        `Receipts: ${receiptCount}\n` +
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

      onSessionCompleted?.();

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

  return {
    closingSession,
    sessionCloseMessage,
    sessionCloseError,
    handleCloseSession,
  };
}
