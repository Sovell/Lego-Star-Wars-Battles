import type { SavedArmy, SavedBattle, SavedBattleSummary, SavedCampaign, SaveFile, SaveKind } from "./save-types";
import { createSaveFile, SAVE_SCHEMA_VERSION, summarizeBattle } from "./save-types";
import type { PersistenceAdapter } from "./storage-adapter";

export type StorageLike = Pick<Storage, "getItem" | "key" | "length" | "removeItem" | "setItem">;

const DEFAULT_PREFIX = "lego-star-wars-battles";

export function createLocalStoragePersistence(
  storage: StorageLike = window.localStorage,
  prefix = DEFAULT_PREFIX,
): PersistenceAdapter {
  return {
    saveArmy(savedArmy) {
      writeSaveFile(storage, prefix, "army", savedArmy.id, savedArmy);
      return Promise.resolve();
    },
    async loadArmy(id) {
      return readSaveFile<SavedArmy>(storage, prefix, "army", id);
    },
    async listArmies() {
      return listSaveFiles<SavedArmy>(storage, prefix, "army");
    },
    deleteArmy(id) {
      storage.removeItem(storageKey(prefix, "army", id));
      return Promise.resolve();
    },
    saveBattle(savedBattle) {
      writeSaveFile(storage, prefix, "battle", savedBattle.id, savedBattle);
      return Promise.resolve();
    },
    async loadBattle(id) {
      return readSaveFile<SavedBattle>(storage, prefix, "battle", id);
    },
    async listBattles() {
      return listSaveFiles<SavedBattle>(storage, prefix, "battle")
        .map(summarizeBattle)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    deleteBattle(id) {
      storage.removeItem(storageKey(prefix, "battle", id));
      return Promise.resolve();
    },
    saveCampaign(savedCampaign) {
      writeSaveFile(storage, prefix, "campaign", savedCampaign.id, savedCampaign);
      return Promise.resolve();
    },
    async loadCampaign(id) {
      return readSaveFile<SavedCampaign>(storage, prefix, "campaign", id);
    },
    async listCampaigns() {
      return listSaveFiles<SavedCampaign>(storage, prefix, "campaign").sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    },
    deleteCampaign(id) {
      storage.removeItem(storageKey(prefix, "campaign", id));
      return Promise.resolve();
    },
  };
}

function writeSaveFile<TPayload>(
  storage: StorageLike,
  prefix: string,
  kind: SaveKind,
  id: string,
  payload: TPayload,
): void {
  storage.setItem(storageKey(prefix, kind, id), JSON.stringify(createSaveFile(kind, payload)));
}

function readSaveFile<TPayload>(
  storage: StorageLike,
  prefix: string,
  kind: SaveKind,
  id: string,
): TPayload | undefined {
  const rawSaveFile = storage.getItem(storageKey(prefix, kind, id));
  if (!rawSaveFile) {
    return undefined;
  }

  return parseSaveFile<TPayload>(rawSaveFile, kind).payload;
}

function listSaveFiles<TPayload>(
  storage: StorageLike,
  prefix: string,
  kind: SaveKind,
): TPayload[] {
  const keyPrefix = storageKeyPrefix(prefix, kind);
  const records: TPayload[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(keyPrefix)) {
      continue;
    }

    const rawSaveFile = storage.getItem(key);
    if (!rawSaveFile) {
      continue;
    }

    records.push(parseSaveFile<TPayload>(rawSaveFile, kind).payload);
  }

  return records;
}

function parseSaveFile<TPayload>(rawSaveFile: string, expectedKind: SaveKind): SaveFile<TPayload> {
  const saveFile = JSON.parse(rawSaveFile) as SaveFile<TPayload>;

  if (saveFile.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error(`Unsupported save schema version: ${saveFile.schemaVersion}.`);
  }

  if (saveFile.kind !== expectedKind) {
    throw new Error(`Unexpected save kind: ${saveFile.kind}.`);
  }

  return saveFile;
}

function storageKey(prefix: string, kind: SaveKind, id: string): string {
  return `${storageKeyPrefix(prefix, kind)}${id}`;
}

function storageKeyPrefix(prefix: string, kind: SaveKind): string {
  return `${prefix}:${kind}:`;
}
