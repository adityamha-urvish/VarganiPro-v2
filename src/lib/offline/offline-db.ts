import { supabase } from "@/supabase/client";

const DB_NAME = "varganipro-offline";
const DB_VERSION = 2;

const RECEIPTS_STORE = "receipts";
const META_STORE = "metadata";
const BUILDINGS_STORE = "buildings";
const PROPERTIES_STORE = "properties";

export interface CachedBuildingSummary {
  buildingId: string;
  eventId: string;
  organizationId: string;
  buildingName: string;
  code: string | null;
  wing: string | null;
  areaName: string | null;
  totalUnits: number;
  collectedCount: number;
  pendingCount: number;
  refusedCount: number;
  notVisitedCount: number;
  remainingCount: number;
  totalAmountCollected: number;
  lastActivityAt: string | null;
  cachedAt: string;
}

export interface CachedPropertyProgress {
  propertyId: string;
  buildingId: string;
  eventId: string;
  organizationId: string;
  propertyType: string;
  unitNumber: string;
  flatNumber: string | null;
  floorNumber: number | null;
  shopName: string | null;
  ownerName: string | null;
  contactMobile: string | null;
  status: "collected" | "pending" | "refused" | "not_visited";
  receiptCount: number;
  totalCollectedAmount: number;
  latestReceiptNumber: number | null;
  lastReceiptAt: string | null;
  pendingReason: string | null;
  followUpTime: string | null;
  followUpNotes: string | null;
  followUpAt: string | null;
  cachedAt: string;
}

export interface LocalReceipt {
  clientReceiptId: string;

  organizationId: string;
  eventId: string;
  collectionSessionId: string;
  receiptBookId: string;
  volunteerId: string;
  ownerUserId?: string | null;

  propertyId: string | null;

  receiptNumber: number;

  donorName: string;
  donorMobile: string | null;

  amount: number;

  paymentMode:
    | "cash"
    | "upi"
    | "cheque"
    | "bank_transfer";

  paymentReference: string | null;
  notes: string | null;

  offlineCreatedAt: string;

  syncStatus:
    | "pending"
    | "syncing"
    | "synced"
    | "conflict";

  syncAttempts: number;
  lastSyncAttemptAt: string | null;
  lastSyncError: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface OfflineBookState {
  receiptBookId: string;

  organizationId: string;
  eventId: string;
  collectionSessionId: string;
  volunteerId: string;
  ownerUserId?: string | null;

  bookNumber: string;
  prefix: string;

  startNumber: number;
  endNumber: number;

  nextLocalNumber: number;

  updatedAt: string;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Safe RFC 4122 v4 UUID generator that works across all contexts:
 * - Secure Contexts (HTTPS, localhost) via crypto.randomUUID()
 * - Insecure Contexts (LAN IP http://192.168.0.x on iOS Safari / WebKit) via crypto.getRandomValues()
 */
export function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 1 (RFC 4122)
    const hex = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION
    );

    request.onerror = () => {
      reject(
        request.error ??
          new Error(
            "Unable to open offline database"
          )
      );
    };

    request.onupgradeneeded = () => {
      const db = request.result;

      if (
        !db.objectStoreNames.contains(
          RECEIPTS_STORE
        )
      ) {
        const receipts =
          db.createObjectStore(
            RECEIPTS_STORE,
            {
              keyPath:
                "clientReceiptId",
            }
          );

        receipts.createIndex(
          "byReceiptBook",
          "receiptBookId",
          { unique: false }
        );

        receipts.createIndex(
          "bySyncStatus",
          "syncStatus",
          { unique: false }
        );

        receipts.createIndex(
          "byReceiptNumber",
          [
            "receiptBookId",
            "receiptNumber",
          ],
          { unique: true }
        );
      }

      if (
        !db.objectStoreNames.contains(
          META_STORE
        )
      ) {
        db.createObjectStore(
          META_STORE,
          {
            keyPath:
              "receiptBookId",
          }
        );
      }

      if (
        !db.objectStoreNames.contains(
          BUILDINGS_STORE
        )
      ) {
        const buildings =
          db.createObjectStore(
            BUILDINGS_STORE,
            {
              keyPath:
                "buildingId",
            }
          );
        buildings.createIndex(
          "byEventId",
          "eventId",
          { unique: false }
        );
      }

      if (
        !db.objectStoreNames.contains(
          PROPERTIES_STORE
        )
      ) {
        const properties =
          db.createObjectStore(
            PROPERTIES_STORE,
            {
              keyPath:
                "propertyId",
            }
          );
        properties.createIndex(
          "byBuildingId",
          "buildingId",
          { unique: false }
        );
        properties.createIndex(
          "byEventId",
          "eventId",
          { unique: false }
        );
        properties.createIndex(
          "byBuildingAndStatus",
          [
            "buildingId",
            "status",
          ],
          { unique: false }
        );
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/* -------------------------------------------------
   RECEIPTS
------------------------------------------------- */

export async function saveLocalReceipt(
  receipt: LocalReceipt
): Promise<void> {
  const db = await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          RECEIPTS_STORE,
          "readwrite"
        );

      transaction
        .objectStore(RECEIPTS_STORE)
        .put(receipt);

      transaction.oncomplete =
        () => {
          db.close();
          resolve();
        };

      transaction.onerror = () => {
        db.close();

        reject(
          transaction.error ??
            new Error(
              "Unable to save local receipt"
            )
        );
      };

      transaction.onabort = () => {
        db.close();

        reject(
          transaction.error ??
            new Error(
              "Local receipt save was aborted"
            )
        );
      };
    }
  );
}

export async function getLocalReceipt(
  clientReceiptId: string
): Promise<LocalReceipt | null> {
  const db = await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          RECEIPTS_STORE,
          "readonly"
        );

