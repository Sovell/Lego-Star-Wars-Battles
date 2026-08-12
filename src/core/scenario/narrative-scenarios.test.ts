import { describe, expect, it } from "vitest";
import { starterArmies } from "../../data";
import { createScenarioDraft, applyScenarioMapPreset, remapScheduledEventsByArmy } from "../../app/scenario-draft";
import { validateMapConnectivity } from "../map-generation/map-connectivity";
import { validateScheduledScenarioEvents } from "./scheduled-events";
import { applyScenarioEvents, createMissionState } from "./scenario-engine";
import { validateMissionDirector } from "./mission-director";
import {
  customScenarioTemplates,
  mandaloreHuntInSundariScenario,
  narrativeMissions,
  scenarios,
} from "./scenarios";

describe("narrative mission catalog", () => {
  it("separates five authored missions from custom scenario templates", () => {
    expect(narrativeMissions).toHaveLength(5);
    expect(narrativeMissions.every((scenario) =>
      scenario.experience === "NarrativeMission" && Boolean(scenario.mapPreset)
    )).toBe(true);
    expect(customScenarioTemplates.every((scenario) =>
      scenario.experience !== "NarrativeMission" && !scenario.mapPreset
    )).toBe(true);
    expect(scenarios).toEqual([...narrativeMissions, ...customScenarioTemplates]);
  });

  it.each(narrativeMissions.map((scenario) => [scenario.id, scenario] as const))(
    "%s produces a connected, deterministic preset board",
    (_scenarioId, scenario) => {
      const draft = createScenarioDraft(scenario.id, {
        armies: starterArmies,
        defenderArmyId: starterArmies[scenario.defaultDefenderArmySlot ?? 0].id,
      });
      const first = applyScenarioMapPreset(draft, scenario);
      const second = applyScenarioMapPreset(draft, scenario);

      expect(first.board).toEqual(second.board);
      expect(first.mapGeneration?.themeId).toBe(scenario.mapPreset?.themeId);
      expect(validateMapConnectivity(first.board).valid).toBe(true);
      expect(validateMissionDirector(scenario.missionDirector, starterArmies)).toBe(true);
    },
  );

  it("remaps authored event armies to custom composer army IDs", () => {
    const armies = structuredClone(starterArmies);
    armies[0].id = "army_player_1";
    armies[0].units.forEach((unit) => { unit.armyId = armies[0].id; });
    armies[1].id = "army_player_2";
    armies[1].units.forEach((unit) => { unit.armyId = armies[1].id; });
    const events = remapScheduledEventsByArmy(
      mandaloreHuntInSundariScenario.scheduledEvents ?? [],
      [],
      armies,
    );

    expect(validateScheduledScenarioEvents(events, armies)).toBe(true);
    expect(events.find(({ id }) => id === "sundari-maul-enters")?.effect)
      .toMatchObject({ armyId: "army_player_2" });
  });

  it("fails a scripted hunt when its authored round limit expires", () => {
    const mission = {
      ...createMissionState(mandaloreHuntInSundariScenario, starterArmies),
      roundsCompleted: 11,
    };
    const result = applyScenarioEvents(
      mission,
      mandaloreHuntInSundariScenario,
      [{ type: "TurnEnded", turn: 12 }],
    );

    expect(result.mission.status).toBe("Defeat");
    expect(result.mission.roundsCompleted).toBe(12);
  });
});
