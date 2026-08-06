export { generateMap } from "./map-generator";
export { validateMapConnectivity, type MapConnectivity } from "./map-connectivity";
export { desertOutpostTheme, getMapTheme, mapThemes } from "./map-themes";
export { getMapScenarioRequirements } from "./scenario-map-requirements";
export type {
  GeneratedMap,
  MapGenerationConfig,
  MapGenerationRecipe,
  MapObjectPlacement,
  MapObjectWeight,
  MapScenarioObjectRequirement,
  MapScenarioRequirements,
  MapTerrainWeight,
  MapTheme,
  MapThemeId,
} from "./map-generation-types";
