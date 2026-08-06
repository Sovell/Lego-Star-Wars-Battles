import { describe, expect, it } from "vitest";
import { createBattle, getTemplate } from "../core/battle-state";
import { survivalTestScenario } from "../core/scenario/scenarios";
import { abilities, starterArmies } from "../data";
import { createBoardInteractionModel, getBoardCellInteraction } from "./board-interaction-model";

function createReadyBattle() {
  const battle = createBattle(starterArmies);
  const republic = battle.armies[0];
  const separatists = battle.armies[1];
  republic.units.forEach((unit, index) => {
    unit.position = { x: 1, y: index + 1 };
    unit.status = "Ready";
  });
  separatists.units.forEach((unit, index) => {
    unit.position = { x: 5, y: index + 1 };
    unit.status = "Ready";
  });
  battle.activeActivation = {
    id: "interaction-test-activation",
    armyId: republic.id,
    faction: republic.faction,
    used: false,
  };
  return battle;
}

function baseInput(battle: ReturnType<typeof createReadyBattle>) {
  const selectedUnit = battle.armies[0].units[0];
  return {
    battle,
    scenario: survivalTestScenario,
    interactionDisabled: false,
    missionActive: true,
    selectedUnitId: selectedUnit.id,
    selectedOrder: "Move" as const,
    selectedWeaponId: getTemplate(selectedUnit).weapons[0].id,
    selectingMovePosition: true,
    selectingAbilityPosition: false,
  };
}

describe("board interaction model", () => {
  it("marks only engine-approved movement cells as legal", () => {
    const battle = createReadyBattle();
    const model = createBoardInteractionModel(baseInput(battle));

    expect(model.mode).toBe("movement");
    expect(getBoardCellInteraction(model, 2, 1)).toBe("legal");
    expect(getBoardCellInteraction(model, 7, 7)).toBe("invalid");
    expect(getBoardCellInteraction(model, 1, 2)).toBe("invalid");
  });

  it("distinguishes reserve entry cells from forbidden deployment cells", () => {
    const battle = createReadyBattle();
    battle.armies[0].units[0].position = null;
    const model = createBoardInteractionModel(baseInput(battle));

    expect(model.mode).toBe("reserve");
    expect(getBoardCellInteraction(model, 0, 0)).toBe("reserve");
    expect(getBoardCellInteraction(model, 6, 0)).toBe("invalid");
  });

  it("does not advertise reserve cells for a unit blocked by the active token", () => {
    const battle = createReadyBattle();
    const separatistReserve = battle.armies[1].units[0];
    separatistReserve.position = null;
    const model = createBoardInteractionModel({
      ...baseInput(battle),
      selectedUnitId: separatistReserve.id,
    });

    expect(model.mode).toBe("reserve");
    expect(model.hint).toContain("token");
    expect(model.reserveEntryCells.size).toBe(0);
    expect(getBoardCellInteraction(model, 6, 0)).toBe("invalid");
  });

  it("marks only enemy units in range as attack targets", () => {
    const battle = createReadyBattle();
    battle.armies[1].units[0].position = { x: 2, y: 1 };
    battle.armies[1].units[1].position = { x: 7, y: 7 };
    const model = createBoardInteractionModel({
      ...baseInput(battle),
      selectedOrder: "Attack",
      selectingMovePosition: false,
    });

    expect(model.mode).toBe("attack");
    expect(getBoardCellInteraction(model, 2, 1)).toBe("target");
    expect(getBoardCellInteraction(model, 7, 7)).toBe("default");
  });

  it("uses legal ability actions to mark position targets", () => {
    const battle = createReadyBattle();
    const engineer = battle.armies[0].units[0];
    engineer.templateId = "clone_engineers_332nd";
    const buildCover = abilities.find((ability) => ability.id === "build_cover");
    const model = createBoardInteractionModel({
      ...baseInput(battle),
      selectingMovePosition: false,
      selectingAbilityPosition: true,
      selectedAbility: buildCover,
    });

    expect(model.mode).toBe("ability-position");
    expect(getBoardCellInteraction(model, 2, 1)).toBe("legal");
    expect(getBoardCellInteraction(model, 7, 7)).toBe("invalid");
  });

  it("uses legal ability actions to mark unit targets", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];
    const enemy = battle.armies[1].units[0];
    source.templateId = "yoda";
    enemy.position = { x: 2, y: 1 };
    const forcePush = abilities.find((ability) => ability.id === "force_push");
    const model = createBoardInteractionModel({
      ...baseInput(battle),
      selectingMovePosition: false,
      selectedAbility: forcePush,
    });

    expect(model.mode).toBe("ability-target");
    expect(getBoardCellInteraction(model, 2, 1)).toBe("target");
    expect(getBoardCellInteraction(model, 1, 1)).toBe("default");
  });
});
