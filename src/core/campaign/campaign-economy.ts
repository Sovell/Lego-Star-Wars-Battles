import { unitTemplates } from "../../data";
import type { UnitTemplate } from "../../types";
import { isHeroTemplate } from "../army-roster";
import { getCampaignPlanetController } from "./campaign-sector-control";
import type {
  CampaignArmy,
  CampaignBaseLevel,
  CampaignBaseState,
  CampaignConstructionOrder,
  CampaignIncomeBreakdown,
  CampaignPlayer,
  CampaignRecruitmentOrder,
  CampaignReserveUnit,
  CampaignState,
} from "./campaign-types";

export const BASE_CONSTRUCTION_COST: Readonly<Record<CampaignBaseLevel, number>> = {
  1: 20,
  2: 40,
  3: 60,
};
export const PLANET_CONTROL_BONUS = 2;
export const CAPITAL_STIPEND = 5;

const templateById = new Map(unitTemplates.map((template) => [template.id, template]));

export type DeployCampaignReservesInput = {
  playerId: string;
  planetId: string;
  unitIds?: string[];
  heroIds?: string[];
  armyId?: string;
  armyName?: string;
};

export function getCampaignIncomeBreakdown(
  state: CampaignState,
  playerId: string,
): CampaignIncomeBreakdown {
  const player = requirePlayer(state, playerId);
  const sectorIncome = state.planets
    .flatMap(({ sectors }) => sectors)
    .filter(({ controllerPlayerId }) => controllerPlayerId === playerId)
    .reduce((total, { income }) => total + income, 0);
  const controlledPlanets = state.planets.filter((planet) =>
    getCampaignPlanetController(state, planet.planetId) === player.factionId
  );
  const planetControlBonus = controlledPlanets
    .filter((planet) =>
      planet.sectors.find(({ role }) => role === "Command")?.controllerPlayerId === playerId
    )
    .length * PLANET_CONTROL_BONUS;
  const capitalStipend = controlledPlanets.some(({ capitalOf }) => capitalOf === player.factionId)
    ? CAPITAL_STIPEND
    : 0;
  return {
    playerId,
    sectorIncome,
    planetControlBonus,
    capitalStipend,
    total: sectorIncome + planetControlBonus + capitalStipend,
  };
}

export function processCampaignEconomy(
  state: CampaignState,
): { state: CampaignState; income: CampaignIncomeBreakdown[] } {
  if (state.phase !== "Income") {
    throw new Error(`Campaign economy cannot be processed during ${state.phase}.`);
  }
  if (state.incomeCollectedForTurn === state.turn) {
    throw new Error(`Campaign income for turn ${state.turn} was already collected.`);
  }
  let nextState = releaseReturningHeroes(state);
  nextState = completeConstructionOrders(nextState);
  nextState = completeRecruitmentOrders(nextState);
  const income = nextState.players.map((player) =>
    getCampaignIncomeBreakdown(nextState, player.id)
  );
  const incomeByPlayer = new Map(income.map((entry) => [entry.playerId, entry.total]));
  nextState = {
    ...nextState,
    players: nextState.players.map((player) => ({
      ...player,
      credits: player.credits + (incomeByPlayer.get(player.id) ?? 0),
    })),
    incomeCollectedForTurn: nextState.turn,
  };
  return { state: nextState, income };
}

export function queueBaseConstruction(
  state: CampaignState,
  playerId: string,
  planetId: string,
): CampaignState {
  requireEconomyWindow(state);
  const player = requirePlayer(state, playerId);
  const commandSector = requireControlledCommandSector(state, player, planetId);
  if (state.bases.some((base) => base.planetId === planetId)) {
    throw new Error(`Planet ${planetId} already has a base.`);
  }
  if (state.constructionQueue.some((order) => order.planetId === planetId)) {
    throw new Error(`Planet ${planetId} already has construction in progress.`);
  }
  const cost = BASE_CONSTRUCTION_COST[1];
  requireCredits(player, cost);
  const order: CampaignConstructionOrder = {
    id: nextOrderId(state, "construction"),
    kind: "BuildBase",
    ownerPlayerId: playerId,
    factionId: player.factionId,
    planetId,
    sectorId: commandSector.sectorId,
    targetLevel: 1,
    cost,
    orderedOnTurn: state.turn,
    completesOnTurn: state.turn + 1,
  };
  return spendCredits({
    ...state,
    constructionQueue: [...state.constructionQueue, order],
  }, playerId, cost);
}

