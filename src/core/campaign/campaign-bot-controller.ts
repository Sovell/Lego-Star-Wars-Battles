import { unitTemplates } from "../../data";
import { getCampaignPlanetController, getLegalCampaignSectorTargets, invadeCampaignPlanet, attackCampaignSector } from "./campaign-sector-control";
import { getLegalCampaignRoutes, finishCampaignArmyActivation, moveCampaignArmy } from "./campaign-movement";
import {
  BASE_CONSTRUCTION_COST,
  deployCampaignReserves,
  getCampaignArmyPointCost,
  getRequiredBaseLevel,
  queueBaseConstruction,
  queueBaseUpgrade,
  queueCampaignRecruitment,
} from "./campaign-economy";
import type { CampaignArmy, CampaignPlayer, CampaignState } from "./campaign-types";

export type CampaignBotAction =
  | { kind: "BuildBase"; playerId: string; planetId: string; reason: string }
  | { kind: "UpgradeBase"; playerId: string; baseId: string; reason: string }
  | { kind: "Recruit"; playerId: string; baseId: string; templateId: string; reason: string }
  | { kind: "DeployReserves"; playerId: string; planetId: string; unitIds: string[]; heroIds: string[]; armyId?: string; reason: string }
  | { kind: "SectorAssault"; playerId: string; armyId: string; sectorId: string; reason: string }
  | { kind: "Invasion"; playerId: string; armyId: string; planetId: string; reason: string }
  | { kind: "Move"; playerId: string; armyId: string; planetId: string; reason: string }
  | { kind: "FinishActivation"; playerId: string; armyId: string; reason: string };

export type CampaignBotStep = {
  state: CampaignState;
  action: CampaignBotAction;
  battleRequired: boolean;
};

/**
 * Returns exactly one deterministic strategic decision. Repeated calls advance
 * consecutive bot players until a human turn, a battle, or no bot work remains.
 */
export function runNextCampaignBotAction(state: CampaignState): CampaignBotStep | undefined {
  const action = chooseCampaignBotAction(state);
  if (!action) return undefined;

  if (action.kind === "BuildBase") {
    return { state: queueBaseConstruction(state, action.playerId, action.planetId), action, battleRequired: false };
  }
  if (action.kind === "UpgradeBase") {
    return { state: queueBaseUpgrade(state, action.playerId, action.baseId), action, battleRequired: false };
  }
  if (action.kind === "Recruit") {
    return { state: queueCampaignRecruitment(state, action.playerId, action.baseId, action.templateId), action, battleRequired: false };
  }
  if (action.kind === "DeployReserves") {
    return {
      state: deployCampaignReserves(state, action),
      action,
      battleRequired: false,
    };
  }
  if (action.kind === "SectorAssault") {
    const result = attackCampaignSector(state, action.armyId, action.sectorId);
    return { state: result.state, action, battleRequired: result.action.type === "BattleRequired" };
  }
  if (action.kind === "Invasion") {
    const result = invadeCampaignPlanet(state, action.armyId, action.planetId);
    return { state: result.state, action, battleRequired: result.action.type === "BattleRequired" };
  }
  if (action.kind === "Move") {
    return { state: moveCampaignArmy(state, action.armyId, action.planetId).state, action, battleRequired: false };
  }
  return { state: finishCampaignArmyActivation(state, action.armyId), action, battleRequired: false };
}

export function chooseCampaignBotAction(state: CampaignState): CampaignBotAction | undefined {
  if (state.phase === "Income" && state.incomeCollectedForTurn === state.turn) {
    return chooseEconomyAction(state);
  }
  if (state.phase === "Activation") return chooseActivationAction(state);
  return undefined;
}

function chooseEconomyAction(state: CampaignState): CampaignBotAction | undefined {
  for (const player of botPlayersInInitiativeOrder(state)) {
    const action = chooseEconomyActionForPlayer(state, player);
    if (action) return action;
  }
  return undefined;
}

