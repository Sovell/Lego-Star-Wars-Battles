import { createTerrainTile, terrainDefinitions } from "./terrain-definitions";

export const terrainPresets = terrainDefinitions.map(({ terrainType }) =>
  createTerrainTile(terrainType, 0, 0)
);
