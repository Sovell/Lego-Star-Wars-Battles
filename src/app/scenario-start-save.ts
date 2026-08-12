import { createSavedBattle, type SavedBattle } from "../core/persistence/save-types";
import type { MissionState } from "../core/scenario/scenario-types";
import type { Battle, CombatLogEntry } from "../types";

export function createScenarioStartSave({
  battle,
  initialBattle,
  logs,
  mission,
  scenarioName,
  saveNamePrefix = "Początek",
  now,
}: {
  battle: Battle;
  initialBattle: Battle;
  logs: CombatLogEntry[];
  mission: MissionState;
  scenarioName: string;
  saveNamePrefix?: string;
  now?: string;
}): SavedBattle {
  return createSavedBattle({
    id: battle.id,
    name: `${saveNamePrefix} — ${scenarioName}`,
    battle: structuredClone(battle),
    initialBattle: structuredClone(initialBattle),
    logs: structuredClone(logs),
    mission: structuredClone(mission),
    scenarioId: mission.scenarioId,
    now,
  });
}
