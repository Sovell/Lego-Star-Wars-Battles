import { describe, expect, it } from "vitest";
import { applyBattleAction } from "./battle-actions";
import { createBattle } from "./battle-state";
import { createBattlefieldObject } from "./battlefield-objects";
import { createSeededRandomSource, createSequenceDiceRoller } from "./random";
import { getDefenseBonus } from "./rules/terrain";
import { survivalTestScenario } from "./scenario/scenarios";
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

  it("does not draw another token before the current activation is resolved", () => {
    const battle = applyBattleAction(
      createBattle(),
      { type: "DrawActivation" },
      { randomSource: createSeededRandomSource(42) },
    ).battle;

    const result = applyBattleAction(
      battle,
      { type: "DrawActivation" },
      { randomSource: createSeededRandomSource(7) },
    );

    expect(result.battle).toBe(battle);
    expect(result.events).toEqual([]);
    expect(result.log).toContain("aktualnie wylosowany token");
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

  it("rejects Move for a unit that is still in reserve", () => {
    const battle = readyBattle({
      attacker: { id: "rep_unit_1", position: null },
      defender: { id: "sep_unit_1", position: { x: 6, y: 2 } },
    });

    const result = applyBattleAction(battle, {
      type: "MoveUnit",
      unitId: "rep_unit_1",
      targetPosition: { x: 0, y: 4 },
    });

    expect(result.battle).toBe(battle);
    expect(result.events).toEqual([]);
    expect(result.log).toContain("rezerwie");
  });

  it("deploys a reserve unit only inside its scenario entry zone", () => {
    const battle = readyBattle({
      attacker: { id: "rep_unit_1", position: null },
      defender: { id: "sep_unit_1", position: { x: 6, y: 2 } },
    });

    const result = applyBattleAction(
      battle,
      {
        type: "DeployUnit",
        unitId: "rep_unit_1",
        targetPosition: { x: 1, y: 4 },
      },
      { scenario: survivalTestScenario },
    );

    expect(findUnit(result.battle, "rep_unit_1")).toMatchObject({
      position: { x: 1, y: 4 },
      status: "Activated",
      movedThisTurn: true,
    });
    expect(result.battle.activeActivation).toBeUndefined();
    expect(result.events).toEqual([
      {
        type: "UnitDeployed",
        unitId: "rep_unit_1",
        position: { x: 1, y: 4 },
      },
    ]);
  });

  it("rejects reserve deployment outside the army entry zone", () => {
    const battle = readyBattle({
      attacker: { id: "rep_unit_1", position: null },
      defender: { id: "sep_unit_1", position: { x: 6, y: 2 } },
    });

    const result = applyBattleAction(
      battle,
      {
        type: "DeployUnit",
        unitId: "rep_unit_1",
        targetPosition: { x: 5, y: 4 },
      },
      { scenario: survivalTestScenario },
    );

    expect(result.battle).toBe(battle);
    expect(result.events).toEqual([]);
    expect(result.log).toContain("nie jest legalnym polem wejścia");
  });

  it("keeps an Advance activation open for one attack", () => {
    const battle = readyBattle({
      attacker: { id: "rep_unit_1", position: { x: 1, y: 2 } },
      defender: { id: "sep_unit_1", position: { x: 3, y: 2 } },
    });

    const advance = applyBattleAction(battle, {
      type: "AdvanceUnit",
      unitId: "rep_unit_1",
      targetPosition: { x: 2, y: 1 },
    });

    expect(advance.battle.activeActivation?.armyId).toBe("army_republic");
    expect(findUnit(advance.battle, "rep_unit_1")).toMatchObject({
      position: { x: 2, y: 1 },
      status: "Ready",
      movedThisTurn: true,
      activeEffects: ["advance_pending"],
    });

    const attack = applyBattleAction(
      advance.battle,
      {
        type: "Attack",
        attackerId: "rep_unit_1",
        defenderId: "sep_unit_1",
        weaponId: "dc_15_blaster_rifles",
      },
      { rollD6: createSequenceDiceRoller([4, 4, 1, 1, 1]) },
    );

    expect(attack.attackResult).toBeDefined();
    expect(attack.battle.activeActivation).toBeUndefined();
    expect(findUnit(attack.battle, "rep_unit_1")?.status).toBe("Activated");
    expect(findUnit(attack.battle, "rep_unit_1")?.activeEffects).not.toContain(
      "advance_pending",
    );
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
    const battle = patchUnit(activateAllLivingUnits(createBattle()), "rep_unit_1", {
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

  it("rejects ending a turn while any living unit still awaits its order", () => {
    const battle = patchUnit(createBattle(), "rep_unit_1", { status: "Activated" });

    const result = applyBattleAction(battle, { type: "EndTurn" });

    expect(result.battle).toBe(battle);
    expect(result.events).toEqual([]);
    expect(result.log).toContain("5 jednostek nadal czeka na rozkaz");
  });

  it("allows a turn to end when every surviving unit activated", () => {
    let battle = activateAllLivingUnits(createBattle());
    battle = patchUnit(battle, "sep_unit_3", {
      currentHp: 0,
      position: null,
      status: "Destroyed",
    });

    const result = applyBattleAction(battle, { type: "EndTurn" });

    expect(result.battle.turn).toBe(2);
    expect(result.events).toEqual([{ type: "TurnEnded", turn: 2 }]);
    expect(result.battle.activationBag).toHaveLength(5);
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

  it("damages and destroys a battlefield object instead of a unit", () => {
    let battle = readyBattle({
      attacker: { id: "rep_unit_1", position: { x: 1, y: 2 } },
      defender: { id: "sep_unit_1", position: { x: 6, y: 2 } },
    });
    battle = {
      ...battle,
      board: {
        ...battle.board,
        objects: [
          {
            ...createBattlefieldObject("LightFortification", { x: 2, y: 2 }),
            currentHp: 1,
          },
        ],
      },
    };
    const target = battle.board.objects![0];

    const result = applyBattleAction(
      battle,
      {
        type: "AttackObject",
        attackerId: "rep_unit_1",
        objectId: target.id,
        weaponId: "dc_15_blaster_rifles",
      },
      { rollD6: createSequenceDiceRoller([6, 6, 6, 1, 1, 1]) },
    );

    expect(result.objectAttackResult).toMatchObject({ damage: 3, destroyed: true });
    expect(result.battle.board.objects?.[0]).toMatchObject({
      currentHp: 0,
      status: "Destroyed",
    });
    expect(result.events.map((event) => event.type)).toEqual([
      "BattlefieldObjectDamaged",
      "BattlefieldObjectDestroyed",
    ]);
  });

  it("grants cover only while a fortification remains active", () => {
    const battle = createBattle();
    const defender = findUnit(battle, "rep_unit_1")!;
    const fortification = createBattlefieldObject("HeavyFortification", defender.position!);
    battle.board.objects = [fortification];

    expect(getDefenseBonus(battle, defender)).toBe(2);
    fortification.status = "Destroyed";
    fortification.currentHp = 0;
    expect(getDefenseBonus(battle, defender)).toBe(0);
  });
});

function readyBattle(options: {
  attacker: { id: string; position: UnitInstance["position"] };
  defender: { id: string; position: UnitInstance["position"] };
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

function activateAllLivingUnits(battle: Battle): Battle {
  return {
    ...battle,
    activeActivation: undefined,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) =>
        unit.status === "Destroyed" ? unit : { ...unit, status: "Activated" },
      ),
    })),
  };
}

function findUnit(battle: Battle, unitId: string): UnitInstance | undefined {
  return battle.armies.flatMap((army) => army.units).find((unit) => unit.id === unitId);
}
