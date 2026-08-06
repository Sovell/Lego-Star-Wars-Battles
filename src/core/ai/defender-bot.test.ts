import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { createBattlefieldObject } from "../battlefield-objects";
import { createBattle } from "../battle-state";
import { protectGeneratorScenario, survivalTestScenario } from "../scenario/scenarios";
import { chooseDefenderBotAction } from "./defender-bot";

const defenderArmyId = "army_republic";

describe("defender bot", () => {
  it("attacks an enemy threatening the defensive line", () => {
    let battle = readyDefenderBattle();
    battle = patchUnit(battle, "sep_unit_1", { position: { x: 2, y: 2 } });

    const decision = chooseDefenderBotAction(
      battle,
      survivalTestScenario,
      defenderArmyId,
    );

    expect(decision?.action).toMatchObject({
      type: "Attack",
      attackerId: "rep_unit_1",
      defenderId: "sep_unit_1",
    });
    expect(decision?.reason).toContain("odpiera zagrożenie");
  });

  it("moves toward a protected objective without attacking it", () => {
    let battle = readyDefenderBattle();
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 0, y: 0 } });
    battle = {
      ...battle,
      board: {
        ...battle.board,
        objects: [createBattlefieldObject("Generator", { x: 3, y: 2 })],
      },
    };

    const decision = chooseDefenderBotAction(
      battle,
      protectGeneratorScenario,
      defenderArmyId,
    );

    expect(decision?.action.type).toBe("AdvanceUnit");
    expect(decision?.reason).toContain("celu");
  });

  it("never scores the protected object as an attack candidate", () => {
    let battle = readyDefenderBattle();
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 2, y: 2 } });
    battle = {
      ...battle,
      board: {
        ...battle.board,
        objects: [createBattlefieldObject("Generator", { x: 3, y: 2 })],
      },
    };

    const decision = chooseDefenderBotAction(
      battle,
      protectGeneratorScenario,
      defenderArmyId,
    );

    expect(decision?.action.type).not.toBe("AttackObject");
  });

  it("rallies a suppressed unit when there is no immediate threat", () => {
    let battle = readyDefenderBattle();
    battle = patchUnit(battle, "rep_unit_1", { suppression: 2 });

    const decision = chooseDefenderBotAction(
      battle,
      survivalTestScenario,
      defenderArmyId,
    );

    expect(decision?.action).toEqual({
      type: "ApplyOrder",
      unitId: "rep_unit_1",
      order: "Rally",
    });
  });
});

function readyDefenderBattle(): Battle {
  const battle = createBattle();
  return {
    ...battle,
    activeActivation: {
      id: "defender-token",
      armyId: defenderArmyId,
      faction: "Republic",
      used: true,
    },
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit, index) => ({
        ...unit,
        status: army.id === defenderArmyId && index > 0 ? "Activated" : unit.status,
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
        unit.id === unitId ? { ...unit, ...patch } : unit
      ),
    })),
  };
}
