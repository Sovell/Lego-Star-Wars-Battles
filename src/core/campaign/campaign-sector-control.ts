import { galacticHyperlanes } from "../galactic-conquest/galaxy";
import type { StrategicFaction } from "../galactic-conquest/galaxy-model";
import {
  finishCampaignArmyActivation,
  moveCampaignArmy,
} from "./campaign-movement";
import type {
  CampaignArmy,
  CampaignConflict,
  CampaignConflictOutcome,
  CampaignConflictResolution,
  CampaignPlanetController,
  CampaignPlanetState,
  CampaignSectorAction,
  CampaignSectorState,
  CampaignState,
} from "./campaign-types";

export function getCampaignPlanetController(
  state: CampaignState,
  planetId: string,
): CampaignPlanetController {
  const planet = requirePlanet(state, planetId);
  const owners = new Set(planet.sectors.map(({ ownerFactionId }) => ownerFactionId));
  if (owners.size === 1) return [...owners][0];
  return "Contested";
}

export function getLegalCampaignSectorTargets(
  state: CampaignState,
  armyId: string,
): CampaignSectorState[] {
  const army = state.armies.find(({ id }) => id === armyId);
  if (
    !army ||
    state.phase !== "Activation" ||
    state.activePlayerId !== army.ownerPlayerId ||
    army.activatedThisTurn ||
    state.pendingConflict
  ) return [];
  const planet = requirePlanet(state, army.planetId);
  return planet.sectors.filter((sector) =>
    sector.ownerFactionId !== army.factionId &&
    isCommandSectorUnlocked(planet, sector, army.factionId)
  );
}

export function attackCampaignSector(
  state: CampaignState,
  armyId: string,
  sectorId: string,
): { state: CampaignState; action: CampaignSectorAction } {
  assertNoPendingConflict(state);
  const army = requireArmy(state, armyId);
  const planet = requirePlanet(state, army.planetId);
  const sector = requireSector(planet, sectorId);
  validateSectorAttack(state, army, planet, sector);
  const resumeState = finishCampaignArmyActivation(state, armyId);
  return settleSectorAction(
    resumeState,
    army,
    sector,
    "SectorAssault",
    army.planetId,
    army.sectorId,
    false,
  );
}

export function invadeCampaignPlanet(
  state: CampaignState,
  armyId: string,
  destinationPlanetId: string,
  preferredSectorId?: string,
): { state: CampaignState; action: CampaignSectorAction } {
  assertNoPendingConflict(state);
  const army = requireArmy(state, armyId);
  if (army.planetId === destinationPlanetId) {
    throw new Error("Use attackCampaignSector for a sector on the army's current planet.");
  }
  const destination = requirePlanet(state, destinationPlanetId);
  const target = selectInvasionTarget(state, army, destination, preferredSectorId);
  validateSectorAttack(state, army, destination, target, true);
  const originPlanetId = army.planetId;
  const originSectorId = army.sectorId;
  const moved = moveCampaignArmy(state, armyId, destinationPlanetId);
  const movedArmy = requireArmy(moved.state, armyId);
  const stateAtTarget: CampaignState = {
    ...moved.state,
    armies: moved.state.armies.map((candidate) => candidate.id === armyId
      ? { ...candidate, sectorId: target.sectorId }
      : candidate),
  };
  return settleSectorAction(
    stateAtTarget,
    movedArmy,
    target,
    "Invasion",
    originPlanetId,
    originSectorId,
    true,
  );
}

