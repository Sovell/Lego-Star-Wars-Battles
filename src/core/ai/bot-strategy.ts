import type { Battle } from "../../types";
import type { LegalUnitAction } from "../legal-actions";
import { getLegalUnitActions } from "../legal-actions";
import { getUnitActiveAbilities } from "../rules/active-abilities";
import { findUnit, getTemplate } from "../rules/state";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import { chooseBestBotAction, estimateMaximumDamage } from "./bot-action-scoring";
import type { BotDecision, BotDecisionContext } from "./bot-controller";
import {
  getBotDoctrine,
  type BotDoctrine,
  type BotProfileId,
} from "./bot-doctrine";
import {
  createBotStrategyContext,
  type BotStrategyContext,
} from "./bot-strategy-context";

/**
 * Builds and ranks one shared candidate list. Scenario intent comes from the
 * strategy context; tactical preferences come exclusively from the doctrine.
 */
export function chooseDoctrineBotAction(
  battle: Battle,
  scenario: ScenarioDefinition,
  armyId: string,
  doctrine: BotDoctrine,
  mission?: MissionState,
  decisionContext?: BotDecisionContext,
): BotDecision | undefined {
  const context = createBotStrategyContext(
    battle,
    scenario,
    armyId,
    doctrine,
    mission,
    decisionContext,
  );
  if (!context) return undefined;

  const actions = context.units.flatMap((unit) =>
    getLegalUnitActions(battle, scenario, unit.id)
  );
  const best = chooseBestBotAction(actions, context) ?? chooseFallbackBotAction(actions, context);
  return best ? describeDecision(best.action, context) : undefined;
}

/** Neutral entry point used by every bot role and scenario. */
export function chooseBotAction(
  battle: Battle,
  scenario: ScenarioDefinition,
  armyId: string,
  profile: BotProfileId,
  mission?: MissionState,
  decisionContext?: BotDecisionContext,
): BotDecision | undefined {
  return chooseDoctrineBotAction(
    battle,
    scenario,
    armyId,
    getBotDoctrine(profile),
    mission,
    decisionContext,
  );
}

/**
 * The scoring model is intentionally strict: an action without a useful
 * tactical score is rejected. A live battle must nevertheless never lose a
 * bot activation just because an unusual map or restored state gives every
 * candidate that strict score. Prefer a legal move, then a legal attack or
 * order, using the current strategic target as a deterministic tiebreaker.
 */
function chooseFallbackBotAction(
  actions: LegalUnitAction[],
  context: BotStrategyContext,
) {
  const movement = actions.filter(
    (action): action is Extract<LegalUnitAction, { type: "MoveUnit" | "AdvanceUnit" }> =>
      action.type === "MoveUnit" || action.type === "AdvanceUnit",
  );
  const target = context.movementTarget ?? {
    x: Math.floor((context.battle.board.width - 1) / 2),
    y: Math.floor((context.battle.board.height - 1) / 2),
  };
  const fallbackMovement = [...movement].sort((left, right) => {
    const leftDistance = distanceToTarget(left.targetPosition, target);
    const rightDistance = distanceToTarget(right.targetPosition, target);
    return leftDistance - rightDistance ||
      Number(left.type === "AdvanceUnit") - Number(right.type === "AdvanceUnit") ||
      left.targetPosition.y - right.targetPosition.y ||
      left.targetPosition.x - right.targetPosition.x ||
      left.unitId.localeCompare(right.unitId);
  })[0];
  if (fallbackMovement) return { action: fallbackMovement, score: Number.NEGATIVE_INFINITY };

  const executable = actions.find((action) =>
    action.type === "Attack" || action.type === "AttackObject" || action.type === "ApplyOrder"
  );
  return executable ? { action: executable, score: Number.NEGATIVE_INFINITY } : undefined;
}

function distanceToTarget(
  position: { x: number; y: number },
  target: { x: number; y: number },
): number {
  return Math.max(Math.abs(position.x - target.x), Math.abs(position.y - target.y));
}

