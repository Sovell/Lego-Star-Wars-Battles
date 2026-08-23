import { describe, expect, it } from "vitest";
import { createLocalStoragePersistence, type StorageLike } from "../persistence/local-storage-adapter";
import { createSavedCampaign } from "../persistence/save-types";
import {
  appendCampaignEvent,
  createCampaignState,
  createStandardCampaignPlayers,
  processCampaignEconomy,
  queueBaseConstruction,
  type CampaignState,
} from "./index";

describe("campaign history", () => {
  it("records income and economic orders, then restores the journal with the campaign", async () => {
    let state = fullyControlFelucia(createCampaign());
    state = processCampaignEconomy(state).state;
    state = withCredits(state, "player-1", 100);
    state = queueBaseConstruction(state, "player-1", "felucia");

    expect(state.history?.map(({ type }) => type)).toEqual(expect.arrayContaining([
      "CampaignStarted",
      "IncomeCollected",
      "BaseConstructionQueued",
    ]));
    expect(state.history?.at(-1)).toMatchObject({
      type: "BaseConstructionQueued",
      planetId: "felucia",
      amount: 20,
      completesOnTurn: 2,
    });

    const persistence = createLocalStoragePersistence(memoryStorage(), "campaign-history");
    const saved = createSavedCampaign({ campaign: state });
    await persistence.saveCampaign(saved);
    expect((await persistence.loadCampaign(saved.id))?.campaign.history).toEqual(state.history);
  });

  it("keeps event ids unique after the journal reaches its retention limit", () => {
    let state = createCampaign();
    for (let index = 0; index < 170; index += 1) {
      state = appendCampaignEvent(state, { type: "ArmyActivationFinished", armyId: `army-${index}` });
    }
    expect(state.history).toHaveLength(160);
    expect(new Set(state.history?.map(({ id }) => id)).size).toBe(160);
  });
});

function createCampaign(): CampaignState {
  return createCampaignState({
    id: "campaign-history-test",
    name: "Campaign History Test",
    seed: 2026,
    players: createStandardCampaignPlayers(["Rex", "Grievous"]),
  });
}

function fullyControlFelucia(state: CampaignState): CampaignState {
  return {
    ...state,
    planets: state.planets.map((planet) => planet.planetId === "felucia"
      ? {
          ...planet,
          sectors: planet.sectors.map((sector) => ({
            ...sector,
            ownerFactionId: "Republic" as const,
            controllerPlayerId: "player-1",
          })),
        }
      : planet),
  };
}

function withCredits(state: CampaignState, playerId: string, credits: number): CampaignState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, credits } : player),
  };
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, value); },
  };
}
