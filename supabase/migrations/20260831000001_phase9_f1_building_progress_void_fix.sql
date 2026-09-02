-- ==============================================================================
-- Migration: 20260831000001_phase9_f1_building_progress_void_fix.sql
-- Phase 9: F-1 Maintenance Patch — Exclude Voided/Cancelled Receipts from Building Traversal & Progress
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: get_event_building_summaries
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_event_building_summaries(
    p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id uuid;
    v_event RECORD;
    v_result jsonb;
BEGIN
    -- 1. Caller authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'Event ID is required';
    END IF;

    -- 2. Validate Event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive';
    END IF;

    -- 3. Validate Calling User is an ACTIVE member of the event's organization
    SELECT u.id INTO v_calling_user_id
    FROM public.organization_members om
    JOIN public.users u ON u.id = om.user_id
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active = true
      AND om.organization_id = v_event.organization_id
    LIMIT 1;

    IF v_calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not an active member of this organization';
    END IF;

    -- 4. Aggregate progress safely
    -- Step A: Pre-aggregate ACTIVE receipts per property (Excluding voided & cancelled receipts)
    WITH property_receipts AS (
        SELECT
            r.property_id,
            COUNT(r.id) AS receipt_count,
            SUM(r.amount) AS total_collected_amount,
            MAX(r.created_at) AS last_receipt_at,
            ARRAY_AGG(r.receipt_number ORDER BY r.receipt_number DESC) AS receipt_numbers
        FROM public.receipts r
        WHERE r.event_id = p_event_id
          AND r.property_id IS NOT NULL
          AND r.status IN ('valid', 'issued')
          AND r.voided_at IS NULL
          AND r.cancelled_at IS NULL
        GROUP BY r.property_id
    ),
    -- Step B: Aggregate active follow-ups per property for this event
    property_follow_ups AS (
        SELECT
            f.property_id,
            f.status,
            f.reason,
            f.follow_up_time,
            f.created_at AS follow_up_at
        FROM public.collection_follow_ups f
        WHERE f.event_id = p_event_id
    ),
    -- Step C: Determine distinct status per property in this organization
    property_statuses AS (
        SELECT
            p.id AS property_id,
            p.building_id,
            CASE
                WHEN pr.property_id IS NOT NULL THEN 'collected'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' AND pfu.reason = 'refused' THEN 'refused'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' THEN 'pending'
                ELSE 'not_visited'
            END AS status,
            COALESCE(pr.total_collected_amount, 0) AS collected_amount,
            COALESCE(pr.receipt_count, 0) AS receipt_count,
            pr.last_receipt_at,
            pfu.follow_up_at
        FROM public.properties p
        LEFT JOIN property_receipts pr ON pr.property_id = p.id
        LEFT JOIN property_follow_ups pfu ON pfu.property_id = p.id
        WHERE p.organization_id = v_event.organization_id
          AND p.building_id IS NOT NULL
    ),
    -- Step D: Group by building
    building_summaries AS (
        SELECT
            b.id AS building_id,
            b.name AS building_name,
            b.code AS building_code,
            b.wing AS building_wing,
            b.area_name AS building_area,
            COUNT(ps.property_id) AS total_units,
            COUNT(ps.property_id) FILTER (WHERE ps.status = 'collected') AS collected_count,
            COUNT(ps.property_id) FILTER (WHERE ps.status = 'pending') AS pending_count,
            COUNT(ps.property_id) FILTER (WHERE ps.status = 'refused') AS refused_count,
            COUNT(ps.property_id) FILTER (WHERE ps.status = 'not_visited') AS not_visited_count,
            COUNT(ps.property_id) FILTER (WHERE ps.status IN ('not_visited', 'pending')) AS remaining_count,
            COALESCE(SUM(ps.collected_amount), 0) AS total_amount_collected,
            GREATEST(MAX(ps.last_receipt_at), MAX(ps.follow_up_at)) AS last_activity_at
        FROM public.buildings b
        LEFT JOIN property_statuses ps ON ps.building_id = b.id
        WHERE b.organization_id = v_event.organization_id
        GROUP BY b.id, b.name, b.code, b.wing, b.area_name
        ORDER BY
            (COUNT(ps.property_id) FILTER (WHERE ps.status IN ('not_visited', 'pending')) > 0) DESC,
            GREATEST(MAX(ps.last_receipt_at), MAX(ps.follow_up_at)) DESC NULLS LAST,
            b.name ASC
    )
    SELECT jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'organization_id', v_event.organization_id,
        'buildings', COALESCE(jsonb_agg(
            jsonb_build_object(
                'building_id', bs.building_id,
                'building_name', bs.building_name,
                'code', bs.building_code,
                'wing', bs.building_wing,
                'area_name', bs.building_area,
                'total_units', bs.total_units,
                'collected_count', bs.collected_count,
                'pending_count', bs.pending_count,
                'refused_count', bs.refused_count,
                'not_visited_count', bs.not_visited_count,
                'remaining_count', bs.remaining_count,
                'total_amount_collected', bs.total_amount_collected,
                'last_activity_at', bs.last_activity_at
            )
        ), '[]'::jsonb)
    ) INTO v_result
    FROM building_summaries bs;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_building_summaries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_building_summaries(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_event_building_summaries(uuid) FROM PUBLIC, anon;

-- ------------------------------------------------------------------------------
-- 2. RPC: get_building_properties_progress
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_building_properties_progress(
    p_event_id uuid,
    p_building_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id uuid;
    v_event RECORD;
    v_building RECORD;
    v_result jsonb;
BEGIN
    -- 1. Caller authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_event_id IS NULL OR p_building_id IS NULL THEN
        RAISE EXCEPTION 'Event ID and Building ID are required';
    END IF;

    -- 2. Validate Event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
      AND is_active = true;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'Event not found or inactive';
    END IF;

    -- 3. Validate Calling User is an ACTIVE member of the event's organization
    SELECT u.id INTO v_calling_user_id
    FROM public.organization_members om
    JOIN public.users u ON u.id = om.user_id
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active = true
      AND om.organization_id = v_event.organization_id
    LIMIT 1;

    IF v_calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not an active member of this organization';
    END IF;

    -- 4. Validate Building belongs to the exact same organization
    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = p_building_id
      AND organization_id = v_event.organization_id;

    IF v_building.id IS NULL THEN
        RAISE EXCEPTION 'Building not found in this organization';
    END IF;

    -- 5. Safe per-property receipt and follow-up aggregation for this building (Excluding voided & cancelled receipts)
    WITH property_receipts AS (
        SELECT
            r.property_id,
            COUNT(r.id) AS receipt_count,
            SUM(r.amount) AS total_collected_amount,
            MAX(r.created_at) AS last_receipt_at,
            (ARRAY_AGG(r.receipt_number ORDER BY r.receipt_number DESC))[1] AS latest_receipt_number
        FROM public.receipts r
        WHERE r.event_id = p_event_id
          AND r.property_id IS NOT NULL
          AND r.status IN ('valid', 'issued')
          AND r.voided_at IS NULL
          AND r.cancelled_at IS NULL
        GROUP BY r.property_id
    ),
    property_follow_ups AS (
        SELECT
            f.property_id,
            f.status,
            f.reason,
            f.follow_up_time,
            f.notes,
            f.created_at AS follow_up_at
        FROM public.collection_follow_ups f
        WHERE f.event_id = p_event_id
    ),
    property_list AS (
        SELECT
            p.id AS property_id,
            p.building_id,
            p.property_type,
            COALESCE(p.unit_number, p.flat_number) AS unit_number,
            p.flat_number,
            p.floor_number,
            p.shop_name,
            p.owner_name,
            p.contact_mobile,
            CASE
                WHEN pr.property_id IS NOT NULL THEN 'collected'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' AND pfu.reason = 'refused' THEN 'refused'
                WHEN pfu.property_id IS NOT NULL AND pfu.status = 'pending' THEN 'pending'
                ELSE 'not_visited'
            END AS status,
            COALESCE(pr.receipt_count, 0) AS receipt_count,
            COALESCE(pr.total_collected_amount, 0) AS total_collected_amount,
            pr.latest_receipt_number,
            pr.last_receipt_at,
            pfu.reason AS pending_reason,
            pfu.follow_up_time,
            pfu.notes AS follow_up_notes,
            pfu.follow_up_at
        FROM public.properties p
        LEFT JOIN property_receipts pr ON pr.property_id = p.id
        LEFT JOIN property_follow_ups pfu ON pfu.property_id = p.id
        WHERE p.building_id = p_building_id
          AND p.organization_id = v_event.organization_id
        ORDER BY
            COALESCE(p.floor_number, 0) ASC,
            p.unit_number ASC,
            p.flat_number ASC
    )
    SELECT jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'building_id', p_building_id,
        'building_name', v_building.name,
        'building_wing', v_building.wing,
        'properties', COALESCE(jsonb_agg(
            jsonb_build_object(
                'property_id', pl.property_id,
                'property_type', pl.property_type,
                'unit_number', pl.unit_number,
                'flat_number', pl.flat_number,
                'floor_number', pl.floor_number,
                'shop_name', pl.shop_name,
                'owner_name', pl.owner_name,
                'contact_mobile', pl.contact_mobile,
                'status', pl.status,
                'receipt_count', pl.receipt_count,
                'total_collected_amount', pl.total_collected_amount,
                'latest_receipt_number', pl.latest_receipt_number,
                'last_receipt_at', pl.last_receipt_at,
                'pending_reason', pl.pending_reason,
                'follow_up_time', pl.follow_up_time,
                'follow_up_notes', pl.follow_up_notes,
                'follow_up_at', pl.follow_up_at
            )
        ), '[]'::jsonb)
    ) INTO v_result
    FROM property_list pl;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_building_properties_progress(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_building_properties_progress(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_building_properties_progress(uuid, uuid) FROM PUBLIC, anon;
