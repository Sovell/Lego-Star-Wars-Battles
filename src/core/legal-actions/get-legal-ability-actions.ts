import type { AbilityDefinition, Battle } from "../../types";
import type { BattleAction } from "../battle-actions";
import {
  getUnitActiveAbilities,
  useActiveAbility,
  type UseAbilityInput,
} from "../rules/active-abilities";
import { findUnit } from "../rules/state";

export type LegalAbilityAction = Extract<BattleAction, { type: "UseAbility" }>;

type AbilityTargetMode = "none" | "position" | "unit" | "unit-position";

const deterministicRoll = () => 6;

/**
 * Generates only ability actions accepted by the active-ability rules.
 * Target shapes are enumerated here; cooldowns, allegiance, range, occupancy
 * and effect-specific requirements remain owned by useActiveAbility().
 */
export function getLegalAbilityActions(
  battle: Battle,
  unitId: string,
  abilityId?: string,
): LegalAbilityAction[] {
  const unit = findUnit(battle, unitId);
  if (!unit) return [];

  return getUnitActiveAbilities(battle, unit)
    .filter((ability) => !abilityId || ability.id === abilityId)
    .flatMap((ability) =>
      createAbilityCandidates(battle, unitId, ability).filter((action) =>
        useActiveAbility(battle, action, deterministicRoll).battle !== battle
      )
    );
}

function createAbilityCandidates(
  battle: Battle,
  unitId: string,
  ability: AbilityDefinition,
): LegalAbilityAction[] {
  const base: UseAbilityInput = { unitId, abilityId: ability.id };
  const positions = boardPositions(battle);
  const unitIds = battle.armies.flatMap((army) => army.units.map((unit) => unit.id));

  switch (getAbilityTargetMode(ability.effect.type)) {
    case "none":
      return [{ type: "UseAbility", ...base }];
    case "position":
      return positions.map((targetPosition) => ({
        type: "UseAbility",
        ...base,
        targetPosition,
      }));
    case "unit":
      return unitIds.map((targetUnitId) => ({
        type: "UseAbility",
        ...base,
        targetUnitId,
      }));
    case "unit-position":
      return unitIds.flatMap((targetUnitId) =>
        positions.map((targetPosition) => ({
          type: "UseAbility" as const,
          ...base,
          targetUnitId,
          targetPosition,
        }))
      );
  }
}

function getAbilityTargetMode(effectType: string): AbilityTargetMode {
  switch (effectType) {
    case "incoming_damage_multiplier":
      return "none";
    case "create_light_cover":
    case "bonus_move_ignore_terrain":
      return "position";
    case "move_after_attack":
      return "unit-position";
    case "restore_hp":
    case "damage_and_push":
    case "direct_damage":
    case "bonus_move_then_melee_attack":
    case "task_force_once_per_turn_movement_bonus":
    case "task_force_attack_bonus_against_damaged":
    case "task_force_attack_bonus_against_hero":
      return "unit";
    default:
      return "none";
  }
}

function boardPositions(battle: Battle): Array<{ x: number; y: number }> {
  return Array.from(
    { length: battle.board.width * battle.board.height },
    (_, index) => ({
      x: index % battle.board.width,
      y: Math.floor(index / battle.board.width),
    }),
  );
}
