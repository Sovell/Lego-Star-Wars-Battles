import type { Battle } from "../../types";
import type { BattleAction } from "../battle-actions";
import { resolveAttack } from "../rules/combat";
import { resolveObjectAttack } from "../rules/object-combat";
import { findUnit, getTemplate } from "../rules/state";

export type LegalAttackAction = Extract<
  BattleAction,
  { type: "Attack" | "AttackObject" }
>;

const deterministicRoll = () => 6;

/**
 * Generates only attack actions accepted by the combat rules.
 * The deterministic roll is used solely to pass through validation; consumers
 * must apply the chosen action through applyBattleAction() for real resolution.
 */
export function getLegalAttackActions(
  battle: Battle,
  attackerId: string,
): LegalAttackAction[] {
  const attacker = findUnit(battle, attackerId);
  if (!attacker) return [];

  const weapons = getTemplate(attacker).weapons;
  const units = battle.armies.flatMap((army) => army.units);
  const unitAttacks = weapons.flatMap<LegalAttackAction>((weapon) =>
    units.flatMap<LegalAttackAction>((defender) => {
      const action: LegalAttackAction = {
        type: "Attack",
        attackerId,
        defenderId: defender.id,
        weaponId: weapon.id,
      };
      return resolveAttack(
        battle,
        attackerId,
        defender.id,
        weapon.id,
        deterministicRoll,
      ).result
        ? [action]
        : [];
    }),
  );
  const objectAttacks = weapons.flatMap<LegalAttackAction>((weapon) =>
    (battle.board.objects ?? []).flatMap<LegalAttackAction>((target) => {
      const action: LegalAttackAction = {
        type: "AttackObject",
        attackerId,
        objectId: target.id,
        weaponId: weapon.id,
      };
      return resolveObjectAttack(
        battle,
        attackerId,
        target.id,
        weapon.id,
        deterministicRoll,
      ).result
        ? [action]
        : [];
    }),
  );

  return [...unitAttacks, ...objectAttacks];
}
