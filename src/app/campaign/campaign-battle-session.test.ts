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
  restoreActiveCampaignBattle,
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
      .toThrow(/already resolved|no pending conflict|no battle awaiting resolution/i);

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

  it("restores the same pending campaign battle from the campaign or its tactical save after restart", async () => {
    const savedCampaign = createSavedCampaign({
      campaign: createDefendedConflict(),
      now: "2026-08-23T10:00:00.000Z",
    });
    const activeBattle = createActiveCampaignBattle(savedCampaign);
    const mission = createMissionState(
      activeBattle.battlePackage.scenario,
      activeBattle.battlePackage.battle.armies,
      activeBattle.battlePackage.request.battleDefenderArmyId,
    );
    const savedBattle = createSavedBattle({
      id: activeBattle.battleId,
      name: "Pending campaign battle",
      battle: activeBattle.battlePackage.battle,
      initialBattle: activeBattle.battlePackage.battle,
      logs: [],
      mission,
      campaignId: savedCampaign.id,
      scenarioId: activeBattle.battlePackage.scenario.id,
      now: "2026-08-23T10:01:00.000Z",
    });
    const persistence = createLocalStoragePersistence(createMemoryStorage(), "campaign-battle-restart");
    await persistence.saveCampaign(savedCampaign);
    await persistence.saveBattle(savedBattle);

    const restoredCampaign = await persistence.loadCampaign(savedCampaign.id);
    const restoredBattle = await persistence.loadBattle(savedBattle.id);
    expect(restoredCampaign).toBeDefined();
    expect(restoredBattle).toBeDefined();
    expect(restoreActiveCampaignBattle(restoredCampaign!)).toMatchObject({
      battleId: activeBattle.battleId,
      campaignId: savedCampaign.id,
    });
    expect(restoreActiveCampaignBattle(restoredCampaign!, restoredBattle!)).toMatchObject({
      battleId: activeBattle.battleId,
      request: activeBattle.request,
    });
  });

  it("rejects orphaned, mismatched, and previously resolved campaign battle saves", () => {
    const savedCampaign = createSavedCampaign({ campaign: createDefendedConflict() });
    const activeBattle = createActiveCampaignBattle(savedCampaign);
    const matchingSave = createSavedBattle({
      id: activeBattle.battleId,
      name: "Pending campaign battle",
      battle: activeBattle.battlePackage.battle,
      logs: [],
      campaignId: savedCampaign.id,
      scenarioId: activeBattle.battlePackage.scenario.id,
    });

    expect(() => restoreActiveCampaignBattle(savedCampaign, {
      ...matchingSave,
      campaignId: "missing-campaign",
    })).toThrow(/does not belong/i);
    expect(() => restoreActiveCampaignBattle(savedCampaign, {
      ...matchingSave,
      id: "different-battle",
    })).toThrow(/does not match/i);
    expect(() => restoreActiveCampaignBattle({
      ...savedCampaign,
      battleIds: [activeBattle.battleId],
    })).toThrow(/already been resolved/i);
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
