export type MissionStatus = "Active" | "Victory" | "Defeat";

export type ScenarioVictoryCondition =
  | { type: "SurviveRounds"; rounds: number }
  | { type: "ProtectObject"; rounds: number; objectType: "Generator" }
  | {
      type: "DefendPoint";
      rounds: number;
      defenderArmySlot: number;
      objectiveType: "DefensePoint";
    };

export type ScenarioDefeatCondition =
  | { type: "ArmyEliminated"; armySlot: number }
  | { type: "BattlefieldObjectDestroyed"; objectType: "Generator" };

export type ScenarioDefinition = {
  id: string;
  name: string;
  description: string;
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
};

export type MissionEvent =
  | {
      type: "MissionCompleted";
      status: "Victory" | "Defeat";
      message: string;
    }
  | { type: "MissionProgress"; message: string };
