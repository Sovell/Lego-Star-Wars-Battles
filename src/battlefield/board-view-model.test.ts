import { describe, expect, it } from "vitest";
import { createBattlefieldObject } from "../core/battlefield-objects";
import { createBattle } from "../core/battle-state";
import { createMissionState } from "../core/scenario/scenario-engine";
import { controlTerritoryScenario } from "../core/scenario/scenarios";
import { starterArmies } from "../data";
import { boardPositionKey, createBoardViewModel } from "./board-view-model";

describe("board view model", () => {
  it("indexes board content, units and territory once by position", () => {
    const battle = createBattle(starterArmies);
    battle.board = {
      width: 8,
      height: 8,
      tiles: [{
        x: 1,
        y: 2,
        terrainType: "Building",
        defenseBonus: 2,
        attackBonus: 1,
        movementCost: 1,
        blocksLineOfSight: true,
      }],
      objects: [createBattlefieldObject("StrategicPoint", { x: 1, y: 2 })],
    };
    battle.armies[0].units[0].position = { x: 1, y: 2 };
    const mission = {
      ...createMissionState(controlTerritoryScenario, battle.armies),
      territoryOwners: { "1,2": battle.armies[0].id },
    };

    const viewModel = createBoardViewModel(battle, mission);
    const key = boardPositionKey(1, 2);

    expect(viewModel.positions).toHaveLength(64);
    expect(viewModel.tilesByPosition.get(key)?.terrainType).toBe("Building");
    expect(viewModel.objectsByPosition.get(key)?.type).toBe("StrategicPoint");
    expect(viewModel.unitsByPosition.get(key)?.[0]).toMatchObject({
      unitId: battle.armies[0].units[0].id,
      faction: battle.armies[0].faction,
      name: "Clone Trooper Battalion",
      initials: "CTB",
    });
    expect(viewModel.territoryByPosition.get(key)).toEqual({
      armyId: battle.armies[0].id,
      faction: battle.armies[0].faction,
    });
  });
});
