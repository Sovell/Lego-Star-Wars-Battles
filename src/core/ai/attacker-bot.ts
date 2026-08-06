import type {
  Battle,
  BattlefieldObject,
  UnitInstance,
  WeaponProfile,
} from "../../types";
import type { BattleAction } from "../battle-actions";
import { areArmiesAllied, areArmiesEnemies } from "../army-relations";
import {
  getLegalUnitActions,
  type LegalAttackAction,
  type LegalUnitAction,
} from "../legal-actions";
import { distance, type GridPosition } from "../rules/geometry";
import { getTemplate } from "../rules/state";
import { getDefenseBonus } from "../rules/terrain";
import { isPositionFree } from "../rules/occupancy";
import { getUnitActiveAbilities } from "../rules/active-abilities";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import type { BotDecision } from "./bot-controller";

export type { BotDecision } from "./bot-controller";

type UnitAttackOption = {
  action: Extract<BattleAction, { type: "Attack" }>;
  attacker: UnitInstance;
  defender: UnitInstance;
  weapon: WeaponProfile;
  score: number;
};

type ObjectAttackOption = {
  action: Extract<BattleAction, { type: "AttackObject" }>;
  attacker: UnitInstance;
  target: BattlefieldObject;
  weapon: WeaponProfile;
  score: number;
};

/**
 * Selects one legal action for the currently drawn attacking-army token.
 * The battle engine remains the authority that validates and applies the action.
 */
export function chooseAttackerBotAction(
  battle: Battle,
  scenario: ScenarioDefinition,
  attackerArmyId: string,
  mission?: MissionState,
): BotDecision | undefined {
  if (battle.activeActivation?.armyId !== attackerArmyId) {
    return undefined;
  }

  const availableAttackers = battle.armies
    .find((army) => army.id === attackerArmyId)
    ?.units.filter((unit) => unit.status !== "Activated" && unit.status !== "Destroyed") ?? [];
  const pendingAdvanceUnit = availableAttackers.find((unit) =>
    unit.activeEffects?.includes("advance_pending"),
  );
  const attackers = pendingAdvanceUnit ? [pendingAdvanceUnit] : availableAttackers;
  if (attackers.length === 0) {
    return undefined;
  }

  const objective = getAttackObjective(battle, scenario);
  const legalActions = attackers.flatMap((attacker) =>
    getLegalUnitActions(battle, scenario, attacker.id)
  );
  const legalAttacks = legalActions.filter(
    (action): action is LegalAttackAction =>
      action.type === "Attack" || action.type === "AttackObject",
  );
  const abilityDecision = chooseOffensiveAbility(
    battle,
    attackers,
    attackerArmyId,
    legalActions,
  );
  if (abilityDecision) {
    return abilityDecision;
  }
  const objectAttack = chooseBestObjectAttack(battle, legalAttacks, objective);
  if (objectAttack) {
    return {
      action: objectAttack.action,
      reason: `${getTemplate(objectAttack.attacker).name} atakuje cel scenariusza: ${objectAttack.target.name}.`,
    };
  }

  const unitAttack = chooseBestUnitAttack(battle, legalAttacks);
  if (unitAttack) {
    const lethal = estimateMaximumDamage(unitAttack.weapon) >= unitAttack.defender.currentHp;
    return {
      action: unitAttack.action,
      reason: lethal
        ? `${getTemplate(unitAttack.attacker).name} ma szanse wyeliminowac ${getTemplate(unitAttack.defender).name}.`
        : `${getTemplate(unitAttack.attacker).name} wybiera najlepszy dostepny cel: ${getTemplate(unitAttack.defender).name}.`,
    };
  }

  if (pendingAdvanceUnit) {
    const finishAdvance = legalActions.find(
      (action): action is Extract<BattleAction, { type: "ApplyOrder" }> =>
        action.type === "ApplyOrder" &&
        action.unitId === pendingAdvanceUnit.id &&
        action.order === "Advance",
    );
    if (!finishAdvance) return undefined;
    return {
      action: finishAdvance,
      reason: `${getTemplate(pendingAdvanceUnit).name} kończy Advance bez dostępnego celu.`,
    };
  }

  const movementTarget = objective?.position ??
    findTerritoryTarget(battle, scenario, mission, attackers, attackerArmyId) ??
    findNearestEnemyPosition(battle, attackers, attackerArmyId);
  const reserveDeployment = chooseBestReserveDeployment(
    battle,
    attackers,
    legalActions,
    movementTarget,
  );
  if (reserveDeployment) {
    return {
      action: {
        type: "DeployUnit",
        unitId: reserveDeployment.unit.id,
        targetPosition: reserveDeployment.position,
      },
      reason: `${getTemplate(reserveDeployment.unit).name} wchodzi z rezerwy przez strefę rozmieszczenia.`,
    };
  }
  if (movementTarget) {
    const movement = chooseBestMovement(battle, attackers, legalActions, movementTarget);
    if (movement) {
      return {
        action: {
          type: "AdvanceUnit",
          unitId: movement.unit.id,
          targetPosition: movement.position,
        },
        reason: objective
          ? `${getTemplate(movement.unit).name} zbliza sie do celu scenariusza: ${objective.name}.`
          : `${getTemplate(movement.unit).name} zbliza sie do najblizszego przeciwnika.`,
      };
    }
  }

  const legalOrders = legalActions.filter(
    (action): action is Extract<BattleAction, { type: "ApplyOrder" }> =>
      action.type === "ApplyOrder",
  );
  const rallyAction = legalOrders
    .filter((action) => action.order === "Rally")
    .sort((left, right) => {
      const leftSuppression = attackers.find((unit) => unit.id === left.unitId)?.suppression ?? 0;
      const rightSuppression = attackers.find((unit) => unit.id === right.unitId)?.suppression ?? 0;
      return rightSuppression - leftSuppression;
    })[0];
  const orderAction = rallyAction ?? legalOrders.find((action) => action.order === "Overwatch");
  if (!orderAction) return undefined;
  const unit = attackers.find((candidate) => candidate.id === orderAction.unitId);
  if (!unit) return undefined;

  return {
    action: orderAction,
    reason: orderAction.order === "Rally"
      ? `${getTemplate(unit).name} porzadkuje szyki i usuwa suppression.`
      : `${getTemplate(unit).name} nie ma legalnego celu ani lepszej pozycji i pozostaje w gotowosci.`,
  };
}

