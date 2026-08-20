import "fake-indexeddb/auto";
import { afterEach } from "vitest";

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("varganipro-offline");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Unable to reset IndexedDB."));
  });
});