export function resolveCampaignConflict(
  state: CampaignState,
  outcome: CampaignConflictOutcome,
): CampaignConflictResolution {
  const conflict = state.pendingConflict;
  if (state.phase !== "Battle" || !conflict) {
    throw new Error("The campaign has no battle awaiting resolution.");
  }
  if (conflict.id !== outcome.conflictId) {
    throw new Error(`Unexpected campaign conflict: ${outcome.conflictId}.`);
  }
  if (
    outcome.winnerFactionId !== conflict.attackerFactionId &&
    outcome.winnerFactionId !== conflict.defenderFactionId
  ) {
    throw new Error("Conflict winner must be its attacker or defender.");
  }

  const attackerWon = outcome.winnerFactionId === conflict.attackerFactionId;
  let nextState: CampaignState = { ...state, pendingConflict: undefined };
  const retreatedArmyIds: string[] = [];
  const eliminatedArmyIds: string[] = [];

  if (attackerWon) {
    nextState = captureSector(
      nextState,
      conflict.planetId,
      conflict.sectorId,
      conflict.attackerFactionId,
      conflict.attackerPlayerId,
      conflict.attackerArmyId,
    );
    if (conflict.defenderBaseId) {
      nextState = destroyCampaignBase(nextState, conflict.defenderBaseId);
    }
    if (conflict.defenderArmyId) {
      const retreat = retreatDefendingArmy(nextState, conflict);
      nextState = retreat.state;
      (retreat.eliminated ? eliminatedArmyIds : retreatedArmyIds).push(conflict.defenderArmyId);
    }
  } else {
    const retreat = retreatAttackingArmy(nextState, conflict);
    nextState = retreat.state;
    (retreat.eliminated ? eliminatedArmyIds : retreatedArmyIds).push(conflict.attackerArmyId);
  }

  const capturedCapital = attackerWon && isCapturedEnemyCapital(nextState, conflict);
  nextState = capturedCapital
    ? {
        ...nextState,
        phase: "Finished",
        activePlayerId: undefined,
        winnerFactionId: conflict.attackerFactionId,
      }
    : {
        ...nextState,
        phase: conflict.resumePhase,
        activePlayerId: conflict.resumePlayerId,
      };

  return {
    state: nextState,
    capturedSector: attackerWon,
    retreatedArmyIds,
    eliminatedArmyIds,
  };
}

