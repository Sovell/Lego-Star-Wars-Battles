import type { Army, Battle, CombatLogEntry, FactionId } from "../../types";
import type { MissionState } from "../scenario/scenario-types";
import { assertCampaignState } from "../campaign/campaign-validation";
import type { CampaignState } from "../campaign/campaign-types";
export type {
  DeploymentZone,
  ObjectiveDefinition,
  ScenarioDefinition,
} from "../scenario/scenario-types";

export const SAVE_SCHEMA_VERSION = 1;
export const CAMPAIGN_SAVE_FORMAT_VERSION = 1;

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
  campaignFormatVersion: typeof CAMPAIGN_SAVE_FORMAT_VERSION;
  id: string;
  name: string;
  campaign: CampaignState;
  battleIds: string[];
  createdAt: string;
  updatedAt: string;
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

export function createSavedCampaign(input: {
  campaign: CampaignState;
  battleIds?: string[];
  now?: string;
  createdAt?: string;
}): SavedCampaign {
  assertCampaignState(input.campaign);
  const timestamp = input.now ?? new Date().toISOString();

  return {
    campaignFormatVersion: CAMPAIGN_SAVE_FORMAT_VERSION,
    id: input.campaign.id,
    name: input.campaign.name,
    campaign: input.campaign,
    battleIds: [...(input.battleIds ?? [])],
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export function assertSavedCampaign(value: unknown): asserts value is SavedCampaign {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid campaign save: payload must be an object.");
  }
  const saved = value as Record<string, unknown>;
  if (saved.campaignFormatVersion === undefined && saved.campaign === undefined) {
    throw new Error("Legacy campaign save contains metadata only and cannot restore CampaignState.");
  }
  if (saved.campaignFormatVersion !== CAMPAIGN_SAVE_FORMAT_VERSION) {
    throw new Error(`Unsupported campaign save format version: ${String(saved.campaignFormatVersion)}.`);
  }
  if (typeof saved.id !== "string" || !saved.id.trim()) throw new Error("Invalid campaign save id.");
  if (typeof saved.name !== "string" || !saved.name.trim()) throw new Error("Invalid campaign save name.");
  if (!Array.isArray(saved.battleIds) || saved.battleIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Invalid campaign save battleIds.");
  }
  if (typeof saved.createdAt !== "string" || Number.isNaN(Date.parse(saved.createdAt))) {
    throw new Error("Invalid campaign save createdAt.");
  }
  if (typeof saved.updatedAt !== "string" || Number.isNaN(Date.parse(saved.updatedAt))) {
    throw new Error("Invalid campaign save updatedAt.");
  }
  assertCampaignState(saved.campaign);
  const campaign = saved.campaign as CampaignState;
  if (saved.id !== campaign.id) throw new Error("Invalid campaign save: id does not match CampaignState.");
  if (saved.name !== campaign.name) throw new Error("Invalid campaign save: name does not match CampaignState.");
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