      const request =
        transaction
          .objectStore(
            RECEIPTS_STORE
          )
          .get(clientReceiptId);

      request.onsuccess = () => {
        db.close();

        resolve(
          request.result ?? null
        );
      };

      request.onerror = () => {
        db.close();

        reject(
          request.error ??
            new Error(
              "Unable to read local receipt"
            )
        );
      };
    }
  );
}

export async function getPendingReceipts(
  receiptBookId: string,
  ownerUserId?: string
): Promise<LocalReceipt[]> {
  const currentOwner = ownerUserId ?? (await getAuthenticatedUserId());
  const db = await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          RECEIPTS_STORE,
          "readonly"
        );

      const request =
        transaction
          .objectStore(
            RECEIPTS_STORE
          )
          .index("byReceiptBook")
          .getAll(receiptBookId);

      request.onsuccess = () => {
        db.close();

        let receipts =
          (
            request.result as LocalReceipt[]
          ).filter(
            (receipt) =>
              receipt.syncStatus ===
                "pending" ||
              receipt.syncStatus ===
                "syncing"
          );

        if (currentOwner) {
          receipts = receipts.filter(
            (receipt) =>
              !receipt.ownerUserId ||
              receipt.ownerUserId === currentOwner
          );
        }

        receipts.sort(
          (a, b) =>
            a.receiptNumber -
            b.receiptNumber
        );

        resolve(receipts);
      };

      request.onerror = () => {
        db.close();

        reject(
          request.error ??
            new Error(
              "Unable to read pending receipts"
            )
        );
      };
    }
  );
}

export async function getPendingReceiptsForOwner(
  ownerUserId?: string
): Promise<LocalReceipt[]> {
  const currentOwner = ownerUserId ?? (await getAuthenticatedUserId());
  if (!currentOwner) {
    return [];
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      RECEIPTS_STORE,
      "readonly"
    );

    const request = transaction
      .objectStore(RECEIPTS_STORE)
      .getAll();

    request.onsuccess = () => {
      db.close();

      const allReceipts = request.result as LocalReceipt[];
      const pending = allReceipts.filter(
        (receipt) =>
          (!receipt.ownerUserId ||
            receipt.ownerUserId === currentOwner) &&
          (receipt.syncStatus === "pending" ||
            receipt.syncStatus === "syncing" ||
            receipt.syncStatus === "conflict")
      );

      resolve(pending);
    };

    request.onerror = () => {
      db.close();

      reject(
        request.error ??
          new Error(
            "Unable to read pending receipts for owner"
          )
      );
    };
  });
}

