import type { CampaignState } from "./campaign-types";

const CAMPAIGN_PHASES = ["Income", "Activation", "Battle", "Resolution", "Finished"] as const;
const FACTIONS = ["Republic", "Separatists"] as const;
const SECTOR_CONTROLLERS = [...FACTIONS, "Neutral"] as const;
const SECTOR_ROLES = ["Landing", "Infrastructure", "Command"] as const;
const BATTLE_ARCHETYPES = [
  "ControlTerritory",
  "DefendPoint",
  "DestroyObjects",
  "ProgressiveControl",
  "RescueAndExtract",
  "SurviveAndExtract",
] as const;
const MAP_THEME_IDS = [
  "desert-outpost",
  "forest-moon",
  "ice-front",
  "volcanic-foundry",
  "geonosis-foundry",
  "felucia-wilds",
  "christophsis-crystal-city",
  "mandalore-city",
  "ryloth-badlands",
  "republic-research-station",
  "separatist-warship",
  "republic-warship",
] as const;
const HERO_STATUSES = ["Available", "Queued", "Reserve", "Assigned", "Unavailable", "Eliminated"] as const;

/** Rejects structurally invalid or internally inconsistent campaign snapshots. */
export function assertCampaignState(value: unknown): asserts value is CampaignState {
  const state = record(value, "campaign");
  nonEmptyString(state.id, "campaign.id");
  nonEmptyString(state.name, "campaign.name");
  integer(state.seed, "campaign.seed");
  positiveInteger(state.turn, "campaign.turn");
  oneOf(state.phase, CAMPAIGN_PHASES, "campaign.phase");
  nonNegativeInteger(state.incomeCollectedForTurn, "campaign.incomeCollectedForTurn");

  const players = array(state.players, "campaign.players").map((entry, index) => {
    const player = record(entry, `campaign.players[${index}]`);
    nonEmptyString(player.id, `campaign.players[${index}].id`);
    nonEmptyString(player.name, `campaign.players[${index}].name`);
    oneOf(player.factionId, FACTIONS, `campaign.players[${index}].factionId`);
    nonNegativeInteger(player.credits, `campaign.players[${index}].credits`);
    return player;
  });
  const playerIds = uniqueStrings(players.map(({ id }) => id), "campaign.players");

  const initiativeOrder = array(state.initiativeOrder, "campaign.initiativeOrder");
  initiativeOrder.forEach((id, index) => nonEmptyString(id, `campaign.initiativeOrder[${index}]`));
  const initiativeIds = uniqueStrings(initiativeOrder, "campaign.initiativeOrder");
  if (initiativeIds.size !== playerIds.size || [...playerIds].some((id) => !initiativeIds.has(id))) {
    fail("campaign.initiativeOrder must contain every campaign player exactly once");
  }
  optionalReference(state.activePlayerId, playerIds, "campaign.activePlayerId", "campaign player");

  const sectorKeys = new Set<string>();
  const planets = array(state.planets, "campaign.planets").map((entry, planetIndex) => {
    const planetPath = `campaign.planets[${planetIndex}]`;
    const planet = record(entry, planetPath);
    nonEmptyString(planet.planetId, `${planetPath}.planetId`);
    oneOf(planet.mapThemeId, MAP_THEME_IDS, `${planetPath}.mapThemeId`);
    if (planet.capitalOf !== undefined) oneOf(planet.capitalOf, FACTIONS, `${planetPath}.capitalOf`);
    array(planet.sectors, `${planetPath}.sectors`).forEach((sectorEntry, sectorIndex) => {
      const sectorPath = `${planetPath}.sectors[${sectorIndex}]`;
      const sector = record(sectorEntry, sectorPath);
      nonEmptyString(sector.planetId, `${sectorPath}.planetId`);
      nonEmptyString(sector.sectorId, `${sectorPath}.sectorId`);
      if (sector.planetId !== planet.planetId) fail(`${sectorPath}.planetId must match its parent planet`);
      oneOf(sector.role, SECTOR_ROLES, `${sectorPath}.role`);
      nonNegativeInteger(sector.income, `${sectorPath}.income`);
      oneOf(sector.battleArchetype, BATTLE_ARCHETYPES, `${sectorPath}.battleArchetype`);
      oneOf(sector.ownerFactionId, SECTOR_CONTROLLERS, `${sectorPath}.ownerFactionId`);
      optionalReference(sector.controllerPlayerId, playerIds, `${sectorPath}.controllerPlayerId`, "campaign player");
      nonNegativeInteger(sector.fortificationLevel, `${sectorPath}.fortificationLevel`);
      const key = sectorKey(planet.planetId as string, sector.sectorId as string);
      if (sectorKeys.has(key)) fail(`Duplicate campaign sector: ${key}`);
      sectorKeys.add(key);
    });
    return planet;
  });
  uniqueStrings(planets.map(({ planetId }) => planetId), "campaign.planets");
  const planetIds = new Set(planets.map(({ planetId }) => planetId as string));

  const armies = array(state.armies, "campaign.armies").map((entry, index) => {
    const path = `campaign.armies[${index}]`;
    const army = record(entry, path);
    nonEmptyString(army.id, `${path}.id`);
    nonEmptyString(army.name, `${path}.name`);
    reference(army.ownerPlayerId, playerIds, `${path}.ownerPlayerId`, "campaign player");
    oneOf(army.factionId, FACTIONS, `${path}.factionId`);
    campaignLocation(army, path, planetIds, sectorKeys);
    boolean(army.activatedThisTurn, `${path}.activatedThisTurn`);
    nonNegativeInteger(army.movementPointsRemaining, `${path}.movementPointsRemaining`);
    const units = array(army.units, `${path}.units`).map((unitEntry, unitIndex) => {
      const unitPath = `${path}.units[${unitIndex}]`;
      const unit = record(unitEntry, unitPath);
      nonEmptyString(unit.id, `${unitPath}.id`);
      nonEmptyString(unit.templateId, `${unitPath}.templateId`);
      return unit.id;
    });
    uniqueStrings(units, `${path}.units`);
    const heroIds = array(army.heroIds, `${path}.heroIds`);
    heroIds.forEach((id, heroIndex) => nonEmptyString(id, `${path}.heroIds[${heroIndex}]`));
    uniqueStrings(heroIds, `${path}.heroIds`);
    return army;
  });
  const armyIds = uniqueStrings(armies.map(({ id }) => id), "campaign.armies");

  const bases = array(state.bases, "campaign.bases").map((entry, index) => {
    const path = `campaign.bases[${index}]`;
    const base = record(entry, path);
    nonEmptyString(base.id, `${path}.id`);
    reference(base.ownerPlayerId, playerIds, `${path}.ownerPlayerId`, "campaign player");
    oneOf(base.factionId, FACTIONS, `${path}.factionId`);
    campaignLocation(base, path, planetIds, sectorKeys);
    oneOf(base.level, [1, 2, 3] as const, `${path}.level`);
    return base;
  });
  const baseIds = uniqueStrings(bases.map(({ id }) => id), "campaign.bases");

  validateConstructionQueue(state.constructionQueue, playerIds, planetIds, sectorKeys);
  validateRecruitmentQueue(state.recruitmentQueue, playerIds, planetIds);
  validateReserves(state.reserves, playerIds, planetIds);
  validateHeroes(state.heroes, playerIds, planetIds, armyIds);
  validateRules(state.rules);

  if (state.pendingConflict !== undefined) {
    validateConflict(state.pendingConflict, playerIds, planetIds, sectorKeys, armyIds, baseIds);
  }
  if (state.phase === "Battle" && state.pendingConflict === undefined) {
    fail("campaign.pendingConflict is required during the Battle phase");
  }
  if (state.winnerFactionId !== undefined) oneOf(state.winnerFactionId, FACTIONS, "campaign.winnerFactionId");
  if (state.phase === "Finished" && state.winnerFactionId === undefined) {
    fail("campaign.winnerFactionId is required when the campaign is Finished");
  }
}

