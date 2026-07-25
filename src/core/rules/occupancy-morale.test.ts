import { describe, expect, it } from "vitest";
import { applyBattleAction } from "../battle-actions";
import { createBattle } from "../battle-state";
import { createSequenceDiceRoller } from "../random";
import { crossedCriticalHpThreshold, resolveMoraleRetreat } from "./morale";
import { getTemplate } from "./state";

describe("exclusive field occupancy", () => {
  it("rejects movement onto any occupied field", () => {
    const battle = createBattle();
    battle.activeActivation = {
      id: "rep-token",
      armyId: "army_republic",
      faction: "Republic",
      used: true,
    };

    const result = applyBattleAction(battle, {
      type: "MoveUnit",
      unitId: "rep_unit_1",
      targetPosition: { x: 1, y: 3 },
    });

    expect(result.battle).toBe(battle);
    expect(result.log).toContain("jest zajete");
  });

  it("also rejects movement onto an enemy field", () => {
    const battle = createBattle();
    battle.armies[0].units[0].position = { x: 5, y: 2 };
    battle.activeActivation = {
      id: "rep-token",
      armyId: "army_republic",
      faction: "Republic",
      used: true,
    };

    const result = applyBattleAction(battle, {
      type: "MoveUnit",
      unitId: "rep_unit_1",
      targetPosition: { x: 6, y: 2 },
    });

    expect(result.battle).toBe(battle);
    expect(result.log).toContain("B1 Droid Regiment");
  });
});

describe("critical morale retreat", () => {
  it("checks morale only when HP crosses below twenty percent", () => {
    const template = getTemplate({
      ...createBattle().armies[0].units[0],
      templateId: "ahsoka_tano",
    });

    expect(crossedCriticalHpThreshold(template, 5, 3)).toBe(true);
    expect(crossedCriticalHpThreshold(template, 3, 2)).toBe(false);
    expect(crossedCriticalHpThreshold(template, 5, 0)).toBe(false);
  });

  it("retreats to a free field away from the attacker after a failed roll", () => {
    const battle = createBattle();
    const defender = battle.armies[0].units[0];
    const result = resolveMoraleRetreat(
      battle,
      defender.id,
      { x: 2, y: 2 },
      createSequenceDiceRoller([6, 6]),
    );

    expect(result.failed).toBe(true);
    expect(result.rolls).toEqual([6, 6]);
    expect(result.retreatedTo).toEqual({ x: 0, y: 1 });
  });
});
