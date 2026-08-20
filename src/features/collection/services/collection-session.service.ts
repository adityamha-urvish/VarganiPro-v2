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

export async function initializeCollectionSession(): Promise<
  CollectionSessionContext
> {
  /*
   * 1. Get the authenticated Supabase user.
   */
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(
      `Unable to read authenticated user: ${authError.message}`
    );
  }

  const authUser = authData.user;

  if (!authUser) {
    throw new Error("No authenticated Supabase user.");
  }

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

  if (appUserError) {
    throw new Error(
      `Unable to find application user: ${appUserError.message}`
    );
  }

  if (!appUser) {
    throw new Error(
      "No VarganiPro user profile is linked to this Supabase login."
    );
  }

  if (!appUser.is_active) {
    throw new Error("The VarganiPro user account is inactive.");
  }

  /*
   * 3. Find the active volunteer profile linked
   *    to public.users.id.
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

  if (volunteerError) {
    throw new Error(
      `Unable to find volunteer: ${volunteerError.message}`
    );
  }

  if (!volunteer) {
    throw new Error(
      "No active volunteer profile is linked to this VarganiPro user."
    );
  }

  /*
   * 4. Prefer an OPEN collection session.
   *
   * If there is no open session, load the most recently
   * started COMPLETED session instead.
   *
   * This is important after a volunteer closes a session:
   * the dashboard still needs to display the completed
   * session so its summary and handover workflow remain
   * accessible.
   *
   * A new receipt can only be created while sessionStatus
   * is "open" (enforced by the dashboard).
   */

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
    throw new Error(
      `Unable to find open collection session: ${openSessionError.message}`
    );
  }

  let session =
    (openSessions as CollectionSessionRow[] | null)?.[0] ??
    null;

  /*
   * No open session. Fall back to the most recent
   * completed session so the volunteer can finish the
   * handover workflow.
   */
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
      throw new Error(
        `Unable to find completed collection session: ${completedSessionError.message}`
      );
    }

    session =
      (completedSessions as CollectionSessionRow[] | null)?.[0] ??
      null;
  }

  if (!session) {
    throw new Error(
      "No open or recently completed collection session is assigned to this volunteer."
    );
  }

  /*
   * 5. The session must have a receipt book.
   */
  if (!session.receipt_book_id) {
    throw new Error(
      "The collection session does not have a receipt book assigned."
    );
  }

  /*
   * 6. Load the receipt book separately.
   *
   * This avoids the PostgREST relationship embedding
   * ambiguity.
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

  if (bookError) {
    throw new Error(
      `Unable to load receipt book: ${bookError.message}`
    );
  }

  if (!book) {
    throw new Error(
      "The assigned receipt book could not be found."
    );
  }

  /*
   * 7. Verify receipt-book ownership for an OPEN session.
   *
   * A COMPLETED session must remain restorable after refresh even
   * if the book has already been released/reassigned. In that case
   * the authoritative relationship is the collection session itself.
   */
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

  /*
   * 8. Validate receipt number range.
   */
  if (
    book.current_number < book.start_number ||
    book.current_number > book.end_number + 1
  ) {
    throw new Error(
      "The receipt book has an invalid current receipt number."
    );
  }

  /*
   * 9. Build local offline book state.
   *
   * We continue saving the server's current number as the
   * local next number. The receipt creation workflow itself
   * checks sessionStatus before allowing a new receipt.
   */
  const bookState: OfflineBookState = {
    receiptBookId: book.id,

    organizationId: session.organization_id,

    eventId: session.event_id,

    collectionSessionId: session.id,

    volunteerId: session.volunteer_id,

    bookNumber: book.book_number,

    prefix: book.prefix,

    startNumber: book.start_number,

    endNumber: book.end_number,

    nextLocalNumber: book.current_number,

    updatedAt: new Date().toISOString(),
  };

  /*
   * 10. Persist the assignment into IndexedDB.
   */
  await mergeOfflineBookState(bookState);

  /*
   * 11. Return the initialized context.
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
