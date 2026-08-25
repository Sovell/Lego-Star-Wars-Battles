import type { Battle, UnitInstance, WeaponProfile } from "../../types";
import type { BattleAction } from "../battle-actions";
import type { LegalUnitAction } from "../legal-actions";
import { distance, lineOfSight, type GridPosition } from "../rules/geometry";
import { getUnitActiveAbilities } from "../rules/active-abilities";
import { getPathCost } from "../rules/pathfinding";
import { getUnitMovementBonus } from "../rules/movement";
import { findUnit, getTemplate } from "../rules/state";
import { getDefenseBonus, getHazardSuppression } from "../rules/terrain";
import type { BotDoctrine } from "./bot-doctrine";
import type { BotStrategyContext } from "./bot-strategy-context";

export type BotActionScoringContext = Pick<
  BotStrategyContext,
  "battle" | "doctrine" | "movementTarget" | "objectiveObjectId" |
  "protectedObjectivePosition" | "territoryTargets"
> & { decisionSeed?: string };

export type ScoredBotAction<TAction extends LegalUnitAction = LegalUnitAction> = {
  action: TAction;
  score: number;
};

const offensiveAbilityEffects = new Set([
  "direct_damage",
  "damage_and_push",
  "bonus_move_then_melee_attack",
]);

const strategicPositionAbilityEffects = new Set([
  "build_droid_foundry",
  "line_airstrike",
  "schedule_area_strike",
]);

const strategicUnitAbilityEffects = new Set([
  "rally_and_reactivate",
  "mark_shatterpoint",
  "designate_target",
  "deny_activation",
  "mark_hunted_hero",
]);

/** Scores every legal unit action through one doctrine-driven model. */
export function scoreBotAction(
  action: LegalUnitAction,
  context: BotActionScoringContext,
): number {
  switch (action.type) {
    case "Attack":
      return scoreUnitAttack(action, context);
    case "AttackObject":
      return scoreObjectAttack(action, context);
    case "UseAbility":
      return scoreAbility(action, context);
    case "MoveUnit":
    case "AdvanceUnit":
      return scoreMovement(action, context);
    case "DeployUnit":
      return scoreDeployment(action, context);
    case "ApplyOrder":
      return scoreOrder(action, context);
  }
}

/** Returns a stable ranking; equal scores are resolved by the action payload. */
export function rankBotActions<TAction extends LegalUnitAction>(
  actions: TAction[],
  context: BotActionScoringContext,
): ScoredBotAction<TAction>[] {
  return actions
    .map((action) => ({ action, score: scoreBotAction(action, context) }))
    .filter((option) => Number.isFinite(option.score))
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      if (scoreDifference !== 0) return scoreDifference;
      const leftKey = actionKey(left.action);
      const rightKey = actionKey(right.action);
      return seededRank(context.decisionSeed, leftKey) -
        seededRank(context.decisionSeed, rightKey) ||
        leftKey.localeCompare(rightKey);
    });
}

export function chooseBestBotAction<TAction extends LegalUnitAction>(
  actions: TAction[],
  context: BotActionScoringContext,
): ScoredBotAction<TAction> | undefined {
  return rankBotActions(actions, context)[0];
}

export function estimateMaximumDamage(weapon: WeaponProfile): number {
  return weapon.attacks * weapon.damage;
}

function scoreUnitAttack(
  action: Extract<BattleAction, { type: "Attack" }>,
  context: BotActionScoringContext,
): number {
  const { battle, doctrine } = context;
  const attacker = findUnit(battle, action.attackerId);
  const defender = findUnit(battle, action.defenderId);
  const weapon = getWeapon(attacker, action.weaponId);
  if (!attacker || !defender || !weapon) return Number.NEGATIVE_INFINITY;

  const damagePotential = estimateMaximumDamage(weapon);
  return (
    doctrine.attackBaseScore +
    damagePotential * doctrine.damagePotentialWeight +
    (damagePotential >= defender.currentHp ? doctrine.lethalBonus : 0) +
    getTemplate(defender).cost * doctrine.targetValueWeight -
    getDefenseBonus(battle, defender) * doctrine.coverPenaltyWeight -
    defender.currentHp * doctrine.remainingHpPenaltyWeight +
    getObjectiveThreatScore(defender, context)
  );
}

