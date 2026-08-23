import { unitTemplates } from "../../data";
import type { Army, Battle, UnitInstance, UnitTemplate } from "../../types";
import { createBattle } from "../battle-state";
import { generateMap } from "../map-generation";
import type { ScenarioDefinition, ScenarioVictoryCondition } from "../scenario/scenario-types";
import { resolveCampaignConflict } from "./campaign-sector-control";
import { appendCampaignEvent } from "./campaign-history";
import type {
  CampaignArmy,
  CampaignBattleOutcome,
  CampaignBattlePackage,
  CampaignBattleRequest,
  CampaignBattleResolution,
  CampaignBattleUnitBinding,
  CampaignConflict,
  CampaignState,
} from "./campaign-types";

const templateById = new Map(unitTemplates.map((template) => [template.id, template]));
const BOARD_SIZE = 8;

export function createCampaignBattleRequest(state: CampaignState): CampaignBattleRequest {
  return buildBattleContext(state).request;
}

export function createCampaignBattlePackage(state: CampaignState): CampaignBattlePackage {
  const { request, armies } = buildBattleContext(state);
  const scenario = createCampaignBattleScenario(request);
  const generated = generateMap({
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    seed: request.scenarioSeed,
    themeId: request.themeId,
    scenario,
    armies,
    defenderArmySlot: 1,
    terrainDensity: Math.min(0.65, 0.34 + request.fortificationLevel * 0.03),
  });
  const battle: Battle = {
    ...createBattle(armies),
    id: request.id,
    board: generated.board,
    phase: "Setup",
  };
  return {
    request,
    scenario,
    armies,
    battle,
    deploymentZones: generated.deploymentZones,
  };
}

export function createCampaignBattleOutcome(
  request: CampaignBattleRequest,
  finalBattle: Battle,
  winnerFactionId: CampaignBattleOutcome["winnerFactionId"],
): CampaignBattleOutcome {
  if (
    winnerFactionId !== request.attackerFactionId &&
    winnerFactionId !== request.defenderFactionId
  ) throw new Error("Campaign battle winner must be its attacker or defender.");
  const battleUnits = new Map(
    finalBattle.armies.flatMap((army) => army.units).map((unit) => [unit.id, unit]),
  );
  const destroyedBindings = request.unitBindings.filter((binding) => {
    if (binding.kind === "Garrison") return false;
    return battleUnits.get(binding.battleUnitId)?.status === "Destroyed" ||
      !battleUnits.has(binding.battleUnitId);
  });
  return {
    battleRequestId: request.id,
    winnerFactionId,
    destroyedCampaignUnitIds: destroyedBindings.flatMap(({ campaignUnitId }) =>
      campaignUnitId ? [campaignUnitId] : []
    ),
    destroyedHeroIds: destroyedBindings.flatMap(({ heroId }) => heroId ? [heroId] : []),
    objectiveResult: winnerFactionId === request.attackerFactionId
      ? "AttackerVictory"
      : "DefenderVictory",
  };
}

export function applyCampaignBattleOutcome(
  state: CampaignState,
  request: CampaignBattleRequest,
  outcome: CampaignBattleOutcome,
): CampaignBattleResolution {
  const conflict = requireMatchingConflict(state, request, outcome);
  validateDestroyedEntities(request, outcome);
  const destroyedUnitIds = new Set(outcome.destroyedCampaignUnitIds);
  const destroyedHeroIds = new Set(outcome.destroyedHeroIds);
  let casualtyState: CampaignState = {
    ...state,
    armies: state.armies.map((army) => ({
      ...army,
      units: army.units.filter(({ id }) => !destroyedUnitIds.has(id)),
      heroIds: army.heroIds.filter((heroId) => !destroyedHeroIds.has(heroId)),
    })),
  };
  const battleHeroLoss = applyHeroLosses(casualtyState, destroyedHeroIds);
  casualtyState = battleHeroLoss.state;
  const emptyArmyIds = casualtyState.armies
    .filter((army) => army.units.length === 0 && army.heroIds.length === 0)
    .map(({ id }) => id);
  casualtyState = {
    ...casualtyState,
    armies: casualtyState.armies.filter(({ id }) => !emptyArmyIds.includes(id)),
  };
  const beforeStrategicResolution = casualtyState;
  const conflictResolution = resolveCampaignConflict(casualtyState, {
    conflictId: conflict.id,
    winnerFactionId: outcome.winnerFactionId,
  });
  const strategicallyEliminatedHeroIds = new Set(
    beforeStrategicResolution.armies
      .filter(({ id }) => conflictResolution.eliminatedArmyIds.includes(id))
      .flatMap(({ heroIds }) => heroIds),
  );
  const strategicHeroLoss = applyHeroLosses(
    conflictResolution.state,
    strategicallyEliminatedHeroIds,
  );
  const allEliminatedArmyIds = [...new Set([
    ...conflictResolution.eliminatedArmyIds,
    ...emptyArmyIds,
  ])];
  return {
    ...conflictResolution,
    state: appendCampaignEvent(strategicHeroLoss.state, {
      type: "BattleResolved",
      playerId: conflict.attackerPlayerId,
      armyId: conflict.attackerArmyId,
      planetId: conflict.planetId,
      sectorId: conflict.sectorId,
      winnerFactionId: outcome.winnerFactionId,
      destroyedUnitCount: outcome.destroyedCampaignUnitIds.length,
      heroIds: outcome.destroyedHeroIds,
    }),
    eliminatedArmyIds: allEliminatedArmyIds,
    outcome,
    heroesLostPermanently: [...new Set([
      ...battleHeroLoss.permanentlyLost,
      ...strategicHeroLoss.permanentlyLost,
    ])],
    heroesAwaitingReturn: [...new Set([
      ...battleHeroLoss.awaitingReturn,
      ...strategicHeroLoss.awaitingReturn,
    ])],
  };
}

