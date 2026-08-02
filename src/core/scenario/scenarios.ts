import type { ScenarioDefinition } from "./scenario-types";

const standardDeploymentZones = createEdgeDeploymentZones(8, 8, 2);

export const survivalTestScenario: ScenarioDefinition = {
  id: "survival-test",
  name: "Ostatni bastion",
  description: "Przetrwaj wymagana liczbe rund. Nie musisz kontrolowac konkretnego pola.",
  deploymentZones: standardDeploymentZones,
  victoryCondition: {
    type: "SurviveRounds",
    rounds: 3,
  },
  defeatCondition: {
    type: "ArmyEliminated",
    armySlot: 0,
  },
};

export const defendPointScenario: ScenarioDefinition = {
  id: "defend-point",
  name: "Bron punktu",
  description: "Wyznacz punkt na mapie i utrzymaj go przez trzy kolejne pelne rundy.",
  deploymentZones: standardDeploymentZones,
  victoryCondition: {
    type: "DefendPoint",
    rounds: 3,
    defenderArmySlot: 0,
    objectiveType: "DefensePoint",
  },
  defeatCondition: {
    type: "ArmyEliminated",
    armySlot: 0,
  },
};

export const protectGeneratorScenario: ScenarioDefinition = {
  id: "protect-generator",
  name: "Chroń generator",
  description: "Postaw generator i utrzymaj go przy zyciu przez trzy pelne rundy.",
  deploymentZones: standardDeploymentZones,
  victoryCondition: {
    type: "ProtectObject",
    rounds: 3,
    objectType: "Generator",
  },
  defeatCondition: {
    type: "BattlefieldObjectDestroyed",
    objectType: "Generator",
  },
};

export const controlTerritoryScenario: ScenarioDefinition = {
  id: "control-territory",
  name: "Kontrola terytorium",
  description: "Zajmuj pola i zdobywaj za nie punkty na koniec każdej rundy. Punkty strategiczne ★ są warte 2 pkt. Po wybranej liczbie rund wygrywa armia z większą liczbą punktów.",
  deploymentZones: standardDeploymentZones,
  victoryCondition: {
    type: "ControlTerritory",
    rounds: 6,
  },
};

export const scenarios: ScenarioDefinition[] = [
  survivalTestScenario,
  defendPointScenario,
  protectGeneratorScenario,
  controlTerritoryScenario,
];

function createEdgeDeploymentZones(
  width: number,
  height: number,
  depth: number,
): ScenarioDefinition["deploymentZones"] {
  const cellsForColumns = (startX: number) =>
    Array.from({ length: depth * height }, (_, index) => ({
      x: startX + Math.floor(index / height),
      y: index % height,
    }));

  return [
    {
      id: "army-slot-0-entry",
      armySlot: 0,
      cells: cellsForColumns(0),
    },
    {
      id: "army-slot-1-entry",
      armySlot: 1,
      cells: cellsForColumns(width - depth),
    },
  ];
}
