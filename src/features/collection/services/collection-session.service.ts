import { supabase } from "@/supabase/client";

import {
  mergeOfflineBookState,
  type OfflineBookState,
} from "@/lib/offline/offline-db";

export interface CollectionSessionContext {
  sessionId: string;
  organizationId: string;
  eventId: string;
  volunteerId: string;
  receiptBookId: string;

  bookNumber: string;
  prefix: string;

  startNumber: number;
  endNumber: number;
  currentNumber: number;

  sessionStatus: string;
  bookStatus: string;
}

interface CollectionSessionRow {
  id: string;
  organization_id: string;
  event_id: string;
  volunteer_id: string;
  receipt_book_id: string | null;
  status: string;
  started_at: string;
}

export interface ResolveCollectionSessionOptions {
  preferredReceiptBookId?: string;
  strict?: boolean;
}

/**
 * Pure session resolver responsible for user, volunteer, collection-session,
 * and receipt-book data retrieval from Supabase.
 */
export async function resolveCollectionSession(
  options: ResolveCollectionSessionOptions = {}
): Promise<CollectionSessionContext | null> {
  const { preferredReceiptBookId, strict = false } = options;

  /*
   * 1. Get the authenticated Supabase user.
   */
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    if (strict) {
      throw new Error(
        `Unable to read authenticated user: ${authError?.message ?? "No authenticated user"}`
      );
    }
    return null;
  }

  const authUser = authData.user;

  /*
   * 2. Map Supabase Auth user -> public.users.
   */
  const {
    data: appUser,
    error: appUserError,
  } = await supabase
    .from("users")
    .select(
      "id, name, mobile, role, is_active, auth_user_id"
    )
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (appUserError || !appUser) {
    if (strict) {
      throw new Error(
        appUserError
          ? `Unable to find application user: ${appUserError.message}`
          : "No VarganiPro user profile is linked to this Supabase login."
      );
    }
    return null;
  }

  if (strict && !appUser.is_active) {
    throw new Error("The VarganiPro user account is inactive.");
  }

  /*
   * 3. Find the active volunteer profile linked to public.users.id.
   */
  const {
    data: volunteer,
    error: volunteerError,
  } = await supabase
    .from("volunteers")
    .select(
      "id, organization_id, user_id, name, status"
    )
    .eq("user_id", appUser.id)
    .eq("status", "active")
    .maybeSingle();

  if (volunteerError || !volunteer) {
    if (strict) {
      throw new Error(
        volunteerError
          ? `Unable to find volunteer: ${volunteerError.message}`
          : "No active volunteer profile is linked to this VarganiPro user."
      );
    }
    return null;
  }

  /*
   * 4. Session Resolution:
   *
   * If preferredReceiptBookId is provided, query collection_sessions
   * specifically for that book.
   *
   * Otherwise:
   * Prefer an OPEN collection session.
   * If there is no open session, load the most recently started
   * COMPLETED session instead.
   */
  let session: CollectionSessionRow | null = null;

  if (preferredReceiptBookId) {
    const { data: sessionRows, error: sessionError } = await supabase
      .from("collection_sessions")
      .select(
        `id,
         organization_id,
         event_id,
         volunteer_id,
         receipt_book_id,
         status,
         started_at`
      )
      .eq("volunteer_id", volunteer.id)
      .eq("receipt_book_id", preferredReceiptBookId)
      .in("status", ["open", "completed"])
      .order("started_at", { ascending: false })
      .limit(1);

    if (sessionError) {
      if (strict) {
        throw new Error(
          `Unable to find collection session: ${sessionError.message}`
        );
      }
      return null;
    }

    session = (sessionRows as CollectionSessionRow[] | null)?.[0] ?? null;
  } else {
    // 4a. Check open sessions
    const {
      data: openSessions,
      error: openSessionError,
    } = await supabase
      .from("collection_sessions")
      .select(
        `id,
         organization_id,
         event_id,
         volunteer_id,
         receipt_book_id,
         status,
         started_at`
      )
      .eq("volunteer_id", volunteer.id)
      .eq("status", "open")
      .order("started_at", {
        ascending: false,
      });

    if (openSessionError) {
      if (strict) {
        throw new Error(
          `Unable to find open collection session: ${openSessionError.message}`
        );
      }
      return null;
    }

    session =
      (openSessions as CollectionSessionRow[] | null)?.[0] ??
      null;

    // 4b. Fall back to most recent completed session
    if (!session) {
      const {
        data: completedSessions,
        error: completedSessionError,
      } = await supabase
        .from("collection_sessions")
        .select(
          `id,
           organization_id,
           event_id,
           volunteer_id,
           receipt_book_id,
           status,
           started_at`
        )
        .eq("volunteer_id", volunteer.id)
        .eq("status", "completed")
        .order("started_at", {
          ascending: false,
        })
        .limit(1);

      if (completedSessionError) {
        if (strict) {
          throw new Error(
            `Unable to find completed collection session: ${completedSessionError.message}`
          );
        }
        return null;
      }

      session =
        (completedSessions as CollectionSessionRow[] | null)?.[0] ??
        null;
    }
  }

  if (!session) {
    if (strict) {
      throw new Error(
        "No open or recently completed collection session is assigned to this volunteer."
      );
    }
    return null;
  }

  /*
   * 5. The session must have a receipt book.
   */
  if (!session.receipt_book_id) {
    if (strict) {
      throw new Error(
        "The collection session does not have a receipt book assigned."
      );
    }
    return null;
  }

  /*
   * 6. Load the receipt book separately.
   */
  const {
    data: book,
    error: bookError,
  } = await supabase
    .from("receipt_books")
    .select(
      `id,
       book_number,
       prefix,
       start_number,
       end_number,
       current_number,
       status,
       assigned_volunteer_id,
       checked_out_session_id`
    )
    .eq("id", session.receipt_book_id)
    .maybeSingle();

  if (bookError || !book) {
    if (strict) {
      throw new Error(
        bookError
          ? `Unable to load receipt book: ${bookError.message}`
          : "The assigned receipt book could not be found."
      );
    }
    return null;
  }

  /*
   * 7. Strict Validation Checks (ownership and receipt number bounds).
   */
  if (strict) {
    if (
      session.status === "open" &&
      book.assigned_volunteer_id !== volunteer.id
    ) {
      throw new Error(
        "The receipt book is not assigned to the current volunteer."
      );
    }

    if (
      session.status === "completed" &&
      book.checked_out_session_id &&
      book.checked_out_session_id !== session.id
    ) {
      throw new Error(
        "The receipt book is not linked to this completed collection session."
      );
    }

    if (
      book.current_number < book.start_number ||
      book.current_number > book.end_number + 1
    ) {
      throw new Error(
        "The receipt book has an invalid current receipt number."
      );
    }
  }

  /*
   * 8. Return resolved context.
   */
  return {
    sessionId: session.id,
    organizationId: session.organization_id,
    eventId: session.event_id,
    volunteerId: session.volunteer_id,
    receiptBookId: book.id,
    bookNumber: book.book_number,
    prefix: book.prefix,
    startNumber: book.start_number,
    endNumber: book.end_number,
    currentNumber: book.current_number,
    sessionStatus: session.status,
    bookStatus: book.status,
  };
}

