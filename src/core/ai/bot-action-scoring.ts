import type { Battle, UnitInstance, WeaponProfile } from "../../types";
import type { BattleAction } from "../battle-actions";
import type { LegalUnitAction } from "../legal-actions";
import { distance, type GridPosition } from "../rules/geometry";
import { getUnitActiveAbilities } from "../rules/active-abilities";
import { findUnit, getTemplate } from "../rules/state";
import { getDefenseBonus } from "../rules/terrain";
import type { BotDoctrine } from "./bot-doctrine";

export type BotActionScoringContext = {
  battle: Battle;
  doctrine: BotDoctrine;
  movementTarget?: GridPosition;
  objectiveObjectId?: string;
};

export type ScoredBotAction<TAction extends LegalUnitAction = LegalUnitAction> = {
  action: TAction;
  score: number;
};

const offensiveAbilityEffects = new Set([
  "direct_damage",
  "damage_and_push",
  "bonus_move_then_melee_attack",
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
    .sort((left, right) =>
      right.score - left.score || actionKey(left.action).localeCompare(actionKey(right.action))
    );
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
  { battle, doctrine }: BotActionScoringContext,
): number {
  const attacker = findUnit(battle, action.attackerId);
  const defender = findUnit(battle, action.defenderId);
  const weapon = getWeapon(attacker, action.weaponId);
  if (!attacker || !defender || !weapon) return Number.NEGATIVE_INFINITY;

  const damagePotential = estimateMaximumDamage(weapon);
  return (
    damagePotential * doctrine.damagePotentialWeight +
    (damagePotential >= defender.currentHp ? doctrine.lethalBonus : 0) +
    getTemplate(defender).cost * doctrine.targetValueWeight -
    getDefenseBonus(battle, defender) * doctrine.coverPenaltyWeight -
    defender.currentHp * doctrine.remainingHpPenaltyWeight
  );
}

function scoreObjectAttack(
  action: Extract<BattleAction, { type: "AttackObject" }>,
  { battle, doctrine, objectiveObjectId }: BotActionScoringContext,
): number {
  const attacker = findUnit(battle, action.attackerId);
  const target = battle.board.objects?.find((object) => object.id === action.objectId);
  const weapon = getWeapon(attacker, action.weaponId);
  if (!attacker || !target || !weapon) return Number.NEGATIVE_INFINITY;

  const damagePotential = estimateMaximumDamage(weapon);
  return (
    damagePotential * doctrine.damagePotentialWeight +
    (damagePotential >= target.currentHp ? doctrine.lethalBonus : 0) +
    (target.id === objectiveObjectId ? doctrine.objectiveAttackBonus : 0) -
    target.currentHp * doctrine.remainingHpPenaltyWeight
  );
}

function scoreAbility(
  action: Extract<BattleAction, { type: "UseAbility" }>,
  { battle, doctrine }: BotActionScoringContext,
): number {
  const unit = findUnit(battle, action.unitId);
  const ability = unit
    ? getUnitActiveAbilities(battle, unit).find((candidate) => candidate.id === action.abilityId)
    : undefined;
  if (!unit || !ability || !offensiveAbilityEffects.has(ability.effect.type)) {
    return Number.NEGATIVE_INFINITY;
  }

  const target = action.targetUnitId ? findUnit(battle, action.targetUnitId) : undefined;
  if (!target) return Number.NEGATIVE_INFINITY;
  const effectValue = ability.effect.value ?? 1;

  return (
    doctrine.abilityBaseScore +
    effectValue * doctrine.abilityEffectWeight +
    (effectValue >= target.currentHp ? doctrine.lethalBonus : 0) -
    target.currentHp * doctrine.remainingHpPenaltyWeight
  );
}

function scoreMovement(
  action: Extract<BattleAction, { type: "MoveUnit" | "AdvanceUnit" }>,
  { battle, doctrine, movementTarget }: BotActionScoringContext,
): number {
  const unit = findUnit(battle, action.unitId);
  if (!unit?.position || !movementTarget) return Number.NEGATIVE_INFINITY;
  const currentDistance = distance(unit.position, movementTarget);
  const targetDistance = distance(action.targetPosition, movementTarget);
  const progress = currentDistance - targetDistance;
  if (progress <= 0) return Number.NEGATIVE_INFINITY;

  return (
    progress * doctrine.movementProgressWeight -
    targetDistance * doctrine.remainingDistancePenaltyWeight +
    getTileDefenseBonus(battle, action.targetPosition) * doctrine.terrainDefenseWeight
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
  return (
    -distance(action.targetPosition, destination) * doctrine.deploymentDistancePenaltyWeight +
    getTileDefenseBonus(battle, action.targetPosition) * doctrine.terrainDefenseWeight
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

function actionKey(action: LegalUnitAction): string {
  return JSON.stringify(action);
}
