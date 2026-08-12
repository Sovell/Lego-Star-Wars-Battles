import {
  customScenarioTemplates,
  narrativeMissions,
  scenarios as allScenarios,
} from "../src/core/scenario/scenarios";
import {
  formatBalanceReport,
  runBalanceBatch,
} from "../src/simulation/balance-report";

const args = process.argv.slice(2);
const runs = readIntegerArgument("--runs", 25);
const seed = readIntegerArgument("--seed", 1138);
const requestedScenario = readStringArgument("--scenario") ?? "all";
const requestedGroup = readStringArgument("--group") ?? "narrative";
const scenarioGroup = requestedGroup === "standard"
  ? customScenarioTemplates
  : requestedGroup === "all"
    ? allScenarios
    : requestedGroup === "narrative"
      ? narrativeMissions
      : [];
const scenarios = requestedScenario === "all"
  ? scenarioGroup
  : allScenarios.filter((scenario) => scenario.id === requestedScenario);

if (scenarios.length === 0) {
  console.error(`Nie znaleziono scenariuszy dla --group ${requestedGroup} i --scenario ${requestedScenario}.`);
  console.error(`Grupy: narrative, standard, all.`);
  console.error(`Scenariusze: all, ${allScenarios.map((scenario) => scenario.id).join(", ")}`);
  process.exitCode = 1;
} else {
  const report = runBalanceBatch({ scenarios, runsPerScenario: runs, baseSeed: seed });
  console.log(args.includes("--json")
    ? JSON.stringify(report, null, 2)
    : formatBalanceReport(report));
}

function readStringArgument(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readIntegerArgument(name: string, fallback: number): number {
  const raw = readStringArgument(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    console.error(`${name} wymaga nieujemnej liczby całkowitej.`);
    process.exit(1);
  }
  return value;
}