function validateConstructionQueue(value: unknown, playerIds: Set<string>, planetIds: Set<string>, sectorKeys: Set<string>): void {
  array(value, "campaign.constructionQueue").forEach((entry, index) => {
    const path = `campaign.constructionQueue[${index}]`;
    const order = record(entry, path);
    nonEmptyString(order.id, `${path}.id`);
    oneOf(order.kind, ["BuildBase", "UpgradeBase"] as const, `${path}.kind`);
    reference(order.ownerPlayerId, playerIds, `${path}.ownerPlayerId`, "campaign player");
    oneOf(order.factionId, FACTIONS, `${path}.factionId`);
    campaignLocation(order, path, planetIds, sectorKeys);
    oneOf(order.targetLevel, [1, 2, 3] as const, `${path}.targetLevel`);
    nonNegativeInteger(order.cost, `${path}.cost`);
    positiveInteger(order.orderedOnTurn, `${path}.orderedOnTurn`);
    positiveInteger(order.completesOnTurn, `${path}.completesOnTurn`);
    if (order.baseId !== undefined) nonEmptyString(order.baseId, `${path}.baseId`);
  });
}

function validateRecruitmentQueue(value: unknown, playerIds: Set<string>, planetIds: Set<string>): void {
  array(value, "campaign.recruitmentQueue").forEach((entry, index) => {
    const path = `campaign.recruitmentQueue[${index}]`;
    const order = record(entry, path);
    nonEmptyString(order.id, `${path}.id`);
    reference(order.ownerPlayerId, playerIds, `${path}.ownerPlayerId`, "campaign player");
    oneOf(order.factionId, FACTIONS, `${path}.factionId`);
    // A base can be destroyed while its recruitment remains queued; the economy
    // resolver will cancel that order on the next turn.
    nonEmptyString(order.baseId, `${path}.baseId`);
    reference(order.planetId, planetIds, `${path}.planetId`, "campaign planet");
    nonEmptyString(order.templateId, `${path}.templateId`);
    positiveInteger(order.quantity, `${path}.quantity`);
    nonNegativeInteger(order.cost, `${path}.cost`);
    positiveInteger(order.orderedOnTurn, `${path}.orderedOnTurn`);
    positiveInteger(order.completesOnTurn, `${path}.completesOnTurn`);
    oneOf(order.kind, ["Unit", "Hero"] as const, `${path}.kind`);
  });
}

