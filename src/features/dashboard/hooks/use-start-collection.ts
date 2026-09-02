import { useEffect, useState } from "react";

import { supabase } from "@/supabase/client";

import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";

import type {
  StartCollectionBook,
  StartCollectionEvent,
} from "../components/start-collection-card";

export interface UseStartCollectionOptions {
  session: CollectionSessionContext | null;
  loading: boolean;
  isAdmin: boolean;
  organizationId: string | null;
  loadCurrentCollectionSession: (
    preferredReceiptBookId?: string
  ) => Promise<CollectionSessionContext | null>;
  onSessionStarted: (newSession: CollectionSessionContext) => Promise<void>;
}

export function useStartCollection({
  session,
  loading,
  isAdmin,
  organizationId,
  loadCurrentCollectionSession,
  onSessionStarted,
}: UseStartCollectionOptions) {
  const [startSessionLoading, setStartSessionLoading] = useState(false);
  const [startSessionError, setStartSessionError] = useState<string | null>(null);
  const [availableEvents, setAvailableEvents] = useState<StartCollectionEvent[]>([]);
  const [availableBooks, setAvailableBooks] = useState<StartCollectionBook[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");

  /*
   * Load collection handovers for the current admin's organization.
   */
  async function loadAvailableBooks(eventId: string) {
    setStartSessionError(null);
    setSelectedBookId("");

    try {
      const { data, error } = await supabase
        .from("receipt_books")
        .select(
          "id, book_number, prefix, start_number, end_number, current_number, status, event_id"
        )
        .eq("event_id", eventId)
        .or("status.eq.available,status.eq.assigned")
        .order("book_number", { ascending: true });

      if (error) throw new Error(error.message);

      const books = (data ?? []) as StartCollectionBook[];
      setAvailableBooks(books);

      if (books.length === 1) {
        setSelectedBookId(books[0].id);
      }
    } catch (err) {
      console.error("AVAILABLE BOOKS ERROR:", err);
      setStartSessionError(
        err instanceof Error
          ? err.message
          : "Unable to load available receipt books."
      );
      setAvailableBooks([]);
    }
  }

  async function loadStartSessionOptions() {
    setStartSessionError(null);

    try {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, code, start_date, end_date")
        .eq("is_active", true)
        .order("start_date", { ascending: true });

      if (error) throw new Error(error.message);

      const events = (data ?? []) as StartCollectionEvent[];
      setAvailableEvents(events);

      if (events.length > 0) {
        const preferred =
          events.find((event) => event.id === session?.eventId) ?? events[0];
        setSelectedEventId(preferred.id);
        await loadAvailableBooks(preferred.id);
      } else {
        setAvailableBooks([]);
      }
    } catch (err) {
      console.error("START SESSION OPTIONS ERROR:", err);
      setStartSessionError(
        err instanceof Error
          ? err.message
          : "Unable to load events and receipt books."
      );
    }
  }

  async function handleStartCollectionSession() {
    if (!selectedEventId) {
      setStartSessionError("Please select an event.");
      return;
    }

    if (!selectedBookId) {
      setStartSessionError("Please select a receipt book.");
      return;
    }

    if (
      !window.confirm(
        "Start this collection session?\n\nThe selected receipt book will be checked out to you."
      )
    ) {
      return;
    }

    setStartSessionError(null);
    setStartSessionLoading(true);

    try {
      const { data, error } = await supabase.rpc("start_collection_session", {
        p_event_id: selectedEventId,
        p_receipt_book_id: selectedBookId,
      });

      if (error) throw new Error(error.message);

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        data.success !== true
      ) {
        throw new Error(
          "Unexpected response while starting collection session."
        );
      }

      const newSession = await loadCurrentCollectionSession(selectedBookId);

      if (!newSession) {
        throw new Error(
          "Collection session was created, but the new open session could not be loaded."
        );
      }

      setAvailableBooks([]);
      setSelectedBookId("");
      setStartSessionError(null);

      await onSessionStarted(newSession);
    } catch (err) {
      console.error("START SESSION ERROR:", err);
      setStartSessionError(
        err instanceof Error
          ? err.message
          : "Unable to start collection session."
      );
    } finally {
      setStartSessionLoading(false);
    }
  }

  useEffect(() => {
    if (!loading && (!session || session.sessionStatus === "completed")) {
      void loadStartSessionOptions();
    }
  }, [loading, session?.sessionId, session?.eventId, isAdmin, organizationId]);

  return {
    startSessionLoading,
    startSessionError,
    setStartSessionError,
    availableEvents,
    availableBooks,
    selectedEventId,
    setSelectedEventId,
    selectedBookId,
    setSelectedBookId,
    loadAvailableBooks,
    loadStartSessionOptions,
    handleStartCollectionSession,
  };
}
