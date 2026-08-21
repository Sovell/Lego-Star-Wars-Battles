import { describe, expect, it } from "vitest";
import { unitTemplates } from "../../data";
import type { Battle } from "../../types";
import {
  applyCampaignBattleOutcome,
  createCampaignBattleOutcome,
  createCampaignBattlePackage,
  createCampaignBattleRequest,
  resolveCampaignBattle,
} from "./campaign-battle-bridge";
import { processCampaignEconomy } from "./campaign-economy";
import { beginCampaignActivationPhase } from "./campaign-movement";
import { attackCampaignSector } from "./campaign-sector-control";
import { createCampaignState, createStandardCampaignPlayers } from "./campaign-state";
import type { CampaignState } from "./campaign-types";

const templateById = new Map(unitTemplates.map((template) => [template.id, template]));

describe("campaign battle bridge", () => {
  it("creates a deterministic battle request and full tactical armies", () => {
    const conflictState = createDefendedConflict({ withYoda: true });
    const first = createCampaignBattlePackage(conflictState);
    const secondRequest = createCampaignBattleRequest(conflictState);

    expect(secondRequest).toEqual(first.request);
    expect(first.request).toMatchObject({
      campaignId: "battle-bridge-test",
      campaignTurn: 1,
      planetId: "felucia",
      themeId: "felucia-wilds",
      attackerArmyId: "player-1-army-1",
      defenderArmyId: "player-2-army-1",
      attackerFactionId: "Republic",
      defenderFactionId: "Separatists",
    });
    expect(first.armies).toHaveLength(2);
    expect(first.armies[0].units).toHaveLength(3);
    expect(first.armies[0].units.some(({ templateId }) => templateId === "yoda")).toBe(true);
    expect(first.battle.phase).toBe("Setup");
    expect(first.battle.board.width).toBe(8);
    expect(first.deploymentZones).toHaveLength(2);
    for (const unit of first.armies.flatMap(({ units }) => units)) {
      expect(unit.currentHp).toBe(templateById.get(unit.templateId)!.maxHp);
      expect(unit.position).toBeNull();
      expect(unit.suppression).toBe(0);
    }
  });

  it("adds a disposable level-three garrison without campaign bindings", () => {
    const conflictState = createBaseConflict(3);
    const battlePackage = createCampaignBattlePackage(conflictState);
    const garrisonBindings = battlePackage.request.unitBindings
      .filter(({ kind }) => kind === "Garrison");

    expect(battlePackage.request.defenderArmyId).toBeUndefined();
    expect(battlePackage.request.defenderBaseLevel).toBe(3);
    expect(garrisonBindings).toHaveLength(3);
    expect(battlePackage.armies[1].units.map(({ templateId }) => templateId)).toEqual([
      "b1_droid_squad",
      "b1_battle_droid_commander_squad",
      "aat_battle_tank",
    ]);

    const finalBattle = destroyUnits(battlePackage.battle, garrisonBindings.map(({ battleUnitId }) =>
      battleUnitId
    ));
    const outcome = createCampaignBattleOutcome(
      battlePackage.request,
      finalBattle,
      "Republic",
    );
    expect(outcome.destroyedCampaignUnitIds).toEqual([]);
    expect(outcome.destroyedHeroIds).toEqual([]);
  });

  it("removes destroyed strategic units and makes a defeated hero unavailable", () => {
    const conflictState = createDefendedConflict({ withYoda: true });
    const battlePackage = createCampaignBattlePackage(conflictState);
    const attackerRegular = battlePackage.request.unitBindings.find((binding) =>
      binding.kind === "Unit" && binding.campaignArmyId === "player-1-army-1"
    )!;
    const yoda = battlePackage.request.unitBindings.find(({ heroId }) => heroId === "yoda")!;
    const finalBattle = destroyUnits(battlePackage.battle, [
      attackerRegular.battleUnitId,
      yoda.battleUnitId,
    ]);

    const resolution = resolveCampaignBattle(
      conflictState,
      battlePackage,
      finalBattle,
      "Republic",
    );

    expect(resolution.outcome.destroyedCampaignUnitIds).toEqual([
      attackerRegular.campaignUnitId,
    ]);
    expect(resolution.outcome.destroyedHeroIds).toEqual(["yoda"]);
    expect(resolution.heroesAwaitingReturn).toEqual(["yoda"]);
    expect(resolution.state.armies.find(({ id }) => id === "player-1-army-1")?.units)
      .toHaveLength(1);
    expect(resolution.state.heroes.find(({ heroId }) => heroId === "yoda")).toMatchObject({
      livesRemaining: 2,
      status: "Unavailable",
      availableFromTurn: 3,
      assignedArmyId: undefined,
    });
  });

  it("keeps damaged survivors in the campaign and restores full HP next battle", () => {
    const conflictState = createDefendedConflict({ withYoda: false });
    const battlePackage = createCampaignBattlePackage(conflictState);
    const survivor = battlePackage.armies[0].units[0];
    const finalBattle = patchBattleUnit(battlePackage.battle, survivor.id, {
      currentHp: 1,
      suppression: 4,
    });
    const outcome = createCampaignBattleOutcome(
      battlePackage.request,
      finalBattle,
      "Separatists",
    );
    const resolution = applyCampaignBattleOutcome(conflictState, battlePackage.request, outcome);

    expect(outcome.destroyedCampaignUnitIds).toEqual([]);
    const campaignUnit = resolution.state.armies
      .flatMap(({ units }) => units)
      .find(({ id }) => id === survivor.id)!;
    expect(campaignUnit).toEqual({ id: survivor.id, templateId: survivor.templateId });
  });

  it("permanently eliminates a hero when its final life is lost", () => {
    let conflictState = createDefendedConflict({ withYoda: true });
    conflictState = {
      ...conflictState,
      heroes: conflictState.heroes.map((hero) => hero.heroId === "yoda"
        ? { ...hero, livesRemaining: 1 }
        : hero),
    };
    const battlePackage = createCampaignBattlePackage(conflictState);
    const yoda = battlePackage.request.unitBindings.find(({ heroId }) => heroId === "yoda")!;
    const resolution = resolveCampaignBattle(
      conflictState,
      battlePackage,
      destroyUnits(battlePackage.battle, [yoda.battleUnitId]),
      "Separatists",
    );

    expect(resolution.heroesLostPermanently).toEqual(["yoda"]);
    expect(resolution.state.heroes.find(({ heroId }) => heroId === "yoda")).toMatchObject({
      livesRemaining: 0,
      status: "Eliminated",
      assignedArmyId: undefined,
    });
  });

  it("returns a surviving hero only after one complete unavailable turn", () => {
    const conflictState = createDefendedConflict({ withYoda: true });
    const battlePackage = createCampaignBattlePackage(conflictState);
    const yoda = battlePackage.request.unitBindings.find(({ heroId }) => heroId === "yoda")!;
    let state = resolveCampaignBattle(
      conflictState,
      battlePackage,
      destroyUnits(battlePackage.battle, [yoda.battleUnitId]),
      "Separatists",
    ).state;

    state = processCampaignEconomy({
      ...state,
      turn: 2,
      phase: "Income",
      incomeCollectedForTurn: 1,
    }).state;
    expect(state.heroes.find(({ heroId }) => heroId === "yoda")?.status)
      .toBe("Unavailable");
    state = processCampaignEconomy({
      ...state,
      turn: 3,
      phase: "Income",
    }).state;
    expect(state.heroes.find(({ heroId }) => heroId === "yoda")?.status)
      .toBe("Available");
  });

  it("rejects losses that were not part of the original battle request", () => {
    const conflictState = createDefendedConflict({ withYoda: false });
    const request = createCampaignBattleRequest(conflictState);
    expect(() => applyCampaignBattleOutcome(conflictState, request, {
      battleRequestId: request.id,
      winnerFactionId: "Republic",
      destroyedCampaignUnitIds: ["foreign-unit"],
      destroyedHeroIds: [],
      objectiveResult: "AttackerVictory",
    })).toThrow(/outside its campaign request/);
  });
});

