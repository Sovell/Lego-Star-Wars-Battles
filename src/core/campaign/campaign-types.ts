import type { MapThemeId } from "../map-generation";
import type {
  ProvinceBattleArchetype,
  ProvinceController,
  StrategicFaction,
} from "../galactic-conquest/galaxy-model";
import type { Army, Battle } from "../../types";
import type { DeploymentZone, ScenarioDefinition } from "../scenario/scenario-types";

export type CampaignPhase = "Income" | "Activation" | "Battle" | "Resolution" | "Finished";

export type CampaignPlayer = {
  id: string;
  name: string;
  factionId: StrategicFaction;
  credits: number;
};

export type CampaignSectorState = {
  planetId: string;
  sectorId: string;
  role: CampaignSectorRole;
  income: number;
  battleArchetype: ProvinceBattleArchetype;
  ownerFactionId: ProvinceController;
  controllerPlayerId?: string;
  fortificationLevel: number;
};

export type CampaignPlanetState = {
  planetId: string;
  mapThemeId: MapThemeId;
  capitalOf?: StrategicFaction;
  sectors: CampaignSectorState[];
};

export type CampaignSectorRole = "Landing" | "Infrastructure" | "Command";

export type CampaignBaseLevel = 1 | 2 | 3;

export type CampaignBaseState = {
  id: string;
  ownerPlayerId: string;
  factionId: StrategicFaction;
  planetId: string;
  sectorId: string;
  level: CampaignBaseLevel;
};

export type CampaignConstructionOrder = {
  id: string;
  kind: "BuildBase" | "UpgradeBase";
  ownerPlayerId: string;
  factionId: StrategicFaction;
  planetId: string;
  sectorId: string;
  targetLevel: CampaignBaseLevel;
  cost: number;
  orderedOnTurn: number;
  completesOnTurn: number;
  baseId?: string;
};

export type CampaignRecruitmentOrder = {
  id: string;
  ownerPlayerId: string;
  factionId: StrategicFaction;
  baseId: string;
  planetId: string;
  templateId: string;
  quantity: number;
  cost: number;
  orderedOnTurn: number;
  completesOnTurn: number;
  kind: "Unit" | "Hero";
};

export type CampaignReserveUnit = CampaignUnit & {
  ownerPlayerId: string;
  factionId: StrategicFaction;
  planetId: string;
  sourceOrderId: string;
};

/** A strategic unit deliberately contains no transient battlefield state. */
export type CampaignUnit = {
  id: string;
  templateId: string;
};

export type CampaignArmy = {
  id: string;
  name: string;
  ownerPlayerId: string;
  factionId: StrategicFaction;
  planetId: string;
  sectorId: string;
  units: CampaignUnit[];
  heroIds: string[];
  activatedThisTurn: boolean;
  movementPointsRemaining: number;
};

export type HeroCampaignState = {
  heroId: string;
  factionId: StrategicFaction;
  livesRemaining: number;
  xp: number;
  level: number;
  status: "Available" | "Queued" | "Reserve" | "Assigned" | "Unavailable" | "Eliminated";
  ownerPlayerId?: string;
  reservePlanetId?: string;
  assignedArmyId?: string;
  availableFromTurn: number;
};

export type CampaignRules = {
  movementPointsPerActivation: number;
  armyPointLimit: number;
  maxHeroesPerArmy: number;
  heroLives: number;
};

export type CampaignMovementEncounter = "EnemyArmy" | "EnemyBase" | "EnemyArmyAndBase";

export type CampaignRoute = {
  destinationPlanetId: string;
  planetIds: string[];
  movementCost: number;
  encounter?: CampaignMovementEncounter;
};

export type CampaignMovementResult = {
  armyId: string;
  fromPlanetId: string;
  toPlanetId: string;
  route: CampaignRoute;
};

export type CampaignConflictKind = "Invasion" | "SectorAssault";

