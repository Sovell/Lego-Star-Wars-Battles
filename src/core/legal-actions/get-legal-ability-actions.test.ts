import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { createBattle } from "../battle-state";
import { getLegalAbilityActions } from "./get-legal-ability-actions";

function withActiveUnit(templateId: string, armyIndex = 0): Battle {
  const battle = createBattle();
  const source = battle.armies[armyIndex].units[0];
  source.templateId = templateId;
  source.position = { x: armyIndex === 0 ? 2 : 4, y: 2 };
  source.status = "Ready";
  battle.activeActivation = {
    id: "legal-ability-test-activation",
    armyId: source.armyId,
    faction: battle.armies[armyIndex].faction,
    used: false,
  };
  return battle;
}

describe("getLegalAbilityActions", () => {
  it("generates legal position targets for Build Cover", () => {
    const battle = withActiveUnit("clone_engineers_332nd");
    const source = battle.armies[0].units[0];
    const actions = getLegalAbilityActions(battle, source.id, "build_cover");

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((action) => action.targetPosition)).toBe(true);
    expect(actions.every((action) => !action.targetUnitId)).toBe(true);
    expect(actions.some((action) =>
      action.targetPosition?.x === 7 && action.targetPosition.y === 7
    )).toBe(false);
  });

  it("generates legal enemy targets for Force Push", () => {
    let battle = withActiveUnit("yoda");
    const source = battle.armies[0].units[0];
    const enemy = battle.armies[1].units[0];
    battle = patchUnit(battle, enemy.id, { position: { x: 3, y: 2 } });
    const actions = getLegalAbilityActions(battle, source.id, "force_push");

    expect(actions).toContainEqual({
      type: "UseAbility",
      unitId: source.id,
      abilityId: "force_push",
      targetUnitId: enemy.id,
    });
    expect(actions.some((action) => action.targetUnitId === source.id)).toBe(false);
  });

  it("supports abilities without a target", () => {
    const battle = withActiveUnit("obi_wan_kenobi");
    const source = battle.armies[0].units[0];

    expect(getLegalAbilityActions(battle, source.id, "defensive_stance")).toEqual([{
      type: "UseAbility",
      unitId: source.id,
      abilityId: "defensive_stance",
    }]);
  });

  it("generates combined unit and position targets for Shadow Strike", () => {
    let battle = withActiveUnit("asajj_ventress", 1);
    const source = battle.armies[1].units[0];
    const enemy = battle.armies[0].units[0];
    battle = patchUnit(battle, enemy.id, { position: { x: 3, y: 2 } });
    const actions = getLegalAbilityActions(battle, source.id, "shadow_strike");

    expect(actions.some((action) =>
      action.targetUnitId === enemy.id && Boolean(action.targetPosition)
    )).toBe(true);
    expect(actions.every((action) => action.targetUnitId && action.targetPosition)).toBe(true);
  });

  it("returns no actions when the ability is cooling down", () => {
    let battle = withActiveUnit("clone_engineers_332nd");
    const source = battle.armies[0].units[0];
    battle = patchUnit(battle, source.id, { abilityCooldowns: { build_cover: 2 } });

    expect(getLegalAbilityActions(battle, source.id, "build_cover")).toEqual([]);
  });
});

function patchUnit(
  battle: Battle,
  unitId: string,
  patch: Partial<UnitInstance>,
): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) =>
        unit.id === unitId ? { ...unit, ...patch } : unit
      ),
    })),
  };
}