export function resolveCampaignBattle(
  state: CampaignState,
  battlePackage: Pick<CampaignBattlePackage, "request">,
  finalBattle: Battle,
  winnerFactionId: CampaignBattleOutcome["winnerFactionId"],
): CampaignBattleResolution {
  const outcome = createCampaignBattleOutcome(
    battlePackage.request,
    finalBattle,
    winnerFactionId,
  );
  return applyCampaignBattleOutcome(state, battlePackage.request, outcome);
}

export function createCampaignBattleScenario(
  request: CampaignBattleRequest,
): ScenarioDefinition {
  const victoryCondition = createVictoryCondition(request);
  return {
    id: `campaign-scenario:${request.id}`,
    name: `${request.planetId}: ${request.scenarioType}`,
    description: `Campaign battle for sector ${request.sectorId}.`,
    recommendedMapThemeId: request.themeId,
    defaultDefenderArmySlot: 1,
    deploymentZones: [],
    objectives: [{
      id: `campaign-objective:${request.sectorId}`,
      name: "Secure the sector",
      description: "Complete the generated objective to decide strategic control.",
      victoryPoints: 1,
    }],
    ...(request.scenarioType === "SurviveAndExtract"
      ? {
          zones: [{
            id: "campaign-extraction",
            type: "Extraction" as const,
            cells: Array.from({ length: BOARD_SIZE }, (_, y) => ({ x: BOARD_SIZE - 1, y })),
          }],
        }
      : {}),
    victoryCondition,
    defeatCondition: { type: "ArmyEliminated", armySlot: 0 },
  };
}

function buildBattleContext(state: CampaignState): {
  request: CampaignBattleRequest;
  armies: Army[];
} {
  const conflict = requirePendingConflict(state);
  const planet = state.planets.find(({ planetId }) => planetId === conflict.planetId);
  const sector = planet?.sectors.find(({ sectorId }) => sectorId === conflict.sectorId);
  if (!planet || !sector) throw new Error(`Unknown conflict sector: ${conflict.planetId}/${conflict.sectorId}.`);
  const attacker = requireCampaignArmy(state, conflict.attackerArmyId);
  const defender = conflict.defenderArmyId
    ? requireCampaignArmy(state, conflict.defenderArmyId)
    : undefined;
  const defenderBase = conflict.defenderBaseId
    ? state.bases.find(({ id }) => id === conflict.defenderBaseId)
    : undefined;
  const battleDefenderArmyId = defender?.id ?? `${conflict.id}:garrison`;
  const attackerForce = createTacticalArmy(state, attacker, 1);
  const defenderForce = defender
    ? createTacticalArmy(state, defender, 2)
    : {
        army: {
          id: battleDefenderArmyId,
          playerName: `${conflict.defenderFactionId} Garrison`,
          faction: conflict.defenderFactionId,
          teamId: 2 as const,
          control: "Bot" as const,
          units: [],
        },
        bindings: [] as CampaignBattleUnitBinding[],
      };
  const garrison = createGarrison(
    conflict,
    battleDefenderArmyId,
    defenderBase?.level,
    sector.role === "Command",
  );
  defenderForce.army.units.push(...garrison.units);
  defenderForce.bindings.push(...garrison.bindings);
  if (attackerForce.army.units.length === 0) throw new Error("Campaign attacker has no units.");
  if (defenderForce.army.units.length === 0) throw new Error("Campaign defender has no units.");
  const bindings = [...attackerForce.bindings, ...defenderForce.bindings];
  const request: CampaignBattleRequest = {
    id: `campaign-battle:${conflict.id}`,
    campaignId: state.id,
    campaignTurn: state.turn,
    conflictId: conflict.id,
    planetId: conflict.planetId,
    sectorId: conflict.sectorId,
    themeId: planet.mapThemeId,
    scenarioSeed: hash(`${state.seed}:${state.turn}:${conflict.id}`),
    scenarioType: sector.battleArchetype,
    attackerArmyId: attacker.id,
    ...(defender ? { defenderArmyId: defender.id } : {}),
    battleDefenderArmyId,
    attackerFactionId: conflict.attackerFactionId,
    defenderFactionId: conflict.defenderFactionId,
    attackerUnitIds: attackerForce.army.units.map(({ id }) => id),
    defenderUnitIds: defenderForce.army.units.map(({ id }) => id),
    fortificationLevel: sector.fortificationLevel + (defenderBase?.level ?? 0),
    ...(defenderBase ? { defenderBaseLevel: defenderBase.level } : {}),
    previousPlanetId: conflict.originPlanetId,
    unitBindings: bindings,
  };
  return { request, armies: [attackerForce.army, defenderForce.army] };
}

