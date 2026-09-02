-- ==============================================================================
-- Migration: 20260826000001_phase9_properties_and_followups.sql
-- Phase 9-1: DML-Locked Multi-Tenant Properties & Pending Follow-Ups
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enhance public.buildings (Non-destructive + DB Invariants)
-- ------------------------------------------------------------------------------
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS wing text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_floors integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS flats_per_floor integer DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_building_name_not_empty'
  ) THEN
    ALTER TABLE public.buildings
      ADD CONSTRAINT chk_building_name_not_empty CHECK (TRIM(name) <> '');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_buildings_org_name
  ON public.buildings (organization_id, name);

-- Revoke direct table DML (All writes MUST go through create_building RPC)
REVOKE INSERT, UPDATE, DELETE ON public.buildings FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Enhance public.properties (Non-destructive + DB Invariants)
-- ------------------------------------------------------------------------------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS property_type text DEFAULT 'residential',
  ADD COLUMN IF NOT EXISTS flat_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shop_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unit_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS floor_number integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS owner_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_mobile text DEFAULT NULL;

-- Backfill unit_number from flat_number for pre-existing residential rows
UPDATE public.properties
SET unit_number = flat_number
WHERE unit_number IS NULL AND flat_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_property_type_semantics'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT chk_property_type_semantics CHECK (
        (property_type = 'residential' AND building_id IS NOT NULL AND (unit_number IS NOT NULL OR flat_number IS NOT NULL) AND shop_name IS NULL)
        OR (property_type = 'commercial' AND building_id IS NULL AND unit_number IS NULL AND flat_number IS NULL AND shop_name IS NOT NULL)
        OR (property_type = 'office')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_org_building
  ON public.properties (organization_id, building_id);

CREATE INDEX IF NOT EXISTS idx_properties_org_type
  ON public.properties (organization_id, property_type);

-- Revoke direct table DML (All writes MUST go through create_property RPC)
REVOKE INSERT, UPDATE, DELETE ON public.properties FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Create public.collection_follow_ups (DML-Locked)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collection_follow_ups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    created_by_volunteer_id uuid NOT NULL REFERENCES public.volunteers(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'cancelled')),
    reason text NOT NULL CHECK (reason IN (
        'not_home',
        'asked_to_return_later',
        'door_locked',
        'refused',
        'building_closed_access',
        'contact_not_available',
        'other'
    )),
    follow_up_time text DEFAULT NULL,
    notes text DEFAULT NULL,
    resolved_at timestamptz DEFAULT NULL,
    resolved_by_receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL DEFAULT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_event_property_follow_up UNIQUE (event_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_org_event_status
  ON public.collection_follow_ups (organization_id, event_id, status);

CREATE INDEX IF NOT EXISTS idx_follow_ups_property
  ON public.collection_follow_ups (property_id);

-- Enable RLS for read queries
ALTER TABLE public.collection_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view follow-ups in their organization"
  ON public.collection_follow_ups
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.users u ON u.id = om.user_id
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active = true
    )
  );

