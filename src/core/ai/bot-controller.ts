import type { Battle } from "../../types";
import type { BattleAction } from "../battle-actions";
import {
  applyMissionAction,
  type MissionActionContext,
  type MissionActionResult,
  type MissionSessionState,
} from "../scenario/mission-session";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";

export type BotDecision = {
  action: BattleAction;
  reason: string;
};

export type BotDecisionContext = {
  seed: string;
  step: number;
};

export type BotActionSelector = (
  battle: Battle,
  scenario: ScenarioDefinition,
  armyId: string,
  mission: MissionState,
  decisionContext: BotDecisionContext,
) => BotDecision | undefined;

export type BotActivationStopReason =
  | "activation-completed"
  | "inactive-army"
  | "no-legal-action"
  | "action-rejected"
  | "step-limit";

export type BotActivationStep = {
  decision: BotDecision;
  decisionContext: BotDecisionContext;
  battleBeforeAction: Battle;
  result: MissionActionResult;
};

export type BotActivationResult = MissionSessionState & {
  steps: BotActivationStep[];
  stopReason: BotActivationStopReason;
};

export type RunBotActivationOptions = {
  session: MissionSessionState;
  scenario: ScenarioDefinition;
  armyId: string;
  chooseAction: BotActionSelector;
  maxSteps?: number;
  decisionSeed?: string | number;
  actionContext?: MissionActionContext;
};

/**
 * Executes one complete bot activation through the mission engine.
 * The injected selector owns strategy; this controller owns execution and loop safety.
 */
export function runBotActivation({
  session,
  scenario,
  armyId,
  chooseAction,
  maxSteps = 8,
  decisionSeed,
  actionContext,
}: RunBotActivationOptions): BotActivationResult {
  if (session.battle.activeActivation?.armyId !== armyId) {
    return {
      ...session,
      steps: [],
      stopReason: "inactive-army",
    };
  }

  let currentSession = session;
  const steps: BotActivationStep[] = [];
  const safeStepLimit = Math.max(0, Math.floor(maxSteps));
  const baseDecisionSeed = String(
    decisionSeed ??
      `${session.battle.id}:${session.battle.turn}:${session.battle.activeActivation.id}:${armyId}`,
  );

  for (let step = 0; step < safeStepLimit; step += 1) {
    if (currentSession.battle.activeActivation?.armyId !== armyId) {
      return {
        ...currentSession,
        steps,
        stopReason: "activation-completed",
      };
    }

    const decisionContext: BotDecisionContext = {
      seed: `${baseDecisionSeed}:${step}`,
      step,
    };
    const decision = chooseAction(
      currentSession.battle,
      scenario,
      armyId,
      currentSession.mission,
      decisionContext,
    );
    if (!decision) {
      return {
        ...currentSession,
        steps,
        stopReason: "no-legal-action",
      };
    }

    const battleBeforeAction = currentSession.battle;
    const result = applyMissionAction(
      currentSession,
      scenario,
      decision.action,
      actionContext,
    );
    steps.push({ decision, decisionContext, battleBeforeAction, result });
    currentSession = { battle: result.battle, mission: result.mission };

    if (result.battle === battleBeforeAction) {
      return {
        ...currentSession,
        steps,
        stopReason: "action-rejected",
      };
    }
  }

  return {
    ...currentSession,
    steps,
    stopReason: currentSession.battle.activeActivation?.armyId === armyId
      ? "step-limit"
      : "activation-completed",
  };
}
