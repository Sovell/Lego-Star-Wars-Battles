import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { createBattlefieldObject } from "../battlefield-objects";
import { createBattle } from "../battle-state";
import { createSequenceDiceRoller } from "../random";
import { createMissionState } from "./scenario-engine";
import { applyMissionAction } from "./mission-session";
import {
  applyScenarioTriggerEffects,
  deriveScenarioTriggerSignals,
} from "./scheduled-events";
import { survivalTestScenario } from "./scenarios";
import type { ScenarioDefinition, ScenarioScheduledEvent } from "./scenario-types";

describe("scenario trigger and effect scripts", () => {
  it("changes the AI profile after a selected unit is destroyed", () => {
    const event: ScenarioScheduledEvent = {
      id: "grievous-enraged",
      name: "Grievous przejmuje dowodzenie",
      trigger: { type: "UnitDestroyed", unitId: "sep_unit_1" },
      effect: {
        type: "ChangeAIProfile",
        armyId: "army_separatists",
        profile: "hunter",
      },
      visibility: "Hidden",
    };
    const scenario = withEvents([event]);
    let battle = createBattle();
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 1, y: 2 } });
    battle = patchUnit(battle, "sep_unit_1", { currentHp: 1, position: { x: 2, y: 2 } });
    battle = withActivation(battle, "army_republic");

    const result = applyMissionAction(
      { battle, mission: createMissionState(scenario, battle.armies, "army_republic") },
      scenario,
      {
        type: "Attack",
        attackerId: "rep_unit_1",
        defenderId: "sep_unit_1",
        weaponId: "dc_15_blaster_rifles",
      },
      { rollD6: createSequenceDiceRoller([6, 1, 1, 1]) },
    );

    expect(result.mission.botProfiles?.army_separatists).toBe("hunter");
    expect(result.mission.resolvedEventIds).toContain(event.id);
  });

  it("completes a mission when a unit enters a scripted zone", () => {
    const scenario: ScenarioDefinition = {
      ...survivalTestScenario,
      zones: [{ id: "command-center", type: "Trigger", cells: [{ x: 2, y: 2 }] }],
      scheduledEvents: [{
        id: "reach-command-center",
        name: "Centrum dowodzenia zdobyte",
        trigger: { type: "UnitEnteredZone", zoneId: "command-center", armyId: "army_republic" },
        effect: { type: "Victory", message: "Centrum dowodzenia zostało zdobyte." },
        visibility: "Announced",
      }],
    };
    let battle = patchUnit(createBattle(), "rep_unit_1", { position: { x: 1, y: 2 } });
    battle = withActivation(battle, "army_republic");

    const result = applyMissionAction(
      { battle, mission: createMissionState(scenario, battle.armies, "army_republic") },
      scenario,
      { type: "MoveUnit", unitId: "rep_unit_1", targetPosition: { x: 2, y: 2 } },
    );

    expect(result.mission.status).toBe("Victory");
    expect(result.battle.activeActivation).toBeUndefined();
    expect(result.missionEvents).toContainEqual(expect.objectContaining({
      type: "MissionCompleted",
      status: "Victory",
    }));
  });

  it("spawns units in a scenario zone and places battlefield objects", () => {
    const spawnEvent: ScenarioScheduledEvent = {
      id: "ambush",
      name: "Zasadzka",
      trigger: { type: "ObjectDestroyed", objectType: "Generator" },
      effect: {
        type: "SpawnUnits",
        armyId: "army_separatists",
        zoneId: "ambush-zone",
        units: [{ templateId: "b1_droid_squad", count: 1 }],
      },
      visibility: "Hidden",
    };
    const placedObject = {
      ...createBattlefieldObject("Generator", { x: 4, y: 4 }),
      id: "secondary-generator",
    };
    const placeEvent: ScenarioScheduledEvent = {
      id: "backup-generator",
      name: "Generator awaryjny",
      trigger: { type: "ObjectDestroyed", objectType: "Generator" },
      effect: { type: "PlaceObject", object: placedObject },
      visibility: "Announced",
    };
    const scenario: ScenarioDefinition = {
      ...survivalTestScenario,
      zones: [{ id: "ambush-zone", type: "Trigger", cells: [{ x: 6, y: 6 }] }],
      scheduledEvents: [spawnEvent, placeEvent],
    };
    const battle = createBattle();

    const result = applyScenarioTriggerEffects(
      battle,
      createMissionState(scenario, battle.armies),
      scenario,
      [{ type: "ObjectDestroyed", objectId: "primary-generator", objectType: "Generator" }],
    );

    expect(result.battle.armies[1].units.at(-1)?.position).toEqual({ x: 6, y: 6 });
    expect(result.battle.board.objects).toContainEqual(expect.objectContaining({
      id: placedObject.id,
      status: "Active",
    }));
  });

  it("derives territory and army-strength signals from state changes", () => {
    const battleBefore = createBattle();
    const battleAfter = patchUnit(battleBefore, "rep_unit_1", {
      currentHp: 1,
      position: { x: 3, y: 3 },
    });
    const missionBefore = createMissionState(survivalTestScenario, battleBefore.armies);
    const missionAfter = {
      ...missionBefore,
      territoryOwners: { "3,3": "army_republic" },
    };

    const signals = deriveScenarioTriggerSignals({
      battleBefore,
      battleAfter,
      missionBefore,
      missionAfter,
      scenario: survivalTestScenario,
      battleEvents: [],
    });

    expect(signals).toContainEqual({
      type: "TerritoryCaptured",
      armyId: "army_republic",
      position: { x: 3, y: 3 },
    });
    expect(signals).toContainEqual(expect.objectContaining({
      type: "ArmyStrengthBelow",
      armyId: "army_republic",
    }));
  });

  it("changes the objective text without mutating the scenario definition", () => {
    const scenario = withEvents([{
      id: "evacuate",
      name: "Ewakuacja",
      trigger: { type: "RoundStarted", round: 3 },
      effect: {
        type: "ChangeObjective",
        objectiveId: "extract",
        name: "Dotrzyj do strefy ewakuacji",
        description: "Wycofaj ocalałe jednostki.",
      },
      visibility: "Announced",
    }]);
    const battle = createBattle();
    const result = applyScenarioTriggerEffects(
      battle,
      createMissionState(scenario, battle.armies),
      scenario,
      [{ type: "RoundStarted", round: 3 }],
    );

    expect(result.mission.activeObjectiveId).toBe("extract");
    expect(result.mission.activeObjectiveName).toBe("Dotrzyj do strefy ewakuacji");
    expect(scenario.name).toBe(survivalTestScenario.name);
  });
});

function withEvents(events: ScenarioScheduledEvent[]): ScenarioDefinition {
  return { ...survivalTestScenario, scheduledEvents: events };
}

function patchUnit(battle: Battle, unitId: string, patch: Partial<UnitInstance>): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => unit.id === unitId ? { ...unit, ...patch } : unit),
    })),
  };
}

function withActivation(battle: Battle, armyId: string): Battle {
  const army = battle.armies.find((candidate) => candidate.id === armyId)!;
  return {
    ...battle,
    activeActivation: {
      id: "script-test-token",
      armyId,
      faction: army.faction,
      used: true,
    },
  };
}