function describeDecision(
  action: LegalUnitAction,
  context: BotStrategyContext,
): BotDecision | undefined {
  const { battle, doctrine } = context;
  switch (action.type) {
    case "AttackObject": {
      const attacker = findUnit(battle, action.attackerId);
      const target = battle.board.objects?.find((object) => object.id === action.objectId);
      return attacker && target
        ? {
            action,
            reason: `${getTemplate(attacker).name} atakuje cel scenariusza: ${target.name}.`,
          }
        : undefined;
    }
    case "Attack": {
      const attacker = findUnit(battle, action.attackerId);
      const defender = findUnit(battle, action.defenderId);
      const weapon = attacker
        ? getTemplate(attacker).weapons.find((candidate) => candidate.id === action.weaponId)
        : undefined;
      if (!attacker || !defender || !weapon) return undefined;
      if (doctrine.objectivePolicy === "Hold") {
        return {
          action,
          reason: `${getTemplate(attacker).name} odpiera zagrożenie: ${getTemplate(defender).name}.`,
        };
      }
      return {
        action,
        reason: estimateMaximumDamage(weapon) >= defender.currentHp
          ? `${getTemplate(attacker).name} ma szanse wyeliminowac ${getTemplate(defender).name}.`
          : `${getTemplate(attacker).name} wybiera najlepszy dostepny cel: ${getTemplate(defender).name}.`,
      };
    }
    case "UseAbility": {
      const unit = findUnit(battle, action.unitId);
      const target = action.targetUnitId ? findUnit(battle, action.targetUnitId) : undefined;
      const ability = unit
        ? getUnitActiveAbilities(battle, unit).find((candidate) => candidate.id === action.abilityId)
        : undefined;
      if (!unit || !ability) return undefined;
      if (target) {
        return {
          action,
          reason: `${getTemplate(unit).name} wykorzystuje zdolność ${ability.name} przeciw ${getTemplate(target).name}.`,
        };
      }
      if (action.targetPosition) {
        return {
          action,
          reason: `${getTemplate(unit).name} wykorzystuje zdolność ${ability.name} na polu ${action.targetPosition.x}, ${action.targetPosition.y}.`,
        };
      }
      return {
        action,
        reason: `${getTemplate(unit).name} wykorzystuje zdolność ${ability.name}.`,
      };
    }
    case "DeployUnit": {
      const unit = findUnit(battle, action.unitId);
      if (!unit) return undefined;
      return {
        action,
        reason: doctrine.objectivePolicy === "Hold"
          ? `${getTemplate(unit).name} wchodzi z rezerwy, aby wzmocnić obronę.`
          : `${getTemplate(unit).name} wchodzi z rezerwy przez strefę rozmieszczenia.`,
      };
    }
    case "MoveUnit":
    case "AdvanceUnit": {
      const unit = findUnit(battle, action.unitId);
      if (!unit) return undefined;
      const objectiveName = context.objectiveName;
      return {
        action,
        reason: doctrine.objectivePolicy === "Hold"
          ? `${getTemplate(unit).name} zajmuje pozycję przy celu: ${objectiveName ?? "linia obrony"}.`
          : objectiveName
            ? `${getTemplate(unit).name} zbliża się do celu scenariusza: ${objectiveName}.`
            : `${getTemplate(unit).name} zbliża się do najbliższego przeciwnika.`,
      };
    }
    case "ApplyOrder": {
      const unit = findUnit(battle, action.unitId);
      if (!unit) return undefined;
      if (action.order === "Advance") {
        return {
          action,
          reason: doctrine.objectivePolicy === "Hold"
            ? `${getTemplate(unit).name} kończy manewr obronny Advance.`
            : `${getTemplate(unit).name} kończy Advance bez dostępnego celu.`,
        };
      }
      if (action.order === "Rally") {
        return {
          action,
          reason: doctrine.objectivePolicy === "Hold"
            ? `${getTemplate(unit).name} porządkuje linię obrony.`
            : `${getTemplate(unit).name} porządkuje szyki i usuwa suppression.`,
        };
      }
      return {
        action,
        reason: doctrine.objectivePolicy === "Hold"
          ? `${getTemplate(unit).name} utrzymuje pozycję w trybie Overwatch.`
          : `${getTemplate(unit).name} nie ma legalnego celu ani lepszej pozycji i pozostaje w gotowości.`,
      };
    }
  }
}
