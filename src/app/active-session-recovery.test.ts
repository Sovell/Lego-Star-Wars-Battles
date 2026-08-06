import { describe, expect, it } from "vitest";
import { createBattle } from "../core/battle-state";
import { createMissionState } from "../core/scenario/scenario-engine";
import { survivalTestScenario } from "../core/scenario/scenarios";
import { restartDraftFromBattle } from "./scenario-draft";
import {
  clearActiveSessionRecovery,
  loadActiveSessionRecovery,
  saveActiveSessionRecovery,
  type RecoveryStorage,
} from "./active-session-recovery";

describe("active session recovery", () => {
  it("restores an unsaved playing session after an app remount", () => {
    const storage = createMemoryStorage();
    const battle = createBattle();
    const mission = createMissionState(
      survivalTestScenario,
      battle.armies,
      battle.armies[0].id,
    );
    const scenarioDraft = restartDraftFromBattle(
      battle,
      survivalTestScenario.id,
      mission.defenderArmyId,
    );

    saveActiveSessionRecovery({
      view: "battle",
      gamePhase: "Playing",
      battle,
      battleStartSnapshot: structuredClone(battle),
      scenarioDraft,
      mission,
      logs: [{ id: "log-1", turn: 1, message: "Scenario started." }],
      activeArmyId: battle.armies[0].id,
      selectedUnitId: battle.armies[0].units[0].id,
      targetUnitId: "",
      selectedWeaponId: "",
      selectedOrder: "Move",
      armyJson: "[]",
      debugMode: false,
    }, storage);

    expect(loadActiveSessionRecovery(storage)).toMatchObject({
      schemaVersion: 1,
      view: "battle",
      gamePhase: "Playing",
      battle: { id: battle.id },
      mission: { scenarioId: survivalTestScenario.id },
      selectedUnitId: battle.armies[0].units[0].id,
    });
  });

  it("discards a corrupt recovery snapshot", () => {
    const storage = createMemoryStorage();
    storage.setItem("lego-star-wars-battles:recovery:active-session", "{broken");

    expect(loadActiveSessionRecovery(storage)).toBeUndefined();
    expect(storage.getItem("lego-star-wars-battles:recovery:active-session")).toBeNull();
  });

  it("discards a recovery snapshot with an unsupported app view", () => {
    const storage = createMemoryStorage();
    storage.setItem("lego-star-wars-battles:recovery:active-session", JSON.stringify({
      schemaVersion: 1,
      view: "unknown-view",
      gamePhase: "Playing",
      battle: {},
      scenarioDraft: {},
      mission: {},
      logs: [],
      selectedUnitId: "",
      targetUnitId: "",
      selectedWeaponId: "",
      selectedOrder: "Move",
      armyJson: "[]",
      debugMode: false,
    }));

    expect(loadActiveSessionRecovery(storage)).toBeUndefined();
    expect(storage.getItem("lego-star-wars-battles:recovery:active-session")).toBeNull();
  });

  it("clears recovery when the active scenario is abandoned", () => {
    const storage = createMemoryStorage();
    storage.setItem("lego-star-wars-battles:recovery:active-session", "snapshot");

    clearActiveSessionRecovery(storage);

    expect(storage.getItem("lego-star-wars-battles:recovery:active-session")).toBeNull();
  });
});

function createMemoryStorage(): RecoveryStorage {
  const records = new Map<string, string>();
  return {
    getItem(key) {
      return records.get(key) ?? null;
    },
    removeItem(key) {
      records.delete(key);
    },
    setItem(key, value) {
      records.set(key, value);
    },
  };
}