/* -------------------------------------------------
   BOOK STATE
------------------------------------------------- */

export async function saveBookState(
  state: OfflineBookState
): Promise<void> {
  const db = await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          META_STORE,
          "readwrite"
        );

      transaction
        .objectStore(META_STORE)
        .put(state);

      transaction.oncomplete =
        () => {
          db.close();
          resolve();
        };

      transaction.onerror = () => {
        db.close();

        reject(
          transaction.error ??
            new Error(
              "Unable to save offline book state"
            )
        );
      };

      transaction.onabort = () => {
        db.close();

        reject(
          transaction.error ??
            new Error(
              "Offline book-state save was aborted"
            )
        );
      };
    }
  );
}

export async function getBookState(
  receiptBookId: string
): Promise<OfflineBookState | null> {
  const db = await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          META_STORE,
          "readonly"
        );

      const request =
        transaction
          .objectStore(
            META_STORE
          )
          .get(receiptBookId);

      request.onsuccess = () => {
        db.close();

        resolve(
          request.result ?? null
        );
      };

      request.onerror = () => {
        db.close();

        reject(
          request.error ??
            new Error(
              "Unable to read offline book state"
            )
        );
      };
    }
  );
}

/**
 * Merges the server's next expected receipt number with this device's
 * persisted state so a refresh cannot reuse a locally issued number.
 */
export async function mergeOfflineBookState(
  serverState: OfflineBookState,
  ownerUserId?: string
): Promise<OfflineBookState> {
  const currentOwner = ownerUserId ?? (await getAuthenticatedUserId());
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [RECEIPTS_STORE, META_STORE],
      "readwrite"
    );

    const receiptsStore = transaction.objectStore(RECEIPTS_STORE);
    const metadataStore = transaction.objectStore(META_STORE);

    const stateRequest = metadataStore.get(serverState.receiptBookId);
    const receiptsRequest = receiptsStore
      .index("byReceiptBook")
      .getAll(serverState.receiptBookId);

    let storedState: OfflineBookState | null = null;
    let localReceipts: LocalReceipt[] | null = null;
    let mergedState: OfflineBookState | null = null;
    let stateLoaded = false;
    let receiptsLoaded = false;

    function saveMergedState() {
      if (!stateLoaded || !receiptsLoaded || !localReceipts) {
        return;
      }

      const relevantReceipts = currentOwner
        ? localReceipts.filter(
            (r) =>
              !r.ownerUserId ||
              r.ownerUserId === currentOwner
          )
        : localReceipts;

      const receiptFloor = relevantReceipts.reduce(
        (nextNumber, receipt) =>
          Math.max(nextNumber, receipt.receiptNumber + 1),
        serverState.nextLocalNumber
      );

      mergedState = {
        ...serverState,
        ownerUserId:
          serverState.ownerUserId ?? currentOwner,
        nextLocalNumber: Math.max(
          serverState.nextLocalNumber,
          storedState?.nextLocalNumber ?? serverState.nextLocalNumber,
          receiptFloor
        ),
        updatedAt: new Date().toISOString(),
      };

      metadataStore.put(mergedState);
    }

    stateRequest.onsuccess = () => {
      storedState = (stateRequest.result as OfflineBookState | undefined) ?? null;
      stateLoaded = true;
      saveMergedState();
    };

    receiptsRequest.onsuccess = () => {
      localReceipts = receiptsRequest.result as LocalReceipt[];
      receiptsLoaded = true;
      saveMergedState();
    };

    stateRequest.onerror = () => {
      transaction.abort();
    };

    receiptsRequest.onerror = () => {
      transaction.abort();
    };

    transaction.oncomplete = () => {
      db.close();
      resolve(mergedState ?? serverState);
    };

    transaction.onerror = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Unable to merge offline book state")
      );
    };

    transaction.onabort = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Offline book-state merge was aborted")
      );
    };
  });
}

