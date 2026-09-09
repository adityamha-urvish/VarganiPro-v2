import { useState, useEffect, useCallback } from "react";
import type {
  CachedBuildingSummary,
  CachedPropertyProgress,
  LocalReceipt,
} from "@/lib/offline/offline-db";
import {
  fetchEventBuildingSummaries,
  fetchBuildingPropertiesProgress,
  recordFollowUp,
} from "@/features/collection/services/collection-progress.service";
import { createLocalReceipt } from "@/lib/offline/receipt-store";
import { drainSyncQueue } from "@/lib/offline/receipt-sync";
import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { PaymentMode } from "../components/receipt-creation-form";

export type ActiveCollectionSession = CollectionSessionContext;

export interface UseBuildingCollectionProps {
  session: ActiveCollectionSession | null;
  eventId?: string | null;
  organizationId?: string | null;
  onReceiptCreated: (receipt: LocalReceipt) => void;
  onReceiptHistoryRefresh: (receiptBookId: string) => Promise<void>;
}

export function useBuildingCollection({
  session,
  eventId,
  organizationId,
  onReceiptCreated,
  onReceiptHistoryRefresh,
}: UseBuildingCollectionProps) {
  const [buildings, setBuildings] = useState<CachedBuildingSummary[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<CachedBuildingSummary | null>(null);
  const [properties, setProperties] = useState<CachedPropertyProgress[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<CachedPropertyProgress | null>(null);
  const [isFastReceiptOpen, setIsFastReceiptOpen] = useState<boolean>(false);
  const [isPendingDrawerOpen, setIsPendingDrawerOpen] = useState<boolean>(false);
  const [loadingBuildings, setLoadingBuildings] = useState<boolean>(false);
  const [loadingProperties, setLoadingProperties] = useState<boolean>(false);
  const [fastReceiptCreating, setFastReceiptCreating] = useState<boolean>(false);
  const [fastReceiptError, setFastReceiptError] = useState<string | null>(null);

  const effectiveEventId = session?.eventId || eventId;
  const effectiveOrgId = session?.organizationId || organizationId;

  const loadBuildings = useCallback(async () => {
    if (!effectiveEventId || !effectiveOrgId) return;
    setLoadingBuildings(true);
    try {
      const list = await fetchEventBuildingSummaries(effectiveEventId, effectiveOrgId);
      setBuildings(list);
    } finally {
      setLoadingBuildings(false);
    }
  }, [effectiveEventId, effectiveOrgId]);

  const selectBuilding = useCallback(
    async (building: CachedBuildingSummary) => {
      if (!session) return;
      setSelectedBuilding(building);
      setLoadingProperties(true);
      try {
        const props = await fetchBuildingPropertiesProgress(
          session.eventId,
          building.buildingId,
          session.organizationId
        );
        setProperties(props);
      } finally {
        setLoadingProperties(false);
      }
    },
    [session]
  );

  const openPropertyReceipt = useCallback((property: CachedPropertyProgress) => {
    setSelectedProperty(property);
    setFastReceiptError(null);
    setIsFastReceiptOpen(true);
  }, []);

  const startNextFlat = useCallback(() => {
    const next = properties.find((p) => p.status === "not_visited") ||
      properties.find((p) => p.status === "pending");
    if (next) {
      openPropertyReceipt(next);
    }
  }, [properties, openPropertyReceipt]);

  // Compute next suggested property after currently selected one
  const getNextProperty = useCallback(
    (currentPropId?: string): CachedPropertyProgress | null => {
      const currentIndex = properties.findIndex((p) => p.propertyId === currentPropId);
      if (currentIndex === -1) return null;

      // Look forward for next unvisited/pending flat
      for (let i = currentIndex + 1; i < properties.length; i++) {
        if (properties[i].status === "not_visited" || properties[i].status === "pending") {
          return properties[i];
        }
      }
      // Wrap around if needed
      for (let i = 0; i < currentIndex; i++) {
        if (properties[i].status === "not_visited" || properties[i].status === "pending") {
          return properties[i];
        }
      }
      return null;
    },
    [properties]
  );

  const submitFastReceipt = useCallback(
    async (input: {
      propertyId: string;
      amount: number;
      paymentMode: PaymentMode;
      donorName: string;
      donorMobile: string | null;
      paymentReference: string | null;
    }) => {
      if (!session || !selectedBuilding || !selectedProperty) return;
      setFastReceiptCreating(true);
      setFastReceiptError(null);

      try {
        const receipt = await createLocalReceipt({
          receiptBookId: session.receiptBookId,
          organizationId: session.organizationId,
          eventId: session.eventId,
          collectionSessionId: session.sessionId,
          volunteerId: session.volunteerId,
          propertyId: input.propertyId,
          amount: input.amount,
          paymentMode: input.paymentMode,
          paymentReference: input.paymentReference,
          donorName: input.donorName,
          donorMobile: input.donorMobile,
          notes: null,
        });

        // Update in-memory properties state immediately
        const updatedProps = properties.map((p) => {
          if (p.propertyId === input.propertyId) {
            return {
              ...p,
              status: "collected" as const,
              receiptCount: (p.receiptCount || 0) + 1,
              totalCollectedAmount: (p.totalCollectedAmount || 0) + input.amount,
              latestReceiptNumber: receipt.receiptNumber,
              lastReceiptAt: receipt.offlineCreatedAt,
            };
          }
          return p;
        });
        setProperties(updatedProps);

        onReceiptCreated(receipt);
        void onReceiptHistoryRefresh(session.receiptBookId);

        // Automatically trigger background queue drain
        void drainSyncQueue(session.receiptBookId).then(() => {
          void onReceiptHistoryRefresh(session.receiptBookId);
        });

        // Auto-advance pointer to next flat
        const next = getNextProperty(input.propertyId);
        if (next) {
          setSelectedProperty(next);
        } else {
          setIsFastReceiptOpen(false);
          setSelectedProperty(null);
        }
      } catch (err: unknown) {
        setFastReceiptError(
          err instanceof Error ? err.message : "Unable to create local receipt"
        );
      } finally {
        setFastReceiptCreating(false);
      }
    },
    [
      session,
      selectedBuilding,
      selectedProperty,
      properties,
      getNextProperty,
      onReceiptCreated,
      onReceiptHistoryRefresh,
    ]
  );

  const submitFollowUp = useCallback(
    async (reason: string, followUpTime?: string | null, notes?: string | null) => {
      if (!session || !selectedBuilding || !selectedProperty) return;

      const isRefused = reason === "refused";
      const newStatus = isRefused ? ("refused" as const) : ("pending" as const);

      await recordFollowUp({
        eventId: session.eventId,
        buildingId: selectedBuilding.buildingId,
        propertyId: selectedProperty.propertyId,
        reason,
        followUpTime,
        notes,
      });

      // Update in-memory property status
      const updatedProps = properties.map((p) => {
        if (p.propertyId === selectedProperty.propertyId) {
          return {
            ...p,
            status: newStatus,
            pendingReason: reason,
            followUpTime: followUpTime ?? null,
            followUpNotes: notes ?? null,
            followUpAt: new Date().toISOString(),
          };
        }
        return p;
      });
      setProperties(updatedProps);

      // Auto-advance to next flat
      const next = getNextProperty(selectedProperty.propertyId);
      if (next) {
        setSelectedProperty(next);
      } else {
        setIsFastReceiptOpen(false);
        setSelectedProperty(null);
      }
    },
    [session, selectedBuilding, selectedProperty, properties, getNextProperty]
  );

  useEffect(() => {
    if (session?.eventId) {
      void loadBuildings();
    }
  }, [session?.eventId, loadBuildings]);

  return {
    buildings,
    selectedBuilding,
    setSelectedBuilding,
    properties,
    selectedProperty,
    isFastReceiptOpen,
    setIsFastReceiptOpen,
    isPendingDrawerOpen,
    setIsPendingDrawerOpen,
    loadingBuildings,
    loadingProperties,
    fastReceiptCreating,
    fastReceiptError,
    loadBuildings,
    selectBuilding,
    openPropertyReceipt,
    startNextFlat,
    getNextProperty,
    submitFastReceipt,
    submitFollowUp,
  };
}
