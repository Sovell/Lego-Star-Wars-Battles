import { galacticHyperlanes } from "../galactic-conquest/galaxy";
import type { HyperlaneDefinition, StrategicFaction } from "../galactic-conquest/galaxy-model";
import type {
  CampaignArmy,
  CampaignMovementEncounter,
  CampaignMovementResult,
  CampaignRoute,
  CampaignState,
} from "./campaign-types";

type AdjacentPlanet = { planetId: string; movementCost: number };

export function beginCampaignActivationPhase(
  state: CampaignState,
  initiativeOrder: readonly string[] = state.initiativeOrder,
): CampaignState {
  if (state.phase !== "Income") {
    throw new Error(`Cannot begin campaign activations during ${state.phase}.`);
  }
  if (state.incomeCollectedForTurn !== state.turn) {
    throw new Error(`Process campaign economy for turn ${state.turn} before activations.`);
  }
  validateInitiativeOrder(state, initiativeOrder);
  const nextState: CampaignState = {
    ...state,
    phase: "Activation",
    initiativeOrder: [...initiativeOrder],
    activePlayerId: undefined,
  };
  const activePlayerId = findNextEligiblePlayer(nextState);
  return activePlayerId
    ? { ...nextState, activePlayerId }
    : { ...nextState, phase: "Resolution" };
}

export function getLegalCampaignRoutes(
  state: CampaignState,
  armyId: string,
  hyperlanes: readonly HyperlaneDefinition[] = galacticHyperlanes,
): CampaignRoute[] {
  const army = state.armies.find(({ id }) => id === armyId);
  if (!army || !canActivateArmy(state, army)) return [];
  const adjacency = createAdjacencyMap(hyperlanes);
  const routes = new Map<string, CampaignRoute>();
  const bestCost = new Map<string, number>([[army.planetId, 0]]);
  const queue: CampaignRoute[] = [{
    destinationPlanetId: army.planetId,
    planetIds: [army.planetId],
    movementCost: 0,
  }];

  while (queue.length > 0) {
    queue.sort(compareRoutes);
    const current = queue.shift()!;
    if (current.movementCost !== bestCost.get(current.destinationPlanetId)) continue;
    for (const neighbor of adjacency.get(current.destinationPlanetId) ?? []) {
      const movementCost = current.movementCost + neighbor.movementCost;
      if (movementCost > army.movementPointsRemaining) continue;
      const knownCost = bestCost.get(neighbor.planetId);
      if (knownCost !== undefined && knownCost <= movementCost) continue;

      const encounter = getMovementEncounter(state, army, neighbor.planetId);
      const route: CampaignRoute = {
        destinationPlanetId: neighbor.planetId,
        planetIds: [...current.planetIds, neighbor.planetId],
        movementCost,
        ...(encounter ? { encounter } : {}),
      };
      bestCost.set(neighbor.planetId, movementCost);
      routes.set(neighbor.planetId, route);
      if (!encounter) queue.push(route);
    }
  }

  return [...routes.values()].sort(compareRoutes);
}

export function moveCampaignArmy(
  state: CampaignState,
  armyId: string,
  destinationPlanetId: string,
  hyperlanes: readonly HyperlaneDefinition[] = galacticHyperlanes,
): { state: CampaignState; movement: CampaignMovementResult } {
  const army = requireActivatableArmy(state, armyId);
  if (destinationPlanetId === army.planetId) {
    throw new Error("A campaign army must move to a different planet.");
  }
  const route = getLegalCampaignRoutes(state, armyId, hyperlanes)
    .find((candidate) => candidate.destinationPlanetId === destinationPlanetId);
  if (!route) {
    throw new Error(`Planet ${destinationPlanetId} is not reachable by army ${armyId}.`);
  }
  const destination = state.planets.find(({ planetId }) => planetId === destinationPlanetId);
  if (!destination) throw new Error(`Unknown campaign planet: ${destinationPlanetId}.`);
  const arrivalSector =
    destination.sectors.find(({ controllerPlayerId }) => controllerPlayerId === army.ownerPlayerId) ??
    destination.sectors.find(({ ownerFactionId }) => ownerFactionId === army.factionId) ??
    destination.sectors.find(({ ownerFactionId }) => ownerFactionId === "Neutral") ??
    destination.sectors[0];
  if (!arrivalSector) throw new Error(`Campaign planet ${destinationPlanetId} has no sectors.`);

  const movedState: CampaignState = {
    ...state,
    armies: state.armies.map((candidate) => candidate.id === armyId
      ? {
          ...candidate,
          planetId: destinationPlanetId,
          sectorId: arrivalSector.sectorId,
          movementPointsRemaining: candidate.movementPointsRemaining - route.movementCost,
        }
      : candidate),
  };
  const nextState = finishCampaignArmyActivation(movedState, armyId, false);
  return {
    state: nextState,
    movement: {
      armyId,
      fromPlanetId: army.planetId,
      toPlanetId: destinationPlanetId,
      route,
    },
  };
}