function validateReserves(value: unknown, playerIds: Set<string>, planetIds: Set<string>): void {
  const ids: unknown[] = [];
  array(value, "campaign.reserves").forEach((entry, index) => {
    const path = `campaign.reserves[${index}]`;
    const reserve = record(entry, path);
    nonEmptyString(reserve.id, `${path}.id`);
    ids.push(reserve.id);
    nonEmptyString(reserve.templateId, `${path}.templateId`);
    reference(reserve.ownerPlayerId, playerIds, `${path}.ownerPlayerId`, "campaign player");
    oneOf(reserve.factionId, FACTIONS, `${path}.factionId`);
    reference(reserve.planetId, planetIds, `${path}.planetId`, "campaign planet");
    nonEmptyString(reserve.sourceOrderId, `${path}.sourceOrderId`);
  });
  uniqueStrings(ids, "campaign.reserves");
}

function validateHeroes(value: unknown, playerIds: Set<string>, planetIds: Set<string>, armyIds: Set<string>): void {
  const ids: unknown[] = [];
  array(value, "campaign.heroes").forEach((entry, index) => {
    const path = `campaign.heroes[${index}]`;
    const hero = record(entry, path);
    nonEmptyString(hero.heroId, `${path}.heroId`);
    ids.push(hero.heroId);
    oneOf(hero.factionId, FACTIONS, `${path}.factionId`);
    nonNegativeInteger(hero.livesRemaining, `${path}.livesRemaining`);
    nonNegativeInteger(hero.xp, `${path}.xp`);
    positiveInteger(hero.level, `${path}.level`);
    oneOf(hero.status, HERO_STATUSES, `${path}.status`);
    optionalReference(hero.ownerPlayerId, playerIds, `${path}.ownerPlayerId`, "campaign player");
    optionalReference(hero.reservePlanetId, planetIds, `${path}.reservePlanetId`, "campaign planet");
    optionalReference(hero.assignedArmyId, armyIds, `${path}.assignedArmyId`, "campaign army");
    positiveInteger(hero.availableFromTurn, `${path}.availableFromTurn`);
  });
  uniqueStrings(ids, "campaign.heroes");
}

function validateRules(value: unknown): void {
  const rules = record(value, "campaign.rules");
  positiveInteger(rules.movementPointsPerActivation, "campaign.rules.movementPointsPerActivation");
  positiveInteger(rules.armyPointLimit, "campaign.rules.armyPointLimit");
  nonNegativeInteger(rules.maxHeroesPerArmy, "campaign.rules.maxHeroesPerArmy");
  positiveInteger(rules.heroLives, "campaign.rules.heroLives");
}

