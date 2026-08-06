import { describe, expect, it } from "vitest";
import { createBattlefieldObject } from "../battlefield-objects";
import { createBattle } from "../battle-state";
import { getLegalAttackActions } from "./get-legal-attack-actions";

function createReadyBattle() {
  const battle = createBattle();
  const attacker = battle.armies[0].units[0];
  const closeEnemy = battle.armies[1].units[0];
  const distantEnemy = battle.armies[1].units[1];
  attacker.position = { x: 2, y: 2 };
  attacker.status = "Ready";
  closeEnemy.position = { x: 3, y: 2 };
  distantEnemy.position = { x: 7, y: 7 };
  battle.activeActivation = {
    id: "legal-attack-test-activation",
    armyId: attacker.armyId,
    faction: battle.armies[0].faction,
    used: false,
  };
  return battle;
}

describe("getLegalAttackActions", () => {
  it("returns enemy unit attacks accepted by the combat engine", () => {
    const battle = createReadyBattle();
    const attacker = battle.armies[0].units[0];
    const closeEnemy = battle.armies[1].units[0];
    const distantEnemy = battle.armies[1].units[1];
    const actions = getLegalAttackActions(battle, attacker.id);

    expect(actions.some((action) =>
      action.type === "Attack" && action.defenderId === closeEnemy.id
    )).toBe(true);
    expect(actions.some((action) =>
      action.type === "Attack" && action.defenderId === distantEnemy.id
    )).toBe(false);
    expect(actions.some((action) =>
      action.type === "Attack" && action.defenderId === attacker.id
    )).toBe(false);
  });

  it("includes destructible objects in range and excludes invalid objects", () => {
    const battle = createReadyBattle();
    const attacker = battle.armies[0].units[0];
    const generator = createBattlefieldObject("Generator", { x: 3, y: 2 });
    const strategicPoint = createBattlefieldObject("StrategicPoint", { x: 2, y: 3 });
    battle.board.objects = [generator, strategicPoint];
    const actions = getLegalAttackActions(battle, attacker.id);

    expect(actions.some((action) =>
      action.type === "AttackObject" && action.objectId === generator.id
    )).toBe(true);
    expect(actions.some((action) =>
      action.type === "AttackObject" && action.objectId === strategicPoint.id
    )).toBe(false);
  });

  it("returns no attacks when the active token blocks the attacker", () => {
    const battle = createReadyBattle();
    const attacker = battle.armies[1].units[0];

    expect(getLegalAttackActions(battle, attacker.id)).toEqual([]);
  });

  it("does not expose units from an allied army as legal targets", () => {
    const battle = createReadyBattle();
    battle.armies[1].teamId = battle.armies[0].teamId;
    const attacker = battle.armies[0].units[0];

    expect(getLegalAttackActions(battle, attacker.id).some(
      (action) => action.type === "Attack",
    )).toBe(false);
  });
});
