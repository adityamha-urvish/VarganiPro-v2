-- Step 8E-7: Harden start_collection_session Assigned-Book Authorization
-- Verifies that an assigned receipt book can only be checked out by its assigned volunteer
-- Rejects assigned receipt books with NULL assigned_volunteer_id or mismatched assigned_volunteer_id

CREATE OR REPLACE FUNCTION public.start_collection_session(
    p_event_id uuid,
    p_receipt_book_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id uuid;
    v_calling_volunteer_id uuid;
    v_organization_id uuid;
    v_event RECORD;
    v_book RECORD;
    v_existing_open_session RECORD;
    v_session_id uuid;
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT u.id, v.id, v.organization_id
    INTO v_calling_user_id, v_calling_volunteer_id, v_organization_id
    FROM public.volunteers v
    JOIN public.users u ON u.id = v.user_id
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active = true
      AND v.status = 'active'
    LIMIT 1;

    IF v_calling_user_id IS NULL OR v_calling_volunteer_id IS NULL THEN
        RAISE EXCEPTION 'Active volunteer profile not found for authenticated user';
    END IF;

    SELECT id INTO v_existing_open_session
    FROM public.collection_sessions
    WHERE volunteer_id = v_calling_volunteer_id
      AND status = 'open'
    LIMIT 1;

    IF v_existing_open_session.id IS NOT NULL THEN
        RAISE EXCEPTION 'Volunteer already has an active open collection session';
    END IF;

    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND organization_id = v_organization_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive in your organization';
    END IF;

    SELECT * INTO v_book
    FROM public.receipt_books
    WHERE id = p_receipt_book_id
      AND organization_id = v_organization_id
      AND event_id = p_event_id
    FOR UPDATE;

    IF v_book.id IS NULL THEN
        RAISE EXCEPTION 'Receipt book not found for this event and organization';
    END IF;

    IF v_book.status <> 'available' AND v_book.status <> 'assigned' THEN
        RAISE EXCEPTION 'Receipt book is not available for collection (status: %)', v_book.status;
    END IF;

    IF v_book.status = 'assigned' THEN
        IF v_book.assigned_volunteer_id IS NULL
           OR v_book.assigned_volunteer_id <> v_calling_volunteer_id THEN
            RAISE EXCEPTION 'Receipt book is assigned to another volunteer';
        END IF;
    END IF;

    INSERT INTO public.collection_sessions (
        organization_id,
        event_id,
        volunteer_id,
        receipt_book_id,
        status,
        started_at,
        created_at,
        updated_at
    )
    VALUES (
        v_organization_id,
        p_event_id,
        v_calling_volunteer_id,
        p_receipt_book_id,
        'open',
        NOW(),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_session_id;

    UPDATE public.receipt_books
    SET
        status = 'checked_out',
        checked_out_session_id = v_session_id,
        checked_out_by = v_calling_volunteer_id,
        checked_out_at = NOW(),
        updated_at = NOW()
    WHERE id = v_book.id;

    v_result := jsonb_build_object(
        'success', true,
        'collection_session_id', v_session_id,
        'receipt_book_id', v_book.id,
        'book_number', v_book.book_number,
        'prefix', v_book.prefix,
        'start_number', v_book.start_number,
        'end_number', v_book.end_number,
        'current_number', COALESCE(v_book.current_number, v_book.start_number)
    );

    RETURN v_result;
END;
$$;
