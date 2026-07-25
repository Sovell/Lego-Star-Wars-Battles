import { describe, expect, it } from "vitest";
import { applyBattleAction } from "../battle-actions";
import { createBattle } from "../battle-state";

describe("active abilities", () => {
  it("lets clone engineers build cover and starts its cooldown", () => {
    const battle = createBattle();
    battle.armies[0].units[0].templateId = "clone_engineers_332nd";
    battle.activeActivation = {
      id: "rep-token",
      armyId: "army_republic",
      faction: "Republic",
      used: true,
    };

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: "rep_unit_1",
      abilityId: "build_cover",
      targetPosition: { x: 2, y: 2 },
    });
    const engineer = result.battle.armies[0].units[0];

    expect(result.events).toContainEqual({
      type: "AbilityUsed",
      unitId: "rep_unit_1",
      abilityId: "build_cover",
    });
    expect(result.battle.board.objects).toContainEqual(
      expect.objectContaining({
        type: "LightFortification",
        position: { x: 2, y: 2 },
      }),
    );
    expect(engineer.abilityCooldowns?.build_cover).toBe(3);
    expect(engineer.status).toBe("Activated");
    expect(result.battle.activeActivation).toBeUndefined();
  });

  it("rejects an active ability while it is cooling down", () => {
    const battle = createBattle();
    battle.armies[0].units[0] = {
      ...battle.armies[0].units[0],
      templateId: "clone_engineers_332nd",
      abilityCooldowns: { build_cover: 2 },
    };
    battle.activeActivation = {
      id: "rep-token",
      armyId: "army_republic",
      faction: "Republic",
      used: true,
    };

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: "rep_unit_1",
      abilityId: "build_cover",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.battle).toBe(battle);
    expect(result.log).toContain("2 rund");
  });
});
