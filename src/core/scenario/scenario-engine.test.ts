import { describe, expect, it } from "vitest";
import type { BattleEvent } from "../battle-actions";
import { createBattle } from "../battle-state";
import { createBattlefieldObject } from "../battlefield-objects";
import { applyScenarioEvents, createMissionState } from "./scenario-engine";
import {
  defendPointScenario,
  christophsisBreakLineScenario,
  controlTerritoryScenario,
  feluciaAmbushScenario,
  geonosisDroidFoundryScenario,
  protectGeneratorScenario,
  survivalTestScenario,
} from "./scenarios";

describe("scenario engine", () => {
  it("ignores battle events unrelated to the scenario condition", () => {
    const mission = createMissionState(survivalTestScenario);
    const events: BattleEvent[] = [{ type: "ActivationDrawn", armyId: "army_republic" }];

    const result = applyScenarioEvents(mission, survivalTestScenario, events);

    expect(result.mission).toBe(mission);
    expect(result.events).toEqual([]);
  });

  it("tracks every completed round", () => {
    const mission = createMissionState(survivalTestScenario);
    const result = applyScenarioEvents(mission, survivalTestScenario, [
      { type: "TurnEnded", turn: 2 },
    ]);

    expect(result.mission).toEqual({
      scenarioId: survivalTestScenario.id,
      status: "Active",
      roundsCompleted: 1,
    });
    expect(result.events).toEqual([]);
  });

  it("completes the survival scenario after the required number of rounds", () => {
    const mission = {
      ...createMissionState(survivalTestScenario),
      roundsCompleted: 7,
    };
    const result = applyScenarioEvents(mission, survivalTestScenario, [
      { type: "TurnEnded", turn: 4 },
    ]);

    expect(result.mission).toEqual({
      scenarioId: survivalTestScenario.id,
      status: "Victory",
      roundsCompleted: 8,
    });
    expect(result.events).toEqual([
      expect.objectContaining({ type: "MissionCompleted", status: "Victory" }),
    ]);
  });

  it("does not complete an already finished mission again", () => {
    const completedMission = {
      ...createMissionState(survivalTestScenario),
      status: "Victory" as const,
      roundsCompleted: 3,
    };
    const result = applyScenarioEvents(completedMission, survivalTestScenario, [
      { type: "TurnEnded", turn: 5 },
    ]);

    expect(result.mission).toBe(completedMission);
    expect(result.events).toEqual([]);
  });

  it("defeats the defenders when their army is eliminated", () => {
    const mission = { ...createMissionState(survivalTestScenario), roundsCompleted: 2 };
    const result = applyScenarioEvents(
      mission,
      survivalTestScenario,
      [{ type: "ArmyEliminated", armyId: "army_republic" }],
      createBattle(),
    );

    expect(result.mission).toEqual({
      scenarioId: survivalTestScenario.id,
      status: "Defeat",
      roundsCompleted: 2,
    });
    expect(result.events).toEqual([
      expect.objectContaining({ type: "MissionCompleted", status: "Defeat" }),
    ]);
  });

  it("uses the selected army as the defender for elimination defeat", () => {
    const battle = createBattle();
    const mission = createMissionState(
      survivalTestScenario,
      battle.armies,
      "army_separatists",
    );
    const result = applyScenarioEvents(
      mission,
      survivalTestScenario,
      [{ type: "ArmyEliminated", armyId: "army_separatists" }],
      battle,
    );

    expect(result.mission.status).toBe("Defeat");
    expect(result.mission.defenderArmyId).toBe("army_separatists");
    expect(result.mission.attackerArmyId).toBe("army_republic");
  });

  it("does not defeat the defender team while an allied army is still standing", () => {
    const battle = createBattle();
    const ally = structuredClone(battle.armies[0]);
    ally.id = "army_republic_allies";
    ally.units = ally.units.map((unit, index) => ({
      ...unit,
      id: `rep_ally_${index}`,
      armyId: ally.id,
    }));
    battle.armies.push(ally);
    battle.armies[0].units = battle.armies[0].units.map((unit) => ({
      ...unit,
      status: "Destroyed",
      position: null,
    }));
    const mission = createMissionState(
      survivalTestScenario,
      battle.armies,
      "army_republic",
    );

    const result = applyScenarioEvents(
      mission,
      survivalTestScenario,
      [{ type: "ArmyEliminated", armyId: "army_republic" }],
      battle,
    );

    expect(result.mission.status).toBe("Active");
  });

  it("counts a round when the defenders control the designated point", () => {
    const battle = createBattle();
    battle.board.objects = [createBattlefieldObject("DefensePoint", { x: 1, y: 2 })];

    const result = applyScenarioEvents(
      createMissionState(defendPointScenario),
      defendPointScenario,
      [{ type: "TurnEnded", turn: 2 }],
      battle,
    );

    expect(result.mission.roundsCompleted).toBe(1);
    expect(result.mission.status).toBe("Active");
  });

  it("resets defense progress when an enemy contests the point", () => {
    const battle = createBattle();
    battle.board.objects = [createBattlefieldObject("DefensePoint", { x: 1, y: 2 })];
    battle.armies[1].units[0].position = { x: 1, y: 2 };
    const mission = {
      ...createMissionState(defendPointScenario),
      roundsCompleted: 2,
    };

    const result = applyScenarioEvents(
      mission,
      defendPointScenario,
      [{ type: "TurnEnded", turn: 3 }],
      battle,
    );

    expect(result.mission.roundsCompleted).toBe(0);
    expect(result.events).toEqual([expect.objectContaining({ type: "MissionProgress" })]);
  });

  it("ends point defense in defeat when the overall battle limit expires", () => {
    const battle = createBattle();
    battle.turn = defendPointScenario.victoryCondition.type === "DefendPoint"
      ? defendPointScenario.victoryCondition.roundLimit + 1
      : 11;
    battle.board.objects = [createBattlefieldObject("DefensePoint", { x: 4, y: 4 })];

    const result = applyScenarioEvents(
      { ...createMissionState(defendPointScenario), roundsCompleted: 2 },
      defendPointScenario,
      [{ type: "TurnEnded", turn: battle.turn }],
      battle,
    );

    expect(result.mission.status).toBe("Defeat");
    expect(result.events).toEqual([
      expect.objectContaining({ type: "MissionCompleted", status: "Defeat" }),
    ]);
  });

  it("counts point defense for the army selected as defender", () => {
    const battle = createBattle();
    battle.board.objects = [createBattlefieldObject("DefensePoint", { x: 6, y: 2 })];
    const mission = createMissionState(
      defendPointScenario,
      battle.armies,
      "army_separatists",
    );

    const result = applyScenarioEvents(
      mission,
      defendPointScenario,
      [{ type: "TurnEnded", turn: 2 }],
      battle,
    );

    expect(result.mission.roundsCompleted).toBe(1);
    expect(result.mission.status).toBe("Active");
  });

  it("defeats the generator scenario when the generator is destroyed", () => {
    const result = applyScenarioEvents(
      createMissionState(protectGeneratorScenario),
      protectGeneratorScenario,
      [{
        type: "BattlefieldObjectDestroyed",
        objectId: "generator-1",
        objectType: "Generator",
      }],
    );

    expect(result.mission.status).toBe("Defeat");
  });

  it("does not count generator survival before a generator is placed", () => {
    const result = applyScenarioEvents(
      createMissionState(protectGeneratorScenario),
      protectGeneratorScenario,
      [{ type: "TurnEnded", turn: 2 }],
      createBattle(),
    );

    expect(result.mission.roundsCompleted).toBe(0);
    expect(result.events).toEqual([expect.objectContaining({ type: "MissionProgress" })]);
  });

  it("uses a custom round target for scenario progress", () => {
    const battle = createBattle();
    battle.board.objects = [createBattlefieldObject("Generator", { x: 3, y: 2 })];
    const mission = {
      ...createMissionState(protectGeneratorScenario),
      roundsCompleted: 11,
      roundTarget: 12,
    };

    const result = applyScenarioEvents(
      mission,
      protectGeneratorScenario,
      [{ type: "TurnEnded", turn: 2 }],
      battle,
    );

    expect(result.mission.status).toBe("Victory");
    expect(result.mission.roundsCompleted).toBe(12);
  });

  it("claims occupied fields and scores them in territory control", () => {
    const battle = createBattle();
    const mission = createMissionState(controlTerritoryScenario, battle.armies);

    const result = applyScenarioEvents(
      mission,
      controlTerritoryScenario,
      [{ type: "TurnEnded", turn: 2 }],
      battle,
    );

    expect(Object.keys(result.mission.territoryOwners ?? {})).toHaveLength(6);
    expect(result.mission.territoryScores).toEqual({
      army_republic: 3,
      army_separatists: 3,
    });
    expect(result.mission.roundsCompleted).toBe(1);
  });

  it("awards two points for a controlled strategic field", () => {
    const battle = createBattle();
    battle.board.objects = [
      createBattlefieldObject("StrategicPoint", { x: 1, y: 2 }),
    ];

    const result = applyScenarioEvents(
      createMissionState(controlTerritoryScenario, battle.armies),
      controlTerritoryScenario,
      [{ type: "TurnEnded", turn: 2 }],
      battle,
    );

    expect(result.mission.territoryScores).toEqual({
      army_republic: 4,
      army_separatists: 3,
    });
  });

  it("honors a custom round target in territory control", () => {
    const battle = createBattle();
    const mission = {
      ...createMissionState(controlTerritoryScenario, battle.armies),
      roundTarget: 12,
      roundsCompleted: 5,
    };

    const result = applyScenarioEvents(
      mission,
      controlTerritoryScenario,
      [{ type: "TurnEnded", turn: 7 }],
      battle,
    );

    expect(result.mission.status).toBe("Active");
    expect(result.mission.roundTarget).toBe(12);
    expect(result.mission.roundsCompleted).toBe(6);
  });

  it("tracks multiple foundry targets and wins immediately after the last one is destroyed", () => {
    const initial = createMissionState(geonosisDroidFoundryScenario);
    const first = applyScenarioEvents(initial, geonosisDroidFoundryScenario, [{
      type: "BattlefieldObjectDestroyed",
      objectId: "generator-a",
      objectType: "Generator",
    }]);
    const second = applyScenarioEvents(first.mission, geonosisDroidFoundryScenario, [{
      type: "BattlefieldObjectDestroyed",
      objectId: "generator-b",
      objectType: "Generator",
    }]);

    expect(first.mission.status).toBe("Active");
    expect(first.mission.destroyedObjectiveIds).toEqual(["generator-a"]);
    expect(second.mission.status).toBe("Victory");
  });

  it("uses the scenario's defensive side when assigning mission roles", () => {
    const battle = createBattle();
    const mission = createMissionState(geonosisDroidFoundryScenario, battle.armies);

    expect(mission.defenderArmyId).toBe(battle.armies[1].id);
    expect(mission.attackerArmyId).toBe(battle.armies[0].id);
  });

  it("loses the foundry assault when its round limit expires", () => {
    const mission = {
      ...createMissionState(geonosisDroidFoundryScenario),
      roundsCompleted: 9,
    };
    const result = applyScenarioEvents(
      mission,
      geonosisDroidFoundryScenario,
      [{ type: "TurnEnded", turn: 11 }],
    );

    expect(result.mission.status).toBe("Defeat");
  });

  it("advances the Christophsis front only through consecutive objectives", () => {
    const battle = createBattle();
    battle.board.objects = [2, 4, 6].map((x) =>
      createBattlefieldObject("StrategicPoint", { x, y: 2 })
    );
    battle.armies[1].units.forEach((unit) => { unit.position = null; });
    const mission = createMissionState(christophsisBreakLineScenario, battle.armies);

    battle.armies[0].units[0].position = { x: 2, y: 2 };
    const first = applyScenarioEvents(
      mission,
      christophsisBreakLineScenario,
      [{ type: "TurnEnded", turn: 2 }],
      battle,
    );
    battle.armies[0].units[0].position = { x: 4, y: 2 };
    const second = applyScenarioEvents(
      first.mission,
      christophsisBreakLineScenario,
      [{ type: "TurnEnded", turn: 3 }],
      battle,
    );
    battle.armies[0].units[0].position = { x: 6, y: 2 };
    const third = applyScenarioEvents(
      second.mission,
      christophsisBreakLineScenario,
      [{ type: "TurnEnded", turn: 4 }],
      battle,
    );

    expect(first.mission.objectiveStage).toBe(1);
    expect(second.mission.objectiveStage).toBe(2);
    expect(third.mission.status).toBe("Victory");
  });

  it("enforces configurable limits for individual progressive sectors", () => {
    const battle = createBattle();
    battle.board.objects = [2, 4, 6].map((x) =>
      createBattlefieldObject("StrategicPoint", { x, y: 4 })
    );
    battle.armies[0].units.forEach((unit) => { unit.position = null; });
    const mission = {
      ...createMissionState(christophsisBreakLineScenario, battle.armies),
      stageRoundTargets: [1, 2, 3],
    };

    const result = applyScenarioEvents(
      mission,
      christophsisBreakLineScenario,
      [{ type: "TurnEnded", turn: 2 }],
      battle,
    );

    expect(result.mission.status).toBe("Defeat");
    expect(result.events[0]).toEqual(expect.objectContaining({ type: "MissionCompleted" }));
  });

  it("resets the stage clock after a sector is captured", () => {
    const battle = createBattle();
    battle.board.objects = [2, 4, 6].map((x) =>
      createBattlefieldObject("StrategicPoint", { x, y: 4 })
    );
    battle.armies[1].units.forEach((unit) => { unit.position = null; });
    battle.armies[0].units[0].position = { x: 2, y: 4 };
    const mission = {
      ...createMissionState(christophsisBreakLineScenario, battle.armies),
      stageRoundTargets: [1, 1, 3],
    };
    const first = applyScenarioEvents(
      mission,
      christophsisBreakLineScenario,
      [{ type: "TurnEnded", turn: 2 }],
      battle,
    );
    battle.armies[0].units[0].position = null;
    const second = applyScenarioEvents(
      first.mission,
      christophsisBreakLineScenario,
      [{ type: "TurnEnded", turn: 3 }],
      battle,
    );

    expect(first.mission.status).toBe("Active");
    expect(first.mission.stageStartedRound).toBe(1);
    expect(second.mission.status).toBe("Defeat");
  });

  it("completes the Felucia ambush after survival and extraction", () => {
    const battle = createBattle();
    battle.armies[0].units[0].position = { x: 7, y: 4 };
    const mission = {
      ...createMissionState(feluciaAmbushScenario, battle.armies),
      roundsCompleted: 5,
    };
    const result = applyScenarioEvents(
      mission,
      feluciaAmbushScenario,
      [{ type: "TurnEnded", turn: 4 }],
      battle,
    );

    expect(result.mission.status).toBe("Victory");
  });
});
