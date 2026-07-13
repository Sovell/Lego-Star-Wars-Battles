import { createLocalStoragePersistence } from "./local-storage-adapter";
import type { PersistenceAdapter } from "./storage-adapter";

export function createPersistenceAdapter(): PersistenceAdapter {
  return createLocalStoragePersistence();
}
