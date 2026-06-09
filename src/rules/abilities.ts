import { abilities } from "../data";
import type { AbilityDefinition, UnitTemplate } from "../types";

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