/* -------------------------------------------------
   ATOMIC LOCAL RECEIPT ALLOCATION & CREATION
------------------------------------------------- */

export interface AllocateReceiptParams {
  receiptBookId: string;
  organizationId: string;
  eventId: string;
  collectionSessionId: string;
  volunteerId: string;
  ownerUserId?: string | null;
  propertyId: string | null;
  donorName: string;
  donorMobile: string | null;
  amount: number;
  paymentMode: "cash" | "upi" | "cheque" | "bank_transfer";
  paymentReference: string | null;
  notes: string | null;
}

/**
 * Atomically reads current nextLocalNumber, assigns it,
 * increments the book counter, and stores the receipt
 * inside a single IndexedDB readwrite transaction.
 */
export async function allocateAndCreateLocalReceiptAtomic(
  input: AllocateReceiptParams
): Promise<LocalReceipt> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [RECEIPTS_STORE, META_STORE],
      "readwrite"
    );

    const receiptsStore = transaction.objectStore(RECEIPTS_STORE);
    const metadataStore = transaction.objectStore(META_STORE);

    const stateRequest = metadataStore.get(input.receiptBookId);
    let createdReceipt: LocalReceipt | null = null;

    stateRequest.onsuccess = () => {
      const bookState = stateRequest.result as OfflineBookState | undefined;

      if (!bookState) {
        transaction.abort();
        reject(
          new Error(
            "Receipt book is not available offline on this device."
          )
        );
        return;
      }

      const receiptNumber = bookState.nextLocalNumber;

      if (
        receiptNumber < bookState.startNumber ||
        receiptNumber > bookState.endNumber
      ) {
        transaction.abort();
        reject(
          new Error(
            "Receipt book has no more available receipt numbers."
          )
        );
        return;
      }

      const now = new Date().toISOString();

      createdReceipt = {
        clientReceiptId: generateUUID(),
        organizationId: input.organizationId,
        eventId: input.eventId,
        collectionSessionId: input.collectionSessionId,
        receiptBookId: input.receiptBookId,
        volunteerId: input.volunteerId,
        ownerUserId: input.ownerUserId ?? null,
        propertyId: input.propertyId,
        receiptNumber,
        donorName: input.donorName,
        donorMobile: input.donorMobile,
        amount: input.amount,
        paymentMode: input.paymentMode,
        paymentReference: input.paymentReference,
        notes: input.notes,
        offlineCreatedAt: now,
        syncStatus: "pending",
        syncAttempts: 0,
        lastSyncAttemptAt: null,
        lastSyncError: null,
        createdAt: now,
        updatedAt: now,
      };

      const nextBookState: OfflineBookState = {
        ...bookState,
        ownerUserId:
          bookState.ownerUserId ?? input.ownerUserId ?? null,
        nextLocalNumber: receiptNumber + 1,
        updatedAt: now,
      };

      receiptsStore.put(createdReceipt);
      metadataStore.put(nextBookState);
    };

    stateRequest.onerror = () => {
      transaction.abort();
      reject(
        stateRequest.error ??
          new Error("Failed to read receipt book metadata")
      );
    };

    transaction.oncomplete = () => {
      db.close();
      if (createdReceipt) {
        resolve(createdReceipt);
      } else {
        reject(
          new Error(
            "Receipt allocation completed without a result"
          )
        );
      }
    };

    transaction.onerror = () => {
      db.close();
      reject(
        transaction.error ??
          new Error(
            "Unable to atomically allocate and create local receipt"
          )
      );
    };

    transaction.onabort = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Local receipt transaction was aborted")
      );
    };
  });
}

/**
 * Creates a local receipt and advances
 * the receipt-book counter in ONE
 * IndexedDB transaction.
 *
 * Either both changes are committed,
 * or neither change is committed.
 */
