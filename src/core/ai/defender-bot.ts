import type { Battle, BattlefieldObject } from "../../types";
import {
  getLegalUnitActions,
  type LegalAttackAction,
  type LegalOrderAction,
  type LegalPositionAction,
} from "../legal-actions";
import { findUnit, getTemplate } from "../rules/state";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import {
  chooseBestBotAction,
  type BotActionScoringContext,
} from "./bot-action-scoring";
import type { BotDecision } from "./bot-controller";
import { defensiveBotDoctrine } from "./bot-doctrine";

/** Selects a legal action that prioritizes holding the scenario objective. */
export function chooseDefenderBotAction(
  battle: Battle,
  scenario: ScenarioDefinition,
  defenderArmyId: string,
  mission?: MissionState,
): BotDecision | undefined {
  if (battle.activeActivation?.armyId !== defenderArmyId) return undefined;

  const availableDefenders = battle.armies
    .find((army) => army.id === defenderArmyId)
    ?.units.filter((unit) => unit.status !== "Activated" && unit.status !== "Destroyed") ?? [];
  const pendingAdvanceUnit = availableDefenders.find((unit) =>
    unit.activeEffects?.includes("advance_pending")
  );
  const defenders = pendingAdvanceUnit ? [pendingAdvanceUnit] : availableDefenders;
  if (defenders.length === 0) return undefined;

  const objective = getDefensiveObjective(battle, scenario, mission, defenderArmyId);
  const scoringContext: BotActionScoringContext = {
    battle,
    doctrine: defensiveBotDoctrine,
    movementTarget: objective?.position,
  };
  const legalActions = defenders.flatMap((unit) =>
    getLegalUnitActions(battle, scenario, unit.id)
  );

  const attack = chooseBestBotAction(
    legalActions.filter(
      (action): action is Extract<LegalAttackAction, { type: "Attack" }> =>
        action.type === "Attack"
    ),
    scoringContext,
  );
  if (attack) {
    const attacker = findUnit(battle, attack.action.attackerId);
    const defender = findUnit(battle, attack.action.defenderId);
    return attacker && defender
      ? {
          action: attack.action,
          reason: `${getTemplate(attacker).name} odpiera zagrożenie: ${getTemplate(defender).name}.`,
        }
      : undefined;
  }

  if (pendingAdvanceUnit) {
    const finishAdvance = legalActions.find(
      (action): action is LegalOrderAction =>
        action.type === "ApplyOrder" &&
        action.unitId === pendingAdvanceUnit.id &&
        action.order === "Advance"
    );
    return finishAdvance
      ? {
          action: finishAdvance,
          reason: `${getTemplate(pendingAdvanceUnit).name} kończy manewr obronny Advance.`,
        }
      : undefined;
  }

  const deployment = chooseBestBotAction(
    legalActions.filter(
      (action): action is Extract<LegalPositionAction, { type: "DeployUnit" }> =>
        action.type === "DeployUnit"
    ),
    scoringContext,
  );
  if (deployment) {
    const unit = findUnit(battle, deployment.action.unitId);
    return unit
      ? {
          action: deployment.action,
          reason: `${getTemplate(unit).name} wchodzi z rezerwy, aby wzmocnić obronę.`,
        }
      : undefined;
  }

  const movement = chooseBestBotAction(
    legalActions.filter(
      (action): action is Extract<LegalPositionAction, { type: "AdvanceUnit" }> =>
        action.type === "AdvanceUnit"
    ),
    scoringContext,
  );
  if (movement) {
    const unit = findUnit(battle, movement.action.unitId);
    return unit && objective
      ? {
          action: movement.action,
          reason: `${getTemplate(unit).name} zajmuje pozycję przy celu: ${objective.name}.`,
        }
      : undefined;
  }

  const order = chooseBestBotAction(
    legalActions.filter((action): action is LegalOrderAction => action.type === "ApplyOrder"),
    scoringContext,
  );
  if (!order) return undefined;
  const unit = findUnit(battle, order.action.unitId);
  if (!unit) return undefined;
  return {
    action: order.action,
    reason: order.action.order === "Rally"
      ? `${getTemplate(unit).name} porządkuje linię obrony.`
      : `${getTemplate(unit).name} utrzymuje pozycję w trybie Overwatch.`,
  };
}

function getDefensiveObjective(
  battle: Battle,
  scenario: ScenarioDefinition,
  _mission: MissionState | undefined,
  _defenderArmyId: string,
): BattlefieldObject | undefined {
  const type = scenario.victoryCondition.type === "ProtectObject"
    ? scenario.victoryCondition.objectType
    : scenario.victoryCondition.type === "DefendPoint"
      ? scenario.victoryCondition.objectiveType
      : scenario.victoryCondition.type === "ControlTerritory"
        ? "StrategicPoint"
        : undefined;
  return type
    ? battle.board.objects?.find(
        (object) => object.type === type && object.status === "Active"
      )
    : undefined;
}
