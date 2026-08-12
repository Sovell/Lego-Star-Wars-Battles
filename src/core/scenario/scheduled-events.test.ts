import { describe, expect, it } from "vitest";
import type { Battle } from "../../types";
import { createBattle } from "../battle-state";
import { createMissionState } from "./scenario-engine";
import { applyMissionAction } from "./mission-session";
import {
  applyScheduledScenarioEvents,
  validateScheduledScenarioEvents,
} from "./scheduled-events";
import { survivalTestScenario } from "./scenarios";
import type { ScenarioDefinition, ScenarioScheduledEvent } from "./scenario-types";
import { buildActivationBag } from "../rules/activation";

const roundOneReinforcements: ScenarioScheduledEvent = {
  id: "republic-wave-one",
  name: "Wsparcie Republiki",
  trigger: { type: "RoundStarted", round: 1 },
  effect: {
    type: "DeployReinforcements",
    armyId: "army_republic",
    units: [{ templateId: "clone_trooper_battalion", count: 2 }],
  },
  visibility: "Announced",
};

describe("scheduled scenario events", () => {
  it("deploys a reinforcement wave deterministically at scenario start", () => {
    const scenario = withEvents([roundOneReinforcements]);
    const battle = createBattle();
    const mission = createMissionState(scenario, battle.armies);

    const result = applyScheduledScenarioEvents(
      battle,
      mission,
      scenario,
      [{ type: "RoundStarted", round: 1 }],
    );
    const addedUnits = result.battle.armies[0].units.slice(3);

    expect(addedUnits).toHaveLength(2);
    expect(addedUnits.map((unit) => unit.position)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
    expect(result.battle.activationBag).toHaveLength(battle.activationBag.length + 2);
    expect(result.mission.resolvedEventIds).toEqual([roundOneReinforcements.id]);
    expect(result.events).toEqual([
      expect.objectContaining({
        type: "ScheduledEventResolved",
        eventId: roundOneReinforcements.id,
      }),
    ]);
  });

  it("does not create a second copy of a hero from reinforcements", () => {
    const heroWave: ScenarioScheduledEvent = {
      id: "duplicate-hero-wave",
      name: "Powrót Rexa",
      trigger: { type: "RoundStarted", round: 1 },
      effect: {
        type: "DeployReinforcements",
        armyId: "army_republic",
        units: [{ templateId: "captain_rex", count: 2 }],
      },
      visibility: "Announced",
    };
    const scenario = withEvents([heroWave]);
    const battle = createBattle();
    battle.armies[0].units.push({
      id: "existing-rex",
      templateId: "captain_rex",
      armyId: "army_republic",
      currentHp: 17,
      suppression: 0,
      position: null,
      status: "Ready",
      hidden: false,
    });

    const result = applyScheduledScenarioEvents(
      battle,
      createMissionState(scenario, battle.armies),
      scenario,
      [{ type: "RoundStarted", round: 1 }],
    );

    expect(result.battle.armies.flatMap((army) => army.units)
      .filter((unit) => unit.templateId === "captain_rex")).toHaveLength(1);
  });

  it("never resolves the same event twice", () => {
    const scenario = withEvents([roundOneReinforcements]);
    const battle = createBattle();
    const first = applyScheduledScenarioEvents(
      battle,
      createMissionState(scenario, battle.armies),
      scenario,
      [{ type: "RoundStarted", round: 1 }],
    );
    const replay = applyScheduledScenarioEvents(
      first.battle,
      first.mission,
      scenario,
      [{ type: "RoundStarted", round: 1 }],
    );

    expect(replay.battle).toBe(first.battle);
    expect(replay.mission).toBe(first.mission);
    expect(replay.events).toEqual([]);
  });

  it("does not let reinforcements raise an army above eight orders", () => {
    const scenario = withEvents([roundOneReinforcements]);
    const battle = createBattle();
    const templateUnit = battle.armies[0].units[0];
    battle.armies[0].units = Array.from({ length: 7 }, (_, index) => ({
      ...structuredClone(templateUnit),
      id: `republic-${index + 1}`,
      position: null,
    }));
    battle.activationBag = buildActivationBag(battle.armies);

    const result = applyScheduledScenarioEvents(
      battle,
      createMissionState(scenario, battle.armies),
      scenario,
      [{ type: "RoundStarted", round: 1 }],
    );

    expect(result.battle.armies[0].units).toHaveLength(9);
    expect(result.battle.activationBag.filter(
      ({ armyId }) => armyId === battle.armies[0].id,
    )).toHaveLength(8);
  });

  it("rejects incomplete waves before the scenario starts", () => {
    const battle = createBattle();

    expect(validateScheduledScenarioEvents([roundOneReinforcements], battle.armies)).toBe(true);
    expect(validateScheduledScenarioEvents([{
      ...roundOneReinforcements,
      effect: {
        type: "DeployReinforcements",
        armyId: "army_republic",
        units: [],
      },
    }], battle.armies)).toBe(false);
    expect(validateScheduledScenarioEvents([{
      ...roundOneReinforcements,
      effect: {
        type: "DeployReinforcements",
        armyId: "missing-army",
        units: [{ templateId: "clone_trooper_battalion", count: 2 }],
      },
    }], battle.armies)).toBe(false);
  });

  it("resolves end-of-round and next-round events during one turn transition", () => {
    const scenario = withEvents([
      {
        ...roundOneReinforcements,
        id: "end-one",
        trigger: { type: "RoundEnded", round: 1 },
        effect: {
          type: "DeployReinforcements",
          armyId: "army_republic",
          units: [{ templateId: "clone_trooper_battalion", count: 1 }],
        },
      },
      {
        ...roundOneReinforcements,
        id: "start-two",
        trigger: { type: "RoundStarted", round: 2 },
        effect: {
          type: "DeployReinforcements",
          armyId: "army_republic",
          units: [{ templateId: "clone_trooper_battalion", count: 1 }],
        },
      },
    ]);
    const battle = activateAllLivingUnits(createBattle());

    const result = applyMissionAction(
      { battle, mission: createMissionState(scenario, battle.armies) },
      scenario,
      { type: "EndTurn" },
    );

    expect(result.battle.turn).toBe(2);
    expect(result.battle.armies[0].units).toHaveLength(5);
    expect(result.mission.resolvedEventIds).toEqual(["end-one", "start-two"]);
    expect(result.missionEvents.map((event) => event.type)).toEqual([
      "ScheduledEventResolved",
      "ScheduledEventResolved",
    ]);
  });
});

function withEvents(events: ScenarioScheduledEvent[]): ScenarioDefinition {
  return { ...survivalTestScenario, scheduledEvents: events };
}

function activateAllLivingUnits(battle: Battle): Battle {
  return {
    ...battle,
    activeActivation: undefined,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) =>
        unit.status === "Destroyed" ? unit : { ...unit, status: "Activated" },
      ),
    })),
  };
}
