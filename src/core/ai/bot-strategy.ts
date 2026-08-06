import type { Battle } from "../../types";
import type { LegalUnitAction } from "../legal-actions";
import { getLegalUnitActions } from "../legal-actions";
import { getUnitActiveAbilities } from "../rules/active-abilities";
import { findUnit, getTemplate } from "../rules/state";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import { chooseBestBotAction, estimateMaximumDamage } from "./bot-action-scoring";
import type { BotDecision } from "./bot-controller";
import type { BotDoctrine } from "./bot-doctrine";
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
): BotDecision | undefined {
  const context = createBotStrategyContext(battle, scenario, armyId, doctrine, mission);
  if (!context) return undefined;

  const actions = context.units.flatMap((unit) =>
    getLegalUnitActions(battle, scenario, unit.id)
  );
  const best = chooseBestBotAction(actions, context);
  return best ? describeDecision(best.action, context) : undefined;
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
      return unit && target && ability
        ? {
            action,
            reason: `${getTemplate(unit).name} wykorzystuje zdolność ${ability.name} przeciw ${getTemplate(target).name}.`,
          }
        : undefined;
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
