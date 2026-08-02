import type { Battle } from "../../types";

export type MissionStatus = "Active" | "Victory" | "Defeat";

export type ScenarioVictoryCondition =
  | { type: "SurviveRounds"; rounds: number }
  | { type: "ProtectObject"; rounds: number; objectType: "Generator" }
  | { type: "ControlTerritory"; rounds: number }
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

export type ScenarioDefinition = {
  id: string;
  name: string;
  description: string;
  recommendedPoints?: number;
  board?: Battle["board"];
  deploymentZones: DeploymentZone[];
  objectives?: ObjectiveDefinition[];
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
  territoryOwners?: Record<string, string>;
  territoryScores?: Record<string, number>;
};

export type MissionEvent =
  | {
      type: "MissionCompleted";
      status: "Victory" | "Defeat";
      message: string;
    }
  | { type: "MissionProgress"; message: string };
