import { describe, expect, it } from "vitest";
import { starterArmies } from "../../data";
import { createBattle } from "../battle-state";
import { survivalTestScenario } from "../scenario/scenarios";
import { getLegalPositionActions } from "./get-legal-position-actions";

function createReadyBattle() {
  const battle = createBattle(starterArmies);
  battle.armies.forEach((army, armyIndex) => {
    army.units.forEach((unit, unitIndex) => {
      unit.position = { x: armyIndex === 0 ? 1 : 6, y: unitIndex + 1 };
      unit.status = "Ready";
    });
  });
  battle.activeActivation = {
    id: "legal-actions-test-activation",
    armyId: battle.armies[0].id,
    faction: battle.armies[0].faction,
    used: false,
  };
  return battle;
}

describe("getLegalPositionActions", () => {
  it("returns only movement actions accepted by the engine", () => {
    const battle = createReadyBattle();
    const unit = battle.armies[0].units[0];
    const actions = getLegalPositionActions(
      battle,
      survivalTestScenario,
      unit.id,
      "Move",
    );

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((action) => action.type === "MoveUnit")).toBe(true);
    expect(actions.some((action) =>
      action.targetPosition.x === 6 && action.targetPosition.y === 1
    )).toBe(false);
  });

  it("turns reserve movement into legal deployment actions", () => {
    const battle = createReadyBattle();
    const unit = battle.armies[0].units[0];
    unit.position = null;
    const actions = getLegalPositionActions(
      battle,
      survivalTestScenario,
      unit.id,
      "Move",
    );

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((action) => action.type === "DeployUnit")).toBe(true);
    expect(actions.every((action) => action.targetPosition.x <= 1)).toBe(true);
  });

  it("returns no deployment actions when the active token blocks the unit", () => {
    const battle = createReadyBattle();
    const unit = battle.armies[1].units[0];
    unit.position = null;

    expect(getLegalPositionActions(
      battle,
      survivalTestScenario,
      unit.id,
      "Advance",
    )).toEqual([]);
  });
});