-- Revoke direct DML from client roles
REVOKE INSERT, UPDATE, DELETE ON public.collection_follow_ups FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. RPC: create_building (Explicit Org & Admin Scoped)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_building(
    p_organization_id uuid,
    p_name text,
    p_code text DEFAULT NULL,
    p_area_name text DEFAULT NULL,
    p_wing text DEFAULT NULL,
    p_total_floors integer DEFAULT NULL,
    p_flats_per_floor integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_building_id uuid;
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    -- Deterministic admin verification for target organization
    IF NOT public.is_organization_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only organization administrators can create buildings';
    END IF;

    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Building name is required';
    END IF;

    INSERT INTO public.buildings (
        organization_id,
        name,
        code,
        area_name,
        wing,
        total_floors,
        flats_per_floor,
        created_at
    )
    VALUES (
        p_organization_id,
        TRIM(p_name),
        NULLIF(TRIM(p_code), ''),
        NULLIF(TRIM(p_area_name), ''),
        NULLIF(TRIM(p_wing), ''),
        p_total_floors,
        p_flats_per_floor,
        NOW()
    )
    RETURNING id INTO v_new_building_id;

    v_result := jsonb_build_object(
        'success', true,
        'building_id', v_new_building_id,
        'organization_id', p_organization_id,
        'name', TRIM(p_name)
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_building(uuid, text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_building(uuid, text, text, text, text, integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_building(uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 5. RPC: create_property (Explicit Org, Admin Scoped, Strict Semantics)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_property(
    p_organization_id uuid,
    p_property_type text,
    p_building_id uuid DEFAULT NULL,
    p_unit_number text DEFAULT NULL,
    p_shop_name text DEFAULT NULL,
    p_owner_name text DEFAULT NULL,
    p_contact_mobile text DEFAULT NULL,
    p_floor_number integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_building RECORD;
    v_new_property_id uuid;
    v_clean_type text;
    v_clean_unit text;
    v_clean_shop text;
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    -- Deterministic admin verification for target organization
    IF NOT public.is_organization_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only organization administrators can create properties';
    END IF;

    v_clean_type := LOWER(TRIM(COALESCE(p_property_type, 'residential')));
    v_clean_unit := NULLIF(TRIM(p_unit_number), '');
    v_clean_shop := NULLIF(TRIM(p_shop_name), '');

    IF v_clean_type NOT IN ('residential', 'commercial') THEN
        RAISE EXCEPTION 'Invalid property type: %. Must be residential or commercial', p_property_type;
    END IF;

    -- Strict property-type semantics
    IF v_clean_type = 'residential' THEN
        IF p_building_id IS NULL THEN
            RAISE EXCEPTION 'Building is required for residential properties';
        END IF;

        IF v_clean_unit IS NULL THEN
            RAISE EXCEPTION 'Unit number is required for residential properties';
        END IF;

        IF v_clean_shop IS NOT NULL THEN
            RAISE EXCEPTION 'Shop name must be null for residential properties';
        END IF;

        -- Verify building belongs to the target organization
        SELECT * INTO v_building
        FROM public.buildings
        WHERE id = p_building_id
          AND organization_id = p_organization_id;

        IF v_building.id IS NULL THEN
            RAISE EXCEPTION 'Building not found in the specified organization';
        END IF;

        INSERT INTO public.properties (
            organization_id,
            building_id,
            flat_number,
            unit_number,
            shop_name,
            property_type,
            floor_number,
            owner_name,
            contact_mobile,
            created_at
        )
        VALUES (
            p_organization_id,
            p_building_id,
            v_clean_unit,
            v_clean_unit,
            NULL,
            'residential',
            p_floor_number,
            NULLIF(TRIM(p_owner_name), ''),
            NULLIF(TRIM(p_contact_mobile), ''),
            NOW()
        )
        RETURNING id INTO v_new_property_id;

    ELSIF v_clean_type = 'commercial' THEN
        IF p_building_id IS NOT NULL THEN
            RAISE EXCEPTION 'Building must be null for commercial shops';
        END IF;

        IF v_clean_shop IS NULL THEN
            RAISE EXCEPTION 'Shop name is required for commercial shops';
        END IF;

        IF v_clean_unit IS NOT NULL THEN
            RAISE EXCEPTION 'Unit number must be null for commercial shops';
        END IF;

        INSERT INTO public.properties (
            organization_id,
            building_id,
            flat_number,
            unit_number,
            shop_name,
            property_type,
            floor_number,
            owner_name,
            contact_mobile,
            created_at
        )
        VALUES (
            p_organization_id,
            NULL,
            NULL,
            NULL,
            v_clean_shop,
            'commercial',
            NULL,
            NULLIF(TRIM(p_owner_name), ''),
            NULLIF(TRIM(p_contact_mobile), ''),
            NOW()
        )
        RETURNING id INTO v_new_property_id;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'property_id', v_new_property_id,
        'organization_id', p_organization_id,
        'property_type', v_clean_type,
        'unit_number', v_clean_unit,
        'shop_name', v_clean_shop
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_property(uuid, text, uuid, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_property(uuid, text, uuid, text, text, text, text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_property(uuid, text, uuid, text, text, text, text, integer) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 6. RPC: record_collection_follow_up (Authoritative Entity Scoped)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_collection_follow_up(
    p_event_id uuid,
    p_property_id uuid,
    p_reason text,
    p_follow_up_time text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id uuid;
    v_calling_volunteer_id uuid;
    v_property RECORD;
    v_event RECORD;
    v_follow_up_id uuid;
    v_clean_reason text;
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL OR p_property_id IS NULL THEN
        RAISE EXCEPTION 'Event ID and Property ID are required';
    END IF;

    v_clean_reason := LOWER(TRIM(p_reason));
    IF v_clean_reason NOT IN (
        'not_home',
        'asked_to_return_later',
        'door_locked',
        'refused',
        'building_closed_access',
        'contact_not_available',
        'other'
    ) THEN
        RAISE EXCEPTION 'Invalid follow-up reason: %', p_reason;
    END IF;

    -- 1. Early Event validation
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive';
    END IF;

    -- 2. Early Property validation
    SELECT * INTO v_property
    FROM public.properties
    WHERE id = p_property_id;

    IF v_property.id IS NULL THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    -- 3. Assert Tenant Boundary: Event and Property must belong to same organization
    IF v_event.organization_id <> v_property.organization_id THEN
        RAISE EXCEPTION 'Event and Property belong to different organizations';
    END IF;

    -- 4. Deterministic volunteer identity for the target organization
    SELECT u.id, v.id
    INTO v_calling_user_id, v_calling_volunteer_id
    FROM public.volunteers v
    JOIN public.users u ON u.id = v.user_id
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active = true
      AND v.organization_id = v_event.organization_id
      AND v.status = 'active'
    LIMIT 1;

    IF v_calling_user_id IS NULL OR v_calling_volunteer_id IS NULL THEN
        RAISE EXCEPTION 'Active volunteer profile not found for this organization';
    END IF;

    -- 5. Upsert follow-up record
    INSERT INTO public.collection_follow_ups (
        organization_id,
        event_id,
        property_id,
        created_by_volunteer_id,
        status,
        reason,
        follow_up_time,
        notes,
        created_at,
        updated_at
    )
    VALUES (
        v_event.organization_id,
        p_event_id,
        p_property_id,
        v_calling_volunteer_id,
        'pending',
        v_clean_reason,
        NULLIF(TRIM(p_follow_up_time), ''),
        NULLIF(TRIM(p_notes), ''),
        NOW(),
        NOW()
    )
    ON CONFLICT (event_id, property_id)
    DO UPDATE SET
        created_by_volunteer_id = EXCLUDED.created_by_volunteer_id,
        status = 'pending',
        reason = EXCLUDED.reason,
        follow_up_time = EXCLUDED.follow_up_time,
        notes = EXCLUDED.notes,
        resolved_at = NULL,
        resolved_by_receipt_id = NULL,
        updated_at = NOW()
    RETURNING id INTO v_follow_up_id;

    v_result := jsonb_build_object(
        'success', true,
        'follow_up_id', v_follow_up_id,
        'property_id', p_property_id,
        'organization_id', v_event.organization_id,
        'status', 'pending',
        'reason', v_clean_reason
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_collection_follow_up(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_collection_follow_up(uuid, uuid, text, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_collection_follow_up(uuid, uuid, text, text, text) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 7. Update sync_offline_receipt (Auto-Resolve Pending Follow-Ups)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_offline_receipt(
    p_collection_session_id uuid,
    p_property_id uuid,
    p_receipt_number integer,
    p_donor_name text,
    p_donor_mobile text,
    p_amount numeric,
    p_payment_mode text,
    p_payment_reference text DEFAULT NULL::text,
    p_notes text DEFAULT NULL::text,
    p_client_receipt_id uuid DEFAULT NULL::uuid,
    p_offline_created_at timestamptz DEFAULT NULL::timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id uuid;
    v_calling_volunteer_id uuid;
    v_session RECORD;
    v_book RECORD;
    v_existing_receipt RECORD;
    v_new_receipt_id uuid;
    v_result jsonb;
BEGIN
    -- 1. Caller authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Check client-receipt-id idempotency
    IF p_client_receipt_id IS NOT NULL THEN
        SELECT * INTO v_existing_receipt
        FROM public.receipts
        WHERE client_receipt_id = p_client_receipt_id;

        IF v_existing_receipt.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_exists', true,
                'receipt_id', v_existing_receipt.id,
                'receipt_number', v_existing_receipt.receipt_number,
                'client_receipt_id', v_existing_receipt.client_receipt_id
            );
        END IF;
    END IF;

    -- 3. Lock and validate collection session FIRST (determines authoritative organization_id)
    SELECT * INTO v_session
    FROM public.collection_sessions
    WHERE id = p_collection_session_id
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Collection session not found';
    END IF;

    IF v_session.status <> 'open' THEN
        RAISE EXCEPTION 'Collection session is not open (status: %)', v_session.status;
    END IF;

    -- 4. Resolve calling user & active volunteer identity FOR THIS EXACT SESSION ORGANIZATION
    SELECT u.id, v.id
    INTO v_calling_user_id, v_calling_volunteer_id
    FROM public.volunteers v
    JOIN public.users u ON u.id = v.user_id
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active = true
      AND v.organization_id = v_session.organization_id
      AND v.status = 'active'
    LIMIT 1;

    IF v_calling_user_id IS NULL OR v_calling_volunteer_id IS NULL THEN
        RAISE EXCEPTION 'Active volunteer profile not found for authenticated user';
    END IF;

    -- 5. Session ownership verification
    IF v_session.volunteer_id <> v_calling_volunteer_id THEN
        RAISE EXCEPTION 'Unauthorized: Authenticated volunteer does not own this collection session';
    END IF;

    -- 6. Lock and validate receipt book derived from session
    SELECT * INTO v_book
    FROM public.receipt_books
    WHERE id = v_session.receipt_book_id
    FOR UPDATE;

    IF v_book.id IS NULL THEN
        RAISE EXCEPTION 'Receipt book not found for session';
    END IF;

    -- 7. Validate receipt number range
    IF p_receipt_number < v_book.start_number OR p_receipt_number > v_book.end_number THEN
        RAISE EXCEPTION 'Receipt number % is outside valid range (% - %)',
            p_receipt_number, v_book.start_number, v_book.end_number;
    END IF;

    -- 8. Duplicate receipt number conflict check
    IF EXISTS (
        SELECT 1 FROM public.receipts
        WHERE receipt_book_id = v_book.id
          AND receipt_number = p_receipt_number
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'sync_status', 'conflict',
            'reason', 'receipt_number_mismatch',
            'message', format('Receipt number %s already registered in book %s', p_receipt_number, v_book.book_number)
        );
    END IF;

    -- 9. Field validation
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero';
    END IF;

    IF p_donor_name IS NULL OR TRIM(p_donor_name) = '' THEN
        RAISE EXCEPTION 'Donor name is required';
    END IF;

    -- 10. Property organization boundary validation (if property is provided)
    IF p_property_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.properties
            WHERE id = p_property_id
              AND organization_id = v_session.organization_id
        ) THEN
            RAISE EXCEPTION 'Property not found in your organization';
        END IF;
    END IF;

    -- 11. Insert receipt row with nested unique_violation handling for concurrent client_receipt_id races
    BEGIN
        INSERT INTO public.receipts (
            organization_id,
            event_id,
            collection_session_id,
            receipt_book_id,
            volunteer_id,
            property_id,
            receipt_number,
            donor_name,
            donor_mobile,
            amount,
            payment_mode,
            payment_reference,
            notes,
            client_receipt_id,
            offline_created_at,
            created_at,
            updated_at
        )
        VALUES (
            v_session.organization_id,
            v_session.event_id,
            v_session.id,
            v_book.id,
            v_calling_volunteer_id,
            p_property_id,
            p_receipt_number,
            TRIM(p_donor_name),
            NULLIF(TRIM(p_donor_mobile), ''),
            p_amount,
            p_payment_mode,
            NULLIF(TRIM(p_payment_reference), ''),
            NULLIF(TRIM(p_notes), ''),
            p_client_receipt_id,
            COALESCE(p_offline_created_at, NOW()),
            NOW(),
            NOW()
        )
        RETURNING id INTO v_new_receipt_id;
    EXCEPTION
        WHEN unique_violation THEN
            IF p_client_receipt_id IS NOT NULL THEN
                SELECT * INTO v_existing_receipt
                FROM public.receipts
                WHERE client_receipt_id = p_client_receipt_id;

                IF v_existing_receipt.id IS NOT NULL THEN
                    RETURN jsonb_build_object(
                        'success', true,
                        'already_exists', true,
                        'receipt_id', v_existing_receipt.id,
                        'receipt_number', v_existing_receipt.receipt_number,
                        'client_receipt_id', v_existing_receipt.client_receipt_id
                    );
                END IF;
            END IF;
            RAISE;
    END;

    -- 12. Advance receipt book current number monotonically
    UPDATE public.receipt_books
    SET
        current_number = GREATEST(COALESCE(current_number, start_number), p_receipt_number + 1),
        updated_at = NOW()
    WHERE id = v_book.id;

    -- 13. Auto-resolve pending follow-up if property is provided
    IF p_property_id IS NOT NULL THEN
        UPDATE public.collection_follow_ups
        SET
            status = 'resolved',
            resolved_at = NOW(),
            resolved_by_receipt_id = v_new_receipt_id,
            updated_at = NOW()
        WHERE event_id = v_session.event_id
          AND property_id = p_property_id
          AND status = 'pending';
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'receipt_id', v_new_receipt_id,
        'receipt_number', p_receipt_number,
        'client_receipt_id', p_client_receipt_id
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_offline_receipt(uuid, uuid, integer, text, text, numeric, text, text, text, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_offline_receipt(uuid, uuid, integer, text, text, numeric, text, text, text, uuid, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.sync_offline_receipt(uuid, uuid, integer, text, text, numeric, text, text, text, uuid, timestamptz) FROM PUBLIC, anon;
