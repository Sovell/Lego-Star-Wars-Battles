import { unitTemplates } from "../data";
import type { Army, Battle, UnitInstance, UnitTemplate } from "../types";

export const templateById = new Map(unitTemplates.map((template) => [template.id, template]));

export function getTemplate(unit: UnitInstance): UnitTemplate {
  const template = templateById.get(unit.templateId);
  if (!template) {
    throw new Error(`Missing template: ${unit.templateId}`);
  }
  return template;
}

export function getArmyCost(army: Army): number {
  return army.units.reduce((total, unit) => total + getTemplate(unit).cost, 0);
}

export function findArmy(battle: Battle, armyId: string): Army | undefined {
  return battle.armies.find((army) => army.id === armyId);
}

export function findUnit(battle: Battle, unitId: string): UnitInstance | undefined {
  return battle.armies.flatMap((army) => army.units).find((unit) => unit.id === unitId);
}

export function replaceUnit(battle: Battle, updatedUnit: UnitInstance): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => (unit.id === updatedUnit.id ? updatedUnit : unit)),
    })),
  };
}
