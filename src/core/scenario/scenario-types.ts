import type { Battle, BattlefieldObject, BattlefieldObjectType } from "../../types";
import type { BotProfileId } from "../ai/bot-doctrine";
import type { MapThemeId } from "../map-generation/map-theme-id";

export type MissionStatus = "Active" | "Victory" | "Defeat";

export type ScenarioVictoryCondition =
  | { type: "SurviveRounds"; rounds: number }
  | { type: "Scripted"; roundLimit: number }
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
  type: "Extraction" | "Trigger";
  cells: { x: number; y: number }[];
};

export type ScenarioEventTrigger =
  | { type: "RoundStarted" | "RoundEnded"; round: number }
  | {
      type: "UnitDestroyed";
      unitId?: string;
      armyId?: string;
      templateId?: string;
    }
  | {
      type: "ObjectDestroyed";
      objectId?: string;
      objectType?: BattlefieldObjectType;
    }
  | { type: "UnitEnteredZone"; zoneId: string; armyId?: string }
  | {
      type: "TerritoryCaptured";
      armyId?: string;
      position?: { x: number; y: number };
    }
  | { type: "ArmyStrengthBelow"; armyId: string; percentage: number };

export type ScenarioReinforcementUnit = {
  templateId: string;
  count: number;
};

export type ScenarioEventEffect =
  | {
      type: "DeployReinforcements";
      armyId: string;
      units: ScenarioReinforcementUnit[];
    }
  | {
      type: "SpawnUnits";
      armyId: string;
      units: ScenarioReinforcementUnit[];
      zoneId?: string;
      positions?: { x: number; y: number }[];
    }
  | {
      type: "ChangeObjective";
      objectiveId?: string;
      name: string;
      description: string;
    }
  | { type: "PlaceObject"; object: BattlefieldObject }
  | { type: "ChangeAIProfile"; armyId: string; profile: BotProfileId }
  | { type: "ShowMessage"; message: string }
  | { type: "Victory"; message: string }
  | { type: "Defeat"; message: string };

export type ScenarioScheduledEvent = {
  id: string;
  name: string;
  trigger: ScenarioEventTrigger;
  effect: ScenarioEventEffect;
  visibility: "Announced" | "Hidden";
};

export type ScenarioScriptEvent = ScenarioScheduledEvent;

export type ScenarioExperience = "NarrativeMission" | "CustomScenario";

export type ScenarioMapPreset = {
  themeId: MapThemeId;
  seed: number;
  width: number;
  height: number;
  terrainDensity?: number;
};

export type ScenarioDefinition = {
  id: string;
  name: string;
  description: string;
  experience?: ScenarioExperience;
  mapPreset?: ScenarioMapPreset;
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
  initialArmyStrength?: Record<string, number>;
  botProfiles?: Partial<Record<string, BotProfileId>>;
  activeObjectiveId?: string;
  activeObjectiveName?: string;
  activeObjectiveDescription?: string;
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
