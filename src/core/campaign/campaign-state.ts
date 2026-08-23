import { unitTemplates } from "../../data";
import { isHeroTemplate } from "../army-roster";
import { appendCampaignEvent } from "./campaign-history";
import { createGalacticConquest, getGalacticPlanet } from "../galactic-conquest/galaxy";
import type { GalacticPlanetState, StrategicFaction } from "../galactic-conquest/galaxy-model";
import type {
  CampaignArmy,
  CampaignPlanetState,
  CampaignPlayer,
  CampaignPlayerSetup,
  CampaignRules,
  CampaignState,
  CreateCampaignInput,
  HeroCampaignState,
} from "./campaign-types";

export const DEFAULT_CAMPAIGN_RULES: Readonly<CampaignRules> = {
  movementPointsPerActivation: 3,
  armyPointLimit: 150,
  maxHeroesPerArmy: 1,
  heroLives: 3,
};

const STARTING_CREDITS = 10;
const STARTING_UNIT_BY_FACTION: Record<StrategicFaction, string> = {
  Republic: "clone_trooper_squad",
  Separatists: "b1_droid_squad",
};

export function createCampaignState(input: CreateCampaignInput): CampaignState {
  validateCampaignInput(input);
  const conquest = createGalacticConquest(input.seed);
  const players = input.players.map((player): CampaignPlayer => ({
    ...player,
    credits: STARTING_CREDITS,
  }));
  const planetAssignments = assignControlledPlanets(conquest.planets, players);
  const planets = conquest.planets.map((planet): CampaignPlanetState => {
    const definition = getGalacticPlanet(planet.planetId);
    return {
      planetId: planet.planetId,
      mapThemeId: definition.mapThemeId,
      ...(definition.capitalOf ? { capitalOf: definition.capitalOf } : {}),
      sectors: planet.provinces.map((sector, index) => {
        const controllerPlayerId = sector.controller === "Neutral"
          ? undefined
          : planetAssignments.get(planet.planetId)?.get(sector.controller);
        return {
          planetId: planet.planetId,
          sectorId: sector.id,
          role: index === 0 ? "Command" : index === 1 ? "Landing" : "Infrastructure",
          income: Math.max(2, sector.income),
          battleArchetype: sector.battleArchetype,
          ownerFactionId: sector.controller,
          ...(controllerPlayerId ? { controllerPlayerId } : {}),
          fortificationLevel: sector.fortificationLevel,
        };
      }),
    };
  });
  const armies = createStartingArmies(players, planets);

  return appendCampaignEvent({
    id: input.id,
    name: input.name,
    seed: input.seed,
    turn: 1,
    phase: "Income",
    players,
    initiativeOrder: createInitiativeOrder(players),
    planets,
    armies,
    bases: [],
    constructionQueue: [],
    recruitmentQueue: [],
    reserves: [],
    heroes: createHeroCampaignStates(DEFAULT_CAMPAIGN_RULES.heroLives),
    rules: { ...DEFAULT_CAMPAIGN_RULES },
    incomeCollectedForTurn: 0,
  }, { type: "CampaignStarted" });
}

function validateCampaignInput(input: CreateCampaignInput): void {
  if (!input.id.trim()) throw new Error("Campaign id cannot be empty.");
  if (!input.name.trim()) throw new Error("Campaign name cannot be empty.");
  if (!Number.isInteger(input.seed)) throw new Error("Campaign seed must be an integer.");
  if (input.players.length !== 2 && input.players.length !== 4) {
    throw new Error("A campaign requires exactly 2 or 4 players.");
  }
  const ids = new Set<string>();
  for (const player of input.players) {
    if (!player.id.trim() || !player.name.trim()) {
      throw new Error("Campaign players require a non-empty id and name.");
    }
    if (ids.has(player.id)) throw new Error(`Duplicate campaign player id: ${player.id}.`);
    ids.add(player.id);
  }
  const republicPlayers = input.players.filter(({ factionId }) => factionId === "Republic");
  const separatistPlayers = input.players.filter(({ factionId }) => factionId === "Separatists");
  if (republicPlayers.length !== separatistPlayers.length) {
    throw new Error("Republic and Separatists require the same number of commanders.");
  }
}

function assignControlledPlanets(
  planets: GalacticPlanetState[],
  players: CampaignPlayer[],
): Map<string, Map<StrategicFaction, string>> {
  const assignments = new Map<string, Map<StrategicFaction, string>>();
  for (const factionId of ["Republic", "Separatists"] satisfies StrategicFaction[]) {
    const factionPlayers = players.filter((player) => player.factionId === factionId);
    const factionPlanets = planets.filter((planet) =>
      planet.provinces.some((sector) => sector.controller === factionId)
    );
    factionPlanets.forEach((planet, index) => {
      assignments.set(
        planet.planetId,
        new Map([[factionId, factionPlayers[index % factionPlayers.length].id]]),
      );
    });
  }
  return assignments;
}

function createStartingArmies(
  players: CampaignPlayer[],
  planets: CampaignPlanetState[],
): CampaignArmy[] {
  return players.map((player) => {
    const startingSector = planets
      .flatMap(({ sectors }) => sectors)
      .find((sector) => sector.controllerPlayerId === player.id);
    if (!startingSector) {
      throw new Error(`No starting sector is available for player ${player.id}.`);
    }
    const armyId = `${player.id}-army-1`;
    return {
      id: armyId,
      name: `${player.name} — Army 1`,
      ownerPlayerId: player.id,
      factionId: player.factionId,
      planetId: startingSector.planetId,
      sectorId: startingSector.sectorId,
      units: [1, 2].map((number) => ({
        id: `${armyId}-unit-${number}`,
        templateId: STARTING_UNIT_BY_FACTION[player.factionId],
      })),
      heroIds: [],
      activatedThisTurn: false,
      movementPointsRemaining: DEFAULT_CAMPAIGN_RULES.movementPointsPerActivation,
    };
  });
}

function createHeroCampaignStates(heroLives: number): HeroCampaignState[] {
  return unitTemplates
    .filter((template) =>
      isHeroTemplate(template) &&
      (template.faction === "Republic" || template.faction === "Separatists")
    )
    .map((template): HeroCampaignState => ({
      heroId: template.id,
      factionId: template.faction as StrategicFaction,
      livesRemaining: heroLives,
      xp: 0,
      level: 1,
      status: "Available",
      availableFromTurn: 1,
    }));
}

export function createStandardCampaignPlayers(
  playerNames: readonly string[],
  controls: readonly ("Human" | "Bot")[] = playerNames.map((_, index) =>
    index < playerNames.length / 2 ? "Human" : "Bot"
  ),
): CampaignPlayerSetup[] {
  if (playerNames.length !== 2 && playerNames.length !== 4) {
    throw new Error("Provide exactly 2 or 4 player names.");
  }
  if (controls.length !== playerNames.length) {
    throw new Error("Provide one tactical controller for every campaign player.");
  }
  const perFaction = playerNames.length / 2;
  return playerNames.map((name, index) => ({
    id: `player-${index + 1}`,
    name,
    factionId: index < perFaction ? "Republic" : "Separatists",
    control: controls[index],
  }));
}

function createInitiativeOrder(players: CampaignPlayer[]): string[] {
  const republic = players.filter(({ factionId }) => factionId === "Republic");
  const separatists = players.filter(({ factionId }) => factionId === "Separatists");
  return republic.flatMap((player, index) => [player.id, separatists[index].id]);
}
