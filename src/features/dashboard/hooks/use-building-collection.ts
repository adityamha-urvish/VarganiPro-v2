import { useState, useEffect, useCallback } from "react";
import type {
  CachedBuildingSummary,
  CachedPropertyProgress,
  LocalReceipt,
} from "@/lib/offline/offline-db";
import { updateLocalPropertyProgress } from "@/lib/offline/offline-db";
import {
  fetchEventBuildingSummaries,
  fetchBuildingPropertiesProgress,
  recordFollowUp,
} from "@/features/collection/services/collection-progress.service";
import { createLocalReceipt } from "@/lib/offline/receipt-store";
import { drainSyncQueue } from "@/lib/offline/receipt-sync";
import type { CollectionSessionContext } from "@/features/collection/services/collection-session.service";
import type { PaymentMode } from "../components/receipt-creation-form";
import {
  quickAddFlat,
  quickAddBuilding,
  quickAddShop,
  fetchStandaloneShops,
  type PropertyRecord,
} from "@/features/admin/master-data/services/master-data.service";


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
  const [shops, setShops] = useState<PropertyRecord[]>([]);
  const [loadingShops, setLoadingShops] = useState<boolean>(false);
  const [loadingBuildings, setLoadingBuildings] = useState<boolean>(false);
  const [loadingProperties, setLoadingProperties] = useState<boolean>(false);
  const [fastReceiptCreating, setFastReceiptCreating] = useState<boolean>(false);
  const [fastReceiptError, setFastReceiptError] = useState<string | null>(null);

  const effectiveEventId = session?.eventId || eventId;
  const effectiveOrgId = session?.organizationId || organizationId;

  const loadShops = useCallback(async () => {
    if (!effectiveOrgId) return;
    setLoadingShops(true);
    try {
      const list = await fetchStandaloneShops(effectiveOrgId);
      setShops(list);
    } catch (err) {
      console.error("Error loading commercial shops:", err);
    } finally {
      setLoadingShops(false);
    }
  }, [effectiveOrgId]);

  const loadBuildings = useCallback(async () => {
    if (!effectiveEventId || !effectiveOrgId) return;
    setLoadingBuildings(true);
    try {
      const list = await fetchEventBuildingSummaries(effectiveEventId, effectiveOrgId);
      setBuildings(list);
      void loadShops();
    } finally {
      setLoadingBuildings(false);
    }
  }, [effectiveEventId, effectiveOrgId, loadShops]);


  const selectBuilding = useCallback(
    async (building: CachedBuildingSummary) => {
      const orgId = session?.organizationId || organizationId;
      const evId = session?.eventId || eventId;
      if (!orgId || !evId) return;
      setSelectedBuilding(building);
      setLoadingProperties(true);
      try {
        const props = await fetchBuildingPropertiesProgress(
          evId,
          building.buildingId,
          orgId
        );
        setProperties(props);
      } finally {
        setLoadingProperties(false);
      }
    },
    [session, organizationId, eventId]
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

        // 1. Persist updated property progress to IndexedDB
        try {
          await updateLocalPropertyProgress(
            session.eventId,
            selectedBuilding.buildingId,
            input.propertyId,
            {
              status: "collected",
              receiptCount: ((selectedProperty.receiptCount || 0) + 1),
              totalCollectedAmount: ((selectedProperty.totalCollectedAmount || 0) + input.amount),
              latestReceiptNumber: receipt.receiptNumber,
              lastReceiptAt: receipt.offlineCreatedAt,
            }
          );
        } catch (dbErr) {
          console.warn("Failed to update local property progress in IndexedDB:", dbErr);
        }

        // 2. Update in-memory properties state immediately
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

        // 3. Automatically trigger background queue drain
        void drainSyncQueue(session.receiptBookId).then(() => {
          void onReceiptHistoryRefresh(session.receiptBookId);
        });

        // 4. Close modal and clear selected property (stay on current building grid)
        setIsFastReceiptOpen(false);
        setSelectedProperty(null);
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

      // Close modal and drawer, reset property selection
      setIsPendingDrawerOpen(false);
      setIsFastReceiptOpen(false);
      setSelectedProperty(null);
    },
    [session, selectedBuilding, selectedProperty, properties]
  );

  const addPropertyDirect = useCallback(
    async (input: {
      unitNumber: string;
      floorNumber?: number | null;
      ownerName?: string;
      contactMobile?: string;
    }): Promise<CachedPropertyProgress | null> => {
      const orgId = session?.organizationId || organizationId;
      const evId = session?.eventId || eventId;
      if (!selectedBuilding || !orgId || !evId) return null;

      try {
        const res = await quickAddFlat({
          buildingId: selectedBuilding.buildingId,
          unitNumber: input.unitNumber.trim(),
          floorNumber: input.floorNumber ?? undefined,
          ownerName: input.ownerName?.trim() || undefined,
          contactMobile: input.contactMobile?.trim() || undefined,
        });

        const newProperty: CachedPropertyProgress = {
          propertyId: res.propertyId,
          buildingId: selectedBuilding.buildingId,
          eventId: evId,
          organizationId: orgId,
          propertyType: "flat",
          unitNumber: input.unitNumber.trim(),
          flatNumber: input.unitNumber.trim(),
          floorNumber: input.floorNumber ?? null,
          shopName: null,
          ownerName: input.ownerName?.trim() || null,
          contactMobile: input.contactMobile?.trim() || null,
          status: "not_visited",
          receiptCount: 0,
          totalCollectedAmount: 0,
          latestReceiptNumber: null,
          lastReceiptAt: null,
          pendingReason: null,
          followUpTime: null,
          followUpNotes: null,
          followUpAt: null,
          cachedAt: new Date().toISOString(),
        };

        setProperties((prev) => {
          if (
            prev.some(
              (p) =>
                p.propertyId === newProperty.propertyId ||
                p.unitNumber.toLowerCase() === newProperty.unitNumber.toLowerCase()
            )
          ) {
            return prev.map((p) =>
              p.propertyId === newProperty.propertyId ||
              p.unitNumber.toLowerCase() === newProperty.unitNumber.toLowerCase()
                ? { ...p, ...newProperty }
                : p
            );
          }
          return [...prev, newProperty];
        });

        return newProperty;
      } catch (err) {
        console.error("Error adding flat in session:", err);
        throw err;
      }
    },
    [session, organizationId, eventId, selectedBuilding]
  );

  const addBuildingDirect = useCallback(
    async (
      nameOrInput: string | { name: string; wing?: string },
      wingParam?: string
    ): Promise<CachedBuildingSummary | null> => {
      const orgId = session?.organizationId || organizationId;
      const evId = session?.eventId || eventId;
      if (!orgId || !evId) return null;

      const name = typeof nameOrInput === "string" ? nameOrInput : nameOrInput.name;
      const wing = typeof nameOrInput === "string" ? wingParam : nameOrInput.wing;

      try {
        const res = await quickAddBuilding({
          organizationId: orgId,
          name: name.trim(),
          wing: wing?.trim() || undefined,
        });

        const newBuilding: CachedBuildingSummary = {
          buildingId: res.buildingId,
          eventId: evId,
          organizationId: orgId,
          buildingName: res.buildingName,
          code: res.code,
          wing: res.wing,
          areaName: null,
          totalUnits: 0,
          collectedCount: 0,
          pendingCount: 0,
          refusedCount: 0,
          notVisitedCount: 0,
          remainingCount: 0,
          totalAmountCollected: 0,
          lastActivityAt: null,
          cachedAt: new Date().toISOString(),
        };

        setBuildings((prev) => [newBuilding, ...prev.filter((b) => b.buildingId !== newBuilding.buildingId)]);
        return newBuilding;
      } catch (err) {
        console.error("Error adding building in session:", err);
        throw err;
      }
    },
    [session, organizationId, eventId]
  );

  const addShopDirect = useCallback(
    async (input: {
      shopName: string;
      ownerName?: string;
      contactMobile?: string;
    }): Promise<CachedPropertyProgress | null> => {
      const orgId = session?.organizationId || organizationId;
      const evId = session?.eventId || eventId;
      if (!orgId || !evId) return null;

      try {
        const res = await quickAddShop({
          organizationId: orgId,
          shopName: input.shopName.trim(),
          ownerName: input.ownerName?.trim() || undefined,
          contactMobile: input.contactMobile?.trim() || undefined,
        });

        const newShopRecord: PropertyRecord = {
          id: res.propertyId,
          organizationId: orgId,
          buildingId: null,
          propertyType: "commercial",
          unitNumber: null,
          flatNumber: null,
          shopName: res.shopName || input.shopName.trim(),
          floorNumber: null,
          ownerName: input.ownerName?.trim() || null,
          contactMobile: input.contactMobile?.trim() || null,
          locationNote: null,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        setShops((prev) => [
          newShopRecord,
          ...prev.filter((s) => s.id !== newShopRecord.id),
        ]);

        const newProperty: CachedPropertyProgress = {
          propertyId: res.propertyId,
          buildingId: "",
          eventId: evId,
          organizationId: orgId,
          propertyType: "commercial",
          unitNumber: "",
          flatNumber: null,
          floorNumber: null,
          shopName: res.shopName || input.shopName.trim(),
          ownerName: input.ownerName?.trim() || null,
          contactMobile: input.contactMobile?.trim() || null,
          status: "not_visited",
          receiptCount: 0,
          totalCollectedAmount: 0,
          latestReceiptNumber: null,
          lastReceiptAt: null,
          pendingReason: null,
          followUpTime: null,
          followUpNotes: null,
          followUpAt: null,
          cachedAt: new Date().toISOString(),
        };

        return newProperty;
      } catch (err) {
        console.error("Error adding commercial shop in session:", err);
        throw err;
      }
    },
    [session, organizationId, eventId]
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
    setProperties,
    selectedProperty,
    setSelectedProperty,
    shops,
    setShops,
    loadingShops,
    loadShops,
    addShopDirect,
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
    addPropertyDirect,
    addBuildingDirect,
  };
}
