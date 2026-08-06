import type { ScenarioDefinition } from "../scenario/scenario-types";
import type { MapScenarioRequirements } from "./map-generation-types";

export function getMapScenarioRequirements(
  scenario?: ScenarioDefinition,
  defenderArmySlot?: number,
): MapScenarioRequirements {
  if (
    defenderArmySlot !== undefined &&
    (!Number.isInteger(defenderArmySlot) || defenderArmySlot < 0 || defenderArmySlot > 3)
  ) {
    throw new Error("Defender army slot must be an integer from 0 to 3.");
  }
  if (!scenario) {
    return { deploymentZones: [], requiredObjects: [] };
  }

  const common = {
    scenarioId: scenario.id,
    deploymentZones: scenario.deploymentZones,
  };
  switch (scenario.victoryCondition.type) {
    case "SurviveRounds":
      return { ...common, requiredObjects: [] };
    case "ProtectObject":
      return {
        ...common,
        defenderArmySlot: defenderArmySlot ?? getDefaultDefenderArmySlot(scenario),
        requiredObjects: [{
          objectType: scenario.victoryCondition.objectType,
          count: 1,
          placement: "defender-side",
        }],
      };
    case "DefendPoint":
      return {
        ...common,
        defenderArmySlot: defenderArmySlot ?? scenario.victoryCondition.defenderArmySlot,
        requiredObjects: [{
          objectType: scenario.victoryCondition.objectiveType,
          count: 1,
          placement: "defender-side",
        }],
      };
    case "ControlTerritory":
      return {
        ...common,
        requiredObjects: [{
          objectType: "StrategicPoint",
          count: 3,
          placement: "distributed",
        }],
      };
  }
}

function getDefaultDefenderArmySlot(scenario: ScenarioDefinition): number {
  return scenario.defeatCondition?.type === "ArmyEliminated"
    ? scenario.defeatCondition.armySlot
    : 0;
}
