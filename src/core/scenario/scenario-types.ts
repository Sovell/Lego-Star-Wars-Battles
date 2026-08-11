import type { Battle } from "../../types";
import type { MapThemeId } from "../map-generation/map-theme-id";

export type MissionStatus = "Active" | "Victory" | "Defeat";

export type ScenarioVictoryCondition =
  | { type: "SurviveRounds"; rounds: number }
  | { type: "ProtectObject"; rounds: number; objectType: "Generator" }
  | { type: "ControlTerritory"; rounds: number }
  | {
      type: "DestroyObjects";
      objectType: "Generator";
      count: number;
      roundLimit: number;
    }
  | {
      type: "ProgressiveControl";
      objectiveType: "StrategicPoint";
      count: number;
      attackerArmySlot: number;
      roundLimit: number;
      stageRoundLimits?: number[];
    }
  | {
      type: "SurviveAndExtract";
      armySlot: number;
      minimumRounds: number;
      roundLimit: number;
      minimumUnits: number;
      zoneId: string;
    }
  | {
      type: "DefendPoint";
      rounds: number;
      defenderArmySlot: number;
      objectiveType: "DefensePoint";
    };

export type ScenarioDefeatCondition =
  | { type: "ArmyEliminated"; armySlot: number }
  | { type: "BattlefieldObjectDestroyed"; objectType: "Generator" };

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

export type ScenarioZone = {
  id: string;
  type: "Extraction";
  cells: { x: number; y: number }[];
};

export type ScenarioEventTrigger = {
  type: "RoundStarted" | "RoundEnded";
  round: number;
};

export type ScenarioReinforcementUnit = {
  templateId: string;
  count: number;
};

export type ScenarioScheduledEvent = {
  id: string;
  name: string;
  trigger: ScenarioEventTrigger;
  effect: {
    type: "DeployReinforcements";
    armyId: string;
    units: ScenarioReinforcementUnit[];
  };
  visibility: "Announced" | "Hidden";
};

export type ScenarioDefinition = {
  id: string;
  name: string;
  description: string;
  planet?: string;
  recommendedMapThemeId?: MapThemeId;
  recommendedPoints?: number;
  defaultDefenderArmySlot?: number;
  board?: Battle["board"];
  deploymentZones: DeploymentZone[];
  zones?: ScenarioZone[];
  objectives?: ObjectiveDefinition[];
  scheduledEvents?: ScenarioScheduledEvent[];
  victoryCondition: ScenarioVictoryCondition;
  defeatCondition?: ScenarioDefeatCondition;
};

export type MissionState = {
  scenarioId: string;
  status: MissionStatus;
  roundsCompleted: number;
  roundTarget?: number;
  defenderArmyId?: string;
  attackerArmyId?: string;
  deploymentZones?: DeploymentZone[];
  territoryOwners?: Record<string, string>;
  territoryScores?: Record<string, number>;
  destroyedObjectiveIds?: string[];
  objectiveStage?: number;
  stageRoundTargets?: number[];
  stageStartedRound?: number;
  scheduledEvents?: ScenarioScheduledEvent[];
  resolvedEventIds?: string[];
};

export type MissionEvent =
  | {
      type: "MissionCompleted";
      status: "Victory" | "Defeat";
      message: string;
    }
  | { type: "MissionProgress"; message: string }
  | {
      type: "ScheduledEventResolved";
      eventId: string;
      message: string;
    };
