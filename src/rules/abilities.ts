import { abilities } from "../data";
import type { AbilityDefinition, Battle, UnitInstance, UnitTemplate } from "../types";
import { distance } from "./geometry";
import { getTemplate } from "./state";

export function getAbilities(template: UnitTemplate): AbilityDefinition[] {
  return abilities.filter((ability) => template.abilities.includes(ability.id));
}

export function getNumericAbilityEffect(
  template: UnitTemplate,
  effectType: string,
): number {
  return getAbilities(template).reduce((total, ability) => {
    if (ability.effect.type !== effectType || typeof ability.effect.value !== "number") {
      return total;
    }

    return total + ability.effect.value;
  }, 0);
}

export function getAttackDiceBonus(
  battle: Battle,
  attacker: UnitInstance,
  defender: UnitInstance,
): number {
  const attackerTemplate = getTemplate(attacker);
  let bonus = 0;

  if (
    attackerTemplate.abilities.includes("assault_training") &&
    attacker.movedThisTurn
  ) {
    bonus += getNumericAbilityEffect(attackerTemplate, "attack_bonus_if_moved");
  }

  if (getTemplate(defender).category === "hero") {
    bonus += getNumericAbilityEffect(attackerTemplate, "attack_bonus_against_category");
  }

  if (
    attackerTemplate.abilities.includes("relentless_fury") &&
    attacker.currentHp < attackerTemplate.maxHp
  ) {
    bonus += getNumericAbilityEffect(attackerTemplate, "attack_bonus_when_damaged");
  }

  bonus += getFriendlyAuraAttackBonus(battle, attacker);
  return bonus;
}

export function getDamageBonus(
  attackerTemplate: UnitTemplate,
  defenderTemplate: UnitTemplate,
): number {
  return getAbilities(attackerTemplate).reduce((total, ability) => {
    if (
      ability.effect.type === "damage_bonus_against_category" &&
      ability.effect.target === defenderTemplate.category &&
      typeof ability.effect.value === "number"
    ) {
      return total + ability.effect.value;
    }

    return total;
  }, 0);
}

function getFriendlyAuraAttackBonus(battle: Battle, attacker: UnitInstance): number {
  if (!attacker.position) {
    return 0;
  }

  return battle.armies
    .find((army) => army.id === attacker.armyId)
    ?.units.reduce((total, source) => {
      if (source.id === attacker.id || source.status === "Destroyed" || !source.position) {
        return total;
      }

      const sourceTemplate = getTemplate(source);
      const sourceAbilities = getAbilities(sourceTemplate);

      return (
        total +
        sourceAbilities.reduce((abilityTotal, ability) => {
          if (
            ability.effect.type !== "aura_attack_bonus" ||
            typeof ability.effect.value !== "number" ||
            typeof ability.range !== "number" ||
            distance(source.position!, attacker.position!) > ability.range ||
            !matchesAbilityTarget(ability.effect.target, getTemplate(attacker))
          ) {
            return abilityTotal;
          }

          return abilityTotal + ability.effect.value;
        }, 0)
      );
    }, 0) ?? 0;
}

function matchesAbilityTarget(target: string | undefined, template: UnitTemplate): boolean {
  if (!target) {
    return true;
  }

  if (target === "friendly_clone") {
    return template.keywords.includes("Clone");
  }

  if (target === "friendly_droid") {
    return template.keywords.includes("Droid");
  }

  return target === template.category || template.keywords.includes(target);
}
