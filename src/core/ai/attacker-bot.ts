import type { Battle, BattlefieldObject, UnitInstance } from "../../types";
import { areArmiesAllied, areArmiesEnemies } from "../army-relations";
import {
  getLegalUnitActions,
  type LegalAbilityAction,
  type LegalAttackAction,
  type LegalOrderAction,
  type LegalPositionAction,
} from "../legal-actions";
import { distance, type GridPosition } from "../rules/geometry";
import { getUnitActiveAbilities } from "../rules/active-abilities";
import { findUnit, getTemplate } from "../rules/state";
import { isPositionFree } from "../rules/occupancy";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import {
  chooseBestBotAction,
  estimateMaximumDamage,
  type BotActionScoringContext,
} from "./bot-action-scoring";
import type { BotDecision } from "./bot-controller";
import { aggressiveBotDoctrine } from "./bot-doctrine";

export type { BotDecision } from "./bot-controller";

/** Selects one legal action using the aggressive doctrine. */
export function chooseAttackerBotAction(
  battle: Battle,
  scenario: ScenarioDefinition,
  attackerArmyId: string,
  mission?: MissionState,
): BotDecision | undefined {
  if (battle.activeActivation?.armyId !== attackerArmyId) return undefined;

  const availableAttackers = battle.armies
    .find((army) => army.id === attackerArmyId)
    ?.units.filter((unit) => unit.status !== "Activated" && unit.status !== "Destroyed") ?? [];
  const pendingAdvanceUnit = availableAttackers.find((unit) =>
    unit.activeEffects?.includes("advance_pending")
  );
  const attackers = pendingAdvanceUnit ? [pendingAdvanceUnit] : availableAttackers;
  if (attackers.length === 0) return undefined;

  const objective = getAttackObjective(battle, scenario);
  const movementTarget = objective?.position ??
    findTerritoryTarget(battle, scenario, mission, attackers, attackerArmyId) ??
    findNearestEnemyPosition(battle, attackers, attackerArmyId);
  const scoringContext: BotActionScoringContext = {
    battle,
    doctrine: aggressiveBotDoctrine,
    movementTarget,
    objectiveObjectId: objective?.id,
  };
  const legalActions = attackers.flatMap((attacker) =>
    getLegalUnitActions(battle, scenario, attacker.id)
  );

  const ability = chooseBestBotAction(
    legalActions.filter((action): action is LegalAbilityAction => action.type === "UseAbility"),
    scoringContext,
  );
  if (ability) return describeAbility(battle, ability.action);

  const objectAttack = objective?.destructible && objective.status === "Active"
    ? chooseBestBotAction(
        legalActions.filter(
          (action): action is Extract<LegalAttackAction, { type: "AttackObject" }> =>
            action.type === "AttackObject" && action.objectId === objective.id
        ),
        scoringContext,
      )
    : undefined;
  if (objectAttack) {
    const attacker = findUnit(battle, objectAttack.action.attackerId);
    return attacker
      ? {
          action: objectAttack.action,
          reason: `${getTemplate(attacker).name} atakuje cel scenariusza: ${objective!.name}.`,
        }
      : undefined;
  }

  const unitAttack = chooseBestBotAction(
    legalActions.filter(
      (action): action is Extract<LegalAttackAction, { type: "Attack" }> =>
        action.type === "Attack"
    ),
    scoringContext,
  );
  if (unitAttack) return describeUnitAttack(battle, unitAttack.action);

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
          reason: `${getTemplate(pendingAdvanceUnit).name} kończy Advance bez dostępnego celu.`,
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
          reason: `${getTemplate(unit).name} wchodzi z rezerwy przez strefę rozmieszczenia.`,
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
    return unit
      ? {
          action: movement.action,
          reason: objective
            ? `${getTemplate(unit).name} zbliża się do celu scenariusza: ${objective.name}.`
            : `${getTemplate(unit).name} zbliża się do najbliższego przeciwnika.`,
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
      ? `${getTemplate(unit).name} porządkuje szyki i usuwa suppression.`
      : `${getTemplate(unit).name} nie ma legalnego celu ani lepszej pozycji i pozostaje w gotowości.`,
  };
}

