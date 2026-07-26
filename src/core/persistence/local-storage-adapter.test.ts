import { describe, expect, it } from "vitest";
import { createBattle } from "../battle-state";
import { createLocalStoragePersistence, type StorageLike } from "./local-storage-adapter";
import { createSavedBattle } from "./save-types";

describe("createLocalStoragePersistence", () => {
  it("saves, loads, lists, and deletes battles", async () => {
    const storage = createMemoryStorage();
    const persistence = createLocalStoragePersistence(storage, "test");
    const battle = createBattle();
    const savedBattle = createSavedBattle({
      id: "battle-1",
      name: "Opening Clash",
      battle,
      initialBattle: structuredClone(battle),
      logs: [{ id: "log-1", turn: 1, message: "Battle ready." }],
      mission: {
        scenarioId: "survival-test",
        status: "Active",
        roundsCompleted: 2,
      },
      now: "2026-06-21T10:00:00.000Z",
    });

    await persistence.saveBattle(savedBattle);

    await expect(persistence.loadBattle("battle-1")).resolves.toEqual(savedBattle);
    await expect(persistence.loadBattle("battle-1")).resolves.toMatchObject({
      initialBattle: { id: battle.id, turn: 1 },
    });
    await expect(persistence.listBattles()).resolves.toEqual([
      {
        id: "battle-1",
        name: "Opening Clash",
        turn: 1,
        phase: "Activation",
        createdAt: "2026-06-21T10:00:00.000Z",
        updatedAt: "2026-06-21T10:00:00.000Z",
      },
    ]);

    await persistence.deleteBattle("battle-1");
    await expect(persistence.loadBattle("battle-1")).resolves.toBeUndefined();
  });

  it("lists the newest battle saves first", async () => {
    const persistence = createLocalStoragePersistence(createMemoryStorage(), "test");

    await persistence.saveBattle(
      createSavedBattle({
        id: "older",
        name: "Older",
        battle: createBattle(),
        logs: [],
        now: "2026-06-21T10:00:00.000Z",
      }),
    );
    await persistence.saveBattle(
      createSavedBattle({
        id: "newer",
        name: "Newer",
        battle: createBattle(),
        logs: [],
        now: "2026-06-21T12:00:00.000Z",
      }),
    );

    await expect(persistence.listBattles()).resolves.toMatchObject([
      { id: "newer" },
      { id: "older" },
    ]);
  });

  it("rejects unsupported save schema versions", async () => {
    const storage = createMemoryStorage();
    const persistence = createLocalStoragePersistence(storage, "test");
    storage.setItem(
      "test:battle:future",
      JSON.stringify({
        schemaVersion: 999,
        kind: "battle",
        payload: {},
      }),
    );

    await expect(persistence.loadBattle("future")).rejects.toThrow("Unsupported save schema version");
  });
});

function createMemoryStorage(): StorageLike {
  const records = new Map<string, string>();

  return {
    get length() {
      return records.size;
    },
    getItem(key) {
      return records.get(key) ?? null;
    },
    key(index) {
      return Array.from(records.keys())[index] ?? null;
    },
    removeItem(key) {
      records.delete(key);
    },
    setItem(key, value) {
      records.set(key, value);
    },
  };
}
