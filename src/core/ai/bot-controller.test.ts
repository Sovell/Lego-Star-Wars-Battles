import { describe, expect, it } from "vitest";
import type { Battle } from "../../types";
import { createBattle } from "../battle-state";
import { createMissionState } from "../scenario/scenario-engine";
import { survivalTestScenario } from "../scenario/scenarios";
import {
  runBotActivation,
  type BotActionSelector,
} from "./bot-controller";

const attackerArmyId = "army_separatists";

describe("bot controller", () => {
  it("executes a selected action through the mission engine", () => {
    const battle = readyAttackerBattle();

    const result = runBotActivation({
      session: createSession(battle),
      scenario: survivalTestScenario,
      armyId: attackerArmyId,
      chooseAction: () => ({
        action: { type: "ApplyOrder", unitId: "sep_unit_1", order: "Overwatch" },
        reason: "Waits for a target.",
      }),
    });

    expect(result.stopReason).toBe("activation-completed");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].decision.reason).toBe("Waits for a target.");
    expect(result.steps[0].result.events).toContainEqual({
      type: "OrderApplied",
      unitId: "sep_unit_1",
      order: "Overwatch",
    });
    expect(result.battle.activeActivation).toBeUndefined();
  });

  it("passes updated state back to the strategy until the activation ends", () => {
    const battle = readyAttackerBattle();
    const chooseAction: BotActionSelector = (currentBattle) => {
      const unit = currentBattle.armies
        .flatMap((army) => army.units)
        .find((candidate) => candidate.id === "sep_unit_1");

      return unit?.activeEffects?.includes("advance_pending")
        ? {
            action: { type: "ApplyOrder", unitId: unit.id, order: "Advance" },
            reason: "Finishes Advance.",
          }
        : {
            action: {
              type: "AdvanceUnit",
              unitId: "sep_unit_1",
              targetPosition: { x: 5, y: 2 },
            },
            reason: "Advances.",
          };
    };

    const result = runBotActivation({
      session: createSession(battle),
      scenario: survivalTestScenario,
      armyId: attackerArmyId,
      chooseAction,
    });

    expect(result.stopReason).toBe("activation-completed");
    expect(result.steps.map((step) => step.decision.action.type)).toEqual([
      "AdvanceUnit",
      "ApplyOrder",
    ]);
    expect(result.battle.activeActivation).toBeUndefined();
  });

  it("stops without changing state when the strategy finds no action", () => {
    const battle = readyAttackerBattle();
    const session = createSession(battle);

    const result = runBotActivation({
      session,
      scenario: survivalTestScenario,
      armyId: attackerArmyId,
      chooseAction: () => undefined,
    });

    expect(result.stopReason).toBe("no-legal-action");
    expect(result.steps).toEqual([]);
    expect(result.battle).toBe(battle);
    expect(result.mission).toBe(session.mission);
  });

  it("stops after the engine rejects a strategy decision", () => {
    const battle = readyAttackerBattle();

    const result = runBotActivation({
      session: createSession(battle),
      scenario: survivalTestScenario,
      armyId: attackerArmyId,
      chooseAction: () => ({
        action: { type: "ApplyOrder", unitId: "rep_unit_1", order: "Overwatch" },
        reason: "Invalid decision.",
      }),
    });

    expect(result.stopReason).toBe("action-rejected");
    expect(result.steps).toHaveLength(1);
    expect(result.battle).toBe(battle);
  });

  it("stops a multi-step activation at the configured safety limit", () => {
    const battle = readyAttackerBattle();

    const result = runBotActivation({
      session: createSession(battle),
      scenario: survivalTestScenario,
      armyId: attackerArmyId,
      maxSteps: 1,
      chooseAction: () => ({
        action: {
          type: "AdvanceUnit",
          unitId: "sep_unit_1",
          targetPosition: { x: 5, y: 2 },
        },
        reason: "Advances.",
      }),
    });

    expect(result.stopReason).toBe("step-limit");
    expect(result.steps).toHaveLength(1);
    expect(result.battle.activeActivation?.armyId).toBe(attackerArmyId);
  });

  it("does not call the strategy for another army's activation", () => {
    const battle = readyAttackerBattle("army_republic");
    let strategyCalled = false;

    const result = runBotActivation({
      session: createSession(battle),
      scenario: survivalTestScenario,
      armyId: attackerArmyId,
      chooseAction: () => {
        strategyCalled = true;
        return undefined;
      },
    });

    expect(result.stopReason).toBe("inactive-army");
    expect(strategyCalled).toBe(false);
    expect(result.steps).toEqual([]);
  });
});

function createSession(battle: Battle) {
  return {
    battle,
    mission: createMissionState(
      survivalTestScenario,
      battle.armies,
      "army_republic",
    ),
  };
}

function readyAttackerBattle(activeArmyId = attackerArmyId): Battle {
  const battle = createBattle();
  const activeArmy = battle.armies.find((army) => army.id === activeArmyId);
  if (!activeArmy) throw new Error(`Unknown army: ${activeArmyId}`);

  return {
    ...battle,
    activeActivation: {
      id: "bot-token",
      armyId: activeArmy.id,
      faction: activeArmy.faction,
      used: true,
    },
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit, index) => ({
        ...unit,
        status: army.id === attackerArmyId && index > 0 ? "Activated" : unit.status,
      })),
    })),
  };
}
