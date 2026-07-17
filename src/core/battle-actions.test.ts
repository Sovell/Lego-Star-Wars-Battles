import { describe, expect, it } from "vitest";
import { applyBattleAction } from "./battle-actions";
import { createBattle } from "./battle-state";
import { createSeededRandomSource, createSequenceDiceRoller } from "./random";
import type { Battle, UnitInstance } from "../types";

describe("applyBattleAction", () => {
  it("draws activations deterministically through the action context", () => {
    const firstResult = applyBattleAction(
      createBattle(),
      { type: "DrawActivation" },
      { randomSource: createSeededRandomSource(42) },
    );
    const repeatedResult = applyBattleAction(
      createBattle(),
      { type: "DrawActivation" },
      { randomSource: createSeededRandomSource(42) },
    );

    expect(firstResult.battle.activeActivation?.id).toBe(repeatedResult.battle.activeActivation?.id);
    expect(firstResult.events).toEqual([
      { type: "ActivationDrawn", armyId: firstResult.battle.activeActivation?.armyId },
    ]);
    expect(
      firstResult.battle.activationBag.find(
        (token) => token.id === firstResult.battle.activeActivation?.id,
      )?.used,
    ).toBe(true);
  });

  it("moves an activated unit and emits a movement event", () => {
    const battle = readyBattle({
      attacker: { id: "rep_unit_1", position: { x: 1, y: 2 } },
      defender: { id: "sep_unit_1", position: { x: 6, y: 2 } },
    });

    const result = applyBattleAction(battle, {
      type: "MoveUnit",
      unitId: "rep_unit_1",
      targetPosition: { x: 2, y: 1 },
    });

    expect(findUnit(result.battle, "rep_unit_1")).toMatchObject({
      position: { x: 2, y: 1 },
      status: "Activated",
      movedThisTurn: true,
    });
    expect(result.battle.activeActivation).toBeUndefined();
    expect(result.events).toEqual([
      { type: "UnitMoved", unitId: "rep_unit_1", position: { x: 2, y: 1 } },
    ]);
  });

  it("resolves combat with deterministic hit and armor rolls", () => {
    const battle = readyBattle({
      attacker: { id: "rep_unit_1", position: { x: 1, y: 2 } },
      defender: { id: "sep_unit_1", position: { x: 2, y: 2 } },
    });

    const result = applyBattleAction(
      battle,
      {
        type: "Attack",
        attackerId: "rep_unit_1",
        defenderId: "sep_unit_1",
        weaponId: "dc_15_blaster_rifles",
      },
      { rollD6: createSequenceDiceRoller([3, 4, 2, 1, 6]) },
    );

    expect(result.attackResult).toMatchObject({
      hitRolls: [3, 4, 2],
      armorRolls: [1, 6],
      hits: 2,
      unsavedHits: 1,
      damage: 1,
      suppression: 1,
      destroyed: false,
    });
    expect(findUnit(result.battle, "sep_unit_1")).toMatchObject({
      currentHp: 2,
      suppression: 1,
      status: "Ready",
    });
    expect(findUnit(result.battle, "rep_unit_1")?.status).toBe("Activated");
    expect(result.events).toEqual([{ type: "AttackResolved", result: result.attackResult }]);
  });

  it("emits destruction events when deterministic damage removes the defender", () => {
    const battle = readyBattle({
      attacker: { id: "rep_unit_1", position: { x: 1, y: 2 } },
      defender: { id: "sep_unit_1", position: { x: 2, y: 2 } },
    });

    const result = applyBattleAction(
      battle,
      {
        type: "Attack",
        attackerId: "rep_unit_1",
        defenderId: "sep_unit_1",
        weaponId: "dc_15_blaster_rifles",
      },
      { rollD6: createSequenceDiceRoller([6, 6, 6, 1, 1, 1]) },
    );

    expect(result.attackResult).toMatchObject({
      hits: 3,
      unsavedHits: 3,
      damage: 3,
      destroyed: true,
    });
    expect(findUnit(result.battle, "sep_unit_1")).toMatchObject({
      currentHp: 0,
      position: null,
      status: "Destroyed",
    });
    expect(result.events.map((event) => event.type)).toEqual(["AttackResolved", "UnitDestroyed"]);
  });

  it("resets surviving units and rebuilds the activation bag at the end of a turn", () => {
    const battle = patchUnit(createBattle(), "rep_unit_1", {
      status: "Activated",
      suppression: 2,
      movedThisTurn: true,
    });

    const result = applyBattleAction(battle, { type: "EndTurn" });

    expect(result.battle.turn).toBe(2);
    expect(result.battle.activeActivation).toBeUndefined();
    expect(findUnit(result.battle, "rep_unit_1")).toMatchObject({
      status: "Ready",
      suppression: 1,
      movedThisTurn: false,
    });
    expect(result.battle.activationBag).toHaveLength(6);
    expect(result.battle.activationBag.every((token) => !token.used)).toBe(true);
    expect(result.events).toEqual([{ type: "TurnEnded", turn: 2 }]);
  });

  it("emits battle completion when the last enemy unit is destroyed", () => {
    let battle = readyBattle({
      attacker: { id: "rep_unit_1", position: { x: 1, y: 2 } },
      defender: { id: "sep_unit_1", position: { x: 2, y: 2 } },
    });
    battle = patchUnit(battle, "sep_unit_1", { currentHp: 1 });
    battle = patchUnit(battle, "sep_unit_2", { currentHp: 0, position: null, status: "Destroyed" });
    battle = patchUnit(battle, "sep_unit_3", { currentHp: 0, position: null, status: "Destroyed" });

    const result = applyBattleAction(
      battle,
      {
        type: "Attack",
        attackerId: "rep_unit_1",
        defenderId: "sep_unit_1",
        weaponId: "dc_15_blaster_rifles",
      },
      { rollD6: createSequenceDiceRoller([6, 1, 1, 1]) },
    );

    expect(result.battle.phase).toBe("Finished");
    expect(result.events.map((event) => event.type)).toEqual([
      "AttackResolved",
      "UnitDestroyed",
      "ArmyEliminated",
      "BattleFinished",
    ]);
    expect(result.events.at(-1)).toEqual({
      type: "BattleFinished",
      winnerArmyId: "army_republic",
    });
  });
});

function readyBattle(options: {
  attacker: { id: string; position: { x: number; y: number } };
  defender: { id: string; position: { x: number; y: number } };
}): Battle {
  const battle = createBattle();

  return {
    ...patchUnit(
      patchUnit(battle, options.attacker.id, { position: options.attacker.position }),
      options.defender.id,
      { position: options.defender.position },
    ),
    activeActivation: {
      id: "test_republic_activation",
      armyId: "army_republic",
      faction: "Republic",
      used: false,
    },
  };
}

function patchUnit(battle: Battle, unitId: string, patch: Partial<UnitInstance>): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => (unit.id === unitId ? { ...unit, ...patch } : unit)),
    })),
  };
}

function findUnit(battle: Battle, unitId: string): UnitInstance | undefined {
  return battle.armies.flatMap((army) => army.units).find((unit) => unit.id === unitId);
}
