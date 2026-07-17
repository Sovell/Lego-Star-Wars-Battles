import type { ScenarioDefinition } from "./scenario-types";

export const survivalTestScenario: ScenarioDefinition = {
  id: "survival-test",
  name: "Utrzymac pozycje",
  description: "Przetrwaj trzy pelne rundy. To pierwszy test silnika scenariuszy.",
  victoryCondition: {
    type: "SurviveRounds",
    rounds: 3,
  },
  defeatCondition: {
    type: "ArmyEliminated",
    armyId: "army_republic",
  },
};