function createTacticalArmy(
  state: CampaignState,
  campaignArmy: CampaignArmy,
  teamId: 1 | 2,
): { army: Army; bindings: CampaignBattleUnitBinding[] } {
  const player = state.players.find(({ id }) => id === campaignArmy.ownerPlayerId);
  const unitBindings: CampaignBattleUnitBinding[] = campaignArmy.units.map((unit) => ({
    battleUnitId: unit.id,
    battleArmyId: campaignArmy.id,
    templateId: unit.templateId,
    campaignArmyId: campaignArmy.id,
    campaignUnitId: unit.id,
    kind: "Unit",
  }));
  const heroBindings: CampaignBattleUnitBinding[] = campaignArmy.heroIds.map((heroId) => ({
    battleUnitId: `${campaignArmy.id}:hero:${heroId}`,
    battleArmyId: campaignArmy.id,
    templateId: heroId,
    campaignArmyId: campaignArmy.id,
    heroId,
    kind: "Hero",
  }));
  const bindings = [...unitBindings, ...heroBindings];
  return {
    army: {
      id: campaignArmy.id,
      playerName: player?.name ?? campaignArmy.name,
      faction: campaignArmy.factionId,
      teamId,
      control: player?.control ?? "Human",
      units: bindings.map((binding) => createBattleUnit(
        binding.battleUnitId,
        binding.templateId,
        campaignArmy.id,
      )),
    },
    bindings,
  };
}

function createGarrison(
  conflict: CampaignConflict,
  battleArmyId: string,
  baseLevel: 1 | 2 | 3 | undefined,
  commandSector: boolean,
): { units: UnitInstance[]; bindings: CampaignBattleUnitBinding[] } {
  const strength = baseLevel ?? (commandSector ? 1 : 0);
  const templates = getGarrisonTemplates(conflict.defenderFactionId, strength);
  const bindings = templates.map((templateId, index): CampaignBattleUnitBinding => ({
    battleUnitId: `${battleArmyId}:garrison:${index + 1}`,
    battleArmyId,
    templateId,
    kind: "Garrison",
  }));
  return {
    units: bindings.map((binding, index) => createBattleUnit(
      binding.battleUnitId,
      templates[index],
      battleArmyId,
    )),
    bindings,
  };
}

function getGarrisonTemplates(
  factionId: CampaignConflict["defenderFactionId"],
  strength: number,
): string[] {
  if (strength <= 0) return [];
  const tiers = factionId === "Republic"
    ? ["clone_trooper_squad", "clone_command_squad", "at_rt_scout_walker"]
    : ["b1_droid_squad", "b1_battle_droid_commander_squad", "aat_battle_tank"];
  return tiers.slice(0, Math.min(3, strength));
}

function createBattleUnit(id: string, templateId: string, armyId: string): UnitInstance {
  const template = requireTemplate(templateId);
  return {
    id,
    templateId,
    armyId,
    currentHp: template.maxHp,
    suppression: 0,
    abilityCooldowns: {},
    usedAbilities: [],
    activeEffects: [],
    movedThisTurn: false,
    position: null,
    status: "Ready",
    hidden: false,
  };
}