function scoreObjectAttack(
  action: Extract<BattleAction, { type: "AttackObject" }>,
  { battle, doctrine, objectiveObjectId }: BotActionScoringContext,
): number {
  const attacker = findUnit(battle, action.attackerId);
  const target = battle.board.objects?.find((object) => object.id === action.objectId);
  const weapon = getWeapon(attacker, action.weaponId);
  if (
    !attacker ||
    !target ||
    !weapon ||
    !objectiveObjectId ||
    target.id !== objectiveObjectId
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const damagePotential = estimateMaximumDamage(weapon);
  return (
    damagePotential * doctrine.damagePotentialWeight +
    (damagePotential >= target.currentHp ? doctrine.lethalBonus : 0) +
    doctrine.attackBaseScore +
    doctrine.objectiveAttackBonus -
    target.currentHp * doctrine.remainingHpPenaltyWeight
  );
}

function scoreAbility(
  action: Extract<BattleAction, { type: "UseAbility" }>,
  context: BotActionScoringContext,
): number {
  const { battle, doctrine } = context;
  const unit = findUnit(battle, action.unitId);
  const ability = unit
    ? getUnitActiveAbilities(battle, unit).find((candidate) => candidate.id === action.abilityId)
    : undefined;
  if (!unit || !ability) {
    return Number.NEGATIVE_INFINITY;
  }

  if (strategicPositionAbilityEffects.has(ability.effect.type)) {
    if (!action.targetPosition) return Number.NEGATIVE_INFINITY;
    const strategicTarget = context.protectedObjectivePosition ??
      context.movementTarget ?? {
        x: Math.floor((battle.board.width - 1) / 2),
        y: Math.floor((battle.board.height - 1) / 2),
      };
    return doctrine.abilityBaseScore +
      (ability.effect.value ?? 1) * doctrine.abilityEffectWeight +
      getTileDefenseBonus(battle, action.targetPosition) * doctrine.terrainDefenseWeight -
      distance(action.targetPosition, strategicTarget) * doctrine.remainingDistancePenaltyWeight;
  }

  if (ability.effect.type === "refresh_nearby_allies") {
    return doctrine.abilityBaseScore +
      (ability.effect.value ?? 1) * doctrine.abilityEffectWeight;
  }

  if (strategicUnitAbilityEffects.has(ability.effect.type)) {
    const strategicTarget = action.targetUnitId ? findUnit(battle, action.targetUnitId) : undefined;
    if (!strategicTarget) return Number.NEGATIVE_INFINITY;
    return doctrine.abilityBaseScore +
      getTemplate(strategicTarget).cost * doctrine.targetValueWeight +
      strategicTarget.suppression * doctrine.suppressionWeight;
  }

  if (!offensiveAbilityEffects.has(ability.effect.type)) {
    return Number.NEGATIVE_INFINITY;
  }

  const target = action.targetUnitId ? findUnit(battle, action.targetUnitId) : undefined;
  if (!target) return Number.NEGATIVE_INFINITY;
  const effectValue = ability.effect.value ?? 1;

  return (
    doctrine.abilityBaseScore +
    effectValue * doctrine.abilityEffectWeight +
    (effectValue >= target.currentHp ? doctrine.lethalBonus : 0) -
    target.currentHp * doctrine.remainingHpPenaltyWeight +
    getObjectiveThreatScore(target, context)
  );
}

function scoreMovement(
  action: Extract<BattleAction, { type: "MoveUnit" | "AdvanceUnit" }>,
  { battle, doctrine, movementTarget, territoryTargets }: BotActionScoringContext,
): number {
  const unit = findUnit(battle, action.unitId);
  const territoryFallback = scoreTerritoryMovementFallback(
    action.targetPosition,
    battle,
    doctrine,
    territoryTargets,
  );
  if (!unit?.position || !movementTarget) return territoryFallback;
  const movementBudget = getTemplate(unit).movement + getUnitMovementBonus(battle, unit);
  const pathOptions = {
    unitId: unit.id,
    movementBudget,
    allowOccupiedTarget: true,
  };
  const currentDistance = getPathCost(
    battle,
    unit.position,
    movementTarget,
    pathOptions,
  );
  const targetDistance = getPathCost(
    battle,
    action.targetPosition,
    movementTarget,
    pathOptions,
  );
  if (currentDistance === undefined || targetDistance === undefined) {
    return territoryFallback;
  }
  const progress = currentDistance - targetDistance;
  if (progress <= 0) return territoryFallback;

  return (
    doctrine.movementBaseScore +
    (action.type === "AdvanceUnit" ? doctrine.advanceActionBonus : 0) +
    progress * doctrine.movementProgressWeight -
    targetDistance * doctrine.remainingDistancePenaltyWeight +
    getTileDefenseBonus(battle, action.targetPosition) * doctrine.terrainDefenseWeight +
    getTileAttackBonus(battle, action.targetPosition) * doctrine.terrainDefenseWeight -
    getTileHazardPenalty(battle, action.targetPosition) * doctrine.suppressionWeight
  );
}

function scoreDeployment(
  action: Extract<BattleAction, { type: "DeployUnit" }>,
  { battle, doctrine, movementTarget }: BotActionScoringContext,
): number {
  const destination = movementTarget ?? {
    x: Math.floor((battle.board.width - 1) / 2),
    y: Math.floor((battle.board.height - 1) / 2),
  };
  const unit = findUnit(battle, action.unitId);
  const movementBudget = unit ? getTemplate(unit).movement : 1;
  const pathDistance = getPathCost(
    battle,
    action.targetPosition,
    destination,
    {
      unitId: action.unitId,
      movementBudget,
      allowOccupiedTarget: true,
    },
  );
  if (pathDistance === undefined) return Number.NEGATIVE_INFINITY;
  return (
    doctrine.deploymentBaseScore -
    pathDistance * doctrine.deploymentDistancePenaltyWeight +
    getTileDefenseBonus(battle, action.targetPosition) * doctrine.terrainDefenseWeight +
    getTileAttackBonus(battle, action.targetPosition) * doctrine.terrainDefenseWeight -
    getTileHazardPenalty(battle, action.targetPosition) * doctrine.suppressionWeight
  );
}

function scoreOrder(
  action: Extract<BattleAction, { type: "ApplyOrder" }>,
  { battle, doctrine }: BotActionScoringContext,
): number {
  const unit = findUnit(battle, action.unitId);
  if (!unit) return Number.NEGATIVE_INFINITY;
  if (action.order === "Rally") {
    return doctrine.rallyBaseScore + unit.suppression * doctrine.suppressionWeight;
  }
  if (action.order === "Overwatch") return doctrine.overwatchScore;
  if (action.order === "Advance") return doctrine.finishAdvanceScore;
  return Number.NEGATIVE_INFINITY;
}

function getWeapon(unit: UnitInstance | undefined, weaponId: string): WeaponProfile | undefined {
  return unit
    ? getTemplate(unit).weapons.find((weapon) => weapon.id === weaponId)
    : undefined;
}

function getTileDefenseBonus(battle: Battle, position: GridPosition): number {
  return battle.board.tiles.find((tile) => tile.x === position.x && tile.y === position.y)
    ?.defenseBonus ?? 0;
}

function getObjectiveThreatScore(
  unit: UnitInstance,
  { battle, doctrine, protectedObjectivePosition }: BotActionScoringContext,
): number {
  if (!unit.position || !protectedObjectivePosition) return 0;
  const objectiveDistance = distance(unit.position, protectedObjectivePosition);
  const proximity = Math.max(
    0,
    Math.max(battle.board.width, battle.board.height) - objectiveDistance,
  );
  const canAttackObjective = getTemplate(unit).weapons.some((weapon) =>
    weapon.range >= objectiveDistance &&
    lineOfSight(battle, unit.position!, protectedObjectivePosition)
  );
  return proximity * doctrine.objectiveDefenseThreatWeight +
    (canAttackObjective ? doctrine.objectiveImmediateThreatBonus : 0);
}

function getTileAttackBonus(battle: Battle, position: GridPosition): number {
  return battle.board.tiles.find((tile) => tile.x === position.x && tile.y === position.y)
    ?.attackBonus ?? 0;
}

function getTileHazardPenalty(battle: Battle, position: GridPosition): number {
  return getHazardSuppression(
    battle.board.tiles.find((tile) => tile.x === position.x && tile.y === position.y),
  );
}

/**
 * A territory match must never turn into an Overwatch deadlock just because
 * the preferred long-range tile is temporarily blocked. Claiming a new tile
 * is always strategically useful and lets the next activation find a route
 * again after the formation has opened up.
 */
function scoreTerritoryMovementFallback(
  position: GridPosition,
  battle: Battle,
  doctrine: BotDoctrine,
  territoryTargets: GridPosition[] | undefined,
): number {
  if (!territoryTargets?.some((target) =>
    target.x === position.x && target.y === position.y
  )) {
    return Number.NEGATIVE_INFINITY;
  }
  return doctrine.movementBaseScore * 0.8 +
    getTileDefenseBonus(battle, position) * doctrine.terrainDefenseWeight +
    getTileAttackBonus(battle, position) * doctrine.terrainDefenseWeight -
    getTileHazardPenalty(battle, position) * doctrine.suppressionWeight;
}

function actionKey(action: LegalUnitAction): string {
  return JSON.stringify(action);
}

function seededRank(seed: string | undefined, key: string): number {
  if (!seed) return 0;
  let hash = 2_166_136_261;
  const value = `${seed}:${key}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
