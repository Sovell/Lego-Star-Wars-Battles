import { taskForces, unitTemplates } from "../../data";
import type { Army, Battle, UnitInstance, UnitTemplate } from "../../types";

export const templateById = new Map(unitTemplates.map((template) => [template.id, template]));

export function getTemplate(unit: UnitInstance): UnitTemplate {
  const template = templateById.get(unit.templateId);
  if (!template) {
    throw new Error(`Missing template: ${unit.templateId}`);
  }
  return template;
}

export function getArmyCost(army: Army): number {
  const taskForceSelectionIds = new Set(army.taskForces?.map((selection) => selection.id) ?? []);
  const taskForceCost = (army.taskForces ?? []).reduce((total, selection) => {
    const taskForce = taskForces.find((candidate) => candidate.id === selection.taskForceId);
    return total + (taskForce?.cost ?? 0);
  }, 0);
  const standaloneCost = army.units
    .filter((unit) => !unit.sourceTaskForceId || !taskForceSelectionIds.has(unit.sourceTaskForceId))
    .reduce((total, unit) => total + getTemplate(unit).cost, 0);

  return taskForceCost + standaloneCost;
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