function createVictoryCondition(request: CampaignBattleRequest): ScenarioVictoryCondition {
  switch (request.scenarioType) {
    case "ControlTerritory":
      return { type: "ControlTerritory", rounds: 10 };
    case "DefendPoint":
      return {
        type: "DefendPoint",
        rounds: 5,
        roundLimit: 10,
        defenderArmySlot: 1,
        objectiveType: "DefensePoint",
      };
    case "DestroyObjects":
      return {
        type: "DestroyObjects",
        objectType: "Generator",
        count: Math.max(1, Math.min(3, request.defenderBaseLevel ?? 2)),
        roundLimit: 10,
      };
    case "ProgressiveControl":
      return {
        type: "ProgressiveControl",
        objectiveType: "StrategicPoint",
        count: 3,
        attackerArmySlot: 0,
        roundLimit: 14,
        stageRoundLimits: [5, 5, 4],
      };
    case "RescueAndExtract":
      return {
        type: "RescueAndExtract",
        objectiveType: "StrategicPoint",
        hostageCount: 2,
        rescuerArmySlot: 0,
        roundLimit: 14,
        stageRoundLimits: [5, 5, 4],
      };
    case "SurviveAndExtract":
      return {
        type: "SurviveAndExtract",
        armySlot: 0,
        minimumRounds: 5,
        roundLimit: 10,
        minimumUnits: 1,
        zoneId: "campaign-extraction",
      };
  }
}

function applyHeroLosses(
  state: CampaignState,
  heroIds: ReadonlySet<string>,
): { state: CampaignState; permanentlyLost: string[]; awaitingReturn: string[] } {
  const permanentlyLost: string[] = [];
  const awaitingReturn: string[] = [];
  const heroes = state.heroes.map((hero) => {
    if (!heroIds.has(hero.heroId)) return hero;
    const livesRemaining = Math.max(0, hero.livesRemaining - 1);
    if (livesRemaining === 0) permanentlyLost.push(hero.heroId);
    else awaitingReturn.push(hero.heroId);
    return {
      ...hero,
      livesRemaining,
      status: livesRemaining === 0 ? "Eliminated" as const : "Unavailable" as const,
      ownerPlayerId: undefined,
      reservePlanetId: undefined,
      assignedArmyId: undefined,
      availableFromTurn: livesRemaining === 0 ? Number.MAX_SAFE_INTEGER : state.turn + 2,
    };
  });
  return {
    state: {
      ...state,
      heroes,
      armies: state.armies.map((army) => ({
        ...army,
        heroIds: army.heroIds.filter((heroId) => !heroIds.has(heroId)),
      })),
    },
    permanentlyLost,
    awaitingReturn,
  };
}

function requirePendingConflict(state: CampaignState): CampaignConflict {
  if (state.phase !== "Battle" || !state.pendingConflict) {
    throw new Error("Campaign has no pending conflict to translate into a battle.");
  }
  return state.pendingConflict;
}

function requireMatchingConflict(
  state: CampaignState,
  request: CampaignBattleRequest,
  outcome: CampaignBattleOutcome,
): CampaignConflict {
  const conflict = requirePendingConflict(state);
  if (
    request.campaignId !== state.id ||
    request.conflictId !== conflict.id ||
    outcome.battleRequestId !== request.id
  ) throw new Error("Campaign battle request does not match the pending conflict.");
  return conflict;
}

function validateDestroyedEntities(
  request: CampaignBattleRequest,
  outcome: CampaignBattleOutcome,
): void {
  const campaignUnitIds = new Set(request.unitBindings.flatMap(({ campaignUnitId }) =>
    campaignUnitId ? [campaignUnitId] : []
  ));
  const heroIds = new Set(request.unitBindings.flatMap(({ heroId }) => heroId ? [heroId] : []));
  if (outcome.destroyedCampaignUnitIds.some((id) => !campaignUnitIds.has(id))) {
    throw new Error("Battle outcome contains a unit outside its campaign request.");
  }
  if (outcome.destroyedHeroIds.some((id) => !heroIds.has(id))) {
    throw new Error("Battle outcome contains a hero outside its campaign request.");
  }
}

function requireCampaignArmy(state: CampaignState, armyId: string): CampaignArmy {
  const army = state.armies.find(({ id }) => id === armyId);
  if (!army) throw new Error(`Unknown campaign army: ${armyId}.`);
  return army;
}

function requireTemplate(templateId: string): UnitTemplate {
  const template = templateById.get(templateId);
  if (!template) throw new Error(`Unknown unit template: ${templateId}.`);
  return template;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