function settleSectorAction(
  resumeState: CampaignState,
  attacker: CampaignArmy,
  sector: CampaignSectorState,
  kind: CampaignConflict["kind"],
  originPlanetId: string,
  originSectorId: string,
  planetWideDefense: boolean,
): { state: CampaignState; action: CampaignSectorAction } {
  const defenderArmy = resumeState.armies
    .filter((army) =>
      army.id !== attacker.id &&
      army.factionId !== attacker.factionId &&
      army.planetId === sector.planetId &&
      (planetWideDefense || army.sectorId === sector.sectorId)
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  const defenderBase = resumeState.bases
    .filter((base) =>
      base.factionId !== attacker.factionId &&
      base.planetId === sector.planetId &&
      (planetWideDefense || base.sectorId === sector.sectorId)
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  const defenderFactionId = defenderArmy?.factionId ??
    defenderBase?.factionId ??
    (sector.ownerFactionId === "Neutral" ? undefined : sector.ownerFactionId);
  const requiresBattle = Boolean(
    defenderArmy ||
    defenderBase ||
    (sector.role === "Command" && defenderFactionId)
  );

  if (!requiresBattle || !defenderFactionId) {
    const capturedState = captureSector(
      resumeState,
      sector.planetId,
      sector.sectorId,
      attacker.factionId,
      attacker.ownerPlayerId,
      attacker.id,
    );
    return {
      state: capturedState,
      action: {
        type: "CapturedWithoutBattle",
        planetId: sector.planetId,
        sectorId: sector.sectorId,
      },
    };
  }

  const conflict: CampaignConflict = {
    id: `${resumeState.id}:turn-${resumeState.turn}:${attacker.id}:${sector.planetId}:${sector.sectorId}`,
    kind,
    turn: resumeState.turn,
    planetId: sector.planetId,
    sectorId: sector.sectorId,
    attackerArmyId: attacker.id,
    attackerFactionId: attacker.factionId,
    attackerPlayerId: attacker.ownerPlayerId,
    defenderFactionId,
    ...(defenderArmy ? { defenderArmyId: defenderArmy.id } : {}),
    ...(defenderBase ? { defenderBaseId: defenderBase.id } : {}),
    originPlanetId,
    originSectorId,
    resumePhase: resumeState.phase === "Resolution" ? "Resolution" : "Activation",
    ...(resumeState.activePlayerId ? { resumePlayerId: resumeState.activePlayerId } : {}),
  };
  return {
    state: {
      ...resumeState,
      phase: "Battle",
      activePlayerId: undefined,
      pendingConflict: conflict,
    },
    action: {
      type: "BattleRequired",
      planetId: sector.planetId,
      sectorId: sector.sectorId,
      conflict,
    },
  };
}

function validateSectorAttack(
  state: CampaignState,
  army: CampaignArmy,
  planet: CampaignPlanetState,
  sector: CampaignSectorState,
  allowDifferentPlanet = false,
): void {
  if (state.phase !== "Activation") {
    throw new Error(`Campaign sectors cannot be attacked during ${state.phase}.`);
  }
  if (state.activePlayerId !== army.ownerPlayerId || army.activatedThisTurn) {
    throw new Error(`Campaign army ${army.id} cannot activate now.`);
  }
  if (!allowDifferentPlanet && army.planetId !== planet.planetId) {
    throw new Error(`Campaign army ${army.id} is not on planet ${planet.planetId}.`);
  }
  if (sector.ownerFactionId === army.factionId) {
    throw new Error(`Campaign sector ${sector.sectorId} is already friendly.`);
  }
  if (!isCommandSectorUnlocked(planet, sector, army.factionId)) {
    throw new Error("A capital command sector is locked until its other sectors are captured.");
  }
}

function isCommandSectorUnlocked(
  planet: CampaignPlanetState,
  sector: CampaignSectorState,
  attackerFactionId: StrategicFaction,
): boolean {
  if (!planet.capitalOf || sector.role !== "Command") return true;
  return planet.sectors
    .filter(({ sectorId }) => sectorId !== sector.sectorId)
    .every(({ ownerFactionId }) => ownerFactionId === attackerFactionId);
}

function selectInvasionTarget(
  state: CampaignState,
  army: CampaignArmy,
  destination: CampaignPlanetState,
  preferredSectorId?: string,
): CampaignSectorState {
  const blockerArmy = state.armies
    .filter((candidate) =>
      candidate.id !== army.id &&
      candidate.factionId !== army.factionId &&
      candidate.planetId === destination.planetId
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  const blockerBase = state.bases
    .filter((base) =>
      base.factionId !== army.factionId && base.planetId === destination.planetId
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  const forcedSectorId = blockerArmy?.sectorId ?? blockerBase?.sectorId;
  if (forcedSectorId) return requireSector(destination, forcedSectorId);
  if (preferredSectorId) return requireSector(destination, preferredSectorId);
  const roleOrder: CampaignSectorState["role"][] = ["Landing", "Infrastructure", "Command"];
  for (const role of roleOrder) {
    const sector = destination.sectors.find((candidate) =>
      candidate.role === role && candidate.ownerFactionId !== army.factionId
    );
    if (sector) return sector;
  }
  throw new Error(`Planet ${destination.planetId} has no sector available for invasion.`);
}

function captureSector(
  state: CampaignState,
  planetId: string,
  sectorId: string,
  factionId: StrategicFaction,
  playerId: string,
  armyId: string,
): CampaignState {
  return {
    ...state,
    planets: state.planets.map((planet) => planet.planetId === planetId
      ? {
          ...planet,
          sectors: planet.sectors.map((sector) => sector.sectorId === sectorId
            ? {
                ...sector,
                ownerFactionId: factionId,
                controllerPlayerId: playerId,
                fortificationLevel: 0,
              }
            : sector),
        }
      : planet),
    armies: state.armies.map((army) => army.id === armyId
      ? { ...army, sectorId }
      : army),
  };
}

function retreatAttackingArmy(
  state: CampaignState,
  conflict: CampaignConflict,
): { state: CampaignState; eliminated: boolean } {
  const bridgehead = requirePlanet(state, conflict.planetId).sectors.find(
    ({ ownerFactionId }) => ownerFactionId === conflict.attackerFactionId,
  );
  const destination = bridgehead
    ? { planetId: conflict.planetId, sectorId: bridgehead.sectorId }
    : { planetId: conflict.originPlanetId, sectorId: conflict.originSectorId };
  return moveOrEliminateArmy(state, conflict.attackerArmyId, destination);
}

function retreatDefendingArmy(
  state: CampaignState,
  conflict: CampaignConflict,
): { state: CampaignState; eliminated: boolean } {
  const localSector = requirePlanet(state, conflict.planetId).sectors.find(
    ({ ownerFactionId }) => ownerFactionId === conflict.defenderFactionId,
  );
  if (localSector) {
    return moveOrEliminateArmy(state, conflict.defenderArmyId!, {
      planetId: conflict.planetId,
      sectorId: localSector.sectorId,
    });
  }
  const neighboringPlanetIds = galacticHyperlanes
    .flatMap((lane) => lane.fromPlanetId === conflict.planetId
      ? [lane.toPlanetId]
      : lane.toPlanetId === conflict.planetId
        ? [lane.fromPlanetId]
        : [])
    .sort();
  for (const planetId of neighboringPlanetIds) {
    const sector = state.planets.find((planet) => planet.planetId === planetId)?.sectors
      .find(({ ownerFactionId }) => ownerFactionId === conflict.defenderFactionId);
    if (sector) {
      return moveOrEliminateArmy(state, conflict.defenderArmyId!, {
        planetId,
        sectorId: sector.sectorId,
      });
    }
  }
  return moveOrEliminateArmy(state, conflict.defenderArmyId!, undefined);
}

function moveOrEliminateArmy(
  state: CampaignState,
  armyId: string,
  destination?: { planetId: string; sectorId: string },
): { state: CampaignState; eliminated: boolean } {
  if (!state.armies.some(({ id }) => id === armyId)) return { state, eliminated: true };
  if (!destination) {
    return {
      state: { ...state, armies: state.armies.filter(({ id }) => id !== armyId) },
      eliminated: true,
    };
  }
  return {
    state: {
      ...state,
      armies: state.armies.map((army) => army.id === armyId
        ? { ...army, ...destination }
        : army),
    },
    eliminated: false,
  };
}

function destroyCampaignBase(state: CampaignState, baseId: string): CampaignState {
  const cancelledRecruitment = state.recruitmentQueue.filter((order) => order.baseId === baseId);
  const cancelledHeroIds = new Set(
    cancelledRecruitment.filter(({ kind }) => kind === "Hero").map(({ templateId }) => templateId),
  );
  return {
    ...state,
    bases: state.bases.filter(({ id }) => id !== baseId),
    constructionQueue: state.constructionQueue.filter((order) => order.baseId !== baseId),
    recruitmentQueue: state.recruitmentQueue.filter((order) => order.baseId !== baseId),
    heroes: state.heroes.map((hero) => cancelledHeroIds.has(hero.heroId) && hero.status === "Queued"
      ? {
          ...hero,
          status: "Available",
          ownerPlayerId: undefined,
          reservePlanetId: undefined,
        }
      : hero),
  };
}

function isCapturedEnemyCapital(state: CampaignState, conflict: CampaignConflict): boolean {
  const planet = requirePlanet(state, conflict.planetId);
  return Boolean(
    planet.capitalOf &&
    planet.capitalOf !== conflict.attackerFactionId &&
    planet.sectors.every(({ ownerFactionId }) => ownerFactionId === conflict.attackerFactionId),
  );
}

function assertNoPendingConflict(state: CampaignState): void {
  if (state.pendingConflict || state.phase === "Battle") {
    throw new Error("Resolve the pending campaign conflict before starting another one.");
  }
}

function requireArmy(state: CampaignState, armyId: string): CampaignArmy {
  const army = state.armies.find(({ id }) => id === armyId);
  if (!army) throw new Error(`Unknown campaign army: ${armyId}.`);
  return army;
}

function requirePlanet(state: CampaignState, planetId: string): CampaignPlanetState {
  const planet = state.planets.find((candidate) => candidate.planetId === planetId);
  if (!planet) throw new Error(`Unknown campaign planet: ${planetId}.`);
  return planet;
}

function requireSector(planet: CampaignPlanetState, sectorId: string): CampaignSectorState {
  const sector = planet.sectors.find((candidate) => candidate.sectorId === sectorId);
  if (!sector) throw new Error(`Unknown campaign sector: ${planet.planetId}/${sectorId}.`);
  return sector;
}
