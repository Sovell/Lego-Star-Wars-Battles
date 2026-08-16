import type {
  GalacticConquestState,
  GalacticPlanetDefinition,
  GalacticPlanetState,
  GalacticProvinceState,
  ProvinceBattleRequest,
  ProvinceTemplate,
  StrategicFaction,
} from "./galaxy-model";

const province = (
  id: string,
  name: string,
  type: ProvinceTemplate["type"],
  battleArchetype: ProvinceTemplate["battleArchetype"],
  income: number,
  production: number,
): ProvinceTemplate => ({ id, name, type, battleArchetype, income, production });

export const galacticPlanets: readonly GalacticPlanetDefinition[] = [
  {
    id: "mandalore",
    name: "Mandalore",
    region: "Outer Rim",
    position: { x: 47, y: 15 },
    mapThemeId: "mandalore-city",
    initialController: "Neutral",
    neighbors: ["endor", "ryloth", "christophsis"],
    fixedProvince: { ...province("sundari", "Sundari", "Capital", "DefendPoint", 4, 2), fixed: true },
    variableProvincePool: [
      province("concordia-route", "Szlak Concordii", "Orbital", "ControlTerritory", 2, 2),
      province("keldabe-approach", "Podejścia do Keldabe", "Frontier", "ProgressiveControl", 2, 1),
      province("royal-district", "Dzielnica Królewska", "Settlement", "RescueAndExtract", 3, 1),
      province("beskar-vaults", "Krypty beskarskie", "Industrial", "DestroyObjects", 1, 4),
    ],
  },
  {
    id: "christophsis",
    name: "Christophsis",
    region: "Outer Rim",
    position: { x: 61, y: 31 },
    mapThemeId: "christophsis-crystal-city",
    initialController: "Separatists",
    neighbors: ["mandalore", "ryloth", "geonosis"],
    fixedProvince: { ...province("crystal-city", "Kryształowe Miasto", "Capital", "ControlTerritory", 4, 2), fixed: true },
    variableProvincePool: [
      province("archive-spires", "Iglice archiwów", "Research", "ProgressiveControl", 3, 1),
      province("south-landing", "Południowe lądowisko", "Orbital", "DefendPoint", 2, 2),
      province("glass-canyons", "Szklane kaniony", "Wilderness", "SurviveAndExtract", 1, 1),
      province("energy-junction", "Węzeł energetyczny", "Industrial", "DestroyObjects", 2, 3),
    ],
  },
  {
    id: "ryloth",
    name: "Ryloth",
    region: "Outer Rim",
    position: { x: 69, y: 47 },
    mapThemeId: "ryloth-badlands",
    initialController: "Separatists",
    neighbors: ["mandalore", "christophsis", "geonosis", "tatooine"],
    fixedProvince: { ...province("lessu", "Lessu", "Capital", "DefendPoint", 4, 1), fixed: true },
    variableProvincePool: [
      province("jixuan-pass", "Przełęcz Jixuan", "Frontier", "ProgressiveControl", 1, 2),
      province("nabat-valley", "Dolina Nabat", "Settlement", "RescueAndExtract", 3, 1),
      province("southern-canyons", "Południowe kaniony", "Wilderness", "SurviveAndExtract", 1, 1),
      province("spice-convoys", "Szlak konwojów", "Industrial", "ControlTerritory", 3, 2),
    ],
  },
  {
    id: "geonosis",
    name: "Geonosis",
    region: "Outer Rim",
    position: { x: 61, y: 65 },
    mapThemeId: "geonosis-foundry",
    initialController: "Separatists",
    neighbors: ["christophsis", "ryloth", "tatooine", "mustafar"],
    fixedProvince: { ...province("primary-foundry", "Główna fabryka", "Industrial", "DestroyObjects", 2, 5), fixed: true },
    variableProvincePool: [
      province("spire-hives", "Rój skalnych iglic", "Settlement", "DefendPoint", 2, 2),
      province("arena-district", "Dystrykt areny", "Capital", "ControlTerritory", 3, 1),
      province("assembly-depths", "Głębie montażowe", "Industrial", "ProgressiveControl", 1, 4),
      province("dust-sea", "Morze pyłu", "Wilderness", "SurviveAndExtract", 1, 1),
    ],
  },
  {
    id: "tatooine",
    name: "Tatooine",
    region: "Outer Rim",
    position: { x: 76, y: 78 },
    mapThemeId: "desert-outpost",
    initialController: "Neutral",
    neighbors: ["ryloth", "geonosis", "mustafar"],
    fixedProvince: { ...province("mos-espa", "Mos Espa", "Capital", "ControlTerritory", 4, 1), fixed: true },
    variableProvincePool: [
      province("jundland-wastes", "Pustkowia Jundland", "Wilderness", "SurviveAndExtract", 1, 1),
      province("dune-sea", "Morze Wydm", "Frontier", "ProgressiveControl", 1, 1),
      province("moisture-basin", "Basen farm wilgoci", "Settlement", "DefendPoint", 3, 1),
      province("smuggler-route", "Szlak przemytników", "Orbital", "RescueAndExtract", 3, 2),
    ],
  },
  {
    id: "mustafar",
    name: "Mustafar",
    region: "Outer Rim",
    position: { x: 48, y: 84 },
    mapThemeId: "volcanic-foundry",
    initialController: "Separatists",
    neighbors: ["geonosis", "tatooine", "felucia"],
    fixedProvince: { ...province("black-furnace", "Czarny piec", "Industrial", "DestroyObjects", 2, 5), fixed: true },
    variableProvincePool: [
      province("lava-delta", "Delta lawy", "Wilderness", "SurviveAndExtract", 1, 1),
      province("mining-complex", "Kompleks wydobywczy", "Industrial", "DefendPoint", 2, 4),
      province("obsidian-pass", "Obsydianowa przełęcz", "Frontier", "ProgressiveControl", 1, 2),
      province("orbital-lifts", "Windy orbitalne", "Orbital", "ControlTerritory", 3, 2),
    ],
  },
  {
    id: "felucia",
    name: "Felucia",
    region: "Outer Rim",
    position: { x: 27, y: 71 },
    mapThemeId: "felucia-wilds",
    initialController: "Republic",
    neighbors: ["mustafar", "hoth", "endor"],
    fixedProvince: { ...province("kway-teow", "Kway Teow", "Settlement", "DefendPoint", 3, 2), fixed: true },
    variableProvincePool: [
      province("fungal-basin", "Grzybowy basen", "Wilderness", "SurviveAndExtract", 1, 1),
      province("medical-gardens", "Ogrody medyczne", "Research", "RescueAndExtract", 2, 1),
      province("jungle-relay", "Przekaźnik dżungli", "Frontier", "ProgressiveControl", 2, 2),
      province("spore-mines", "Kopalnie zarodników", "Industrial", "DestroyObjects", 2, 3),
    ],
  },
  {
    id: "hoth",
    name: "Hoth",
    region: "Outer Rim",
    position: { x: 13, y: 59 },
    mapThemeId: "ice-front",
    initialController: "Neutral",
    neighbors: ["felucia", "endor"],
    fixedProvince: { ...province("echo-basin", "Basen Echo", "Frontier", "DefendPoint", 2, 2), fixed: true },
    variableProvincePool: [
      province("northern-glacier", "Północny lodowiec", "Wilderness", "SurviveAndExtract", 1, 1),
      province("ion-field", "Pole jonowe", "Research", "ProgressiveControl", 2, 1),
      province("frozen-caverns", "Zamarznięte jaskinie", "Wilderness", "RescueAndExtract", 1, 1),
      province("orbital-beacon", "Boja orbitalna", "Orbital", "DestroyObjects", 2, 2),
    ],
  },
  {
    id: "endor",
    name: "Endor",
    region: "Outer Rim",
    position: { x: 22, y: 31 },
    mapThemeId: "forest-moon",
    initialController: "Republic",
    neighbors: ["hoth", "felucia", "mandalore"],
    fixedProvince: { ...province("bright-tree", "Jasne Drzewo", "Settlement", "DefendPoint", 3, 1), fixed: true },
    variableProvincePool: [
      province("canopy-route", "Szlak koron drzew", "Frontier", "ProgressiveControl", 1, 2),
      province("forest-bunker", "Leśny bunkier", "Industrial", "DestroyObjects", 2, 3),
      province("river-gorge", "Rzeczny wąwóz", "Wilderness", "SurviveAndExtract", 1, 1),
      province("moon-relay", "Przekaźnik księżyca", "Research", "ControlTerritory", 2, 2),
    ],
  },
];

