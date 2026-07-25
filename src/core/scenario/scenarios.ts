import type { ScenarioDefinition } from "./scenario-types";

export const survivalTestScenario: ScenarioDefinition = {
  id: "survival-test",
  name: "Ostatni bastion",
  description: "Przetrwaj wymagana liczbe rund. Nie musisz kontrolowac konkretnego pola.",
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
