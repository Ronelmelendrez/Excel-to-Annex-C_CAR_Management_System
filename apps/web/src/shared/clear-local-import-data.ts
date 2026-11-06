const IMPORT_RECOVERY_DATABASE = "car_import_sessions";
const IMPORT_STORAGE_KEYS = ["car.demo.imports.v1", "car.demo.issues.v1"];
const IMPORT_LEASE_KEY_PREFIX = `${IMPORT_RECOVERY_DATABASE}:lease:`;

export async function clearLocalImportData(): Promise<void> {
  try {
    for (const key of IMPORT_STORAGE_KEYS) localStorage.removeItem(key);
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(IMPORT_LEASE_KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable; IndexedDB cleanup is still attempted below.
  }

  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(IMPORT_RECOVERY_DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Local import recovery data could not be cleared."));
    request.onblocked = () =>
      reject(new Error("Close other open app tabs, then reload to clear local import recovery data."));
  });
}
