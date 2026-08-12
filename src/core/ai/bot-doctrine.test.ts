import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { createBattle } from "../battle-state";
import { getTemplate } from "../rules/state";
import { chooseBestBotAction } from "./bot-action-scoring";
import {
  botDoctrines,
  getBotDoctrine,
  hunterBotDoctrine,
  objectiveBotDoctrine,
  swarmBotDoctrine,
} from "./bot-doctrine";

describe("bot doctrine profiles", () => {
  it("registers all five profiles behind one lookup", () => {
    expect(Object.keys(botDoctrines)).toEqual([
      "aggressive",
      "defensive",
      "objective",
      "swarm",
      "hunter",
    ]);
    expect(getBotDoctrine("objective")).toBe(objectiveBotDoctrine);
    expect(getBotDoctrine("swarm")).toBe(swarmBotDoctrine);
    expect(getBotDoctrine("hunter")).toBe(hunterBotDoctrine);
  });

  it("gives the objective profile the strongest mission progress priorities", () => {
    expect(objectiveBotDoctrine.objectiveAttackBonus)
      .toBeGreaterThan(botDoctrines.aggressive.objectiveAttackBonus);
    expect(objectiveBotDoctrine.movementProgressWeight)
      .toBeGreaterThan(botDoctrines.aggressive.movementProgressWeight);
  });

  it("makes the swarm profile prioritize deploying reserves", () => {
    expect(swarmBotDoctrine.deploymentBaseScore)
      .toBeGreaterThan(botDoctrines.aggressive.deploymentBaseScore);
    expect(swarmBotDoctrine.deploymentBaseScore)
      .toBeGreaterThan(swarmBotDoctrine.attackBaseScore);
  });

  it("lets the hunter profile pursue a more valuable target", () => {
    let battle = createBattle();
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 2, y: 2 } });
    battle = patchUnit(battle, "sep_unit_1", {
      templateId: "b1_droid_squad",
      currentHp: 1,
      position: { x: 3, y: 2 },
    });
    battle = patchUnit(battle, "sep_unit_2", {
      templateId: "general_grievous",
      currentHp: getTemplateById("general_grievous").maxHp,
      position: { x: 2, y: 3 },
    });
    const attacker = battle.armies.flatMap((army) => army.units)
      .find((unit) => unit.id === "rep_unit_1")!;
    const weaponId = getTemplate(attacker).weapons[0].id;
    const actions = [
      { type: "Attack" as const, attackerId: attacker.id, defenderId: "sep_unit_1", weaponId },
      { type: "Attack" as const, attackerId: attacker.id, defenderId: "sep_unit_2", weaponId },
    ];

    expect(chooseBestBotAction(actions, {
      battle,
      doctrine: hunterBotDoctrine,
    })?.action).toMatchObject({ defenderId: "sep_unit_2" });
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

function getTemplateById(templateId: string) {
  const unit: UnitInstance = {
    id: "template-probe",
    templateId,
    armyId: "probe",
    currentHp: 1,
    suppression: 0,
    position: null,
    status: "Ready",
    hidden: false,
  };
  return getTemplate(unit);
}
