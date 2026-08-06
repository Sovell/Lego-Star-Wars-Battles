import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { createBattlefieldObject } from "../battlefield-objects";
import { createBattle } from "../battle-state";
import {
  defendPointScenario,
  protectGeneratorScenario,
  survivalTestScenario,
} from "../scenario/scenarios";
import { chooseAttackerBotAction } from "./attacker-bot";

const attackerArmyId = "army_separatists";

describe("attacker bot", () => {
  it("attacks a destructible scenario objective before enemy units", () => {
    let battle = readyAttackerBattle();
    battle = patchUnit(battle, "sep_unit_1", { position: { x: 4, y: 2 } });
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 4, y: 3 } });
    battle = {
      ...battle,
      board: {
        ...battle.board,
        objects: [createBattlefieldObject("Generator", { x: 3, y: 2 })],
      },
    };

    const decision = chooseAttackerBotAction(
      battle,
      protectGeneratorScenario,
      attackerArmyId,
    );

    expect(decision?.action).toMatchObject({
      type: "AttackObject",
      attackerId: "sep_unit_1",
      objectId: battle.board.objects?.[0].id,
    });
    expect(decision?.reason).toContain("cel scenariusza");
  });

  it("prefers an enemy unit that can be eliminated", () => {
    let battle = readyAttackerBattle();
    battle = patchUnit(battle, "sep_unit_1", { position: { x: 3, y: 2 } });
    battle = patchUnit(battle, "rep_unit_1", {
      currentHp: 1,
      position: { x: 2, y: 2 },
    });
    battle = patchUnit(battle, "rep_unit_2", {
      currentHp: 5,
      position: { x: 3, y: 3 },
    });

    const decision = chooseAttackerBotAction(
      battle,
      survivalTestScenario,
      attackerArmyId,
    );

    expect(decision?.action).toMatchObject({
      type: "Attack",
      attackerId: "sep_unit_1",
      defenderId: "rep_unit_1",
    });
    expect(decision?.reason).toContain("wyeliminowac");
  });

  it("chooses an offensive ability from the shared legal action API", () => {
    let battle = readyAttackerBattle();
    battle = patchUnit(battle, "sep_unit_1", {
      templateId: "darth_maul",
      position: { x: 3, y: 2 },
    });
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 2, y: 2 } });

    const decision = chooseAttackerBotAction(
      battle,
      survivalTestScenario,
      attackerArmyId,
    );

    expect(decision?.action).toMatchObject({
      type: "UseAbility",
      unitId: "sep_unit_1",
      abilityId: "saber_throw",
      targetUnitId: "rep_unit_1",
    });
  });

  it("moves closer to the scenario objective when it cannot attack", () => {
    let battle = readyAttackerBattle();
    battle = patchUnit(battle, "sep_unit_1", { position: { x: 7, y: 4 } });
    battle = {
      ...battle,
      board: {
        ...battle.board,
        objects: [createBattlefieldObject("DefensePoint", { x: 0, y: 0 })],
      },
    };

    const decision = chooseAttackerBotAction(
      battle,
      defendPointScenario,
      attackerArmyId,
    );

    expect(decision?.action.type).toBe("AdvanceUnit");
    if (decision?.action.type !== "AdvanceUnit") {
      throw new Error("Expected a movement decision.");
    }

    expect(decision.action.unitId).toBe("sep_unit_1");
    expect(Math.max(decision.action.targetPosition.x, decision.action.targetPosition.y)).toBeLessThan(7);
    expect(decision.reason).toContain("celu scenariusza");
  });

  it("deploys a reserve only through the attacking army entry zone", () => {
    let battle = readyAttackerBattle();
    battle = patchUnit(battle, "sep_unit_1", { position: null });

    const decision = chooseAttackerBotAction(
      battle,
      survivalTestScenario,
      attackerArmyId,
    );

    expect(decision?.action.type).toBe("DeployUnit");
    if (decision?.action.type !== "DeployUnit") {
      throw new Error("Expected a reserve deployment decision.");
    }

    expect(decision.action.unitId).toBe("sep_unit_1");
    expect(decision.action.targetPosition.x).toBeGreaterThanOrEqual(6);
    expect(decision.reason).toContain("rezerwy");
  });

  it("does nothing when the active token belongs to another army", () => {
    const battle = {
      ...readyAttackerBattle(),
      activeActivation: {
        id: "republic-token",
        armyId: "army_republic",
        faction: "Republic",
        used: true,
      },
    };

    expect(
      chooseAttackerBotAction(battle, survivalTestScenario, attackerArmyId),
    ).toBeUndefined();
  });
});

function readyAttackerBattle(): Battle {
  const battle = createBattle();

  return {
    ...battle,
    activeActivation: {
      id: "attacker-token",
      armyId: attackerArmyId,
      faction: "Separatists",
      used: true,
    },
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit, index) => ({
        ...unit,
        status:
          army.id === attackerArmyId && index === 0
            ? "Ready"
            : army.id === attackerArmyId
              ? "Activated"
              : unit.status,
      })),
    })),
  };
}

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
        unit.id === unitId ? { ...unit, ...patch } : unit,
      ),
    })),
  };
}