export function queueBaseUpgrade(
  state: CampaignState,
  playerId: string,
  baseId: string,
): CampaignState {
  requireEconomyWindow(state);
  const player = requirePlayer(state, playerId);
  const base = requireBase(state, baseId);
  if (base.ownerPlayerId !== playerId) throw new Error(`Base ${baseId} belongs to another player.`);
  requireControlledCommandSector(state, player, base.planetId);
  if (base.level === 3) throw new Error(`Base ${baseId} is already level 3.`);
  if (state.constructionQueue.some((order) => order.planetId === base.planetId)) {
    throw new Error(`Planet ${base.planetId} already has construction in progress.`);
  }
  const targetLevel = (base.level + 1) as CampaignBaseLevel;
  const cost = BASE_CONSTRUCTION_COST[targetLevel];
  requireCredits(player, cost);
  const order: CampaignConstructionOrder = {
    id: nextOrderId(state, "construction"),
    kind: "UpgradeBase",
    ownerPlayerId: playerId,
    factionId: player.factionId,
    planetId: base.planetId,
    sectorId: base.sectorId,
    targetLevel,
    cost,
    orderedOnTurn: state.turn,
    completesOnTurn: state.turn + 1,
    baseId,
  };
  return spendCredits({
    ...state,
    constructionQueue: [...state.constructionQueue, order],
  }, playerId, cost);
}

export function queueCampaignRecruitment(
  state: CampaignState,
  playerId: string,
  baseId: string,
  templateId: string,
  quantity = 1,
): CampaignState {
  requireEconomyWindow(state);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Recruitment quantity must be a positive integer.");
  }
  const player = requirePlayer(state, playerId);
  const base = requireBase(state, baseId);
  if (base.ownerPlayerId !== playerId) throw new Error(`Base ${baseId} belongs to another player.`);
  const template = requireTemplate(templateId);
  if (template.faction !== player.factionId) {
    throw new Error(`Unit ${templateId} belongs to another faction.`);
  }
  const requiredLevel = getRequiredBaseLevel(templateId);
  if (base.level < requiredLevel) {
    throw new Error(`Unit ${templateId} requires a level ${requiredLevel} base.`);
  }
  const isHero = isHeroTemplate(template);
  if (isHero && quantity !== 1) throw new Error("Named heroes must be recruited individually.");
  if (isHero) {
    const hero = state.heroes.find(({ heroId }) => heroId === templateId);
    if (!hero || hero.status !== "Available" || hero.availableFromTurn > state.turn) {
      throw new Error(`Hero ${templateId} is not available for recruitment.`);
    }
  }
  const cost = template.cost * quantity;
  requireCredits(player, cost);
  const order: CampaignRecruitmentOrder = {
    id: nextOrderId(state, "recruitment"),
    ownerPlayerId: playerId,
    factionId: player.factionId,
    baseId,
    planetId: base.planetId,
    templateId,
    quantity,
    cost,
    orderedOnTurn: state.turn,
    completesOnTurn: state.turn + 1,
    kind: isHero ? "Hero" : "Unit",
  };
  const queuedState: CampaignState = {
    ...state,
    recruitmentQueue: [...state.recruitmentQueue, order],
    heroes: isHero
      ? state.heroes.map((hero) => hero.heroId === templateId
        ? {
            ...hero,
            status: "Queued",
            ownerPlayerId: playerId,
            reservePlanetId: undefined,
          }
        : hero)
      : state.heroes,
  };
  return spendCredits(queuedState, playerId, cost);
}

export function getRequiredBaseLevel(templateId: string): CampaignBaseLevel {
  const template = requireTemplate(templateId);
  const normalizedRole = template.role.toLowerCase();
  if (template.category === "vehicle" || normalizedRole.includes("heavy")) return 3;
  if (
    isHeroTemplate(template) ||
    template.category === "commander" ||
    template.keywords.some((keyword) => ["Elite", "Engineer", "Medic"].includes(keyword)) ||
    ["support", "command", "engineer", "medical", "elite"].some((term) =>
      normalizedRole.includes(term)
    )
  ) return 2;
  return 1;
}

