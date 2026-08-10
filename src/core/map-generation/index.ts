export { generateMap } from "./map-generator";
export {
  createMapArmyLayout,
  generateDeploymentZones,
  type DeploymentEdge,
} from "./deployment-zone-generator";
export { validateMapConnectivity, type MapConnectivity } from "./map-connectivity";
export {
  desertOutpostTheme,
  forestMoonTheme,
  getMapTheme,
  getMapThemeTerrainColor,
  iceFrontTheme,
  mapThemes,
  volcanicFoundryTheme,
} from "./map-themes";
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
  MapThemeMotif,
  MapThemeTerrainPalette,
} from "./map-generation-types";
