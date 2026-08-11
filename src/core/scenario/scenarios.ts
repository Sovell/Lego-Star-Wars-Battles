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

export const geonosisDroidFoundryScenario: ScenarioDefinition = {
  id: "geonosis-droid-foundry",
  name: "Geonosis: Fabryka droidów",
  description: "Przebij się przez skalne gardła i zniszcz dwa generatory fabryki przed upływem szóstej rundy.",
  planet: "Geonosis",
  recommendedMapThemeId: "geonosis-foundry",
  defaultDefenderArmySlot: 1,
  deploymentZones: standardDeploymentZones,
  objectives: [{
    id: "disable-foundry",
    name: "Wyłącz linię produkcyjną",
    description: "Zniszcz oba generatory fabryki w limicie rund.",
    victoryPoints: 1,
  }],
  scheduledEvents: [{
    id: "geonosis-b1-wave",
    name: "Awaryjna aktywacja linii B1",
    trigger: { type: "RoundStarted", round: 3 },
    effect: {
      type: "DeployReinforcements",
      armyId: "army_separatists",
      units: [{ templateId: "b1_droid_regiment", count: 2 }],
    },
    visibility: "Announced",
  }],
  victoryCondition: {
    type: "DestroyObjects",
    objectType: "Generator",
    count: 2,
    roundLimit: 6,
  },
  defeatCondition: { type: "ArmyEliminated", armySlot: 0 },
};

export const christophsisBreakLineScenario: ScenarioDefinition = {
  id: "christophsis-break-line",
  name: "Christophsis: Przełamanie linii",
  description: "Zajmuj kolejno trzy sektory miasta. Każdy utrzymany odcinek przesuwa linię frontu naprzód.",
  planet: "Christophsis",
  recommendedMapThemeId: "christophsis-crystal-city",
  defaultDefenderArmySlot: 1,
  deploymentZones: standardDeploymentZones,
  objectives: [{
    id: "advance-front",
    name: "Przełam linię obrony",
    description: "Kontroluj punkty strategiczne po kolei, zaczynając od najbliższego własnej strefie.",
    victoryPoints: 1,
  }],
  scheduledEvents: [{
    id: "christophsis-defensive-reserve",
    name: "Odwód obrońców",
    trigger: { type: "RoundStarted", round: 4 },
    effect: {
      type: "DeployReinforcements",
      armyId: "army_separatists",
      units: [{ templateId: "b1_droid_regiment", count: 1 }],
    },
    visibility: "Announced",
  }],
  victoryCondition: {
    type: "ProgressiveControl",
    objectiveType: "StrategicPoint",
    count: 3,
    attackerArmySlot: 0,
    roundLimit: 7,
    stageRoundLimits: [2, 2, 3],
  },
  defeatCondition: { type: "ArmyEliminated", armySlot: 0 },
};

export const feluciaAmbushScenario: ScenarioDefinition = {
  id: "felucia-ambush",
  name: "Felucia: Zasadzka",
  description: "Przetrwaj pierwsze uderzenie, a następnie doprowadź co najmniej jedną jednostkę do strefy ewakuacji.",
  planet: "Felucia",
  recommendedMapThemeId: "felucia-wilds",
  deploymentZones: standardDeploymentZones,
  zones: [{
    id: "felucia-extraction",
    type: "Extraction",
    cells: Array.from({ length: 8 }, (_, y) => ({ x: 7, y })),
  }],
  objectives: [{
    id: "survive-and-extract",
    name: "Wyrwij się z zasadzki",
    description: "Przetrwaj dwie rundy i dotrzyj do prawej krawędzi mapy przed końcem szóstej rundy.",
    victoryPoints: 1,
  }],
  scheduledEvents: [2, 4].map((round) => ({
    id: `felucia-wave-${round}`,
    name: `Fala droidów ${round === 2 ? "I" : "II"}`,
    trigger: { type: "RoundStarted" as const, round },
    effect: {
      type: "DeployReinforcements" as const,
      armyId: "army_separatists",
      units: [{ templateId: "b1_droid_regiment", count: 1 }],
    },
    visibility: "Announced" as const,
  })),
  victoryCondition: {
    type: "SurviveAndExtract",
    armySlot: 0,
    minimumRounds: 2,
    roundLimit: 6,
    minimumUnits: 1,
    zoneId: "felucia-extraction",
  },
  defeatCondition: { type: "ArmyEliminated", armySlot: 0 },
};

export const mandaloreBattleForSectorsScenario: ScenarioDefinition = {
  id: "mandalore-battle-for-sectors",
  name: "Mandalore: Bitwa o sektory",
  description: "Walcz o dzielnice miasta, durastalowe place i punkty strategiczne Sundari.",
  planet: "Mandalore",
  recommendedMapThemeId: "mandalore-city",
  deploymentZones: standardDeploymentZones,
  victoryCondition: { type: "ControlTerritory", rounds: 6 },
};

export const scenarios: ScenarioDefinition[] = [
  survivalTestScenario,
  defendPointScenario,
  protectGeneratorScenario,
  controlTerritoryScenario,
  geonosisDroidFoundryScenario,
  christophsisBreakLineScenario,
  feluciaAmbushScenario,
  mandaloreBattleForSectorsScenario,
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