function createDefendedConflict({ withYoda }: { withYoda: boolean }): CampaignState {
  let state = createProcessedCampaign();
  const target = getPlanet(state, "felucia").sectors[2];
  state = {
    ...state,
    planets: state.planets.map((planet) => planet.planetId === "felucia"
      ? {
          ...planet,
          sectors: planet.sectors.map((sector) => sector.sectorId === target.sectorId
            ? { ...sector, ownerFactionId: "Separatists", controllerPlayerId: "player-2" }
            : sector),
        }
      : planet),
    armies: state.armies.map((army) => {
      if (army.id === "player-2-army-1") {
        return { ...army, planetId: "felucia", sectorId: target.sectorId };
      }
      if (withYoda && army.id === "player-1-army-1") {
        return { ...army, heroIds: ["yoda"] };
      }
      return army;
    }),
    heroes: withYoda
      ? state.heroes.map((hero) => hero.heroId === "yoda"
        ? {
            ...hero,
            status: "Assigned",
            ownerPlayerId: "player-1",
            assignedArmyId: "player-1-army-1",
          }
        : hero)
      : state.heroes,
  };
  const active = beginCampaignActivationPhase(state);
  return attackCampaignSector(active, "player-1-army-1", target.sectorId).state;
}

function createBaseConflict(level: 1 | 2 | 3): CampaignState {
  let state = createProcessedCampaign();
  const target = getPlanet(state, "felucia").sectors[2];
  state = {
    ...state,
    planets: state.planets.map((planet) => planet.planetId === "felucia"
      ? {
          ...planet,
          sectors: planet.sectors.map((sector) => sector.sectorId === target.sectorId
            ? { ...sector, ownerFactionId: "Separatists", controllerPlayerId: "player-2" }
            : sector),
        }
      : planet),
    armies: state.armies.filter(({ factionId }) => factionId === "Republic"),
    bases: [{
      id: "felucia-separatist-base",
      ownerPlayerId: "player-2",
      factionId: "Separatists",
      planetId: "felucia",
      sectorId: target.sectorId,
      level,
    }],
  };
  const active = beginCampaignActivationPhase(state);
  return attackCampaignSector(active, "player-1-army-1", target.sectorId).state;
}

function createProcessedCampaign(): CampaignState {
  return processCampaignEconomy(createCampaignState({
    id: "battle-bridge-test",
    name: "Battle Bridge Test",
    seed: 2026,
    players: createStandardCampaignPlayers(["Rex", "Grievous"]),
  })).state;
}

function getPlanet(state: CampaignState, planetId: string) {
  return state.planets.find((planet) => planet.planetId === planetId)!;
}

function destroyUnits(battle: Battle, unitIds: string[]): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => unitIds.includes(unit.id)
        ? { ...unit, currentHp: 0, status: "Destroyed" }
        : unit),
    })),
  };
}

function patchBattleUnit(
  battle: Battle,
  unitId: string,
  patch: Partial<Battle["armies"][number]["units"][number]>,
): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => unit.id === unitId ? { ...unit, ...patch } : unit),
    })),
  };
}
