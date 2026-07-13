import type { TerrainTile } from "../types";

export const terrainPresets: TerrainTile[] = [
  {
    x: 0,
    y: 0,
    terrainType: "Open",
    defenseBonus: 0,
    attackBonus: 0,
    movementCost: 1,
    blocksLineOfSight: false,
  },
  {
    x: 0,
    y: 0,
    terrainType: "LightCover",
    defenseBonus: 1,
    attackBonus: 0,
    movementCost: 1,
    blocksLineOfSight: false,
  },
  {
    x: 0,
    y: 0,
    terrainType: "HeavyCover",
    defenseBonus: 2,
    attackBonus: 0,
    movementCost: 2,
    blocksLineOfSight: false,
  },
  {
    x: 0,
    y: 0,
    terrainType: "Building",
    defenseBonus: 2,
    attackBonus: 0,
    movementCost: 2,
    blocksLineOfSight: true,
  },
  {
    x: 0,
    y: 0,
    terrainType: "DifficultTerrain",
    defenseBonus: 0,
    attackBonus: 0,
    movementCost: 2,
    blocksLineOfSight: false,
  },
];
