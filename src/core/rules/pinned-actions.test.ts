import { describe, expect, it } from "vitest";
import { applyBattleAction } from "../battle-actions";
import { createBattle } from "../battle-state";
import { findUnit } from "./state";

describe("pinned unit actions", () => {
  it("rejects movement and Overwatch at the rules boundary", () => {
    const battle = createPinnedBattle();

    const movement = applyBattleAction(battle, {
      type: "MoveUnit",
      unitId: "rep_unit_1",
      targetPosition: { x: 2, y: 2 },
    });
    const overwatch = applyBattleAction(battle, {
      type: "ApplyOrder",
      unitId: "rep_unit_1",
      order: "Overwatch",
    });

    expect(movement.battle).toBe(battle);
    expect(movement.log).toContain("wyłącznie Rally");
    expect(overwatch.battle).toBe(battle);
    expect(overwatch.log).toContain("wyłącznie Rally");
  });

  it("allows Rally and ends the pinned unit activation", () => {
    const battle = createPinnedBattle();

    const result = applyBattleAction(battle, {
      type: "ApplyOrder",
      unitId: "rep_unit_1",
      order: "Rally",
    });

    expect(result.battle).not.toBe(battle);
    expect(result.battle.activeActivation).toBeUndefined();
    expect(findUnit(result.battle, "rep_unit_1")).toMatchObject({
      status: "Activated",
      suppression: 1,
    });
  });
});

function createPinnedBattle() {
  const battle = createBattle();
  const source = battle.armies[0].units[0];
  source.status = "Pinned";
  source.suppression = 3;
  battle.activeActivation = {
    id: "pinned-unit-token",
    armyId: source.armyId,
    faction: battle.armies[0].faction,
    used: true,
  };
  return battle;
}