export type CampaignConflict = {
  id: string;
  kind: CampaignConflictKind;
  turn: number;
  planetId: string;
  sectorId: string;
  attackerArmyId: string;
  attackerFactionId: StrategicFaction;
  attackerPlayerId: string;
  defenderFactionId: StrategicFaction;
  defenderArmyId?: string;
  defenderBaseId?: string;
  originPlanetId: string;
  originSectorId: string;
  resumePhase: "Activation" | "Resolution";
  resumePlayerId?: string;
};

export type CampaignSectorAction = {
  type: "CapturedWithoutBattle" | "BattleRequired";
  planetId: string;
  sectorId: string;
  conflict?: CampaignConflict;
};

export type CampaignConflictOutcome = {
  conflictId: string;
  winnerFactionId: StrategicFaction;
};

export type CampaignConflictResolution = {
  state: CampaignState;
  capturedSector: boolean;
  retreatedArmyIds: string[];
  eliminatedArmyIds: string[];
};

export type CampaignPlanetController = StrategicFaction | "Neutral" | "Contested";

export type CampaignIncomeBreakdown = {
  playerId: string;
  sectorIncome: number;
  planetControlBonus: number;
  capitalStipend: number;
  total: number;
};

export type CampaignBattleUnitBinding = {
  battleUnitId: string;
  battleArmyId: string;
  templateId: string;
  campaignArmyId?: string;
  campaignUnitId?: string;
  heroId?: string;
  kind: "Unit" | "Hero" | "Garrison";
};

export type CampaignBattleRequest = {
  id: string;
  campaignId: string;
  campaignTurn: number;
  conflictId: string;
  planetId: string;
  sectorId: string;
  themeId: MapThemeId;
  scenarioSeed: number;
  scenarioType: ProvinceBattleArchetype;
  attackerArmyId: string;
  defenderArmyId?: string;
  battleDefenderArmyId: string;
  attackerFactionId: StrategicFaction;
  defenderFactionId: StrategicFaction;
  attackerUnitIds: string[];
  defenderUnitIds: string[];
  fortificationLevel: number;
  defenderBaseLevel?: CampaignBaseLevel;
  previousPlanetId: string;
  unitBindings: CampaignBattleUnitBinding[];
};

export type CampaignBattlePackage = {
  request: CampaignBattleRequest;
  scenario: ScenarioDefinition;
  armies: Army[];
  battle: Battle;
  deploymentZones: DeploymentZone[];
};

export type CampaignBattleObjectiveResult = "AttackerVictory" | "DefenderVictory";

export type CampaignBattleOutcome = {
  battleRequestId: string;
  winnerFactionId: StrategicFaction;
  destroyedCampaignUnitIds: string[];
  destroyedHeroIds: string[];
  objectiveResult: CampaignBattleObjectiveResult;
};

export type CampaignBattleResolution = CampaignConflictResolution & {
  outcome: CampaignBattleOutcome;
  heroesLostPermanently: string[];
  heroesAwaitingReturn: string[];
};

export type CampaignState = {
  id: string;
  name: string;
  seed: number;
  turn: number;
  phase: CampaignPhase;
  players: CampaignPlayer[];
  initiativeOrder: string[];
  activePlayerId?: string;
  planets: CampaignPlanetState[];
  armies: CampaignArmy[];
  bases: CampaignBaseState[];
  constructionQueue: CampaignConstructionOrder[];
  recruitmentQueue: CampaignRecruitmentOrder[];
  reserves: CampaignReserveUnit[];
  heroes: HeroCampaignState[];
  rules: CampaignRules;
  incomeCollectedForTurn: number;
  pendingConflict?: CampaignConflict;
  winnerFactionId?: StrategicFaction;
};

export type CampaignPlayerSetup = Pick<CampaignPlayer, "id" | "name" | "factionId">;

export type CreateCampaignInput = {
  id: string;
  name: string;
  seed: number;
  players: CampaignPlayerSetup[];
};
