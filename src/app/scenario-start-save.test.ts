import { describe, expect, it } from "vitest";
import { createLog } from "../core/battle-state";
import { createMissionState } from "../core/scenario/scenario-engine";
import { protectGeneratorScenario } from "../core/scenario/scenarios";
import { starterArmies } from "../data";
import { createScenarioDraft, startBattleFromDraft } from "./scenario-draft";
import { createScenarioStartSave } from "./scenario-start-save";

describe("scenario start save", () => {
  it("captures the untouched opening state under the battle id", () => {
    const draft = createScenarioDraft(protectGeneratorScenario.id, { armies: starterArmies });
    const battle = startBattleFromDraft(draft);
    const initialBattle = structuredClone(battle);
    const mission = createMissionState(protectGeneratorScenario, battle.armies);
    const logs = [createLog(1, "Utworzono automatyczny zapis początkowy.")];

    const saved = createScenarioStartSave({
      battle,
      initialBattle,
      logs,
      mission,
      scenarioName: protectGeneratorScenario.name,
      now: "2026-08-10T10:00:00.000Z",
    });

    expect(saved).toMatchObject({
      id: battle.id,
      name: `Początek — ${protectGeneratorScenario.name}`,
      scenarioId: protectGeneratorScenario.id,
      turn: 1,
      phase: "Activation",
      createdAt: "2026-08-10T10:00:00.000Z",
      updatedAt: "2026-08-10T10:00:00.000Z",
    });
    expect(saved.battle).toEqual(battle);
    expect(saved.initialBattle).toEqual(initialBattle);
    expect(saved.logs).toEqual(logs);
    expect(saved.mission).toEqual(mission);
    expect(saved.battle).not.toBe(battle);
    expect(saved.initialBattle).not.toBe(initialBattle);
    expect(saved.logs).not.toBe(logs);
    expect(saved.mission).not.toBe(mission);
  });
});
