import type { Board, TerrainType } from "../../types";

export type MapThemeId = "desert-outpost";

export type MapTerrainWeight = {
  terrainType: TerrainType;
  weight: number;
};

export type MapTheme = {
  id: MapThemeId;
  name: string;
  description: string;
  presentation: {
    assetSetId: string;
    groundTextureId: string;
    palette: {
      ground: string;
      accent: string;
      shadow: string;
    };
  };
  generation: {
    defaultTerrainDensity: number;
    terrainWeights: MapTerrainWeight[];
  };
};

export type MapGenerationConfig = {
  width: number;
  height: number;
  seed: number;
  themeId: MapThemeId;
  terrainDensity?: number;
};

export type MapGenerationRecipe = {
  generatorVersion: 1;
  width: number;
  height: number;
  seed: number;
  themeId: MapThemeId;
  terrainDensity: number;
};

export type GeneratedMap = {
  board: Board;
  recipe: MapGenerationRecipe;
};
