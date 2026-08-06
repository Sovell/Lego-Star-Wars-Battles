import type { ScenarioDefinition } from "../scenario/scenario-types";
import type { Army, BattlefieldObjectType, Board, TeamId, TerrainType } from "../../types";

export type MapThemeId = "desert-outpost";

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
    palette: {
      ground: string;
      accent: string;
      shadow: string;
    };
  };
  generation: {
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
  generatorVersion: 3;
  width: number;
  height: number;
  seed: number;
  themeId: MapThemeId;
  themeVersion: number;
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
