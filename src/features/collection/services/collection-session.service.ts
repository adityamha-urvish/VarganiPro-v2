import { supabase } from "@/supabase/client";

import {
  saveBookState,
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
    throw new Error(
      "No authenticated Supabase user."
    );
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
    throw new Error(
      "The VarganiPro user account is inactive."
    );
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
   * 4. Find open collection sessions for the
   *    volunteer.
   *
   * We currently have two test sessions, so we
   * intentionally use the most recently started one.
   */
  const {
    data: sessions,
    error: sessionError,
  } = await supabase
    .from("collection_sessions")
    .select(
      `
        id,
        organization_id,
        event_id,
        volunteer_id,
        receipt_book_id,
        status,
        started_at
      `
    )
    .eq("volunteer_id", volunteer.id)
    .eq("status", "open")
    .order("started_at", {
      ascending: false,
    });

  if (sessionError) {
    throw new Error(
      `Unable to find collection session: ${sessionError.message}`
    );
  }

  const session =
    (sessions as CollectionSessionRow[] | null)?.[0] ??
    null;

  if (!session) {
    throw new Error(
      "No open collection session is assigned to this volunteer."
    );
  }

  /*
   * 5. The session must have a receipt book.
   */
  if (!session.receipt_book_id) {
    throw new Error(
      "The open collection session does not have a receipt book assigned."
    );
  }

  /*
   * 6. Load the receipt book separately.
   *
   * This avoids the PostgREST relationship
   * embedding ambiguity.
   */
  const {
    data: book,
    error: bookError,
  } = await supabase
    .from("receipt_books")
    .select(
      `
        id,
        book_number,
        prefix,
        start_number,
        end_number,
        current_number,
        status,
        assigned_volunteer_id
      `
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
   * 7. Verify receipt-book ownership.
   */
  if (
    book.assigned_volunteer_id !==
    volunteer.id
  ) {
    throw new Error(
      "The receipt book is not assigned to the current volunteer."
    );
  }

  /*
   * 8. Validate receipt number range.
   */
  if (
    book.current_number <
      book.start_number ||
    book.current_number >
      book.end_number + 1
  ) {
    throw new Error(
      "The receipt book has an invalid current receipt number."
    );
  }

  /*
   * 9. Build local offline book state.
   */
  const bookState: OfflineBookState = {
    receiptBookId:
      book.id,

    organizationId:
      session.organization_id,

    eventId:
      session.event_id,

    collectionSessionId:
      session.id,

    volunteerId:
      session.volunteer_id,

    bookNumber:
      book.book_number,

    prefix:
      book.prefix,

    startNumber:
      book.start_number,

    endNumber:
      book.end_number,

    nextLocalNumber:
      book.current_number,

    updatedAt:
      new Date().toISOString(),
  };

  /*
   * 10. Persist the assignment into IndexedDB.
   */
  await saveBookState(bookState);

  /*
   * 11. Return the initialized context.
   */
  return {
    sessionId:
      session.id,

    organizationId:
      session.organization_id,

    eventId:
      session.event_id,

    volunteerId:
      session.volunteer_id,

    receiptBookId:
      book.id,

    bookNumber:
      book.book_number,

    prefix:
      book.prefix,

    startNumber:
      book.start_number,

    endNumber:
      book.end_number,

    currentNumber:
      book.current_number,

    sessionStatus:
      session.status,

    bookStatus:
      book.status,
  };
}