function chooseEconomyActionForPlayer(state: CampaignState, player: CampaignPlayer): CampaignBotAction | undefined {
  const ownsConstructionThisTurn = state.constructionQueue.some((order) =>
    order.ownerPlayerId === player.id && order.orderedOnTurn === state.turn
  );
  const controlledPlanets = state.planets
    .filter((planet) => isFullyControlledBy(state, planet.planetId, player))
    .sort((left, right) => comparePlanets(state, player, left.planetId, right.planetId));

  if (!ownsConstructionThisTurn && player.credits >= BASE_CONSTRUCTION_COST[1]) {
    const baseSite = controlledPlanets.find((planet) =>
      !state.bases.some((base) => base.planetId === planet.planetId) &&
      !state.constructionQueue.some((order) => order.planetId === planet.planetId)
    );
    if (baseSite) return {
      kind: "BuildBase",
      playerId: player.id,
      planetId: baseSite.planetId,
      reason: baseSite.capitalOf === player.factionId ? "defend campaign headquarters" : "develop a fully controlled planet",
    };
  }

  if (!ownsConstructionThisTurn) {
    const upgrade = state.bases
      .filter((base) => base.ownerPlayerId === player.id && base.level < 3)
      .filter((base) => isFullyControlledBy(state, base.planetId, player))
      .filter((base) => !state.constructionQueue.some((order) => order.planetId === base.planetId))
      .filter((base) => player.credits >= BASE_CONSTRUCTION_COST[(base.level + 1) as 1 | 2 | 3])
      .sort((left, right) => comparePlanets(state, player, left.planetId, right.planetId) || left.level - right.level)[0];
    if (upgrade) return {
      kind: "UpgradeBase",
      playerId: player.id,
      baseId: upgrade.id,
      reason: upgrade.planetId === capitalPlanetId(state, player) ? "strengthen campaign headquarters" : "improve military production",
    };
  }

  const deployment = chooseReserveDeployment(state, player);
  if (deployment) return deployment;

  const recruitment = chooseRecruitment(state, player);
  if (recruitment) return recruitment;
  return undefined;
}

function chooseReserveDeployment(state: CampaignState, player: CampaignPlayer): CampaignBotAction | undefined {
  const bases = state.bases
    .filter((base) => base.ownerPlayerId === player.id)
    .sort((left, right) => comparePlanets(state, player, left.planetId, right.planetId));
  for (const base of bases) {
    const reserves = state.reserves
      .filter((reserve) => reserve.ownerPlayerId === player.id && reserve.planetId === base.planetId)
      .sort((left, right) => left.id.localeCompare(right.id));
    const heroes = state.heroes
      .filter((hero) => hero.status === "Reserve" && hero.ownerPlayerId === player.id && hero.reservePlanetId === base.planetId)
      .sort((left, right) => left.heroId.localeCompare(right.heroId));
    if (reserves.length === 0 && heroes.length === 0) continue;

    const targets = [
      ...state.armies
        .filter((army) => army.ownerPlayerId === player.id && army.planetId === base.planetId)
        .sort((left, right) => armyPointCost(left) - armyPointCost(right) || left.id.localeCompare(right.id)),
      undefined,
    ];
    for (const target of targets) {
      const currentCost = target ? armyPointCost(target) : 0;
      const unitIds: string[] = [];
      let nextCost = currentCost;
      for (const reserve of reserves) {
        const cost = templateCost(reserve.templateId);
        if (nextCost + cost <= state.rules.armyPointLimit) {
          unitIds.push(reserve.id);
          nextCost += cost;
        }
      }
      const heroIds = target?.heroIds.length ? [] : heroes
        .filter((hero) => nextCost + templateCost(hero.heroId) <= state.rules.armyPointLimit)
        .slice(0, state.rules.maxHeroesPerArmy)
        .map(({ heroId }) => heroId);
      if (unitIds.length > 0 || heroIds.length > 0) return {
        kind: "DeployReserves",
        playerId: player.id,
        planetId: base.planetId,
        unitIds,
        heroIds,
        ...(target ? { armyId: target.id } : {}),
        reason: target ? "reinforce a local army" : "form an army from reserves",
      };
    }
  }
  return undefined;
}

