import { describe, expect, it } from "vitest";
import { starterArmies } from "../../data";
import { createBattle } from "../battle-state";
import {
  applyMissionDirectorRound,
  getMissionDirectorPhase,
  validateMissionDirector,
} from "./mission-director";
import { createMissionState } from "./scenario-engine";
import { christophsisLastLandingScenario } from "./scenarios";

describe("Mission Director", () => {
  it("sets the authored AI profile when a mission phase begins", () => {
    const battle = createBattle();
    const mission = createMissionState(
      christophsisLastLandingScenario,
      battle.armies,
    );
    const result = applyMissionDirectorRound(
      battle,
      mission,
      christophsisLastLandingScenario,
      1,
    );

    expect(result.mission.directorState).toMatchObject({
      phase: "Opening",
      lastEvaluatedRound: 1,
      wavesDeployed: 0,
      supportUses: 0,
    });
    expect(result.mission.botProfiles?.army_separatists).toBe("aggressive");
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "MissionDirectorIntervention",
      intervention: "PhaseChanged",
    }));
  });

  it("deploys a bounded adaptive wave when the enemy is not dominant", () => {
    const battle = createBattle();
    const mission = createMissionState(
      christophsisLastLandingScenario,
      battle.armies,
    );
    const enemyUnitCount = battle.armies[1].units.length;
    const first = applyMissionDirectorRound(
      battle,
      mission,
      christophsisLastLandingScenario,
      4,
    );
    const repeated = applyMissionDirectorRound(
      first.battle,
      first.mission,
      christophsisLastLandingScenario,
      4,
    );

    expect(first.battle.armies[1].units).toHaveLength(enemyUnitCount + 1);
    expect(first.mission.directorState?.wavesDeployed).toBe(1);
    expect(first.mission.directorState?.lastWaveRound).toBe(4);
    expect(first.events).toContainEqual(expect.objectContaining({
      intervention: "EnemyWave",
    }));
    expect(repeated.battle).toBe(first.battle);
    expect(repeated.events).toEqual([]);
  });

  it("withholds escalation while the enemy already controls the battle", () => {
    const battle = createBattle();
    battle.armies[0].units.forEach((unit) => {
      unit.currentHp = unit.id === "rep_unit_1" ? 1 : 0;
      unit.status = unit.id === "rep_unit_1" ? "Ready" : "Destroyed";
    });
    const mission = createMissionState(
      christophsisLastLandingScenario,
      starterArmies,
    );
    const enemyUnitCount = battle.armies[1].units.length;
    const result = applyMissionDirectorRound(
      battle,
      mission,
      christophsisLastLandingScenario,
      4,
    );

    expect(result.battle.armies[1].units).toHaveLength(enemyUnitCount);
    expect(result.mission.directorState?.wavesDeployed).toBe(0);
  });

  it("grants emergency support once when the player side collapses", () => {
    const battle = createBattle();
    const mission = createMissionState(
      christophsisLastLandingScenario,
      battle.armies,
    );
    battle.armies[0].units.forEach((unit) => {
      unit.currentHp = unit.id === "rep_unit_2" ? 1 : 0;
      unit.status = unit.id === "rep_unit_2" ? "Ready" : "Destroyed";
    });
    const playerUnitCount = battle.armies[0].units.length;
    const result = applyMissionDirectorRound(
      battle,
      mission,
      christophsisLastLandingScenario,
      5,
    );

    expect(result.battle.armies[0].units).toHaveLength(playerUnitCount + 1);
    expect(result.battle.armies[0].units.at(-1)?.templateId).toBe("clone_trooper_squad");
    expect(result.mission.directorState).toMatchObject({
      supportUses: 1,
      lastSupportRound: 5,
      wavesDeployed: 0,
    });
    expect(result.events).toContainEqual(expect.objectContaining({
      intervention: "EmergencySupport",
    }));
  });

  it("derives stable phases from the expanded operational round limit", () => {
    expect([1, 2, 3, 6, 8, 11, 12].map((round) =>
      getMissionDirectorPhase(round, 12)
    )).toEqual([
      "Opening",
      "Opening",
      "Opening",
      "Escalation",
      "Crisis",
      "Finale",
      "Finale",
    ]);
  });

  it("validates reinforcement factions and army slots", () => {
    expect(validateMissionDirector(
      christophsisLastLandingScenario.missionDirector,
      starterArmies,
    )).toBe(true);
    expect(validateMissionDirector({
      playerArmySlot: 0,
      enemyArmySlot: 1,
      escalation: {
        firstRound: 2,
        interval: 2,
        maxWaves: 1,
        powerRatioThreshold: 1,
        waves: [[{ templateId: "clone_trooper_squad", count: 1 }]],
      },
    }, starterArmies)).toBe(false);
  });
});