export async function createLocalReceiptAtomic(
  receipt: LocalReceipt,
  nextBookState: OfflineBookState
): Promise<void> {
  const db = await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          [
            RECEIPTS_STORE,
            META_STORE,
          ],
          "readwrite"
        );

      const receiptsStore =
        transaction.objectStore(
          RECEIPTS_STORE
        );

      const metadataStore =
        transaction.objectStore(
          META_STORE
        );

      receiptsStore.put(receipt);

      metadataStore.put(
        nextBookState
      );

      transaction.oncomplete =
        () => {
          db.close();
          resolve();
        };

      transaction.onerror = () => {
        db.close();

        reject(
          transaction.error ??
            new Error(
              "Unable to atomically create local receipt"
            )
        );
      };

      transaction.onabort = () => {
        db.close();

        reject(
          transaction.error ??
            new Error(
              "Local receipt transaction was aborted"
            )
        );
      };
    }
  );
}

/* -------------------------------------------------
   SYNC STATE
------------------------------------------------- */

export async function updateLocalReceiptSyncState(
  clientReceiptId: string,
  syncStatus:
    | "pending"
    | "syncing"
    | "synced"
    | "conflict",
  options?: {
    syncAttempts?: number;
    lastSyncAttemptAt?: string | null;
    lastSyncError?: string | null;
  }
): Promise<void> {
  const db = await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          RECEIPTS_STORE,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          RECEIPTS_STORE
        );

      const request =
        store.get(clientReceiptId);

      request.onsuccess = () => {
        const receipt =
          request.result as
            | LocalReceipt
            | undefined;

        if (!receipt) {
          transaction.abort();

          reject(
            new Error(
              `Local receipt ${clientReceiptId} was not found.`
            )
          );

          return;
        }

        const updatedReceipt: LocalReceipt =
          {
            ...receipt,

            syncStatus,

            syncAttempts:
              options?.syncAttempts !== undefined
                ? options.syncAttempts
                : receipt.syncAttempts,

            lastSyncAttemptAt:
              options?.lastSyncAttemptAt !== undefined
                ? options.lastSyncAttemptAt
                : receipt.lastSyncAttemptAt,

            lastSyncError:
              options?.lastSyncError !== undefined
                ? options.lastSyncError
                : receipt.lastSyncError,

            updatedAt:
              new Date().toISOString(),
          };

        store.put(
          updatedReceipt
        );
      };

      request.onerror = () => {
        transaction.abort();

        reject(
          request.error ??
            new Error(
              "Unable to read local receipt for sync-state update"
            )
        );
      };

      transaction.oncomplete =
        () => {
          db.close();
          resolve();
        };

      transaction.onerror = () => {
        db.close();

        reject(
          transaction.error ??
            new Error(
              "Unable to update local receipt sync state"
            )
        );
      };

      transaction.onabort = () => {
        db.close();

        reject(
          transaction.error ??
            new Error(
              "Local receipt sync-state transaction was aborted"
            )
        );
      };
    }
  );
}

/* -------------------------------------------------
   RECEIPT HISTORY
------------------------------------------------- */

export async function getLocalReceipts(
  receiptBookId: string,
  ownerUserId?: string
): Promise<LocalReceipt[]> {
  const currentOwner = ownerUserId ?? (await getAuthenticatedUserId());
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      RECEIPTS_STORE,
      "readonly"
    );

    const request = transaction
      .objectStore(RECEIPTS_STORE)
      .index("byReceiptBook")
      .getAll(receiptBookId);

    request.onsuccess = () => {
      db.close();

      let receipts =
        request.result as LocalReceipt[];

      if (currentOwner) {
        receipts = receipts.filter(
          (receipt) =>
            !receipt.ownerUserId ||
            receipt.ownerUserId === currentOwner
        );
      }

      receipts.sort(
        (a, b) =>
          b.receiptNumber -
          a.receiptNumber
      );

      resolve(receipts);
    };

    request.onerror = () => {
      db.close();

      reject(
        request.error ??
          new Error(
            "Unable to read local receipt history"
          )
      );
    };
  });
}