function chooseRecruitment(state: CampaignState, player: CampaignPlayer): CampaignBotAction | undefined {
  const bases = state.bases
    .filter((base) => base.ownerPlayerId === player.id)
    .filter((base) => !state.recruitmentQueue.some((order) =>
      order.baseId === base.id && order.orderedOnTurn === state.turn
    ))
    .sort((left, right) => comparePlanets(state, player, left.planetId, right.planetId));
  const templates = unitTemplates
    .filter((template) => template.faction === player.factionId)
    .filter((template) => !state.heroes.some(({ heroId }) => heroId === template.id))
    .sort((left, right) => left.cost - right.cost || left.id.localeCompare(right.id));
  for (const base of bases) {
    const template = templates.find((candidate) =>
      candidate.cost <= player.credits && getRequiredBaseLevel(candidate.id) <= base.level
    );
    if (template) return {
      kind: "Recruit",
      playerId: player.id,
      baseId: base.id,
      templateId: template.id,
      reason: "replace and expand frontline forces",
    };
  }
  return undefined;
}

function chooseActivationAction(state: CampaignState): CampaignBotAction | undefined {
  const player = state.players.find(({ id }) => id === state.activePlayerId);
  if (!player || player.control !== "Bot") return undefined;
  const candidates = state.armies
    .filter((army) => army.ownerPlayerId === player.id && !army.activatedThisTurn)
    .flatMap((army) => getActivationCandidates(state, player, army));
  const selected = candidates.sort((left, right) => right.score - left.score || left.key.localeCompare(right.key))[0];
  return selected?.action ?? state.armies
    .filter((army) => army.ownerPlayerId === player.id && !army.activatedThisTurn)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((army): CampaignBotAction => ({
      kind: "FinishActivation",
      playerId: player.id,
      armyId: army.id,
      reason: "no purposeful strategic move is available",
    }))[0];
}

function getActivationCandidates(
  state: CampaignState,
  player: CampaignPlayer,
  army: CampaignArmy,
): { action: CampaignBotAction; score: number; key: string }[] {
  const candidates: { action: CampaignBotAction; score: number; key: string }[] = [];
  for (const sector of getLegalCampaignSectorTargets(state, army.id)) {
    candidates.push({
      action: {
        kind: "SectorAssault",
        playerId: player.id,
        armyId: army.id,
        sectorId: sector.sectorId,
        reason: sector.role === "Command" ? "seize a command sector" : "capture an exposed local sector",
      },
      score: scoreSectorTarget(state, army, sector.planetId, sector.sectorId) + 120,
      key: `${army.id}:sector:${sector.sectorId}`,
    });
  }
  for (const route of getLegalCampaignRoutes(state, army.id)) {
    const planet = state.planets.find(({ planetId }) => planetId === route.destinationPlanetId)!;
    const enemySectors = planet.sectors.filter((sector) =>
      sector.ownerFactionId !== "Neutral" && sector.ownerFactionId !== army.factionId
    );
    if (enemySectors.length > 0 || route.encounter) {
      const target = [...enemySectors].sort((left, right) =>
        scoreSectorTarget(state, army, planet.planetId, right.sectorId) - scoreSectorTarget(state, army, planet.planetId, left.sectorId) ||
        left.sectorId.localeCompare(right.sectorId)
      )[0];
      candidates.push({
        action: {
          kind: "Invasion",
          playerId: player.id,
          armyId: army.id,
          planetId: planet.planetId,
          reason: target?.role === "Command" ? "attack an enemy command sector" : "attack a weakened enemy position",
        },
        score: (target ? scoreSectorTarget(state, army, planet.planetId, target.sectorId) : 80) - route.movementCost,
        key: `${army.id}:invasion:${planet.planetId}`,
      });
      continue;
    }
    if (planet.sectors.some(({ ownerFactionId }) => ownerFactionId !== army.factionId)) {
      candidates.push({
        action: {
          kind: "Move",
          playerId: player.id,
          armyId: army.id,
          planetId: planet.planetId,
          reason: "advance toward an unclaimed sector",
        },
        score: scorePlanetDevelopment(state, army, planet.planetId) - route.movementCost,
        key: `${army.id}:move:${planet.planetId}`,
      });
    }
  }
  return candidates;
}