export function createGalacticConquest(seed: number): GalacticConquestState {
  if (!Number.isInteger(seed)) throw new Error("Galactic conquest seed must be an integer.");
  return {
    seed,
    round: 1,
    activeFaction: "Republic",
    resources: {
      Republic: { credits: 10, production: 5 },
      Separatists: { credits: 10, production: 5 },
    },
    planets: galacticPlanets.map((planet) => createPlanetState(planet, seed)),
    armies: [
      {
        id: "republic-expeditionary-army",
        faction: "Republic",
        planetId: "felucia",
        provinceId: "kway-teow",
        units: [{ templateId: "clone_trooper_squad", count: 2 }],
        movementPoints: 1,
      },
      {
        id: "separatist-invasion-army",
        faction: "Separatists",
        planetId: "geonosis",
        provinceId: "primary-foundry",
        units: [{ templateId: "b1_droid_regiment", count: 2 }],
        movementPoints: 1,
      },
    ],
  };
}

export function createProvinceBattleRequest(
  state: GalacticConquestState,
  planetId: string,
  provinceId: string,
  attackerFaction: StrategicFaction,
): ProvinceBattleRequest {
  const planetDefinition = getGalacticPlanet(planetId);
  const planetState = state.planets.find((planet) => planet.planetId === planetId);
  const target = planetState?.provinces.find((provinceState) => provinceState.id === provinceId);
  if (!target) throw new Error(`Unknown conquest province: ${planetId}/${provinceId}.`);
  return {
    campaignSeed: state.seed,
    battleSeed: hash(`${state.seed}:${state.round}:${planetId}:${provinceId}:${attackerFaction}`),
    planetId,
    provinceId,
    themeId: planetDefinition.mapThemeId,
    attackerFaction,
    defenderFaction: target.controller,
    archetype: target.battleArchetype,
    fortificationLevel: target.fortificationLevel,
  };
}

export function getGalacticPlanet(planetId: string): GalacticPlanetDefinition {
  const planet = galacticPlanets.find(({ id }) => id === planetId);
  if (!planet) throw new Error(`Unknown galactic planet: ${planetId}.`);
  return planet;
}

function createPlanetState(
  planet: GalacticPlanetDefinition,
  seed: number,
): GalacticPlanetState {
  const variableProvinces = [...planet.variableProvincePool]
    .sort((left, right) =>
      hash(`${seed}:${planet.id}:${left.id}`) - hash(`${seed}:${planet.id}:${right.id}`)
    )
    .slice(0, 2);
  const templates = [planet.fixedProvince, ...variableProvinces];
  return {
    planetId: planet.id,
    provinces: templates.map((template, index): GalacticProvinceState => ({
      ...template,
      planetId: planet.id,
      controller: index < 2 ? planet.initialController : "Neutral",
      fortificationLevel: template.fixed ? 1 : 0,
      buildings: template.fixed ? ["Barracks"] : [],
      recruitmentQueue: [],
    })),
  };
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