function chooseBestObjectAttack(
  battle: Battle,
  legalAttacks: LegalAttackAction[],
  objective: BattlefieldObject | undefined,
): ObjectAttackOption | undefined {
  if (!objective?.destructible || objective.status !== "Active") {
    return undefined;
  }

  return legalAttacks
    .filter((action): action is Extract<BattleAction, { type: "AttackObject" }> =>
      action.type === "AttackObject" && action.objectId === objective.id
    )
    .flatMap<ObjectAttackOption>((action) => {
      const attacker = battle.armies
        .flatMap((army) => army.units)
        .find((unit) => unit.id === action.attackerId);
      const weapon = attacker
        ? getTemplate(attacker).weapons.find((candidate) => candidate.id === action.weaponId)
        : undefined;
      if (!attacker || !weapon) return [];
      const lethalBonus = estimateMaximumDamage(weapon) >= objective.currentHp ? 10_000 : 0;
      return [{
        action,
        attacker,
        target: objective,
        weapon,
        score: 100_000 + lethalBonus + estimateExpectedDamage(weapon),
      }];
    })
    .sort((left, right) => right.score - left.score)[0];
}

function chooseBestUnitAttack(
  battle: Battle,
  legalAttacks: LegalAttackAction[],
): UnitAttackOption | undefined {
  const units = battle.armies.flatMap((army) => army.units);
  return legalAttacks
    .filter((action): action is Extract<BattleAction, { type: "Attack" }> =>
      action.type === "Attack"
    )
    .flatMap<UnitAttackOption>((action) => {
      const attacker = units.find((unit) => unit.id === action.attackerId);
      const defender = units.find((unit) => unit.id === action.defenderId);
      const weapon = attacker
        ? getTemplate(attacker).weapons.find((candidate) => candidate.id === action.weaponId)
        : undefined;
      if (!attacker || !defender || !weapon) return [];
      const maximumDamage = estimateMaximumDamage(weapon);
      const lethalBonus = maximumDamage >= defender.currentHp ? 10_000 : 0;
      const targetValue = getTemplate(defender).cost;
      const coverPenalty = getDefenseBonus(battle, defender) * 25;
      return [{
        action,
        attacker,
        defender,
        weapon,
        score:
          lethalBonus +
          estimateExpectedDamage(weapon) * 100 +
          targetValue -
          coverPenalty -
          defender.currentHp,
      }];
    })
    .sort((left, right) => right.score - left.score)[0];
}

function chooseBestMovement(
  battle: Battle,
  attackers: UnitInstance[],
  legalActions: LegalUnitAction[],
  target: GridPosition,
): { unit: UnitInstance; position: GridPosition; score: number } | undefined {
  return attackers
    .filter((unit) => unit.position)
    .flatMap((unit) => {
      const currentDistance = distance(unit.position!, target);
      return legalActions
        .filter((action): action is Extract<BattleAction, { type: "AdvanceUnit" }> =>
          action.type === "AdvanceUnit" && action.unitId === unit.id
        )
        .map((action) => action.targetPosition)
        .filter((position) => distance(position, target) < currentDistance)
        .map((position) => {
          const terrain = battle.board.tiles.find(
            (tile) => tile.x === position.x && tile.y === position.y,
          );
          return {
            unit,
            position,
            score:
              (currentDistance - distance(position, target)) * 1_000 +
              (terrain?.defenseBonus ?? 0) * 10 -
              distance(position, target),
          };
        });
    })
    .sort((left, right) => right.score - left.score)[0];
}