function scoreSectorTarget(state: CampaignState, army: CampaignArmy, planetId: string, sectorId: string): number {
  const planet = state.planets.find((candidate) => candidate.planetId === planetId)!;
  const sector = planet.sectors.find((candidate) => candidate.sectorId === sectorId)!;
  const defense = state.armies
    .filter((candidate) => candidate.planetId === planetId && candidate.factionId !== army.factionId)
    .reduce((total, candidate) => total + candidate.units.length + candidate.heroIds.length * 2, 0) +
    state.bases.filter((base) => base.planetId === planetId && base.factionId !== army.factionId)
      .reduce((total, base) => total + base.level * 2, 0);
  const completesPlanet = planet.sectors
    .filter((candidate) => candidate.sectorId !== sectorId)
    .every((candidate) => candidate.ownerFactionId === army.factionId);
  return (planet.capitalOf && planet.capitalOf !== army.factionId ? 1000 : 0) +
    (sector.role === "Command" ? 280 : 0) +
    (completesPlanet ? 160 : 0) +
    (sector.ownerFactionId === "Neutral" ? 80 : 190) +
    Math.max(-80, army.units.length * 12 - defense * 8);
}

function scorePlanetDevelopment(state: CampaignState, army: CampaignArmy, planetId: string): number {
  const planet = state.planets.find((candidate) => candidate.planetId === planetId)!;
  const unclaimed = planet.sectors.filter(({ ownerFactionId }) => ownerFactionId !== army.factionId).length;
  const ownCapitalThreatened = planet.capitalOf === army.factionId && unclaimed > 0;
  return (ownCapitalThreatened ? 650 : 0) + unclaimed * 45 + planet.sectors.reduce((sum, sector) => sum + sector.income, 0);
}

function botPlayersInInitiativeOrder(state: CampaignState): CampaignPlayer[] {
  return state.initiativeOrder
    .map((id) => state.players.find((player) => player.id === id))
    .filter((player): player is CampaignPlayer => player?.control === "Bot");
}

function isFullyControlledBy(state: CampaignState, planetId: string, player: CampaignPlayer): boolean {
  return getCampaignPlanetController(state, planetId) === player.factionId &&
    state.planets.find((planet) => planet.planetId === planetId)?.sectors
      .some((sector) => sector.role === "Command" && sector.controllerPlayerId === player.id) === true;
}

function comparePlanets(state: CampaignState, player: CampaignPlayer, leftPlanetId: string, rightPlanetId: string): number {
  const left = state.planets.find(({ planetId }) => planetId === leftPlanetId)!;
  const right = state.planets.find(({ planetId }) => planetId === rightPlanetId)!;
  const leftCapital = left.capitalOf === player.factionId ? 1 : 0;
  const rightCapital = right.capitalOf === player.factionId ? 1 : 0;
  const leftIncome = left.sectors.reduce((sum, sector) => sum + sector.income, 0);
  const rightIncome = right.sectors.reduce((sum, sector) => sum + sector.income, 0);
  return rightCapital - leftCapital || rightIncome - leftIncome || leftPlanetId.localeCompare(rightPlanetId);
}

function capitalPlanetId(state: CampaignState, player: CampaignPlayer): string | undefined {
  return state.planets.find(({ capitalOf }) => capitalOf === player.factionId)?.planetId;
}

function armyPointCost(army: CampaignArmy): number {
  return getCampaignArmyPointCost(army.units, army.heroIds);
}

function templateCost(templateId: string): number {
  return unitTemplates.find(({ id }) => id === templateId)?.cost ?? Number.POSITIVE_INFINITY;
}
