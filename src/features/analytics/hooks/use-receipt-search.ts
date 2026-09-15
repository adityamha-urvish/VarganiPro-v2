/**
 * Custom Hook for Global Receipt Search
 * Phase 9-4 Step 4C: State management, debounce, pagination, and race condition defense
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  searchOrganizationReceipts,
  type SearchReceiptItem,
} from "../services/receipt-search.service";

export type DateFilterOption = "all" | "today" | "yesterday";

export interface UseReceiptSearchOptions {
  eventId: string | null;
  pageSize?: number;
}

export function useReceiptSearch({
  eventId,
  pageSize = 25,
}: UseReceiptSearchOptions) {
  const [query, setQuery] = useState("");
  const [paymentMode, setPaymentMode] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all");

  const [receipts, setReceipts] = useState<SearchReceiptItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Request ID ref for race condition protection
  const activeRequestIdRef = useRef<symbol | null>(null);
  const isInitialMount = useRef(true);

  const executeSearch = useCallback(
    async (
      currentQuery: string,
      currentPaymentMode: string,
      currentStatus: string,
      currentVolunteerId: string | null,
      currentOffset: number,
      isLoadMore = false
    ) => {
      if (!eventId) return;

      const requestId = Symbol();
      activeRequestIdRef.current = requestId;

      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await searchOrganizationReceipts({
          eventId,
          query: currentQuery,
          paymentMode: currentPaymentMode,
          status: currentStatus,
          volunteerId: currentVolunteerId,
          limit: pageSize,
          offset: currentOffset,
        });

        // Guard against stale response
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        if (isLoadMore) {
          setReceipts((prev) => [...prev, ...result.receipts]);
        } else {
          setReceipts(result.receipts);
        }

        setTotalCount(result.total_count);
        setHasMore(result.has_more);
        setOffset(currentOffset);
        setHasSearched(true);
      } catch (err) {
        if (activeRequestIdRef.current === requestId) {
          setError(
            err instanceof Error ? err.message : "पावत्या शोधताना त्रुटी आली."
          );
        }
      } finally {
        if (activeRequestIdRef.current === requestId) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [eventId, pageSize]
  );

  // Debounced query and immediate filter changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only trigger if user typed a query or picked a non-default filter
    const hasActiveFilter =
      paymentMode !== "all" ||
      status !== "all" ||
      volunteerId !== null ||
      query.trim().length > 0;

    if (!hasActiveFilter && !hasSearched) {
      return;
    }

    const timer = setTimeout(() => {
      setOffset(0);
      void executeSearch(query, paymentMode, status, volunteerId, 0, false);
    }, 350);

    return () => clearTimeout(timer);
  }, [query, paymentMode, status, volunteerId, executeSearch, hasSearched]);

  // Client-side date filter computation
  const filteredReceipts = useMemo(() => {
    if (dateFilter === "all") return receipts;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    return receipts.filter((r) => {
      try {
        const rDate = new Date(r.created_at);
        const rDateStr = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, "0")}-${String(rDate.getDate()).padStart(2, "0")}`;
        if (dateFilter === "today") return rDateStr === todayStr;
        if (dateFilter === "yesterday") return rDateStr === yesterdayStr;
        return true;
      } catch {
        return true;
      }
    });
  }, [receipts, dateFilter]);

  // Load More action
  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || !eventId) return;
    const nextOffset = offset + pageSize;
    void executeSearch(
      query,
      paymentMode,
      status,
      volunteerId,
      nextOffset,
      true
    );
  }, [
    loading,
    loadingMore,
    hasMore,
    eventId,
    offset,
    pageSize,
    query,
    paymentMode,
    status,
    volunteerId,
    executeSearch,
  ]);

  // Explicit Trigger / Refresh
  const triggerSearch = useCallback(() => {
    setOffset(0);
    void executeSearch(query, paymentMode, status, volunteerId, 0, false);
  }, [query, paymentMode, status, volunteerId, executeSearch]);

  // Reset Filters
  const resetFilters = useCallback(() => {
    setQuery("");
    setPaymentMode("all");
    setStatus("all");
    setVolunteerId(null);
    setDateFilter("all");
    setReceipts([]);
    setTotalCount(0);
    setHasMore(false);
    setOffset(0);
    setError(null);
    setHasSearched(false);
  }, []);

  return {
    query,
    setQuery,
    paymentMode,
    setPaymentMode,
    status,
    setStatus,
    volunteerId,
    setVolunteerId,
    dateFilter,
    setDateFilter,
    receipts,
    filteredReceipts,
    totalCount,
    hasMore,
    loading,
    loadingMore,
    error,
    hasSearched,
    loadMore,
    triggerSearch,
    resetFilters,
  };
}