function chooseBestReserveDeployment(
  battle: Battle,
  attackers: UnitInstance[],
  legalActions: LegalUnitAction[],
  target?: GridPosition,
): { unit: UnitInstance; position: GridPosition; score: number } | undefined {
  const fallbackTarget = {
    x: Math.floor((battle.board.width - 1) / 2),
    y: Math.floor((battle.board.height - 1) / 2),
  };
  const deploymentTarget = target ?? fallbackTarget;

  return attackers
    .filter((unit) => !unit.position)
    .flatMap((unit) =>
      legalActions
        .filter((action): action is Extract<BattleAction, { type: "DeployUnit" }> =>
          action.type === "DeployUnit" && action.unitId === unit.id
        )
        .map((action) => ({
          unit,
          position: action.targetPosition,
          score: -distance(action.targetPosition, deploymentTarget),
        })),
    )
    .sort((left, right) => right.score - left.score)[0];
}

function chooseOffensiveAbility(
  battle: Battle,
  attackers: UnitInstance[],
  attackerArmyId: string,
  legalActions: LegalUnitAction[],
): BotDecision | undefined {
  const enemies = battle.armies
    .filter((army) => areArmiesEnemies(battle, army.id, attackerArmyId))
    .flatMap((army) => army.units)
    .filter((unit) => unit.status !== "Destroyed" && unit.position);

  for (const attacker of attackers) {
    if (!attacker.position) continue;
    const activeAbilities = getUnitActiveAbilities(battle, attacker).filter(
      (ability) =>
        (attacker.abilityCooldowns?.[ability.id] ?? 0) === 0,
    );

    for (const ability of activeAbilities) {
      if (
        ability.effect.type !== "direct_damage" &&
        ability.effect.type !== "damage_and_push" &&
        ability.effect.type !== "bonus_move_then_melee_attack"
      ) {
        continue;
      }
      const option = legalActions
        .filter((action): action is Extract<BattleAction, { type: "UseAbility" }> =>
          action.type === "UseAbility" &&
          action.unitId === attacker.id &&
          action.abilityId === ability.id
        )
        .flatMap((action) => {
          const target = action.targetUnitId
            ? enemies.find((enemy) => enemy.id === action.targetUnitId)
            : undefined;
          return target ? [{ action, target }] : [];
        })
        .sort((left, right) => left.target.currentHp - right.target.currentHp)[0];
      if (option) {
        return {
          action: option.action,
          reason: `${getTemplate(attacker).name} wykorzystuje zdolność ${ability.name} przeciw ${getTemplate(option.target).name}.`,
        };
      }
    }
  }

  return undefined;
}

function findTerritoryTarget(
  battle: Battle,
  scenario: ScenarioDefinition,
  mission: MissionState | undefined,
  attackers: UnitInstance[],
  attackerArmyId: string,
): GridPosition | undefined {
  if (scenario.victoryCondition.type !== "ControlTerritory") {
    return undefined;
  }
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
    const leftStrategic = isStrategicPosition(battle, left) ? 1 : 0;
    const rightStrategic = isStrategicPosition(battle, right) ? 1 : 0;
    if (leftStrategic !== rightStrategic) {
      return rightStrategic - leftStrategic;
    }
    const leftDistance = Math.min(...origins.map((origin) => distance(origin, left)));
    const rightDistance = Math.min(...origins.map((origin) => distance(origin, right)));
    return leftDistance - rightDistance;
  })[0];
}

function isStrategicPosition(battle: Battle, position: GridPosition): boolean {
  return Boolean(
    battle.board.objects?.some(
      (object) =>
        object.type === "StrategicPoint" &&
        object.status === "Active" &&
        object.position.x === position.x &&
        object.position.y === position.y,
    ),
  );
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
        (object) => object.type === objectiveType && object.status === "Active",
      )
    : undefined;
}

function findNearestEnemyPosition(
  battle: Battle,
  attackers: UnitInstance[],
  attackerArmyId: string,
): GridPosition | undefined {
  const attackerPositions = attackers.flatMap((unit) => unit.position ? [unit.position] : []);
  const enemies = battle.armies
    .filter((army) => areArmiesEnemies(battle, army.id, attackerArmyId))
    .flatMap((army) => army.units)
    .filter((unit) => unit.status !== "Destroyed")
    .flatMap((unit) => unit.position ? [unit.position] : []);

  return enemies.sort((left, right) => {
    const leftDistance = Math.min(...attackerPositions.map((position) => distance(position, left)));
    const rightDistance = Math.min(...attackerPositions.map((position) => distance(position, right)));
    return leftDistance - rightDistance;
  })[0];
}

function estimateMaximumDamage(weapon: WeaponProfile): number {
  return weapon.attacks * weapon.damage;
}

function estimateExpectedDamage(weapon: WeaponProfile): number {
  return weapon.attacks * weapon.damage * 0.5;
}

function isTerritoryOwnedByTeam(
  battle: Battle,
  mission: MissionState | undefined,
  position: GridPosition,
  armyId: string,
): boolean {
  const ownerArmyId = mission?.territoryOwners?.[`${position.x},${position.y}`];
  return ownerArmyId
    ? areArmiesAllied(battle, ownerArmyId, armyId)
    : false;
}
