import { describe, expect, it } from "vitest";
import {
  christophsisLastLandingScenario,
  mandaloreHuntInSundariScenario,
} from "../core/scenario/scenarios";
import {
  buildScenarioPresetArmies,
  getScenarioArmyPreset,
} from "../core/scenario/scenario-army-presets";
import { runBalanceBatch } from "./balance-report";
import { runHeadlessSimulation } from "./headless-simulation";

describe("headless mission simulation", () => {
  it("is fully reproducible for the same seed", () => {
    const first = runHeadlessSimulation({
      scenario: christophsisLastLandingScenario,
      seed: 1138,
    });
    const second = runHeadlessSimulation({
      scenario: christophsisLastLandingScenario,
      seed: 1138,
    });

    expect(second).toEqual(first);
    expect(["mission-completed", "round-limit"]).toContain(first.terminationReason);
    expect(first.counters.activationsDrawn).toBeGreaterThan(0);
    expect(first.counters.activationsResolved).toBe(first.counters.activationsDrawn);
    expect(first.counters.roundsEnded).toBe(first.roundsPlayed);
  }, 15_000);

  it("runs a deterministic multi-seed balance batch", () => {
    const report = runBalanceBatch({
      scenarios: [mandaloreHuntInSundariScenario],
      runsPerScenario: 2,
      baseSeed: 3277,
    });

    expect(report.totalRuns).toBe(2);
    expect(report.results.map((result) => result.seed)).toEqual([1011199, 1019118]);
    expect(report.summaries).toHaveLength(1);
    expect(report.summaries[0].runs).toBe(2);
    expect(
      report.summaries[0].victories +
      report.summaries[0].defeats +
      report.summaries[0].incomplete,
    ).toBe(2);
  });

  it("stops safely at a caller-provided round bound", () => {
    const result = runHeadlessSimulation({
      scenario: christophsisLastLandingScenario,
      seed: 7,
      maxRounds: 1,
    });

    expect(result.outcome).toBe("Incomplete");
    expect(result.terminationReason).toBe("round-limit");
    expect(result.roundsPlayed).toBe(1);
  });

  it("drives the Crystal City droid column with its authored roster", () => {
    const roster = getScenarioArmyPreset(christophsisLastLandingScenario.id);
    if (!roster) throw new Error("Crystal City scenario roster is missing.");

    const result = runHeadlessSimulation({
      scenario: christophsisLastLandingScenario,
      armies: buildScenarioPresetArmies(roster, "pl"),
      seed: 3277,
    });

    expect(result.counters.botStopReasons["no-legal-action"]).toBe(0);
    expect(result.counters.botActions).toBeGreaterThan(0);
    expect(result.counters.activationsResolved).toBeGreaterThan(0);
  }, 15_000);

});
