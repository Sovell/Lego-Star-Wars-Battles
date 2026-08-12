import type { ScenarioDefinition } from "../core/scenario/scenario-types";
import {
  runHeadlessSimulation,
  type HeadlessSimulationResult,
} from "./headless-simulation";

export type ScenarioBalanceSummary = {
  scenarioId: string;
  scenarioName: string;
  runs: number;
  victories: number;
  defeats: number;
  incomplete: number;
  victoryRate: number;
  averageRounds: number;
  medianRounds: number;
  averagePlayerRemainingPowerPercentage: number;
  averageEnemyRemainingPowerPercentage: number;
  averageEnemyWaves: number;
  averageEmergencySupport: number;
  averagePassedActivations: number;
  warnings: string[];
};

export type BalanceBatchReport = {
  baseSeed: number;
  runsPerScenario: number;
  totalRuns: number;
  summaries: ScenarioBalanceSummary[];
  results: HeadlessSimulationResult[];
};

export type RunBalanceBatchOptions = {
  scenarios: ScenarioDefinition[];
  runsPerScenario?: number;
  baseSeed?: number;
};

export function runBalanceBatch({
  scenarios,
  runsPerScenario = 25,
  baseSeed = 1138,
}: RunBalanceBatchOptions): BalanceBatchReport {
  if (!Number.isInteger(runsPerScenario) || runsPerScenario < 1) {
    throw new Error("Runs per scenario must be a positive integer.");
  }
  if (!Number.isInteger(baseSeed)) throw new Error("Base seed must be an integer.");

  const results = scenarios.flatMap((scenario, scenarioIndex) =>
    Array.from({ length: runsPerScenario }, (_, runIndex) =>
      runHeadlessSimulation({
        scenario,
        seed: deriveSimulationSeed(baseSeed, scenarioIndex, runIndex),
      })
    )
  );
  return {
    baseSeed,
    runsPerScenario,
    totalRuns: results.length,
    summaries: scenarios.map((scenario) => summarizeScenario(
      scenario,
      results.filter((result) => result.scenarioId === scenario.id),
    )),
    results,
  };
}

export function formatBalanceReport(report: BalanceBatchReport): string {
  const lines = [
    "LEGO Star Wars Battles — headless balance report",
    `Seed bazowy: ${report.baseSeed} | prób na misję: ${report.runsPerScenario} | razem: ${report.totalRuns}`,
    "",
  ];
  for (const summary of report.summaries) {
    lines.push(
      `${summary.scenarioName} (${summary.scenarioId})`,
      `  wynik: ${summary.victories} zwycięstw / ${summary.defeats} porażek / ${summary.incomplete} niedokończonych (${summary.victoryRate}% zwycięstw)`,
      `  rundy: średnio ${summary.averageRounds}, mediana ${summary.medianRounds}`,
      `  pozostała siła: gracz ${summary.averagePlayerRemainingPowerPercentage}% | przeciwnik ${summary.averageEnemyRemainingPowerPercentage}%`,
      `  Director: fale ${summary.averageEnemyWaves} | wsparcie ${summary.averageEmergencySupport} | pominięte aktywacje ${summary.averagePassedActivations}`,
    );
    for (const warning of summary.warnings) lines.push(`  UWAGA: ${warning}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function deriveSimulationSeed(
  baseSeed: number,
  scenarioIndex: number,
  runIndex: number,
): number {
  return (
    (baseSeed >>> 0) +
    Math.imul(scenarioIndex + 1, 1_000_003) +
    Math.imul(runIndex + 1, 7_919)
  ) >>> 0;
}

function summarizeScenario(
  scenario: ScenarioDefinition,
  results: HeadlessSimulationResult[],
): ScenarioBalanceSummary {
  const victories = results.filter((result) => result.outcome === "Victory").length;
  const defeats = results.filter((result) => result.outcome === "Defeat").length;
  const incomplete = results.length - victories - defeats;
  const victoryRate = percentage(victories, results.length);
  const warnings: string[] = [];
  if (incomplete > 0) warnings.push(`${incomplete} symulacji nie osiągnęło stanu końcowego.`);
  if (victoryRate < 25) warnings.push("Misja wygląda na bardzo trudną dla strony gracza.");
  else if (victoryRate > 75) warnings.push("Misja wygląda na bardzo łatwą dla strony gracza.");
  const rejected = results.reduce(
    (sum, result) => sum + result.counters.botStopReasons["action-rejected"],
    0,
  );
  const stepLimits = results.reduce(
    (sum, result) => sum + result.counters.botStopReasons["step-limit"],
    0,
  );
  if (rejected > 0) warnings.push(`Bot otrzymał ${rejected} odrzuconych akcji.`);
  if (stepLimits > 0) warnings.push(`Bot ${stepLimits} razy osiągnął limit kroków aktywacji.`);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    runs: results.length,
    victories,
    defeats,
    incomplete,
    victoryRate,
    averageRounds: average(results.map((result) => result.roundsPlayed)),
    medianRounds: median(results.map((result) => result.roundsPlayed)),
    averagePlayerRemainingPowerPercentage: average(
      results.map((result) => result.playerRemainingPowerPercentage),
    ),
    averageEnemyRemainingPowerPercentage: average(
      results.map((result) => result.enemyRemainingPowerPercentage),
    ),
    averageEnemyWaves: average(results.map((result) => result.counters.enemyWaves)),
    averageEmergencySupport: average(
      results.map((result) => result.counters.emergencySupport),
    ),
    averagePassedActivations: average(
      results.map((result) => result.counters.activationsPassed),
    ),
    warnings,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round(value / total * 1_000) / 10 : 0;
}
