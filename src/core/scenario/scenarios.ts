import type { ScenarioDefinition } from "./scenario-types";

const standardDeploymentZones = createEdgeDeploymentZones(8, 8, 2);

export const christophsisLastLandingScenario: ScenarioDefinition = {
  id: "christophsis-last-landing",
  name: "Christophsis: Ostatnie lądowisko",
  description: "Utrzymaj lądowisko do czasu przybycia kanonierki LAAT i odeprzyj kolejne fale droidów.",
  experience: "NarrativeMission",
  planet: "Christophsis",
  recommendedMapThemeId: "christophsis-crystal-city",
  mapPreset: {
    themeId: "christophsis-crystal-city",
    seed: 3277,
    width: 8,
    height: 8,
    terrainDensity: 0.38,
  },
  defaultDefenderArmySlot: 0,
  deploymentZones: standardDeploymentZones,
  objectives: [{
    id: "hold-landing-zone",
    name: "Utrzymaj lądowisko",
    description: "Kontroluj punkt obrony przez pięć pełnych rund.",
    victoryPoints: 1,
  }],
  scheduledEvents: [{
    id: "last-landing-b1-wave",
    name: "Pierwsza fala B1",
    trigger: { type: "RoundStarted", round: 2 },
    effect: {
      type: "DeployReinforcements",
      armyId: "army_separatists",
      units: [{ templateId: "b1_droid_regiment", count: 2 }],
    },
    visibility: "Announced",
  }, {
    id: "last-landing-b2-wave",
    name: "Ciężkie droidy w natarciu",
    trigger: { type: "RoundStarted", round: 3 },
    effect: {
      type: "DeployReinforcements",
      armyId: "army_separatists",
      units: [{ templateId: "super_battle_droid_squad", count: 1 }],
    },
    visibility: "Announced",
  }, {
    id: "last-landing-objective-profile",
    name: "Droidy uderzają na lądowisko",
    trigger: { type: "RoundStarted", round: 4 },
    effect: {
      type: "ChangeAIProfile",
      armyId: "army_separatists",
      profile: "objective",
    },
    visibility: "Announced",
  }, {
    id: "last-landing-laat-relief",
    name: "Wsparcie z powietrza",
    trigger: { type: "RoundStarted", round: 5 },
    effect: {
      type: "DeployReinforcements",
      armyId: "army_republic",
      units: [{ templateId: "laat_patrol", count: 1 }],
    },
    visibility: "Announced",
  }],
  victoryCondition: {
    type: "DefendPoint",
    rounds: 5,
    defenderArmySlot: 0,
    objectiveType: "DefensePoint",
  },
  defeatCondition: { type: "ArmyEliminated", armySlot: 0 },
};

export const geonosisHeartOfFactoryScenario: ScenarioDefinition = {
  id: "geonosis-heart-of-factory",
  name: "Geonosis: Serce fabryki",
  description: "Przedrzyj się przez fabrykę, zniszcz generator osłon i rdzeń linii produkcyjnej.",
  experience: "NarrativeMission",
  planet: "Geonosis",
  recommendedMapThemeId: "geonosis-foundry",
  mapPreset: {
    themeId: "geonosis-foundry",
    seed: 21202,
    width: 8,
    height: 8,
    terrainDensity: 0.44,
  },
  defaultDefenderArmySlot: 1,
  deploymentZones: standardDeploymentZones,
  objectives: [{
    id: "sabotage-foundry",
    name: "Sabotuj fabrykę",
    description: "Zniszcz dwa generatory przed końcem siódmej rundy.",
    victoryPoints: 1,
  }],
  scheduledEvents: [{
    id: "heart-foundry-first-generator",
    name: "Osłony fabryki wyłączone",
    trigger: { type: "ObjectDestroyed", objectType: "Generator" },
    effect: {
      type: "ChangeObjective",
      objectiveId: "destroy-production-core",
      name: "Zniszcz rdzeń produkcyjny",
      description: "Pierwszy generator padł. Dotrzyj do drugiego i zakończ sabotaż.",
    },
    visibility: "Announced",
  }, {
    id: "heart-foundry-reserve",
    name: "Fabryczny odwód B1",
    trigger: { type: "RoundStarted", round: 3 },
    effect: {
      type: "DeployReinforcements",
      armyId: "army_separatists",
      units: [{ templateId: "b1_droid_regiment", count: 2 }],
    },
    visibility: "Announced",
  }, {
    id: "heart-foundry-lockdown",
    name: "Alarm w rdzeniu fabryki",
    trigger: { type: "RoundStarted", round: 5 },
    effect: {
      type: "ChangeAIProfile",
      armyId: "army_separatists",
      profile: "defensive",
    },
    visibility: "Announced",
  }],
  victoryCondition: {
    type: "DestroyObjects",
    objectType: "Generator",
    count: 2,
    roundLimit: 7,
  },
  defeatCondition: { type: "ArmyEliminated", armySlot: 0 },
};

