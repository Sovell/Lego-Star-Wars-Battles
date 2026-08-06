import { describe, expect, it } from "vitest";
import type { BattleAction } from "../battle-actions";
import { applyBattleAction } from "../battle-actions";
import { createBattle } from "../battle-state";
import { survivalTestScenario } from "../scenario/scenarios";
import { getLegalUnitActions } from "./get-legal-unit-actions";

const deterministicRoll = () => 6;

function createReadyBattle() {
  const battle = createBattle();
  const source = battle.armies[0].units[0];
  const enemy = battle.armies[1].units[0];
  source.templateId = "yoda";
  source.position = { x: 2, y: 2 };
  source.status = "Ready";
  enemy.position = { x: 3, y: 2 };
  battle.activeActivation = {
    id: "legal-unit-test-activation",
    armyId: source.armyId,
    faction: battle.armies[0].faction,
    used: false,
  };
  return battle;
}

describe("getLegalUnitActions", () => {
  it("combines position, attack and ability actions", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];
    const actions = getLegalUnitActions(battle, survivalTestScenario, source.id);
    const actionTypes = new Set(actions.map((action) => action.type));

    expect(actionTypes).toEqual(new Set([
      "MoveUnit",
      "AdvanceUnit",
      "Attack",
      "UseAbility",
      "ApplyOrder",
    ]));
  });

  it("does not duplicate deployment actions for a reserve unit", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];
    source.position = null;
    const actions = getLegalUnitActions(battle, survivalTestScenario, source.id);
    const deployments = actions.filter((action) => action.type === "DeployUnit");
    const positions = new Set(
      deployments.map((action) =>
        `${action.targetPosition.x},${action.targetPosition.y}`
      ),
    );

    expect(deployments.length).toBeGreaterThan(0);
    expect(deployments).toHaveLength(positions.size);
    expect(new Set(actions.map((action) => action.type))).toEqual(new Set([
      "DeployUnit",
      "ApplyOrder",
    ]));
  });

  it("returns only actions accepted by the battle engine", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];
    const actions = getLegalUnitActions(battle, survivalTestScenario, source.id);

    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      const result = applyBattleAction(battle, action as BattleAction, {
        scenario: survivalTestScenario,
        rollD6: deterministicRoll,
      });
      expect(result.battle, JSON.stringify(action)).not.toBe(battle);
    }
  });

  it("returns no actions when the active token blocks the unit", () => {
    const battle = createReadyBattle();
    const blockedUnit = battle.armies[1].units[0];

    expect(getLegalUnitActions(
      battle,
      survivalTestScenario,
      blockedUnit.id,
    )).toEqual([]);
  });

  it("returns only Rally for a pinned unit", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];
    source.status = "Pinned";
    source.suppression = 3;

    expect(getLegalUnitActions(
      battle,
      survivalTestScenario,
      source.id,
    )).toEqual([{
      type: "ApplyOrder",
      unitId: source.id,
      order: "Rally",
    }]);
  });
});