/**
 * Strict, throwing initialization for active collection session startup.
 * Primes local IndexedDB book state.
 */
export async function initializeCollectionSession(): Promise<CollectionSessionContext> {
  const context = await resolveCollectionSession({ strict: true });

  if (!context) {
    throw new Error(
      "No open or recently completed collection session is assigned to this volunteer."
    );
  }

  /*
   * Persist the assignment into IndexedDB.
   */
  const bookState: OfflineBookState = {
    receiptBookId: context.receiptBookId,
    organizationId: context.organizationId,
    eventId: context.eventId,
    collectionSessionId: context.sessionId,
    volunteerId: context.volunteerId,
    bookNumber: context.bookNumber,
    prefix: context.prefix,
    startNumber: context.startNumber,
    endNumber: context.endNumber,
    nextLocalNumber: context.currentNumber,
    updatedAt: new Date().toISOString(),
  };

  await mergeOfflineBookState(bookState);

  return context;
}

/**
 * Resilient, nullable loader for fallback session lookup and start-collection checkout.
 * Zero IndexedDB side effects.
 */
export async function loadCurrentCollectionSession(
  preferredReceiptBookId?: string
): Promise<CollectionSessionContext | null> {
  try {
    return await resolveCollectionSession({
      preferredReceiptBookId,
      strict: false,
    });
  } catch (err) {
    console.error("DIRECT SESSION LOAD ERROR:", err);
    return null;
  }
}
