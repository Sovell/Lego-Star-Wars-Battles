import { describe, expect, it } from "vitest";
import type { BattleEvent } from "../battle-actions";
import { applyScenarioEvents, createMissionState } from "./scenario-engine";
import { survivalTestScenario } from "./scenarios";

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
    const result = applyScenarioEvents(mission, survivalTestScenario, [
      { type: "ArmyEliminated", armyId: "army_republic" },
    ]);

    expect(result.mission).toEqual({
      scenarioId: survivalTestScenario.id,
      status: "Defeat",
      roundsCompleted: 2,
    });
    expect(result.events).toEqual([
      expect.objectContaining({ type: "MissionCompleted", status: "Defeat" }),
    ]);
  });
});