function validateConflict(value: unknown, playerIds: Set<string>, planetIds: Set<string>, sectorKeys: Set<string>, armyIds: Set<string>, baseIds: Set<string>): void {
  const conflict = record(value, "campaign.pendingConflict");
  nonEmptyString(conflict.id, "campaign.pendingConflict.id");
  oneOf(conflict.kind, ["Invasion", "SectorAssault"] as const, "campaign.pendingConflict.kind");
  positiveInteger(conflict.turn, "campaign.pendingConflict.turn");
  campaignLocation(conflict, "campaign.pendingConflict", planetIds, sectorKeys);
  reference(conflict.attackerArmyId, armyIds, "campaign.pendingConflict.attackerArmyId", "campaign army");
  oneOf(conflict.attackerFactionId, FACTIONS, "campaign.pendingConflict.attackerFactionId");
  reference(conflict.attackerPlayerId, playerIds, "campaign.pendingConflict.attackerPlayerId", "campaign player");
  oneOf(conflict.defenderFactionId, FACTIONS, "campaign.pendingConflict.defenderFactionId");
  optionalReference(conflict.defenderArmyId, armyIds, "campaign.pendingConflict.defenderArmyId", "campaign army");
  optionalReference(conflict.defenderBaseId, baseIds, "campaign.pendingConflict.defenderBaseId", "campaign base");
  reference(conflict.originPlanetId, planetIds, "campaign.pendingConflict.originPlanetId", "campaign planet");
  nonEmptyString(conflict.originSectorId, "campaign.pendingConflict.originSectorId");
  if (!sectorKeys.has(sectorKey(conflict.originPlanetId as string, conflict.originSectorId as string))) {
    fail("campaign.pendingConflict origin sector does not exist");
  }
  oneOf(conflict.resumePhase, ["Activation", "Resolution"] as const, "campaign.pendingConflict.resumePhase");
  optionalReference(conflict.resumePlayerId, playerIds, "campaign.pendingConflict.resumePlayerId", "campaign player");
}

function campaignLocation(value: Record<string, unknown>, path: string, planetIds: Set<string>, sectorKeys: Set<string>): void {
  reference(value.planetId, planetIds, `${path}.planetId`, "campaign planet");
  nonEmptyString(value.sectorId, `${path}.sectorId`);
  if (!sectorKeys.has(sectorKey(value.planetId as string, value.sectorId as string))) {
    fail(`${path} references an unknown campaign sector`);
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value;
}

function nonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${path} must be a non-empty string`);
}

function integer(value: unknown, path: string): asserts value is number {
  if (!Number.isInteger(value)) fail(`${path} must be an integer`);
}

function nonNegativeInteger(value: unknown, path: string): asserts value is number {
  integer(value, path);
  if (value < 0) fail(`${path} must be non-negative`);
}

function positiveInteger(value: unknown, path: string): asserts value is number {
  integer(value, path);
  if (value < 1) fail(`${path} must be positive`);
}

function boolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") fail(`${path} must be a boolean`);
}

function oneOf<const T>(value: unknown, allowed: readonly T[], path: string): asserts value is T {
  if (!allowed.includes(value as T)) fail(`${path} has an unsupported value`);
}

function uniqueStrings(values: unknown[], path: string): Set<string> {
  const ids = new Set<string>();
  values.forEach((value, index) => {
    nonEmptyString(value, `${path}[${index}]`);
    if (ids.has(value)) fail(`${path} contains duplicate id: ${value}`);
    ids.add(value);
  });
  return ids;
}

function reference(value: unknown, ids: Set<string>, path: string, target: string): asserts value is string {
  nonEmptyString(value, path);
  if (!ids.has(value)) fail(`${path} references an unknown ${target}: ${value}`);
}

function optionalReference(value: unknown, ids: Set<string>, path: string, target: string): void {
  if (value !== undefined) reference(value, ids, path, target);
}

function sectorKey(planetId: string, sectorId: string): string {
  return `${planetId}::${sectorId}`;
}

function fail(message: string): never {
  throw new Error(`Invalid campaign state: ${message}.`);
}
