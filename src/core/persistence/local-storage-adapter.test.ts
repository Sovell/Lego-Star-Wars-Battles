import { describe, expect, it } from "vitest";
import { createBattle } from "../battle-state";
import { createCampaignState, createStandardCampaignPlayers } from "../campaign";
import { createLocalStoragePersistence, type StorageLike } from "./local-storage-adapter";
import {
  CAMPAIGN_SAVE_FORMAT_VERSION,
  createSavedBattle,
  createSavedCampaign,
  SAVE_SCHEMA_VERSION,
} from "./save-types";

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

  it("round-trips a complete CampaignState snapshot", async () => {
    const storage = createMemoryStorage();
    const persistence = createLocalStoragePersistence(storage, "test");
    const campaign = createCampaignState({
      id: "outer-rim-war",
      name: "Outer Rim War",
      seed: 4266,
      players: createStandardCampaignPlayers(["Rex", "Grievous"]),
    });
    campaign.players[0].credits = 37;
    campaign.armies[0].activatedThisTurn = true;
    campaign.armies[0].movementPointsRemaining = 1;
    campaign.heroes[0].xp = 4;
    const savedCampaign = createSavedCampaign({
      campaign,
      battleIds: ["battle-geonosis-1", "battle-ryloth-1"],
      now: "2026-08-17T12:00:00.000Z",
    });

    await persistence.saveCampaign(savedCampaign);
    campaign.players[0].credits = 999;

    await expect(persistence.loadCampaign("outer-rim-war")).resolves.toEqual({
      ...savedCampaign,
      campaign: {
        ...savedCampaign.campaign,
        players: [{ ...savedCampaign.campaign.players[0], credits: 37 }, ...savedCampaign.campaign.players.slice(1)],
      },
    });
    expect(JSON.parse(storage.getItem("test:campaign:outer-rim-war") ?? "null")).toMatchObject({
      schemaVersion: SAVE_SCHEMA_VERSION,
      kind: "campaign",
      payload: {
        campaignFormatVersion: CAMPAIGN_SAVE_FORMAT_VERSION,
        id: "outer-rim-war",
        campaign: { turn: 1, phase: "Income", incomeCollectedForTurn: 0 },
      },
    });
  });

  it("lists full campaign snapshots newest first and deletes them", async () => {
    const persistence = createLocalStoragePersistence(createMemoryStorage(), "test");
    const olderCampaign = createCampaignState({
      id: "older-campaign",
      name: "Older Campaign",
      seed: 1,
      players: createStandardCampaignPlayers(["A", "B"]),
    });
    const newerCampaign = createCampaignState({
      id: "newer-campaign",
      name: "Newer Campaign",
      seed: 2,
      players: createStandardCampaignPlayers(["C", "D"]),
    });
    await persistence.saveCampaign(createSavedCampaign({
      campaign: olderCampaign,
      now: "2026-08-17T10:00:00.000Z",
    }));
    await persistence.saveCampaign(createSavedCampaign({
      campaign: newerCampaign,
      now: "2026-08-17T11:00:00.000Z",
    }));

    await expect(persistence.listCampaigns()).resolves.toMatchObject([
      { id: "newer-campaign", campaign: { seed: 2, players: [{ name: "C" }, { name: "D" }] } },
      { id: "older-campaign", campaign: { seed: 1, players: [{ name: "A" }, { name: "B" }] } },
    ]);

    await persistence.deleteCampaign("newer-campaign");
    await expect(persistence.loadCampaign("newer-campaign")).resolves.toBeUndefined();
  });

  it("recognizes legacy metadata-only campaign saves instead of loading partial state", async () => {
    const storage = createMemoryStorage();
    const persistence = createLocalStoragePersistence(storage, "test");
    storage.setItem("test:campaign:legacy", JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION,
      kind: "campaign",
      payload: {
        id: "legacy",
        name: "Legacy campaign",
        armyIds: ["army-1"],
        battleIds: [],
        createdAt: "2026-08-01T10:00:00.000Z",
        updatedAt: "2026-08-01T10:00:00.000Z",
      },
    }));

    await expect(persistence.loadCampaign("legacy")).rejects.toThrow(
      "Legacy campaign save contains metadata only",
    );
  });

  it("rejects a campaign snapshot with broken internal references", async () => {
    const storage = createMemoryStorage();
    const persistence = createLocalStoragePersistence(storage, "test");
    const campaign = createCampaignState({
      id: "broken",
      name: "Broken",
      seed: 3,
      players: createStandardCampaignPlayers(["A", "B"]),
    });
    const savedCampaign = createSavedCampaign({ campaign, now: "2026-08-17T12:00:00.000Z" });
    savedCampaign.campaign.armies[0].ownerPlayerId = "missing-player";
    storage.setItem("test:campaign:broken", JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION,
      kind: "campaign",
      payload: savedCampaign,
    }));

    await expect(persistence.loadCampaign("broken")).rejects.toThrow(
      "references an unknown campaign player",
    );
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