export function finishCampaignArmyActivation(
  state: CampaignState,
  armyId: string,
  spendRemainingMovement = true,
): CampaignState {
  const army = requireActivatableArmy(state, armyId);
  const activatedState: CampaignState = {
    ...state,
    armies: state.armies.map((candidate) => candidate.id === army.id
      ? {
          ...candidate,
          activatedThisTurn: true,
          movementPointsRemaining: spendRemainingMovement ? 0 : candidate.movementPointsRemaining,
        }
      : candidate),
  };
  const activePlayerId = findNextEligiblePlayer(activatedState, army.ownerPlayerId);
  return activePlayerId
    ? { ...activatedState, activePlayerId }
    : { ...activatedState, phase: "Resolution", activePlayerId: undefined };
}

export function startNextCampaignTurn(state: CampaignState): CampaignState {
  if (state.phase !== "Resolution") {
    throw new Error(`Cannot start the next campaign turn during ${state.phase}.`);
  }
  return {
    ...state,
    turn: state.turn + 1,
    phase: "Income",
    activePlayerId: undefined,
    armies: state.armies.map((army) => ({
      ...army,
      activatedThisTurn: false,
      movementPointsRemaining: state.rules.movementPointsPerActivation,
    })),
  };
}

function requireActivatableArmy(state: CampaignState, armyId: string): CampaignArmy {
  const army = state.armies.find(({ id }) => id === armyId);
  if (!army) throw new Error(`Unknown campaign army: ${armyId}.`);
  if (state.phase !== "Activation") {
    throw new Error(`Campaign armies cannot activate during ${state.phase}.`);
  }
  if (army.activatedThisTurn) throw new Error(`Campaign army ${armyId} already activated this turn.`);
  if (state.activePlayerId !== army.ownerPlayerId) {
    throw new Error(`Campaign army ${armyId} does not belong to the active player.`);
  }
  return army;
}

function canActivateArmy(state: CampaignState, army: CampaignArmy): boolean {
  return state.phase === "Activation" &&
    !army.activatedThisTurn &&
    state.activePlayerId === army.ownerPlayerId;
}

function getMovementEncounter(
  state: CampaignState,
  movingArmy: CampaignArmy,
  planetId: string,
): CampaignMovementEncounter | undefined {
  const enemyArmy = state.armies.some((army) =>
    army.id !== movingArmy.id &&
    army.planetId === planetId &&
    isEnemyFaction(movingArmy.factionId, army.factionId)
  );
  const enemyBase = state.bases.some((base) =>
    base.planetId === planetId && isEnemyFaction(movingArmy.factionId, base.factionId)
  );
  if (enemyArmy && enemyBase) return "EnemyArmyAndBase";
  if (enemyArmy) return "EnemyArmy";
  if (enemyBase) return "EnemyBase";
  return undefined;
}

function isEnemyFaction(left: StrategicFaction, right: StrategicFaction): boolean {
  return left !== right;
}

function createAdjacencyMap(
  hyperlanes: readonly HyperlaneDefinition[],
): Map<string, AdjacentPlanet[]> {
  const adjacency = new Map<string, AdjacentPlanet[]>();
  for (const lane of hyperlanes) {
    if (!Number.isInteger(lane.movementCost) || lane.movementCost <= 0) {
      throw new Error(`Hyperlane ${lane.id} requires a positive integer movement cost.`);
    }
    addAdjacent(adjacency, lane.fromPlanetId, lane.toPlanetId, lane.movementCost);
    addAdjacent(adjacency, lane.toPlanetId, lane.fromPlanetId, lane.movementCost);
  }
  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => left.planetId.localeCompare(right.planetId));
  }
  return adjacency;
}

function addAdjacent(
  adjacency: Map<string, AdjacentPlanet[]>,
  fromPlanetId: string,
  planetId: string,
  movementCost: number,
): void {
  const neighbors = adjacency.get(fromPlanetId) ?? [];
  neighbors.push({ planetId, movementCost });
  adjacency.set(fromPlanetId, neighbors);
}

function compareRoutes(left: CampaignRoute, right: CampaignRoute): number {
  return left.movementCost - right.movementCost ||
    left.planetIds.join("/").localeCompare(right.planetIds.join("/"));
}

function validateInitiativeOrder(state: CampaignState, initiativeOrder: readonly string[]): void {
  const playerIds = state.players.map(({ id }) => id);
  if (
    initiativeOrder.length !== playerIds.length ||
    new Set(initiativeOrder).size !== initiativeOrder.length ||
    playerIds.some((id) => !initiativeOrder.includes(id))
  ) {
    throw new Error("Initiative order must contain every campaign player exactly once.");
  }
}

function findNextEligiblePlayer(
  state: CampaignState,
  afterPlayerId?: string,
): string | undefined {
  const startIndex = afterPlayerId
    ? state.initiativeOrder.indexOf(afterPlayerId) + 1
    : 0;
  for (let offset = 0; offset < state.initiativeOrder.length; offset += 1) {
    const index = (startIndex + offset) % state.initiativeOrder.length;
    const playerId = state.initiativeOrder[index];
    if (state.armies.some((army) => army.ownerPlayerId === playerId && !army.activatedThisTurn)) {
      return playerId;
    }
  }
  return undefined;
}
