import {
  attackCampaignSector,
  finishCampaignArmyActivation,
  getCampaignArmyPointCost,
  getLegalCampaignRoutes,
  getLegalCampaignSectorTargets,
  invadeCampaignPlanet,
  moveCampaignArmy,
  type CampaignArmy,
  type CampaignRoute,
  type CampaignSectorAction,
  type CampaignSectorState,
  type CampaignState,
} from "../../core/campaign";

export type CampaignActivationAction =
  | { kind: "Move"; armyId: string; destinationPlanetId: string }
  | { kind: "Invasion"; armyId: string; destinationPlanetId: string }
  | { kind: "SectorAssault"; armyId: string; sectorId: string }
  | { kind: "Finish"; armyId: string };

export type CampaignActivationDetails = {
  selectableArmies: CampaignArmy[];
  selectedArmy?: CampaignArmy;
  selectedArmyPointCost?: number;
  legalRoutes: CampaignRoute[];
  legalSectorTargets: CampaignSectorState[];
};

export type CampaignActivationResult = {
  state: CampaignState;
  outcome: "Moved" | "Finished" | CampaignSectorAction["type"];
  sectorAction?: CampaignSectorAction;
};

export function getCampaignActivationDetails(
  state: CampaignState,
  selectedArmyId?: string,
): CampaignActivationDetails {
  const selectableArmies = state.phase === "Activation"
    ? state.armies.filter((army) =>
      army.ownerPlayerId === state.activePlayerId && !army.activatedThisTurn
    )
    : [];
  const selectedArmy = selectableArmies.find(({ id }) => id === selectedArmyId);
  return {
    selectableArmies,
    ...(selectedArmy ? {
      selectedArmy,
      selectedArmyPointCost: getCampaignArmyPointCost(selectedArmy.units, selectedArmy.heroIds),
      legalRoutes: getLegalCampaignRoutes(state, selectedArmy.id),
      legalSectorTargets: getLegalCampaignSectorTargets(state, selectedArmy.id),
    } : {
      legalRoutes: [],
      legalSectorTargets: [],
    }),
  };
}

export function getCampaignDestinationAction(
  state: CampaignState,
  armyId: string,
  destinationPlanetId: string,
): CampaignActivationAction {
  const details = getCampaignActivationDetails(state, armyId);
  const army = requireSelectedArmy(details, armyId);
  const route = details.legalRoutes.find((candidate) =>
    candidate.destinationPlanetId === destinationPlanetId
  );
  if (!route) throw new Error(`Planet ${destinationPlanetId} is not reachable by army ${armyId}.`);
  const destination = state.planets.find(({ planetId }) => planetId === destinationPlanetId);
  if (!destination) throw new Error(`Unknown campaign planet: ${destinationPlanetId}.`);
  const hasEnemySector = destination.sectors.some(({ ownerFactionId }) =>
    ownerFactionId !== "Neutral" && ownerFactionId !== army.factionId
  );
  return route.encounter || hasEnemySector
    ? { kind: "Invasion", armyId, destinationPlanetId }
    : { kind: "Move", armyId, destinationPlanetId };
}

export function applyCampaignActivationAction(
  state: CampaignState,
  action: CampaignActivationAction,
): CampaignActivationResult {
  const details = getCampaignActivationDetails(state, action.armyId);
  requireSelectedArmy(details, action.armyId);
  if (action.kind === "Move") {
    const result = moveCampaignArmy(state, action.armyId, action.destinationPlanetId);
    return { state: result.state, outcome: "Moved" };
  }
  if (action.kind === "Invasion") {
    const result = invadeCampaignPlanet(state, action.armyId, action.destinationPlanetId);
    return { state: result.state, outcome: result.action.type, sectorAction: result.action };
  }
  if (action.kind === "SectorAssault") {
    if (!details.legalSectorTargets.some(({ sectorId }) => sectorId === action.sectorId)) {
      throw new Error(`Sector ${action.sectorId} is not a legal target for army ${action.armyId}.`);
    }
    const result = attackCampaignSector(state, action.armyId, action.sectorId);
    return { state: result.state, outcome: result.action.type, sectorAction: result.action };
  }
  return {
    state: finishCampaignArmyActivation(state, action.armyId),
    outcome: "Finished",
  };
}

function requireSelectedArmy(
  details: CampaignActivationDetails,
  armyId: string,
): CampaignArmy {
  if (!details.selectedArmy) {
    throw new Error(`Campaign army ${armyId} cannot activate now.`);
  }
  return details.selectedArmy;
}
