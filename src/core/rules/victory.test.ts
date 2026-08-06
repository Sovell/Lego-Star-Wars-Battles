import { describe, expect, it } from "vitest";
import { createBattle } from "../battle-state";
import { getVictoryState } from "./victory";

describe("team victory", () => {
  it("finishes when multiple surviving armies all belong to one team", () => {
    const battle = createBattle();
    const ally = structuredClone(battle.armies[0]);
    ally.id = "army_republic_allies";
    ally.playerName = "Republic Allies";
    ally.units = ally.units.map((unit, index) => ({
      ...unit,
      id: `rep_ally_${index}`,
      armyId: ally.id,
    }));
    battle.armies.push(ally);
    battle.armies[1].units = battle.armies[1].units.map((unit) => ({
      ...unit,
      status: "Destroyed",
      position: null,
    }));

    expect(getVictoryState(battle)).toEqual({
      finished: true,
      winnerArmyId: "army_republic",
    });
  });
});
