export { generateMap } from "./map-generator";
export {
  createMapArmyLayout,
  generateDeploymentZones,
  type DeploymentEdge,
} from "./deployment-zone-generator";
export { validateMapConnectivity, type MapConnectivity } from "./map-connectivity";
export { desertOutpostTheme, getMapTheme, mapThemes } from "./map-themes";
export { getMapScenarioRequirements } from "./scenario-map-requirements";
export type {
  GeneratedMap,
  MapGenerationArmy,
  MapGenerationArmyLayout,
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
