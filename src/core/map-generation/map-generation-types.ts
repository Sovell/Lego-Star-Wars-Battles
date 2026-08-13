import type { ScenarioDefinition } from "../scenario/scenario-types";
import type { Army, BattlefieldObjectType, Board, TeamId, TerrainType } from "../../types";
import type { MapThemeId } from "./map-theme-id";

export type { MapThemeId } from "./map-theme-id";

export type MapThemeMotif =
  | "dunes"
  | "forest"
  | "ice"
  | "lava"
  | "spires"
  | "fungal"
  | "crystal"
  | "mandalore"
  | "starship";

export type MapGenerationMotif =
  | "open-outpost"
  | "forest-lanes"
  | "ice-fields"
  | "lava-channels"
  | "canyons"
  | "organic-islands"
  | "urban-grid";

export type MapThemeTerrainPalette = {
  open: string;
  lightCover: string;
  heavyCover: string;
  building: string;
  difficultTerrain: string;
  impassable: string;
  hazardous: string;
  highGround: string;
};

export type MapTerrainWeight = {
  terrainType: TerrainType;
  weight: number;
};

export type MapObjectWeight = {
  objectType: Extract<
    BattlefieldObjectType,
    "LightFortification" | "HeavyFortification"
  >;
  weight: number;
};

export type MapObjectPlacement = "defender-side" | "center" | "distributed";

export type MapScenarioObjectRequirement = {
  objectType: BattlefieldObjectType;
  count: number;
  placement: MapObjectPlacement;
};

export type MapScenarioRequirements = {
  scenarioId?: string;
  defenderArmySlot?: number;
  deploymentZones: ScenarioDefinition["deploymentZones"];
  requiredObjects: MapScenarioObjectRequirement[];
};

export type MapGenerationArmy = Pick<Army, "id" | "teamId">;

export type MapGenerationArmyLayout = {
  armyId: string;
  teamId: TeamId | string;
};

export type MapTheme = {
  id: MapThemeId;
  version: number;
  name: string;
  description: string;
  presentation: {
    assetSetId: string;
    groundTextureId: string;
    motif: MapThemeMotif;
    palette: {
      ground: string;
      accent: string;
      shadow: string;
      terrain: MapThemeTerrainPalette;
    };
  };
  generation: {
    motif: MapGenerationMotif;
    defaultTerrainDensity: number;
    clusterSize: {
      minimum: number;
      maximum: number;
    };
    terrainWeights: MapTerrainWeight[];
    objectBudget: {
      minimum: number;
      maximum: number;
      minimumSpacing: number;
      objectWeights: MapObjectWeight[];
    };
  };
};

export type MapGenerationConfig = {
  width: number;
  height: number;
  seed: number;
  themeId: MapThemeId;
  terrainDensity?: number;
  scenario?: ScenarioDefinition;
  defenderArmySlot?: number;
  armies?: MapGenerationArmy[];
  deploymentDepth?: number;
};

export type MapGenerationRecipe = {
  generatorVersion: 4;
  width: number;
  height: number;
  seed: number;
  themeId: MapThemeId;
  themeVersion: number;
  generationMotif: MapGenerationMotif;
  terrainDensity: number;
  scenarioId?: string;
  defenderArmySlot?: number;
  deploymentDepth: number;
  armyLayout: MapGenerationArmyLayout[];
};

export type GeneratedMap = {
  board: Board;
  deploymentZones: ScenarioDefinition["deploymentZones"];
  recipe: MapGenerationRecipe;
};
