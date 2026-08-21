import type { MapThemeId } from "../map-generation/map-theme-id";

export type StrategicFaction = "Republic" | "Separatists";
export type ProvinceController = StrategicFaction | "Neutral";
export type GalacticRegion = "Core" | "Inner Rim" | "Mid Rim" | "Outer Rim";
export type ProvinceType =
  | "Capital"
  | "Settlement"
  | "Industrial"
  | "Research"
  | "Wilderness"
  | "Frontier"
  | "Orbital";
export type ProvinceBattleArchetype =
  | "ControlTerritory"
  | "DefendPoint"
  | "DestroyObjects"
  | "ProgressiveControl"
  | "RescueAndExtract"
  | "SurviveAndExtract";

export type GalacticPosition = { x: number; y: number };

export type HyperlaneDefinition = {
  id: string;
  fromPlanetId: string;
  toPlanetId: string;
  movementCost: number;
};

export type ProvinceTemplate = {
  id: string;
  name: string;
  type: ProvinceType;
  battleArchetype: ProvinceBattleArchetype;
  income: number;
  production: number;
  fixed?: boolean;
};

export type GalacticLocationDefinition = {
  id: string;
  name: string;
  region: GalacticRegion;
  position: GalacticPosition;
  playable: boolean;
  capitalOf?: StrategicFaction;
};

export type GalacticPlanetDefinition = GalacticLocationDefinition & {
  playable: true;
  mapThemeId: MapThemeId;
  initialController: ProvinceController;
  neighbors: string[];
  fixedProvince: ProvinceTemplate;
  variableProvincePool: ProvinceTemplate[];
};

export type LockedGalacticLocationDefinition = GalacticLocationDefinition & {
  playable: false;
};

export type GalacticProvinceState = ProvinceTemplate & {
  planetId: string;
  controller: ProvinceController;
  fortificationLevel: number;
  buildings: Array<"Barracks" | "Factory" | "Hospital" | "Sensor Array">;
  recruitmentQueue: Array<{ templateId: string; remainingRounds: number }>;
};

export type GalacticPlanetState = {
  planetId: string;
  provinces: GalacticProvinceState[];
};

export type GalacticArmy = {
  id: string;
  faction: StrategicFaction;
  planetId: string;
  provinceId: string;
  units: Array<{ templateId: string; count: number }>;
  movementPoints: number;
};

export type GalacticConquestState = {
  seed: number;
  round: number;
  activeFaction: StrategicFaction;
  resources: Record<StrategicFaction, { credits: number; production: number }>;
  planets: GalacticPlanetState[];
  armies: GalacticArmy[];
};

export type ProvinceBattleRequest = {
  campaignSeed: number;
  battleSeed: number;
  planetId: string;
  provinceId: string;
  themeId: MapThemeId;
  attackerFaction: StrategicFaction;
  defenderFaction: ProvinceController;
  archetype: ProvinceBattleArchetype;
  fortificationLevel: number;
};
