import { describe, expect, it } from "vitest";
import { starterArmies } from "../../data";
import type { Army } from "../../types";
import { createBattle } from "../battle-state";
import { survivalTestScenario } from "../scenario/scenarios";
import { deployUnit, getLegalReserveEntryCells } from "./deployment";

describe("multi-army deployment", () => {
  it("uses the configured deployment zone for the fourth army slot", () => {
    const armies = [
      cloneArmy(starterArmies[0], "army-a"),
      cloneArmy(starterArmies[1], "army-b"),
      cloneArmy(starterArmies[0], "army-c"),
      cloneArmy(starterArmies[1], "army-d"),
    ];
    const battle = createBattle(armies);
    const unit = battle.armies[3].units[0];
    unit.position = null;
    battle.activeActivation = {
      id: "army-d-token",
      armyId: "army-d",
      faction: battle.armies[3].faction,
      used: true,
    };
    const scenario = {
      ...survivalTestScenario,
      deploymentZones: [0, 1, 2, 3].map((armySlot) => ({
        id: `zone-${armySlot}`,
        armySlot,
        cells: armySlot === 3 ? [{ x: 4, y: 4 }] : [],
      })),
    };

    expect(getLegalReserveEntryCells(battle, scenario, unit.id)).toEqual([{ x: 4, y: 4 }]);
    const result = deployUnit(battle, scenario, unit.id, { x: 4, y: 4 });
    expect(result.battle.armies[3].units[0].position).toEqual({ x: 4, y: 4 });
  });
});

function cloneArmy(source: Army, id: string): Army {
  return {
    ...structuredClone(source),
    id,
    units: source.units.map((unit, index) => ({
      ...structuredClone(unit),
      id: `${id}-unit-${index}`,
      armyId: id,
    })),
  };
}