/* -------------------------------------------------
   BUILDING SUMMARIES CACHE
------------------------------------------------- */

export async function saveCachedBuildingSummaries(
  eventId: string,
  summaries: CachedBuildingSummary[]
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BUILDINGS_STORE, "readwrite");
    const store = transaction.objectStore(BUILDINGS_STORE);

    for (const summary of summaries) {
      store.put({
        ...summary,
        eventId,
        cachedAt: new Date().toISOString(),
      });
    }

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Unable to cache building summaries"));
    };
  });
}

export async function getCachedBuildingSummaries(
  eventId: string
): Promise<CachedBuildingSummary[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BUILDINGS_STORE, "readonly");
    const request = transaction
      .objectStore(BUILDINGS_STORE)
      .index("byEventId")
      .getAll(eventId);

    request.onsuccess = () => {
      db.close();
      const buildings = (request.result || []) as CachedBuildingSummary[];
      buildings.sort((a, b) => {
        const aHasRemaining = a.remainingCount > 0 ? 1 : 0;
        const bHasRemaining = b.remainingCount > 0 ? 1 : 0;
        if (aHasRemaining !== bHasRemaining) {
          return bHasRemaining - aHasRemaining;
        }
        if (a.lastActivityAt && b.lastActivityAt) {
          return (
            new Date(b.lastActivityAt).getTime() -
            new Date(a.lastActivityAt).getTime()
          );
        }
        if (a.lastActivityAt) return -1;
        if (b.lastActivityAt) return 1;
        return a.buildingName.localeCompare(b.buildingName);
      });
      resolve(buildings);
    };

    request.onerror = () => {
      db.close();
      reject(
        request.error ??
          new Error("Unable to read cached building summaries")
      );
    };
  });
}

/* -------------------------------------------------
   BUILDING PROPERTIES CACHE
------------------------------------------------- */

export async function saveCachedBuildingProperties(
  eventId: string,
  buildingId: string,
  properties: CachedPropertyProgress[]
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROPERTIES_STORE, "readwrite");
    const store = transaction.objectStore(PROPERTIES_STORE);

    for (const prop of properties) {
      store.put({
        ...prop,
        eventId,
        buildingId,
        cachedAt: new Date().toISOString(),
      });
    }

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Unable to cache building properties")
      );
    };
  });
}

export async function getCachedBuildingProperties(
  eventId: string,
  buildingId: string
): Promise<CachedPropertyProgress[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROPERTIES_STORE, "readonly");
    const request = transaction
      .objectStore(PROPERTIES_STORE)
      .index("byBuildingId")
      .getAll(buildingId);

    request.onsuccess = () => {
      db.close();
      let properties = (request.result || []) as CachedPropertyProgress[];
      properties = properties.filter((p) => p.eventId === eventId);
      properties.sort((a, b) => {
        if ((a.floorNumber ?? 0) !== (b.floorNumber ?? 0)) {
          return (a.floorNumber ?? 0) - (b.floorNumber ?? 0);
        }
        return a.unitNumber.localeCompare(b.unitNumber, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
      resolve(properties);
    };

    request.onerror = () => {
      db.close();
      reject(
        request.error ??
          new Error("Unable to read cached building properties")
      );
    };
  });
}

export async function updateLocalPropertyProgress(
  eventId: string,
  buildingId: string,
  propertyId: string,
  updates: Partial<CachedPropertyProgress>
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROPERTIES_STORE, "readwrite");
    const store = transaction.objectStore(PROPERTIES_STORE);
    const getReq = store.get(propertyId);

    getReq.onsuccess = () => {
      const existing = getReq.result as CachedPropertyProgress | undefined;
      if (!existing) {
        db.close();
        resolve();
        return;
      }

      const updated: CachedPropertyProgress = {
        ...existing,
        ...updates,
        eventId,
        buildingId,
        cachedAt: new Date().toISOString(),
      };

      store.put(updated);
    };

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Unable to update local property progress")
      );
    };
  });
}

