import { useState, useEffect, useCallback } from "react";
import type {
  SecretaryOverviewMetrics,
  VolunteerFinancialLedgerResponse,
} from "../types/analytics.types";
import {
  getSecretaryOverviewMetrics,
  getVolunteerFinancialLedger,
} from "../services/analytics.service";

export interface UseSecretaryAnalyticsOptions {
  eventId?: string | null;
  isAdmin: boolean;
}

export function useSecretaryAnalytics({
  eventId,
  isAdmin,
}: UseSecretaryAnalyticsOptions) {
  const [metrics, setMetrics] = useState<SecretaryOverviewMetrics | null>(null);
  const [ledger, setLedger] =
    useState<VolunteerFinancialLedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const loadOverviewMetrics = useCallback(async () => {
    if (!isAdmin || !eventId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getSecretaryOverviewMetrics(eventId);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load secretary overview metrics:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load secretary overview metrics."
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, eventId]);

  const loadVolunteerLedger = useCallback(async () => {
    if (!isAdmin || !eventId) {
      return;
    }

    setLedgerLoading(true);
    setLedgerError(null);

    try {
      const data = await getVolunteerFinancialLedger(eventId);
      setLedger(data);
    } catch (err) {
      console.error("Failed to load volunteer financial ledger:", err);
      setLedgerError(
        err instanceof Error
          ? err.message
          : "Unable to load volunteer financial ledger."
      );
    } finally {
      setLedgerLoading(false);
    }
  }, [isAdmin, eventId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOverviewMetrics(), loadVolunteerLedger()]);
  }, [loadOverviewMetrics, loadVolunteerLedger]);

  useEffect(() => {
    if (isAdmin && eventId) {
      void loadOverviewMetrics();
      void loadVolunteerLedger();
    }
  }, [isAdmin, eventId, loadOverviewMetrics, loadVolunteerLedger]);

  return {
    metrics,
    ledger,
    loading,
    ledgerLoading,
    error,
    ledgerError,
    refreshOverview: loadOverviewMetrics,
    refreshLedger: loadVolunteerLedger,
    refreshAll,
  };
}
