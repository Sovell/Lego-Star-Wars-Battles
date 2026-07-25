import type { BattlefieldObject, BattlefieldObjectType } from "../types";
import type { GridPosition } from "./rules/geometry";

export type BattlefieldObjectPreset = Omit<
  BattlefieldObject,
  "id" | "position" | "currentHp" | "status"
>;

export const battlefieldObjectPresets: BattlefieldObjectPreset[] = [
  {
    type: "DefensePoint",
    name: "Punkt obrony",
    maxHp: 0,
    defenseBonus: 0,
    destructible: false,
    blocksLineOfSight: false,
  },
  {
    type: "StrategicPoint",
    name: "Punkt strategiczny ★",
    maxHp: 0,
    defenseBonus: 0,
    destructible: false,
    blocksLineOfSight: false,
  },
  {
    type: "Generator",
    name: "Generator",
    maxHp: 8,
    armorSave: 5,
    defenseBonus: 0,
    destructible: true,
    blocksLineOfSight: false,
  },
  {
    type: "LightFortification",
    name: "Lekka oslona",
    maxHp: 4,
    armorSave: 6,
    defenseBonus: 1,
    destructible: true,
    blocksLineOfSight: false,
  },
  {
    type: "HeavyFortification",
    name: "Ciezka oslona",
    maxHp: 7,
    armorSave: 5,
    defenseBonus: 2,
    destructible: true,
    blocksLineOfSight: false,
  },
];

export function createBattlefieldObject(
  type: BattlefieldObjectType,
  position: GridPosition,
): BattlefieldObject {
  const preset = battlefieldObjectPresets.find((candidate) => candidate.type === type);
  if (!preset) {
    throw new Error(`Unknown battlefield object type: ${type}.`);
  }

  return {
    ...preset,
    id: `${type.toLowerCase()}-${crypto.randomUUID()}`,
    position,
    currentHp: preset.maxHp,
    status: "Active",
  };
}

export function getBattlefieldObjects(objects?: BattlefieldObject[]): BattlefieldObject[] {
  return objects ?? [];
}
