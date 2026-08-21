import { getCampaignPlanetController } from "../../core/campaign";
import type { CampaignPlanetController, CampaignState } from "../../core/campaign";
import {
  galacticPlanets,
  lockedGalacticLocations,
} from "../../core/galactic-conquest/galaxy";

export type CampaignMapNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  playable: boolean;
  controller: CampaignPlanetController | "Locked";
  sectorControllers: CampaignPlanetController[];
  armyCount: number;
  baseLevel?: number;
};

export function buildCampaignMapNodes(state: CampaignState): CampaignMapNode[] {
  const playableNodes = galacticPlanets.map((definition): CampaignMapNode => {
    const planet = state.planets.find(({ planetId }) => planetId === definition.id);
    if (!planet) throw new Error(`Campaign is missing planet ${definition.id}.`);
    const base = state.bases.find(({ planetId }) => planetId === definition.id);
    return {
      id: definition.id,
      name: definition.name,
      x: definition.position.x,
      y: definition.position.y,
      playable: true,
      controller: getCampaignPlanetController(state, definition.id),
      sectorControllers: planet.sectors.map(({ ownerFactionId }) => ownerFactionId),
      armyCount: state.armies.filter(({ planetId }) => planetId === definition.id).length,
      ...(base ? { baseLevel: base.level } : {}),
    };
  });

  return [
    ...playableNodes,
    ...lockedGalacticLocations.map((definition): CampaignMapNode => ({
      id: definition.id,
      name: definition.name,
      x: definition.position.x,
      y: definition.position.y,
      playable: false,
      controller: "Locked",
      sectorControllers: [],
      armyCount: 0,
    })),
  ];
}

export function getCampaignOverview(state: CampaignState) {
  const controlledSectors = state.planets
    .flatMap(({ sectors }) => sectors)
    .filter(({ ownerFactionId }) => ownerFactionId !== "Neutral").length;
  const totalIncome = state.planets
    .flatMap(({ sectors }) => sectors)
    .reduce((sum, { income }) => sum + income, 0);
  return {
    playablePlanets: state.planets.length,
    controlledSectors,
    totalSectors: state.planets.reduce((sum, { sectors }) => sum + sectors.length, 0),
    totalIncome,
    activeArmies: state.armies.length,
  };
}

export function getSectorName(planetId: string, sectorId: string): string {
  const definition = galacticPlanets.find(({ id }) => id === planetId);
  const sector = definition
    ? [definition.fixedProvince, ...definition.variableProvincePool]
      .find(({ id }) => id === sectorId)
    : undefined;
  return sector?.name ?? sectorId;
}