export function deployCampaignReserves(
  state: CampaignState,
  input: DeployCampaignReservesInput,
): CampaignState {
  requireEconomyWindow(state);
  const player = requirePlayer(state, input.playerId);
  const unitIds = [...new Set(input.unitIds ?? [])];
  const heroIds = [...new Set(input.heroIds ?? [])];
  if (unitIds.length === 0 && heroIds.length === 0) {
    throw new Error("Select at least one reserve unit or hero.");
  }
  if (state.bases.every((base) =>
    base.ownerPlayerId !== input.playerId || base.planetId !== input.planetId
  )) {
    throw new Error(`Player ${input.playerId} has no base on planet ${input.planetId}.`);
  }
  const reserves = unitIds.map((unitId) => {
    const reserve = state.reserves.find(({ id }) => id === unitId);
    if (
      !reserve ||
      reserve.ownerPlayerId !== input.playerId ||
      reserve.planetId !== input.planetId
    ) throw new Error(`Reserve unit ${unitId} is not available on ${input.planetId}.`);
    return reserve;
  });
  const heroes = heroIds.map((heroId) => {
    const hero = state.heroes.find((candidate) => candidate.heroId === heroId);
    if (
      !hero ||
      hero.status !== "Reserve" ||
      hero.ownerPlayerId !== input.playerId ||
      hero.reservePlanetId !== input.planetId
    ) throw new Error(`Reserve hero ${heroId} is not available on ${input.planetId}.`);
    return hero;
  });
  const existingArmy = input.armyId
    ? state.armies.find(({ id }) => id === input.armyId)
    : undefined;
  if (input.armyId && !existingArmy) throw new Error(`Unknown campaign army: ${input.armyId}.`);
  if (existingArmy && (
    existingArmy.ownerPlayerId !== input.playerId || existingArmy.planetId !== input.planetId
  )) throw new Error(`Army ${existingArmy.id} cannot receive these reserves.`);

  const combinedHeroIds = [...(existingArmy?.heroIds ?? []), ...heroIds];
  if (combinedHeroIds.length > state.rules.maxHeroesPerArmy) {
    throw new Error(`An army may contain at most ${state.rules.maxHeroesPerArmy} named hero.`);
  }
  const combinedUnits = [
    ...(existingArmy?.units ?? []),
    ...reserves.map(({ id, templateId }) => ({ id, templateId })),
  ];
  const pointCost = getCampaignArmyPointCost(combinedUnits, combinedHeroIds);
  if (pointCost > state.rules.armyPointLimit) {
    throw new Error(`Army point limit exceeded: ${pointCost}/${state.rules.armyPointLimit}.`);
  }

  const armyId = existingArmy?.id ?? nextArmyId(state, input.playerId);
  const base = state.bases.find((candidate) =>
    candidate.ownerPlayerId === input.playerId && candidate.planetId === input.planetId
  )!;
  const army: CampaignArmy = existingArmy
    ? { ...existingArmy, units: combinedUnits, heroIds: combinedHeroIds }
    : {
        id: armyId,
        name: input.armyName?.trim() || `${player.name} - Army ${armyNumber(armyId)}`,
        ownerPlayerId: player.id,
        factionId: player.factionId,
        planetId: input.planetId,
        sectorId: base.sectorId,
        units: combinedUnits,
        heroIds: combinedHeroIds,
        activatedThisTurn: false,
        movementPointsRemaining: state.rules.movementPointsPerActivation,
      };
  return {
    ...state,
    armies: existingArmy
      ? state.armies.map((candidate) => candidate.id === armyId ? army : candidate)
      : [...state.armies, army],
    reserves: state.reserves.filter(({ id }) => !unitIds.includes(id)),
    heroes: state.heroes.map((hero) => heroIds.includes(hero.heroId)
      ? {
          ...hero,
          status: "Assigned",
          assignedArmyId: armyId,
          reservePlanetId: undefined,
        }
      : hero),
  };
}

export function getCampaignArmyPointCost(
  units: readonly { templateId: string }[],
  heroIds: readonly string[] = [],
): number {
  return [...units.map(({ templateId }) => templateId), ...heroIds]
    .reduce((total, templateId) => total + requireTemplate(templateId).cost, 0);
}

function completeConstructionOrders(state: CampaignState): CampaignState {
  let bases = [...state.bases];
  for (const order of state.constructionQueue.filter(({ completesOnTurn }) =>
    completesOnTurn <= state.turn
  )) {
    const player = state.players.find(({ id }) => id === order.ownerPlayerId);
    if (!player || !canPlayerControlBaseSite(state, player, order.planetId)) continue;
    if (order.kind === "BuildBase") {
      if (bases.some(({ planetId }) => planetId === order.planetId)) continue;
      bases.push({
        id: `base:${order.ownerPlayerId}:${order.planetId}`,
        ownerPlayerId: order.ownerPlayerId,
        factionId: order.factionId,
        planetId: order.planetId,
        sectorId: order.sectorId,
        level: 1,
      });
    } else {
      bases = bases.map((base) => base.id === order.baseId && base.ownerPlayerId === order.ownerPlayerId
        ? { ...base, level: order.targetLevel }
        : base);
    }
  }
  return {
    ...state,
    bases,
    constructionQueue: state.constructionQueue.filter(({ completesOnTurn }) =>
      completesOnTurn > state.turn
    ),
  };
}

