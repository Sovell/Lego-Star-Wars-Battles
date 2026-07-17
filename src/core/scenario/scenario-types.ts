export type MissionStatus = "Active" | "Victory" | "Defeat";

export type ScenarioVictoryCondition = {
  type: "SurviveRounds";
  rounds: number;
};

export type ScenarioDefeatCondition = {
  type: "ArmyEliminated";
  armyId: string;
};

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
};

export type MissionEvent = {
  type: "MissionCompleted";
  status: "Victory" | "Defeat";
  message: string;
};
