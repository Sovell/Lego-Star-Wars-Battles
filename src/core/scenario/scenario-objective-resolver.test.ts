import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { createBattlefieldObject } from "../battlefield-objects";
import { createBattle } from "../battle-state";
import {
  christophsisBreakLineScenario,
  feluciaAmbushScenario,
  geonosisDroidFoundryScenario,
  rescueR2D2Scenario,
} from "./scenarios";
import { resolveScenarioObjective } from "./scenario-objective-resolver";

describe("scenario objective resolver", () => {
  it("selects the nearest active object that the attacking team must destroy", () => {
    let battle = createBattle();
    const nearGenerator = createBattlefieldObject("Generator", { x: 2, y: 2 });
    const farGenerator = createBattlefieldObject("Generator", { x: 6, y: 2 });
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 1, y: 2 } });
    battle = {
      ...battle,
      board: { ...battle.board, objects: [farGenerator, nearGenerator] },
    };

    const target = resolveScenarioObjective({
      battle,
      scenario: geonosisDroidFoundryScenario,
      armyId: "army_republic",
      units: [findUnit(battle, "rep_unit_1")],
    });

    expect(target?.object?.id).toBe(nearGenerator.id);
    expect(target?.canAttackObject).toBe(true);
  });

  it("uses the same ordered objective stage as progressive mission scoring", () => {
    const objectives = [2, 4, 6].map((x) =>
      createBattlefieldObject("StrategicPoint", { x, y: 3 })
    );
    let battle = createBattle();
    battle = {
      ...battle,
      board: { ...battle.board, objects: objectives },
    };

    const target = resolveScenarioObjective({
      battle,
      scenario: christophsisBreakLineScenario,
      mission: {
        scenarioId: christophsisBreakLineScenario.id,
        status: "Active",
        roundsCompleted: 0,
        objectiveStage: 1,
      },
      armyId: "army_republic",
      units: [findUnit(battle, "rep_unit_1")],
    });

    expect(target?.position).toEqual({ x: 4, y: 3 });
    expect(target?.object?.id).toBe(objectives[1].id);
    expect(target?.canAttackObject).toBe(false);
  });

  it("guides only the extracting team toward its nearest extraction cell", () => {
    let battle = createBattle();
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 1, y: 4 } });
    const republicUnit = findUnit(battle, "rep_unit_1");

    const extractionTarget = resolveScenarioObjective({
      battle,
      scenario: feluciaAmbushScenario,
      armyId: "army_republic",
      units: [republicUnit],
    });
    const enemyTarget = resolveScenarioObjective({
      battle,
      scenario: feluciaAmbushScenario,
      armyId: "army_separatists",
      units: [findUnit(battle, "sep_unit_1")],
    });

    expect(extractionTarget).toMatchObject({
      kind: "Zone",
      name: "strefa ewakuacji",
      position: { x: 7 },
    });
    expect(enemyTarget).toBeUndefined();
  });

  it("guides the rescue team from R2-D2 to the extraction airlock in order", () => {
    const objectives = [2, 6].map((x) =>
      createBattlefieldObject("StrategicPoint", { x, y: 3 })
    );
    const battle = {
      ...createBattle(),
      board: { ...createBattle().board, objects: objectives },
    };

    const target = resolveScenarioObjective({
      battle,
      scenario: rescueR2D2Scenario,
      mission: {
        scenarioId: rescueR2D2Scenario.id,
        status: "Active",
        roundsCompleted: 1,
        objectiveStage: 1,
      },
      armyId: "army_republic",
      units: [findUnit(battle, "rep_unit_1")],
    });

    expect(target?.position).toEqual({ x: 6, y: 3 });
    expect(target?.object?.id).toBe(objectives[1].id);
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
      units: army.units.map((unit) => unit.id === unitId ? { ...unit, ...patch } : unit),
    })),
  };
}

function findUnit(battle: Battle, unitId: string): UnitInstance {
  const unit = battle.armies.flatMap((army) => army.units).find(
    (candidate) => candidate.id === unitId,
  );
  if (!unit) throw new Error(`Missing test unit ${unitId}.`);
  return unit;
}
