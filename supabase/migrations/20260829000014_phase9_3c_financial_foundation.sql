-- ==============================================================================
-- Migration: 20260829000014_phase9_3c_financial_foundation.sql
-- Phase 9-3C: Secretary Analytics, Financial Handover & Audit Database Foundation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table Extension: public.collection_handovers
-- ------------------------------------------------------------------------------
-- Adds authorized expense tracking, discrepancy categorization, and physical
-- instrument aggregate columns (Cash + Cheque).

ALTER TABLE public.collection_handovers
  ADD COLUMN IF NOT EXISTS authorized_expense_amount numeric(12,2) NOT NULL DEFAULT 0
    CHECK (authorized_expense_amount >= 0),
  ADD COLUMN IF NOT EXISTS authorized_expense_note text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discrepancy_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expected_physical_amount numeric(12,2) GENERATED ALWAYS AS (
    COALESCE(expected_cash_amount, 0) + COALESCE(expected_cheque_amount, 0)
  ) STORED,
  ADD COLUMN IF NOT EXISTS actual_physical_amount numeric(12,2) GENERATED ALWAYS AS (
    COALESCE(actual_cash_amount, 0) + COALESCE(actual_cheque_amount, 0)
  ) STORED;

-- ------------------------------------------------------------------------------
-- 2. Table Extension: public.receipts
-- ------------------------------------------------------------------------------
-- Adds receipt status tracking for pre-handover receipt voiding with audit metadata.

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'voided')),
  ADD COLUMN IF NOT EXISTS void_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.users(id) DEFAULT NULL;

-- ------------------------------------------------------------------------------
-- 3. Performance & Audit Indexes
-- ------------------------------------------------------------------------------
-- Optimizes event-level analytics, financial summaries, and handover queries.

CREATE INDEX IF NOT EXISTS idx_receipts_org_event_status
  ON public.receipts(organization_id, event_id, status);

CREATE INDEX IF NOT EXISTS idx_handovers_org_event_status
  ON public.collection_handovers(organization_id, event_id, status);