function releaseReturningHeroes(state: CampaignState): CampaignState {
  return {
    ...state,
    heroes: state.heroes.map((hero) =>
      hero.status === "Unavailable" &&
      hero.livesRemaining > 0 &&
      hero.availableFromTurn <= state.turn
        ? {
            ...hero,
            status: "Available",
            ownerPlayerId: undefined,
            reservePlanetId: undefined,
            assignedArmyId: undefined,
          }
        : hero),
  };
}

function completeRecruitmentOrders(state: CampaignState): CampaignState {
  let reserves = [...state.reserves];
  let heroes = [...state.heroes];
  for (const order of state.recruitmentQueue.filter(({ completesOnTurn }) =>
    completesOnTurn <= state.turn
  )) {
    const baseExists = state.bases.some((base) =>
      base.id === order.baseId && base.ownerPlayerId === order.ownerPlayerId
    );
    if (!baseExists) {
      if (order.kind === "Hero") {
        heroes = heroes.map((hero) => hero.heroId === order.templateId && hero.status === "Queued"
          ? { ...hero, status: "Available", ownerPlayerId: undefined }
          : hero);
      }
      continue;
    }
    if (order.kind === "Hero") {
      heroes = heroes.map((hero) => hero.heroId === order.templateId
        ? {
            ...hero,
            status: "Reserve",
            ownerPlayerId: order.ownerPlayerId,
            reservePlanetId: order.planetId,
          }
        : hero);
    } else {
      reserves = [
        ...reserves,
        ...Array.from({ length: order.quantity }, (_, index): CampaignReserveUnit => ({
          id: `${order.id}:unit-${index + 1}`,
          templateId: order.templateId,
          ownerPlayerId: order.ownerPlayerId,
          factionId: order.factionId,
          planetId: order.planetId,
          sourceOrderId: order.id,
        })),
      ];
    }
  }
  return {
    ...state,
    reserves,
    heroes,
    recruitmentQueue: state.recruitmentQueue.filter(({ completesOnTurn }) =>
      completesOnTurn > state.turn
    ),
  };
}

function requireEconomyWindow(state: CampaignState): void {
  if (state.phase !== "Income" || state.incomeCollectedForTurn !== state.turn) {
    throw new Error("Construction and recruitment require the processed Income phase.");
  }
}

function requireControlledCommandSector(
  state: CampaignState,
  player: CampaignPlayer,
  planetId: string,
) {
  if (getCampaignPlanetController(state, planetId) !== player.factionId) {
    throw new Error(`Faction ${player.factionId} does not fully control planet ${planetId}.`);
  }
  const commandSector = state.planets.find((planet) => planet.planetId === planetId)?.sectors
    .find(({ role }) => role === "Command");
  if (!commandSector || commandSector.controllerPlayerId !== player.id) {
    throw new Error(`Player ${player.id} does not control the command sector on ${planetId}.`);
  }
  return commandSector;
}

function canPlayerControlBaseSite(
  state: CampaignState,
  player: CampaignPlayer,
  planetId: string,
): boolean {
  try {
    requireControlledCommandSector(state, player, planetId);
    return true;
  } catch {
    return false;
  }
}

function spendCredits(state: CampaignState, playerId: string, amount: number): CampaignState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId
      ? { ...player, credits: player.credits - amount }
      : player),
  };
}

function requireCredits(player: CampaignPlayer, amount: number): void {
  if (player.credits < amount) {
    throw new Error(`Player ${player.id} needs ${amount} credits but has ${player.credits}.`);
  }
}

function requirePlayer(state: CampaignState, playerId: string): CampaignPlayer {
  const player = state.players.find(({ id }) => id === playerId);
  if (!player) throw new Error(`Unknown campaign player: ${playerId}.`);
  return player;
}

function requireBase(state: CampaignState, baseId: string): CampaignBaseState {
  const base = state.bases.find(({ id }) => id === baseId);
  if (!base) throw new Error(`Unknown campaign base: ${baseId}.`);
  return base;
}

function requireTemplate(templateId: string): UnitTemplate {
  const template = templateById.get(templateId);
  if (!template) throw new Error(`Unknown unit template: ${templateId}.`);
  return template;
}

function nextOrderId(state: CampaignState, prefix: string): string {
  const count = state.constructionQueue.length + state.recruitmentQueue.length + 1;
  return `${state.id}:${prefix}:turn-${state.turn}:${count}`;
}

function nextArmyId(state: CampaignState, playerId: string): string {
  let number = state.armies.filter(({ ownerPlayerId }) => ownerPlayerId === playerId).length + 1;
  while (state.armies.some(({ id }) => id === `${playerId}-army-${number}`)) number += 1;
  return `${playerId}-army-${number}`;
}

function armyNumber(armyId: string): string {
  return armyId.split("-").at(-1) ?? "1";
}
