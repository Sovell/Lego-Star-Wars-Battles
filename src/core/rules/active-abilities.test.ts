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

  it("lets a medic heal a living ally", () => {
    const battle = createBattle();
    battle.armies[0].units[0].templateId = "clone_medic_squad";
    battle.armies[0].units[1].currentHp = 2;
    battle.armies[0].units[1].position = { x: 1, y: 3 };
    battle.activeActivation = { id: "rep-token", armyId: "army_republic", faction: "Republic", used: true };

    const result = applyBattleAction(battle, {
      type: "UseAbility", unitId: "rep_unit_1", abilityId: "field_treatment", targetUnitId: "rep_unit_2",
    });
    expect(result.battle.armies[0].units[1].currentHp).toBe(5);
    expect(result.battle.armies[0].units[0].abilityCooldowns?.field_treatment).toBe(2);
  });

  it("lets the droid commander summon an activated B1 squad", () => {
    const battle = createBattle();
    battle.armies[1].units[0].templateId = "b1_battle_droid_commander_squad";
    battle.activeActivation = { id: "sep-token", armyId: "army_separatists", faction: "Separatists", used: true };

    const result = applyBattleAction(battle, {
      type: "UseAbility", unitId: "sep_unit_1", abilityId: "call_b1_support", targetPosition: { x: 5, y: 2 },
    });
    const summoned = result.battle.armies[1].units.find((unit) =>
      unit.id !== "sep_unit_1" && unit.templateId === "b1_droid_squad"
    );
    expect(summoned).toMatchObject({ position: { x: 5, y: 2 }, status: "Activated" });
  });

  it("rejects Claw Rush after General Grievous has advanced", () => {
    const battle = createBattle();
    const grievous = battle.armies[1].units[0];
    const target = battle.armies[0].units[0];
    grievous.templateId = "general_grievous";
    grievous.position = { x: 4, y: 3 };
    grievous.movedThisTurn = true;
    grievous.activeEffects = ["advance_pending"];
    target.position = { x: 1, y: 2 };
    battle.activeActivation = {
      id: "sep-token",
      armyId: grievous.armyId,
      faction: "Separatists",
      used: true,
    };

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: grievous.id,
      abilityId: "claw_rush",
      targetUnitId: target.id,
    });

    expect(result.battle).toBe(battle);
    expect(result.events).toEqual([]);
    expect(result.log).toContain("nie może zostać użyte po wykonaniu Advance");
  });

  it("lets Grievous build one droid foundry per battle", () => {
    const battle = createBattle();
    const grievous = battle.armies[1].units[0];
    grievous.templateId = "general_grievous";
    grievous.position = { x: 2, y: 2 };
    battle.armies[0].units.forEach((unit, index) => {
      unit.position = { x: 0, y: index };
    });
    battle.armies[1].units.slice(1).forEach((unit, index) => {
      unit.position = { x: 7, y: 6 + index };
    });
    battle.activeActivation = {
      id: "sep-token",
      armyId: grievous.armyId,
      faction: "Separatists",
      used: true,
    };

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: grievous.id,
      abilityId: "droid_foundry",
      targetPosition: { x: 3, y: 3 },
    });
    const foundry = result.battle.board.objects?.find((object) =>
      object.visualId === "droid-foundry"
    );
    expect(foundry).toMatchObject({
      position: { x: 3, y: 3 },
      currentHp: 10,
      armorSave: 4,
      controllerArmyId: grievous.armyId,
      production: {
        templateId: "b1_droid_squad",
        intervalRounds: 2,
        nextProductionTurn: 3,
        remainingSpawns: 3,
      },
    });
    expect(result.battle.armies[1].units[0].usedAbilities).toContain("droid_foundry");

    const nextBattle = result.battle;
    nextBattle.armies[1].units[0].status = "Ready";
    nextBattle.activeActivation = {
      id: "sep-token-2",
      armyId: grievous.armyId,
      faction: "Separatists",
      used: true,
    };
    const repeated = applyBattleAction(nextBattle, {
      type: "UseAbility",
      unitId: grievous.id,
      abilityId: "droid_foundry",
      targetPosition: { x: 4, y: 3 },
    });
    expect(repeated.battle).toBe(nextBattle);
    expect(repeated.log).toContain("już wykorzystane");
  });

  it("rejects a droid foundry next to an enemy", () => {
    const battle = createBattle();
    const grievous = battle.armies[1].units[0];
    grievous.templateId = "general_grievous";
    grievous.position = { x: 2, y: 2 };
    battle.armies[0].units[0].position = { x: 4, y: 3 };
    battle.activeActivation = {
      id: "sep-token",
      armyId: grievous.armyId,
      faction: "Separatists",
      used: true,
    };

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: grievous.id,
      abilityId: "droid_foundry",
      targetPosition: { x: 3, y: 3 },
    });

    expect(result.battle).toBe(battle);
    expect(result.log).toContain("poza bezpośrednim sąsiedztwem przeciwnika");
  });
});
