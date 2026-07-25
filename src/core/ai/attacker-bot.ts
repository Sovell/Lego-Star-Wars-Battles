import type {
  Battle,
  BattlefieldObject,
  UnitInstance,
  WeaponProfile,
} from "../../types";
import type { BattleAction } from "../battle-actions";
import { distance, lineOfSight, type GridPosition } from "../rules/geometry";
import { getTemplate } from "../rules/state";
import { getDefenseBonus } from "../rules/terrain";
import { isPositionFree } from "../rules/occupancy";
import { getUnitActiveAbilities } from "../rules/active-abilities";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";

export type BotDecision = {
  action: BattleAction;
  reason: string;
};

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
  const abilityDecision = chooseOffensiveAbility(battle, attackers, attackerArmyId);
  if (abilityDecision) {
    return abilityDecision;
  }
  const objectAttack = chooseBestObjectAttack(battle, attackers, objective);
  if (objectAttack) {
    return {
      action: objectAttack.action,
      reason: `${getTemplate(objectAttack.attacker).name} atakuje cel scenariusza: ${objectAttack.target.name}.`,
    };
  }

  const unitAttack = chooseBestUnitAttack(battle, attackers, attackerArmyId);
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
    return {
      action: {
        type: "ApplyOrder",
        unitId: pendingAdvanceUnit.id,
        order: "Advance",
      },
      reason: `${getTemplate(pendingAdvanceUnit).name} kończy Advance bez dostępnego celu.`,
    };
  }

  const movementTarget = objective?.position ??
    findTerritoryTarget(battle, scenario, mission, attackers, attackerArmyId) ??
    findNearestEnemyPosition(battle, attackers, attackerArmyId);
  if (movementTarget) {
    const movement = chooseBestMovement(battle, attackers, movementTarget);
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

  const rallyUnit = attackers
    .filter((unit) => unit.suppression > 0)
    .sort((left, right) => right.suppression - left.suppression)[0];
  const unit = rallyUnit ?? attackers[0];

  return {
    action: {
      type: "ApplyOrder",
      unitId: unit.id,
      order: rallyUnit ? "Rally" : "Overwatch",
    },
    reason: rallyUnit
      ? `${getTemplate(unit).name} porzadkuje szyki i usuwa suppression.`
      : `${getTemplate(unit).name} nie ma legalnego celu ani lepszej pozycji i pozostaje w gotowosci.`,
  };
}

function chooseBestObjectAttack(
  battle: Battle,
  attackers: UnitInstance[],
  objective: BattlefieldObject | undefined,
): ObjectAttackOption | undefined {
  if (!objective?.destructible || objective.status !== "Active") {
    return undefined;
  }

  return attackers
    .flatMap((attacker) => {
      if (!attacker.position) {
        return [];
      }

      return getTemplate(attacker).weapons.flatMap<ObjectAttackOption>((weapon) => {
        if (
          distance(attacker.position!, objective.position) > weapon.range ||
          !lineOfSight(battle, attacker.position!, objective.position)
        ) {
          return [];
        }

        const lethalBonus = estimateMaximumDamage(weapon) >= objective.currentHp ? 10_000 : 0;
        return [{
          action: {
            type: "AttackObject",
            attackerId: attacker.id,
            objectId: objective.id,
            weaponId: weapon.id,
          },
          attacker,
          target: objective,
          weapon,
          score: 100_000 + lethalBonus + estimateExpectedDamage(weapon),
        }];
      });
    })
    .sort((left, right) => right.score - left.score)[0];
}

function chooseBestUnitAttack(
  battle: Battle,
  attackers: UnitInstance[],
  attackerArmyId: string,
): UnitAttackOption | undefined {
  const defenders = battle.armies
    .filter((army) => army.id !== attackerArmyId)
    .flatMap((army) => army.units)
    .filter((unit) => unit.status !== "Destroyed" && unit.position);

  return attackers
    .flatMap((attacker) => {
      if (!attacker.position) {
        return [];
      }

      return defenders.flatMap((defender) =>
        getTemplate(attacker).weapons.flatMap<UnitAttackOption>((weapon) => {
          if (
            !defender.position ||
            distance(attacker.position!, defender.position) > weapon.range ||
            !lineOfSight(battle, attacker.position!, defender.position)
          ) {
            return [];
          }

          const maximumDamage = estimateMaximumDamage(weapon);
          const lethalBonus = maximumDamage >= defender.currentHp ? 10_000 : 0;
          const targetValue = getTemplate(defender).cost;
          const coverPenalty = getDefenseBonus(battle, defender) * 25;
          return [{
            action: {
              type: "Attack",
              attackerId: attacker.id,
              defenderId: defender.id,
              weaponId: weapon.id,
            },
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
        }),
      );
    })
    .sort((left, right) => right.score - left.score)[0];
}

function chooseBestMovement(
  battle: Battle,
  attackers: UnitInstance[],
  target: GridPosition,
): { unit: UnitInstance; position: GridPosition; score: number } | undefined {
  return attackers
    .flatMap((unit) => {
      const template = getTemplate(unit);
      const currentDistance = unit.position ? distance(unit.position, target) : Number.MAX_SAFE_INTEGER;
      const positions: GridPosition[] = [];

      for (let y = 0; y < battle.board.height; y += 1) {
        for (let x = 0; x < battle.board.width; x += 1) {
          const position = { x, y };
          const terrain = battle.board.tiles.find((tile) => tile.x === x && tile.y === y);
          const movementCost = Math.max(1, terrain?.movementCost ?? 1);
          const maximumDistance = unit.position
            ? Math.max(1, Math.floor(template.movement / movementCost))
            : 1;
          const movementDistance = unit.position ? distance(unit.position, position) : 1;

          if (movementDistance <= maximumDistance) {
            if (!isPositionFree(battle, position, unit.id)) {
              continue;
            }
            positions.push(position);
          }
        }
      }

      return positions
        .filter((position) => !unit.position || distance(position, target) < currentDistance)
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

function chooseOffensiveAbility(
  battle: Battle,
  attackers: UnitInstance[],
  attackerArmyId: string,
): BotDecision | undefined {
  const enemies = battle.armies
    .filter((army) => army.id !== attackerArmyId)
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
      const range = ability.effect.type === "bonus_move_then_melee_attack"
        ? (ability.effect.value ?? 0) + 1
        : ability.range ?? 1;
      const target = enemies
        .filter(
          (enemy) =>
            enemy.position &&
            distance(attacker.position!, enemy.position) <= range,
        )
        .sort((left, right) => left.currentHp - right.currentHp)[0];
      if (target) {
        return {
          action: {
            type: "UseAbility",
            unitId: attacker.id,
            abilityId: ability.id,
            targetUnitId: target.id,
          },
          reason: `${getTemplate(attacker).name} wykorzystuje zdolność ${ability.name} przeciw ${getTemplate(target).name}.`,
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
        mission?.territoryOwners?.[`${x},${y}`] !== attackerArmyId &&
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
    .filter((army) => army.id !== attackerArmyId)
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
