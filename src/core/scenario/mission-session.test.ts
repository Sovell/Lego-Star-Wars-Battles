import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { createBattle } from "../battle-state";
import { createSequenceDiceRoller } from "../random";
import { createMissionState } from "./scenario-engine";
import { applyMissionAction } from "./mission-session";
import { survivalTestScenario } from "./scenarios";

describe("mission session", () => {
  it("finishes the session only when the scenario reaches a terminal state", () => {
    const battle = createBattle();
    const mission = {
      ...createMissionState(survivalTestScenario),
      roundsCompleted: 2,
    };

    const result = applyMissionAction(
      { battle, mission },
      survivalTestScenario,
      { type: "EndTurn" },
    );

    expect(result.mission.status).toBe("Victory");
    expect(result.battle.phase).toBe("Activation");
    expect(result.battle.activeActivation).toBeUndefined();
    expect(result.missionEvents.map((event) => event.type)).toEqual(["MissionCompleted"]);
  });

  it("does not finish a mission when the last enemy unit is destroyed", () => {
    let battle = createBattle();
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 1, y: 2 } });
    battle = patchUnit(battle, "sep_unit_1", { currentHp: 1, position: { x: 2, y: 2 } });
    battle = patchUnit(battle, "sep_unit_2", {
      currentHp: 0,
      position: null,
      status: "Destroyed",
    });
    battle = patchUnit(battle, "sep_unit_3", {
      currentHp: 0,
      position: null,
      status: "Destroyed",
    });
    battle = {
      ...battle,
      activeActivation: {
        id: "test_republic_activation",
        armyId: "army_republic",
        faction: "Republic",
        used: false,
      },
    };

    const result = applyMissionAction(
      { battle, mission: createMissionState(survivalTestScenario) },
      survivalTestScenario,
      {
        type: "Attack",
        attackerId: "rep_unit_1",
        defenderId: "sep_unit_1",
        weaponId: "dc_15_blaster_rifles",
      },
      { rollD6: createSequenceDiceRoller([6, 1, 1, 1]) },
    );

    expect(result.events.map((event) => event.type)).toEqual([
      "AttackResolved",
      "UnitDestroyed",
      "ArmyEliminated",
    ]);
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: "BattleFinished" }));
    expect(result.mission.status).toBe("Active");
    expect(result.battle.phase).toBe("Activation");
  });
  it("defeats the mission when the defending army is eliminated", () => {
    let battle = createBattle();
    battle = patchUnit(battle, "sep_unit_1", { position: { x: 2, y: 2 } });
    battle = patchUnit(battle, "rep_unit_1", { currentHp: 1, position: { x: 1, y: 2 } });
    battle = patchUnit(battle, "rep_unit_2", { currentHp: 0, position: null, status: "Destroyed" });
    battle = patchUnit(battle, "rep_unit_3", { currentHp: 0, position: null, status: "Destroyed" });
    battle = {
      ...battle,
      activeActivation: {
        id: "test_separatist_activation",
        armyId: "army_separatists",
        faction: "Separatists",
        used: false,
      },
    };

    const result = applyMissionAction(
      { battle, mission: createMissionState(survivalTestScenario) },
      survivalTestScenario,
      {
        type: "Attack",
        attackerId: "sep_unit_1",
        defenderId: "rep_unit_1",
        weaponId: "e_5_blaster_rifles",
      },
      { rollD6: createSequenceDiceRoller([6, 1, 1, 1]) },
    );

    expect(result.events.map((event) => event.type)).toEqual([
      "AttackResolved",
      "UnitDestroyed",
      "ArmyEliminated",
    ]);
    expect(result.mission.status).toBe("Defeat");
    expect(result.battle.activeActivation).toBeUndefined();
    expect(result.missionEvents).toEqual([
      expect.objectContaining({ type: "MissionCompleted", status: "Defeat" }),
    ]);
  });

  it("rejects battle actions after the mission has finished", () => {
    const battle = createBattle();
    const mission = {
      ...createMissionState(survivalTestScenario),
      status: "Victory" as const,
      roundsCompleted: 3,
    };

    const result = applyMissionAction(
      { battle, mission },
      survivalTestScenario,
      { type: "DrawActivation" },
    );

    expect(result.battle).toBe(battle);
    expect(result.mission).toBe(mission);
    expect(result.events).toEqual([]);
    expect(result.missionEvents).toEqual([]);
  });
});

function patchUnit(battle: Battle, unitId: string, patch: Partial<UnitInstance>): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => (unit.id === unitId ? { ...unit, ...patch } : unit)),
    })),
  };
}
