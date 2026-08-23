import { describe, expect, it } from "vitest";
import {
  attackCampaignSector,
  beginCampaignActivationPhase,
  createCampaignState,
  createStandardCampaignPlayers,
  processCampaignEconomy,
  type CampaignState,
} from "../../core/campaign";
import { createSavedBattle, createSavedCampaign } from "../../core/persistence/save-types";
import { createLocalStoragePersistence, type StorageLike } from "../../core/persistence/local-storage-adapter";
import { createMissionState } from "../../core/scenario/scenario-engine";
import type { Battle } from "../../types";
import {
  createActiveCampaignBattle,
  resolveActiveCampaignBattle,
} from "./campaign-battle-session";

describe("campaign battle session", () => {
  it("creates, resolves, saves and restores a complete defended-sector battle flow", async () => {
    const beforeBattle = createDefendedConflict();
    const savedBeforeBattle = createSavedCampaign({ campaign: beforeBattle, now: "2026-08-23T10:00:00.000Z" });
    const activeBattle = createActiveCampaignBattle(savedBeforeBattle);
    const restartedSession = createActiveCampaignBattle(savedBeforeBattle);
    expect(restartedSession.battlePackage).toEqual(activeBattle.battlePackage);

    const destroyedAttacker = activeBattle.battlePackage.request.unitBindings.find(({ kind }) => kind === "Unit")!;
    const finalBattle = destroyUnits(activeBattle.battlePackage.battle, [destroyedAttacker.battleUnitId]);
    const mission = {
      ...createMissionState(activeBattle.battlePackage.scenario, finalBattle.armies, activeBattle.battlePackage.request.battleDefenderArmyId),
      status: "Victory" as const,
    };
    const resolved = resolveActiveCampaignBattle(savedBeforeBattle, activeBattle, finalBattle, mission);

    expect(resolved.winnerFactionId).toBe("Republic");
    expect(resolved.savedCampaign.battleIds).toEqual([activeBattle.battleId]);
    expect(resolved.savedCampaign.campaign.pendingConflict).toBeUndefined();
    expect(resolved.savedCampaign.campaign.planets.find(({ planetId }) => planetId === "felucia")?.sectors[2])
      .toMatchObject({ ownerFactionId: "Republic", controllerPlayerId: "player-1" });
    expect(resolved.savedCampaign.campaign.armies.find(({ id }) => id === "player-1-army-1")?.units)
      .toHaveLength(1);
    expect(() => resolveActiveCampaignBattle(resolved.savedCampaign, activeBattle, finalBattle, mission))
      .toThrow(/no pending conflict|no battle awaiting resolution/i);

    const persistence = createLocalStoragePersistence(createMemoryStorage(), "campaign-battle-session");
    await persistence.saveBattle(createSavedBattle({
      id: activeBattle.battleId,
      name: "Campaign battle",
      battle: finalBattle,
      logs: [],
      mission,
      campaignId: resolved.savedCampaign.id,
      scenarioId: activeBattle.battlePackage.scenario.id,
      now: "2026-08-23T10:01:00.000Z",
    }));
    await persistence.saveCampaign(resolved.savedCampaign);
    expect(await persistence.loadBattle(activeBattle.battleId)).toMatchObject({
      campaignId: resolved.savedCampaign.id,
      battle: expect.objectContaining({
        id: finalBattle.id,
        armies: finalBattle.armies,
      }),
    });
    expect(await persistence.loadCampaign(resolved.savedCampaign.id)).toEqual(resolved.savedCampaign);
  });
});

function createDefendedConflict(): CampaignState {
  const processed = processCampaignEconomy(createCampaignState({
    id: "battle-session-test",
    name: "Battle Session Test",
    seed: 2026,
    players: createStandardCampaignPlayers(["Rex", "Grievous"]),
  })).state;
  const target = processed.planets.find(({ planetId }) => planetId === "felucia")!.sectors[2];
  const prepared = {
    ...processed,
    planets: processed.planets.map((planet) => planet.planetId === "felucia"
      ? {
          ...planet,
          sectors: planet.sectors.map((sector) => sector.sectorId === target.sectorId
            ? { ...sector, ownerFactionId: "Separatists" as const, controllerPlayerId: "player-2" }
            : sector),
        }
      : planet),
    armies: processed.armies.map((army) => army.id === "player-2-army-1"
      ? { ...army, planetId: "felucia", sectorId: target.sectorId }
      : army),
  };
  return attackCampaignSector(
    beginCampaignActivationPhase(prepared),
    "player-1-army-1",
    target.sectorId,
  ).state;
}

function destroyUnits(battle: Battle, unitIds: string[]): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => unitIds.includes(unit.id)
        ? { ...unit, currentHp: 0, status: "Destroyed" as const }
        : unit),
    })),
  };
}

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, value); },
  };
}
