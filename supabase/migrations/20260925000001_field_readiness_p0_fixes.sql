-- ==============================================================================
-- Migration: 20260925000001_field_readiness_p0_fixes.sql
-- Field Readiness P0:
-- 1. quick_add_flat: support p_contact_mobile, volunteer + admin authorized
-- 2. quick_add_building: volunteer door-to-door discovery, tenant-scoped
-- 3. get_secretary_overview_metrics: Asia/Kolkata timezone & offline_created_at alignment
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. quick_add_flat (Corridor Quick Add with Mobile & Admin/Volunteer Auth)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quick_add_flat(
    p_building_id uuid,
    p_unit_number text,
    p_floor_number integer DEFAULT NULL,
    p_owner_name text DEFAULT NULL,
    p_contact_mobile text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_building RECORD;
    v_clean_unit text;
    v_clean_owner text;
    v_clean_mobile text;
    v_existing_prop RECORD;
    v_new_prop_id uuid;
    v_is_admin boolean;
    v_is_volunteer boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_building_id IS NULL THEN
        RAISE EXCEPTION 'Building ID is required';
    END IF;

    v_clean_unit := TRIM(COALESCE(p_unit_number, ''));
    IF v_clean_unit = '' THEN
        RAISE EXCEPTION 'Unit number is required';
    END IF;

    v_clean_owner := NULLIF(TRIM(COALESCE(p_owner_name, '')), '');
    v_clean_mobile := NULLIF(TRIM(COALESCE(p_contact_mobile, '')), '');

    -- Lookup target building and its organization
    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = p_building_id;

    IF v_building.id IS NULL THEN
        RAISE EXCEPTION 'Building not found';
    END IF;

    -- Verify caller authorization: Organization Admin OR Active Volunteer in building's organization
    v_is_admin := public.is_organization_admin(v_building.organization_id);

    SELECT EXISTS (
        SELECT 1
        FROM public.volunteers v
        JOIN public.users u ON u.id = v.user_id
        WHERE u.auth_user_id = auth.uid()
          AND u.is_active = true
          AND v.organization_id = v_building.organization_id
          AND v.status = 'active'
    ) INTO v_is_volunteer;

    IF NOT v_is_admin AND NOT v_is_volunteer THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer in this organization';
    END IF;

    -- Check if property already exists in this building
    SELECT id, owner_name, contact_mobile INTO v_existing_prop
    FROM public.properties
    WHERE organization_id = v_building.organization_id
      AND building_id = p_building_id
      AND (
          LOWER(TRIM(COALESCE(unit_number, ''))) = LOWER(v_clean_unit)
          OR LOWER(TRIM(COALESCE(flat_number, ''))) = LOWER(v_clean_unit)
          OR LOWER(TRIM(COALESCE(property_number, ''))) = LOWER(v_clean_unit)
      )
    LIMIT 1;

    IF v_existing_prop.id IS NOT NULL THEN
        -- Non-destructive update of owner / mobile if provided and previously missing
        IF (v_clean_owner IS NOT NULL AND v_existing_prop.owner_name IS NULL)
           OR (v_clean_mobile IS NOT NULL AND v_existing_prop.contact_mobile IS NULL) THEN
            UPDATE public.properties
            SET owner_name = COALESCE(v_existing_prop.owner_name, v_clean_owner),
                contact_mobile = COALESCE(v_existing_prop.contact_mobile, v_clean_mobile)
            WHERE id = v_existing_prop.id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'property_id', v_existing_prop.id,
            'is_existing', true,
            'unit_number', v_clean_unit
        );
    END IF;

    INSERT INTO public.properties (
        organization_id,
        building_id,
        property_number,
        unit_number,
        flat_number,
        property_type,
        floor_number,
        owner_name,
        contact_mobile,
        is_active,
        created_at
    )
    VALUES (
        v_building.organization_id,
        p_building_id,
        v_clean_unit,
        v_clean_unit,
        v_clean_unit,
        'residential',
        p_floor_number,
        v_clean_owner,
        v_clean_mobile,
        true,
        NOW()
    )
    RETURNING id INTO v_new_prop_id;

    RETURN jsonb_build_object(
        'success', true,
        'property_id', v_new_prop_id,
        'is_existing', false,
        'unit_number', v_clean_unit
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quick_add_flat(uuid, text, integer, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.quick_add_flat(uuid, text, integer, text, text) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 2. quick_add_building (Dedicated Volunteer Discovery RPC)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quick_add_building(
    p_organization_id uuid,
    p_name text,
    p_wing text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_name text;
    v_clean_wing text;
    v_is_admin boolean;
    v_is_volunteer boolean;
    v_slug text;
    v_seq integer;
    v_code text;
    v_new_building_id uuid;
    v_retry_count integer := 0;
    v_max_retries CONSTANT integer := 10;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID is required';
    END IF;

    v_clean_name := TRIM(COALESCE(p_name, ''));
    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'Building name is required';
    END IF;

    v_clean_wing := NULLIF(TRIM(COALESCE(p_wing, '')), '');

    -- Verify caller authorization
    v_is_admin := public.is_organization_admin(p_organization_id);

    SELECT EXISTS (
        SELECT 1
        FROM public.volunteers v
        JOIN public.users u ON u.id = v.user_id
        WHERE u.auth_user_id = auth.uid()
          AND u.is_active = true
          AND v.organization_id = p_organization_id
          AND v.status = 'active'
    ) INTO v_is_volunteer;

    IF NOT v_is_admin AND NOT v_is_volunteer THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither an administrator nor an active volunteer in this organization';
    END IF;

    -- Generate building slug
    v_slug := UPPER(SUBSTRING(REGEXP_REPLACE(v_clean_name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 6));
    IF v_slug IS NULL OR v_slug = '' THEN
        v_slug := 'BLD';
    END IF;

    -- Concurrency-Safe Building Code Generation Retry Loop
    LOOP
        SELECT COALESCE(COUNT(*), 0) + 1 + v_retry_count INTO v_seq
        FROM public.buildings
        WHERE organization_id = p_organization_id;

        v_code := 'BLD-' || v_slug || '-' || v_seq::text;

        BEGIN
            INSERT INTO public.buildings (
                organization_id,
                name,
                code,
                wing,
                is_active,
                created_at,
                updated_at
            )
            VALUES (
                p_organization_id,
                v_clean_name,
                v_code,
                v_clean_wing,
                true,
                NOW(),
                NOW()
            )
            RETURNING id INTO v_new_building_id;

            EXIT; -- Success
        EXCEPTION
            WHEN unique_violation THEN
                v_retry_count := v_retry_count + 1;
                IF v_retry_count >= v_max_retries THEN
                    RAISE EXCEPTION 'Failed to allocate unique building code after % attempts', v_max_retries;
                END IF;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'building_id', v_new_building_id,
        'building_name', v_clean_name,
        'wing', v_clean_wing,
        'code', v_code
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quick_add_building(uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.quick_add_building(uuid, text, text) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 3. get_secretary_overview_metrics (Aligned with Asia/Kolkata & offline_created_at)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_secretary_overview_metrics(
    p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event RECORD;
    v_today_start_utc timestamptz;
    v_today_end_utc timestamptz;
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    -- Validate Event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive';
    END IF;

    -- Authorize Secretary / Admin for this organization
    IF NOT public.is_organization_admin(v_event.organization_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an administrator of this organization';
    END IF;

    -- Time boundaries for today in Asia/Kolkata operational timezone
    -- Start of current IST day converted to UTC timestamptz
    v_today_start_utc := (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')) AT TIME ZONE 'Asia/Kolkata';
    v_today_end_utc := v_today_start_utc + interval '1 day';

    -- Aggregate metrics via CTEs
    WITH
    event_valid_receipts AS (
        SELECT
            id,
            amount,
            payment_mode,
            volunteer_id,
            property_id,
            COALESCE(offline_created_at, created_at) AS effective_created_at
        FROM public.receipts
        WHERE event_id = p_event_id
          AND status IN ('valid', 'issued')
          AND voided_at IS NULL
          AND cancelled_at IS NULL
    ),
    today_receipts AS (
        SELECT *
        FROM event_valid_receipts
        WHERE effective_created_at >= v_today_start_utc
          AND effective_created_at < v_today_end_utc
    ),
    property_receipts AS (
        SELECT
            r.property_id,
            COUNT(r.id) AS receipt_count
        FROM event_valid_receipts r
        WHERE r.property_id IS NOT NULL
        GROUP BY r.property_id
    ),
    property_follow_ups AS (
        SELECT
            f.property_id,
            f.status,
            f.reason
        FROM public.collection_follow_ups f
        WHERE f.event_id = p_event_id
    ),
    distinct_residential_properties AS (
        SELECT
            p.id AS property_id,
            CASE
                WHEN pr.property_id IS NOT NULL THEN 'collected'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' AND pfu.reason = 'refused' THEN 'refused'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' THEN 'pending'
                ELSE 'not_visited'
            END AS status
        FROM public.properties p
        LEFT JOIN property_receipts pr ON pr.property_id = p.id
        LEFT JOIN property_follow_ups pfu ON pfu.property_id = p.id
        WHERE p.organization_id = v_event.organization_id
          AND p.building_id IS NOT NULL
          AND p.is_active = true
    ),
    property_progress_summary AS (
        SELECT
            COUNT(*)::integer AS total_residential_units,
            COUNT(*) FILTER (WHERE status = 'collected')::integer AS collected_count,
            COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending_count,
            COUNT(*) FILTER (WHERE status = 'refused')::integer AS refused_count,
            COUNT(*) FILTER (WHERE status = 'not_visited')::integer AS not_visited_count
        FROM distinct_residential_properties
    ),
    vol_cash_collected AS (
        SELECT
            volunteer_id,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cash'), 0) AS total_cash,
            COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'cheque'), 0) AS total_cheque
        FROM event_valid_receipts
        GROUP BY volunteer_id
    ),
    vol_cash_verified_handovers AS (
        SELECT
            volunteer_id,
            COALESCE(SUM(actual_cash_amount), 0) AS handed_cash,
            COALESCE(SUM(actual_cheque_amount), 0) AS handed_cheque,
            COALESCE(SUM(authorized_expense_amount), 0) AS verified_expenses
        FROM public.collection_handovers
        WHERE event_id = p_event_id
          AND status = 'verified'
        GROUP BY volunteer_id
    ),
    volunteer_balances AS (
        SELECT
            v.id AS volunteer_id,
            GREATEST(0,
                COALESCE(vcc.total_cash, 0) + COALESCE(vcc.total_cheque, 0) - 
                COALESCE(vh.handed_cash, 0) - COALESCE(vh.handed_cheque, 0) - 
                COALESCE(vh.verified_expenses, 0)
            ) AS outstanding_physical_held
        FROM public.volunteers v
        LEFT JOIN vol_cash_collected vcc ON vcc.volunteer_id = v.id
        LEFT JOIN vol_cash_verified_handovers vh ON vh.volunteer_id = v.id
        WHERE v.organization_id = v_event.organization_id
    ),
    handover_metrics AS (
        SELECT
            COUNT(*) FILTER (WHERE status = 'submitted')::integer AS pending_handover_count,
            COALESCE(SUM(expected_physical_amount) FILTER (WHERE status = 'submitted'), 0)::numeric(12,2) AS pending_handover_amount,
            COALESCE(SUM(actual_cash_amount + actual_cheque_amount) FILTER (WHERE status = 'verified'), 0)::numeric(12,2) AS treasury_physical_received,
            COALESCE(SUM(authorized_expense_amount) FILTER (WHERE status = 'verified'), 0)::numeric(12,2) AS total_authorized_expenses
        FROM public.collection_handovers
        WHERE event_id = p_event_id
    )
    SELECT jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'organization_id', v_event.organization_id,
        'today', jsonb_build_object(
            'receipt_count', (SELECT COUNT(*)::integer FROM today_receipts),
            'total_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts), 0.00),
            'cash_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts WHERE payment_mode = 'cash'), 0.00),
            'upi_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts WHERE payment_mode = 'upi'), 0.00),
            'cheque_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts WHERE payment_mode = 'cheque'), 0.00),
            'bank_transfer_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM today_receipts WHERE payment_mode = 'bank_transfer'), 0.00)
        ),
        'festival_total', jsonb_build_object(
            'receipt_count', (SELECT COUNT(*)::integer FROM event_valid_receipts),
            'total_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts), 0.00),
            'cash_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts WHERE payment_mode = 'cash'), 0.00),
            'upi_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts WHERE payment_mode = 'upi'), 0.00),
            'cheque_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts WHERE payment_mode = 'cheque'), 0.00),
            'bank_transfer_amount', COALESCE((SELECT SUM(amount)::numeric(12,2) FROM event_valid_receipts WHERE payment_mode = 'bank_transfer'), 0.00)
        ),
        'property_progress', (
            SELECT jsonb_build_object(
                'total_residential_units', total_residential_units,
                'collected_count', collected_count,
                'pending_count', pending_count,
                'refused_count', refused_count,
                'not_visited_count', not_visited_count,
                'completion_percentage', CASE 
                    WHEN total_residential_units > 0 THEN 
                        ROUND(((collected_count::numeric / total_residential_units::numeric) * 100), 2)
                    ELSE 0.00 
                END
            ) FROM property_progress_summary
        ),
        'treasury', jsonb_build_object(
            'pending_handover_count', (SELECT pending_handover_count FROM handover_metrics),
            'pending_handover_amount', (SELECT pending_handover_amount FROM handover_metrics),
            'treasury_cash_received', (SELECT treasury_physical_received FROM handover_metrics),
            'total_authorized_expenses', (SELECT total_authorized_expenses FROM handover_metrics),
            'total_physical_cash_held', COALESCE((SELECT SUM(outstanding_physical_held)::numeric(12,2) FROM volunteer_balances), 0.00),
            'volunteers_holding_cash_count', COALESCE((SELECT COUNT(*)::integer FROM volunteer_balances WHERE outstanding_physical_held > 0), 0)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_secretary_overview_metrics(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_secretary_overview_metrics(uuid) FROM PUBLIC, anon;
