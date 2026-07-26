import type { Army, Battle, CombatLogEntry, FactionId } from "../../types";
import type { MissionState } from "../scenario/scenario-types";

export const SAVE_SCHEMA_VERSION = 1;

export type SaveKind = "army" | "battle" | "campaign" | "scenario";

export type SaveFile<TPayload, TKind extends SaveKind = SaveKind> = {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  kind: TKind;
  payload: TPayload;
};

export type SavedArmy = {
  id: string;
  name: string;
  faction: FactionId;
  pointsLimit?: number;
  army: Army;
  createdAt: string;
  updatedAt: string;
};

export type SavedBattleSummary = {
  id: string;
  name: string;
  campaignId?: string;
  scenarioId?: string;
  turn: number;
  phase: Battle["phase"];
  createdAt: string;
  updatedAt: string;
};

export type SavedBattle = SavedBattleSummary & {
  battle: Battle;
  initialBattle?: Battle;
  logs: CombatLogEntry[];
  mission?: MissionState;
};

export type SavedCampaign = {
  id: string;
  name: string;
  armyIds: string[];
  battleIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type DeploymentZone = {
  id: string;
  armySlot: number;
  cells: { x: number; y: number }[];
};

export type ObjectiveDefinition = {
  id: string;
  name: string;
  description: string;
  victoryPoints: number;
};

export type ScenarioDefinition = {
  id: string;
  name: string;
  description?: string;
  recommendedPoints?: number;
  board: Battle["board"];
  deploymentZones: DeploymentZone[];
  objectives: ObjectiveDefinition[];
};

export function createSaveFile<TPayload, TKind extends SaveKind>(
  kind: TKind,
  payload: TPayload,
): SaveFile<TPayload, TKind> {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    kind,
    payload,
  };
}

export function createSavedBattle(input: {
  id: string;
  name: string;
  battle: Battle;
  initialBattle?: Battle;
  logs: CombatLogEntry[];
  mission?: MissionState;
  campaignId?: string;
  scenarioId?: string;
  now?: string;
  createdAt?: string;
}): SavedBattle {
  const timestamp = input.now ?? new Date().toISOString();

  return {
    id: input.id,
    name: input.name,
    campaignId: input.campaignId,
    scenarioId: input.scenarioId,
    turn: input.battle.turn,
    phase: input.battle.phase,
    battle: input.battle,
    ...(input.initialBattle ? { initialBattle: input.initialBattle } : {}),
    logs: input.logs,
    ...(input.mission ? { mission: input.mission } : {}),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export function summarizeBattle(savedBattle: SavedBattle): SavedBattleSummary {
  return {
    id: savedBattle.id,
    name: savedBattle.name,
    campaignId: savedBattle.campaignId,
    scenarioId: savedBattle.scenarioId,
    turn: savedBattle.battle.turn,
    phase: savedBattle.battle.phase,
    createdAt: savedBattle.createdAt,
    updatedAt: savedBattle.updatedAt,
  };
}
