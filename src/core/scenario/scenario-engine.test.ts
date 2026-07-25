import { describe, expect, it } from "vitest";
import type { BattleEvent } from "../battle-actions";
import { createBattle } from "../battle-state";
import { createBattlefieldObject } from "../battlefield-objects";
import { applyScenarioEvents, createMissionState } from "./scenario-engine";
import {
  defendPointScenario,
  controlTerritoryScenario,
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
      roundsCompleted: 2,
    };
    const result = applyScenarioEvents(mission, survivalTestScenario, [
      { type: "TurnEnded", turn: 4 },
    ]);

    expect(result.mission).toEqual({
      scenarioId: survivalTestScenario.id,
      status: "Victory",
      roundsCompleted: 3,
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
});
