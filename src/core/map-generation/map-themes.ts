import type { TerrainType } from "../../types";
import type { MapTheme, MapThemeId } from "./map-generation-types";

export const desertOutpostTheme: MapTheme = {
  id: "desert-outpost",
  version: 2,
  name: "Tatooine — Desert Outpost",
  description: "Wyschnięte pustkowie z wydmami, skałami i rozsianymi placówkami.",
  presentation: {
    assetSetId: "tatooine-outpost",
    groundTextureId: "tatooine-sand",
    motif: "dunes",
    palette: {
      ground: "#9a673d",
      accent: "#f0c46b",
      shadow: "#281d19",
      terrain: {
        open: "#6f5035",
        lightCover: "#70603b",
        heavyCover: "#594a3f",
        building: "#554a43",
        difficultTerrain: "#8a552f",
      },
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

export const forestMoonTheme: MapTheme = {
  id: "forest-moon",
  version: 1,
  name: "Endor — Forest Moon",
  description: "Gęsty leśny księżyc z paprociami, głazami i imperialną infrastrukturą.",
  presentation: {
    assetSetId: "endor-forest",
    groundTextureId: "endor-underbrush",
    motif: "forest",
    palette: {
      ground: "#31492f",
      accent: "#8fc46b",
      shadow: "#101a14",
      terrain: {
        open: "#35483a",
        lightCover: "#315d38",
        heavyCover: "#263f31",
        building: "#414a43",
        difficultTerrain: "#4f4931",
      },
    },
  },
  generation: {
    defaultTerrainDensity: 0.46,
    clusterSize: { minimum: 3, maximum: 7 },
    terrainWeights: [
      { terrainType: "LightCover", weight: 5 },
      { terrainType: "HeavyCover", weight: 3 },
      { terrainType: "DifficultTerrain", weight: 2 },
      { terrainType: "Building", weight: 1 },
    ],
    objectBudget: {
      minimum: 2,
      maximum: 4,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 4 },
        { objectType: "HeavyFortification", weight: 1 },
      ],
    },
  },
};

export const iceFrontTheme: MapTheme = {
  id: "ice-front",
  version: 1,
  name: "Hoth — Ice Front",
  description: "Otwarta lodowa równina, zaspy, szczeliny i umocnione pozycje rebelianckie.",
  presentation: {
    assetSetId: "hoth-ice",
    groundTextureId: "hoth-snow",
    motif: "ice",
    palette: {
      ground: "#91afbd",
      accent: "#d9f5ff",
      shadow: "#172631",
      terrain: {
        open: "#819da9",
        lightCover: "#7696a4",
        heavyCover: "#627d8c",
        building: "#536977",
        difficultTerrain: "#6d8795",
      },
    },
  },
  generation: {
    defaultTerrainDensity: 0.3,
    clusterSize: { minimum: 2, maximum: 6 },
    terrainWeights: [
      { terrainType: "DifficultTerrain", weight: 5 },
      { terrainType: "HeavyCover", weight: 3 },
      { terrainType: "LightCover", weight: 2 },
      { terrainType: "Building", weight: 1 },
    ],
    objectBudget: {
      minimum: 2,
      maximum: 4,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 2 },
        { objectType: "HeavyFortification", weight: 2 },
      ],
    },
  },
};

export const volcanicFoundryTheme: MapTheme = {
  id: "volcanic-foundry",
  version: 1,
  name: "Mustafar — Volcanic Foundry",
  description: "Wulkaniczny kompleks przemysłowy przecięty zastygłą lawą i ciężkimi konstrukcjami.",
  presentation: {
    assetSetId: "mustafar-foundry",
    groundTextureId: "mustafar-basalt",
    motif: "lava",
    palette: {
      ground: "#4a2923",
      accent: "#ff7a32",
      shadow: "#160e10",
      terrain: {
        open: "#3b2d2d",
        lightCover: "#49362f",
        heavyCover: "#342e32",
        building: "#41383a",
        difficultTerrain: "#6d2d1f",
      },
    },
  },
  generation: {
    defaultTerrainDensity: 0.4,
    clusterSize: { minimum: 2, maximum: 5 },
    terrainWeights: [
      { terrainType: "DifficultTerrain", weight: 6 },
      { terrainType: "Building", weight: 2 },
      { terrainType: "HeavyCover", weight: 2 },
      { terrainType: "LightCover", weight: 1 },
    ],
    objectBudget: {
      minimum: 3,
      maximum: 5,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 2 },
        { objectType: "HeavyFortification", weight: 3 },
      ],
    },
  },
};

export const mapThemes: readonly MapTheme[] = [
  desertOutpostTheme,
  forestMoonTheme,
  iceFrontTheme,
  volcanicFoundryTheme,
];

export function getMapTheme(themeId: MapThemeId): MapTheme {
  const theme = mapThemes.find(({ id }) => id === themeId);
  if (!theme) {
    throw new Error(`Unknown map theme: ${themeId}.`);
  }
  return theme;
}

export function getMapThemeTerrainColor(
  themeId: MapThemeId,
  terrainType: TerrainType,
): string {
  const terrain = getMapTheme(themeId).presentation.palette.terrain;
  switch (terrainType) {
    case "LightCover": return terrain.lightCover;
    case "HeavyCover": return terrain.heavyCover;
    case "Building": return terrain.building;
    case "DifficultTerrain": return terrain.difficultTerrain;
    default: return terrain.open;
  }
}
