import type { TerrainTile, TerrainTrait, TerrainType } from "../types";

export type TerrainDefinition = Omit<TerrainTile, "x" | "y"> & {
  name: string;
  shortLabel: string;
  description: string;
  traits: TerrainTrait[];
};

export const terrainDefinitions: readonly TerrainDefinition[] = [
  define("Open", "Otwarty teren", "OTWARTY", "Bez dodatkowych modyfikatorow."),
  define("LightCover", "Lekka oslona", "OSLONA", "+1 do obrony.", { defenseBonus: 1 }),
  define("HeavyCover", "Ciezka oslona", "CIEZKA", "+2 do obrony, koszt ruchu 2.", {
    defenseBonus: 2,
    movementCost: 2,
  }),
  define("Building", "Budynek", "BUDYNEK", "+2 do obrony, koszt ruchu 2; blokuje linie widzenia.", {
    defenseBonus: 2,
    movementCost: 2,
    blocksLineOfSight: true,
  }),
  define("DifficultTerrain", "Trudny teren", "TRUDNY", "Koszt ruchu 2.", {
    movementCost: 2,
  }),
  define("Impassable", "Teren niedostepny", "NIEDOST.", "Nie mozna na niego wejsc; blokuje linie widzenia.", {
    blocksLineOfSight: true,
    traits: ["Impassable"],
  }),
  define("Hazardous", "Teren niebezpieczny", "RYZYKO", "Koszt ruchu 2; wejscie daje 1 suppression.", {
    movementCost: 2,
    hazardSuppression: 1,
    traits: ["Hazardous"],
  }),
  define("HighGround", "Wysoki teren", "WYSOKI", "+1 do ataku, koszt ruchu 2.", {
    attackBonus: 1,
    movementCost: 2,
    traits: ["Elevated"],
  }),
];

export function getTerrainDefinition(terrainType: TerrainType): TerrainDefinition | undefined {
  return terrainDefinitions.find((definition) => definition.terrainType === terrainType);
}

export function createTerrainTile(
  terrainType: TerrainType,
  x: number,
  y: number,
): TerrainTile {
  const definition = getTerrainDefinition(terrainType);
  if (!definition) throw new Error(`Unknown terrain type: ${terrainType}.`);
  const { name: _name, shortLabel: _shortLabel, description: _description, ...tile } = definition;
  return { ...tile, traits: [...tile.traits], x, y };
}

export function hasTerrainTrait(
  terrain: Pick<TerrainTile, "terrainType" | "traits"> | undefined,
  trait: TerrainTrait,
): boolean {
  return Boolean(
    terrain?.traits?.includes(trait) ||
    getTerrainDefinition(terrain?.terrainType ?? "")?.traits.includes(trait),
  );
}

export function isTerrainEnterable(terrain: TerrainTile | undefined): boolean {
  return !hasTerrainTrait(terrain, "Impassable");
}

function define(
  terrainType: TerrainType,
  name: string,
  shortLabel: string,
  description: string,
  overrides: Partial<TerrainDefinition> = {},
): TerrainDefinition {
  return {
    terrainType,
    name,
    shortLabel,
    description,
    defenseBonus: 0,
    attackBonus: 0,
    movementCost: 1,
    blocksLineOfSight: false,
    traits: [],
    ...overrides,
  };
}