export const feluciaSurroundedScenario: ScenarioDefinition = {
  id: "felucia-surrounded",
  name: "Felucia: Okrążeni!",
  description: "Przetrwaj sześć rund w grzybowych ostępach, odpierając coraz cięższe fale droidów.",
  experience: "NarrativeMission",
  planet: "Felucia",
  recommendedMapThemeId: "felucia-wilds",
  mapPreset: {
    themeId: "felucia-wilds",
    seed: 501501,
    width: 8,
    height: 8,
    terrainDensity: 0.52,
  },
  defaultDefenderArmySlot: 0,
  deploymentZones: standardDeploymentZones,
  objectives: [{
    id: "survive-encirclement",
    name: "Przetrwaj okrążenie",
    description: "Utrzymaj oddział w walce do końca szóstej rundy.",
    victoryPoints: 1,
  }],
  scheduledEvents: [{
    id: "felucia-surrounded-b1",
    name: "Droidy wychodzą z dżungli",
    trigger: { type: "RoundStarted", round: 2 },
    effect: {
      type: "DeployReinforcements",
      armyId: "army_separatists",
      units: [{ templateId: "b1_droid_regiment", count: 2 }],
    },
    visibility: "Announced",
  }, {
    id: "felucia-surrounded-b2",
    name: "Nadciągają superdroidy",
    trigger: { type: "RoundStarted", round: 4 },
    effect: {
      type: "DeployReinforcements",
      armyId: "army_separatists",
      units: [{ templateId: "super_battle_droid_squad", count: 1 }],
    },
    visibility: "Announced",
  }, {
    id: "felucia-surrounded-spider",
    name: "Droid pająk na flance",
    trigger: { type: "RoundStarted", round: 5 },
    effect: {
      type: "DeployReinforcements",
      armyId: "army_separatists",
      units: [{ templateId: "dwarf_spider_droid", count: 1 }],
    },
    visibility: "Announced",
  }],
  victoryCondition: { type: "SurviveRounds", rounds: 6 },
  defeatCondition: { type: "ArmyEliminated", armySlot: 0 },
};

export const mandaloreHuntInSundariScenario: ScenarioDefinition = {
  id: "mandalore-hunt-in-sundari",
  name: "Mandalore: Polowanie w Sundari",
  description: "Odszukaj Dartha Maula w sektorach Sundari i pokonaj go, zanim zdoła się wymknąć.",
  experience: "NarrativeMission",
  planet: "Mandalore",
  recommendedMapThemeId: "mandalore-city",
  mapPreset: {
    themeId: "mandalore-city",
    seed: 10519,
    width: 8,
    height: 8,
    terrainDensity: 0.41,
  },
  defaultDefenderArmySlot: 1,
  deploymentZones: standardDeploymentZones,
  objectives: [{
    id: "defeat-maul",
    name: "Dopadnij Maula",
    description: "Pokonaj Dartha Maula przed końcem ósmej rundy.",
    victoryPoints: 1,
  }],
  scheduledEvents: [{
    id: "sundari-maul-enters",
    name: "Maul pojawia się w Sundari",
    trigger: { type: "RoundStarted", round: 1 },
    effect: {
      type: "SpawnUnits",
      armyId: "army_separatists",
      units: [{ templateId: "darth_maul", count: 1 }],
      positions: [{ x: 6, y: 3 }],
    },
    visibility: "Announced",
  }, {
    id: "sundari-maul-hunt",
    name: "Maul przejmuje inicjatywę",
    trigger: { type: "RoundStarted", round: 2 },
    effect: {
      type: "ChangeAIProfile",
      armyId: "army_separatists",
      profile: "hunter",
    },
    visibility: "Announced",
  }, {
    id: "sundari-maul-defeated",
    name: "Maul pokonany",
    trigger: { type: "UnitDestroyed", templateId: "darth_maul" },
    effect: { type: "Victory", message: "Darth Maul został pokonany. Sundari jest bezpieczne." },
    visibility: "Announced",
  }],
  victoryCondition: { type: "Scripted", roundLimit: 8 },
  defeatCondition: { type: "ArmyEliminated", armySlot: 0 },
};

export const christophsisCrystalDataScenario: ScenarioDefinition = {
  id: "christophsis-crystal-data",
  name: "Christophsis: Kryształowe dane",
  description: "Zabezpiecz przekaźnik archiwum, a następnie przebij się do nadajnika ewakuacyjnego.",
  experience: "NarrativeMission",
  planet: "Christophsis",
  recommendedMapThemeId: "christophsis-crystal-city",
  mapPreset: {
    themeId: "christophsis-crystal-city",
    seed: 66707,
    width: 8,
    height: 8,
    terrainDensity: 0.37,
  },
  defaultDefenderArmySlot: 1,
  deploymentZones: standardDeploymentZones,
  objectives: [{
    id: "recover-crystal-data",
    name: "Odzyskaj kryształowe dane",
    description: "Przejmij kolejno przekaźnik i punkt transmisyjny.",
    victoryPoints: 1,
  }],
  scheduledEvents: [{
    id: "crystal-data-intercepted",
    name: "Separatyści wykryli transmisję",
    trigger: { type: "RoundStarted", round: 3 },
    effect: {
      type: "ChangeAIProfile",
      armyId: "army_separatists",
      profile: "hunter",
    },
    visibility: "Announced",
  }, {
    id: "crystal-data-reinforcements",
    name: "Droidy odcinają drogę odwrotu",
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
    count: 2,
    attackerArmySlot: 0,
    roundLimit: 7,
    stageRoundLimits: [3, 4],
  },
  defeatCondition: { type: "ArmyEliminated", armySlot: 0 },
};

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

export const narrativeMissions: ScenarioDefinition[] = [
  christophsisLastLandingScenario,
  geonosisHeartOfFactoryScenario,
  feluciaSurroundedScenario,
  mandaloreHuntInSundariScenario,
  christophsisCrystalDataScenario,
];

export const customScenarioTemplates: ScenarioDefinition[] = [
  survivalTestScenario,
  defendPointScenario,
  protectGeneratorScenario,
  controlTerritoryScenario,
  geonosisDroidFoundryScenario,
  christophsisBreakLineScenario,
  feluciaAmbushScenario,
  mandaloreBattleForSectorsScenario,
];

export const scenarios: ScenarioDefinition[] = [
  ...narrativeMissions,
  ...customScenarioTemplates,
];

export function isNarrativeMission(
  scenario: Pick<ScenarioDefinition, "experience">,
): boolean {
  return scenario.experience === "NarrativeMission";
}

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
