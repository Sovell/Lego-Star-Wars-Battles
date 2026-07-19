import { describe, expect, it } from "vitest";
import { createBattle } from "../battle-state";
import type { Battle, UnitInstance } from "../../types";
import { getAttackDiceBonus } from "./abilities";

describe("Ahsoka combat abilities", () => {
  it("adds one attack after moving and one more against a hero", () => {
    const { battle, attacker, defender } = battleWithAhsoka("asajj_ventress", true);

    expect(getAttackDiceBonus(battle, attacker, defender)).toBe(2);
  });

  it("applies each conditional bonus independently", () => {
    const stationaryDuel = battleWithAhsoka("asajj_ventress", false);
    const movingAgainstInfantry = battleWithAhsoka("b1_droid_squad", true);

    expect(
      getAttackDiceBonus(
        stationaryDuel.battle,
        stationaryDuel.attacker,
        stationaryDuel.defender,
      ),
    ).toBe(1);
    expect(
      getAttackDiceBonus(
        movingAgainstInfantry.battle,
        movingAgainstInfantry.attacker,
        movingAgainstInfantry.defender,
      ),
    ).toBe(1);
  });
});

function battleWithAhsoka(
  defenderTemplateId: string,
  movedThisTurn: boolean,
): { battle: Battle; attacker: UnitInstance; defender: UnitInstance } {
  const battle = createBattle();
  const attacker: UnitInstance = {
    ...battle.armies[0].units[0],
    templateId: "ahsoka_tano",
    position: { x: 2, y: 2 },
    movedThisTurn,
  };
  const defender: UnitInstance = {
    ...battle.armies[1].units[0],
    templateId: defenderTemplateId,
    position: { x: 3, y: 2 },
  };
  const nextBattle: Battle = {
    ...battle,
    armies: battle.armies.map((army, armyIndex) => ({
      ...army,
      units: army.units.map((unit, unitIndex) => {
        if (armyIndex === 0 && unitIndex === 0) return attacker;
        if (armyIndex === 1 && unitIndex === 0) return defender;
        return unit;
      }),
    })),
  };

  return { battle: nextBattle, attacker, defender };
}
