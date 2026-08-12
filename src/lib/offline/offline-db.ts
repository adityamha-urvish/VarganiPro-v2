const DB_NAME = "varganipro-offline";
const DB_VERSION = 1;

const RECEIPTS_STORE = "receipts";
const META_STORE = "metadata";

export interface LocalReceipt {
  clientReceiptId: string;

  organizationId: string;
  eventId: string;
  collectionSessionId: string;
  receiptBookId: string;
  volunteerId: string;

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

  bookNumber: string;
  prefix: string;

  startNumber: number;
  endNumber: number;

  nextLocalNumber: number;

  updatedAt: string;
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
  receiptBookId: string
): Promise<LocalReceipt[]> {
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

        const receipts =
          (
            request.result as LocalReceipt[]
          ).filter(
            (receipt) =>
              receipt.syncStatus ===
                "pending" ||
              receipt.syncStatus ===
                "syncing"
          );

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

/* -------------------------------------------------
   ATOMIC LOCAL RECEIPT CREATION
------------------------------------------------- */

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
  receiptBookId: string
): Promise<LocalReceipt[]> {
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

      const receipts =
        request.result as LocalReceipt[];

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