function describeAbility(
  battle: Battle,
  action: LegalAbilityAction,
): BotDecision | undefined {
  const attacker = findUnit(battle, action.unitId);
  const target = action.targetUnitId ? findUnit(battle, action.targetUnitId) : undefined;
  const ability = attacker
    ? getUnitActiveAbilities(battle, attacker).find((candidate) => candidate.id === action.abilityId)
    : undefined;
  return attacker && target && ability
    ? {
        action,
        reason: `${getTemplate(attacker).name} wykorzystuje zdolność ${ability.name} przeciw ${getTemplate(target).name}.`,
      }
    : undefined;
}

function describeUnitAttack(
  battle: Battle,
  action: Extract<LegalAttackAction, { type: "Attack" }>,
): BotDecision | undefined {
  const attacker = findUnit(battle, action.attackerId);
  const defender = findUnit(battle, action.defenderId);
  const weapon = attacker
    ? getTemplate(attacker).weapons.find((candidate) => candidate.id === action.weaponId)
    : undefined;
  if (!attacker || !defender || !weapon) return undefined;
  const lethal = estimateMaximumDamage(weapon) >= defender.currentHp;
  return {
    action,
    reason: lethal
      ? `${getTemplate(attacker).name} ma szanse wyeliminowac ${getTemplate(defender).name}.`
      : `${getTemplate(attacker).name} wybiera najlepszy dostepny cel: ${getTemplate(defender).name}.`,
  };
}

function findTerritoryTarget(
  battle: Battle,
  scenario: ScenarioDefinition,
  mission: MissionState | undefined,
  attackers: UnitInstance[],
  attackerArmyId: string,
): GridPosition | undefined {
  if (scenario.victoryCondition.type !== "ControlTerritory") return undefined;
  const origins = attackers.flatMap((unit) => unit.position ? [unit.position] : []);
  const candidates: GridPosition[] = [];
  for (let y = 0; y < battle.board.height; y += 1) {
    for (let x = 0; x < battle.board.width; x += 1) {
      if (
        !isTerritoryOwnedByTeam(battle, mission, { x, y }, attackerArmyId) &&
        isPositionFree(battle, { x, y })
      ) {
        candidates.push({ x, y });
      }
    }
  }
  return candidates.sort((left, right) => {
    const strategicDifference = Number(isStrategicPosition(battle, right)) -
      Number(isStrategicPosition(battle, left));
    if (strategicDifference !== 0) return strategicDifference;
    const leftDistance = Math.min(...origins.map((origin) => distance(origin, left)));
    const rightDistance = Math.min(...origins.map((origin) => distance(origin, right)));
    return leftDistance - rightDistance;
  })[0];
}

function isStrategicPosition(battle: Battle, position: GridPosition): boolean {
  return Boolean(battle.board.objects?.some(
    (object) =>
      object.type === "StrategicPoint" &&
      object.status === "Active" &&
      object.position.x === position.x &&
      object.position.y === position.y
  ));
}

function getAttackObjective(
  battle: Battle,
  scenario: ScenarioDefinition,
): BattlefieldObject | undefined {
  const objectiveType = scenario.victoryCondition.type === "ProtectObject"
    ? scenario.victoryCondition.objectType
    : scenario.victoryCondition.type === "DefendPoint"
      ? scenario.victoryCondition.objectiveType
      : undefined;
  return objectiveType
    ? battle.board.objects?.find(
        (object) => object.type === objectiveType && object.status === "Active"
      )
    : undefined;
}

function findNearestEnemyPosition(
  battle: Battle,
  attackers: UnitInstance[],
  attackerArmyId: string,
): GridPosition | undefined {
  const origins = attackers.flatMap((unit) => unit.position ? [unit.position] : []);
  const enemies = battle.armies
    .filter((army) => areArmiesEnemies(battle, army.id, attackerArmyId))
    .flatMap((army) => army.units)
    .filter((unit) => unit.status !== "Destroyed")
    .flatMap((unit) => unit.position ? [unit.position] : []);
  return enemies.sort((left, right) => {
    const leftDistance = Math.min(...origins.map((origin) => distance(origin, left)));
    const rightDistance = Math.min(...origins.map((origin) => distance(origin, right)));
    return leftDistance - rightDistance;
  })[0];
}

function isTerritoryOwnedByTeam(
  battle: Battle,
  mission: MissionState | undefined,
  position: GridPosition,
  armyId: string,
): boolean {
  const ownerArmyId = mission?.territoryOwners?.[`${position.x},${position.y}`];
  return ownerArmyId ? areArmiesAllied(battle, ownerArmyId, armyId) : false;
}
