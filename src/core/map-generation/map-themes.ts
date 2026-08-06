import type { MapTheme, MapThemeId } from "./map-generation-types";

export const desertOutpostTheme: MapTheme = {
  id: "desert-outpost",
  version: 2,
  name: "Desert Outpost",
  description: "A dry frontier battlefield with scattered rocks, ruins, and fortified positions.",
  presentation: {
    assetSetId: "prototype-desert",
    groundTextureId: "desert-sand",
    palette: {
      ground: "#b9814f",
      accent: "#dfbd79",
      shadow: "#4d3529",
    },
  },
  generation: {
    defaultTerrainDensity: 0.34,
    clusterSize: {
      minimum: 2,
      maximum: 5,
    },
    terrainWeights: [
      { terrainType: "DifficultTerrain", weight: 4 },
      { terrainType: "LightCover", weight: 3 },
      { terrainType: "HeavyCover", weight: 2 },
      { terrainType: "Building", weight: 1 },
    ],
    objectBudget: {
      minimum: 3,
      maximum: 5,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 3 },
        { objectType: "HeavyFortification", weight: 1 },
      ],
    },
  },
};

export const mapThemes: readonly MapTheme[] = [desertOutpostTheme];

export function getMapTheme(themeId: MapThemeId): MapTheme {
  const theme = mapThemes.find(({ id }) => id === themeId);
  if (!theme) {
    throw new Error(`Unknown map theme: ${themeId}.`);
  }
  return theme;
}
