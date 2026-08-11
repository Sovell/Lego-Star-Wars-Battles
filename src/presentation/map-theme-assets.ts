import { getMapTheme, type MapThemeId } from "../core/map-generation";
import type { BattlefieldObjectType, TerrainType } from "../types";

type DecoratedTerrainType =
  | "LightCover"
  | "HeavyCover"
  | "Building"
  | "DifficultTerrain"
  | "Impassable"
  | "Hazardous"
  | "HighGround";

export type MapAssetSet = {
  id: string;
  sources: readonly {
    name: string;
    url: string;
    license: string;
    licenseUrl: string;
  }[];
  terrain: Partial<Record<DecoratedTerrainType, readonly string[]>>;
  objects: Partial<Record<BattlefieldObjectType, string>>;
};

const sciFiRtsSource = {
  name: "Kenney Sci-Fi RTS",
  url: "https://kenney.nl/assets/sci-fi-rts",
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
} as const;

const foliagePackSource = {
  name: "Kenney Foliage Pack",
  url: "https://kenney.nl/assets/foliage-pack",
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
} as const;

const mandaloreVectorSource = {
  name: "LEGO Star Wars Battles — Mandalore vector pack",
  url: "/map-assets/mandalore/README.md",
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
} as const;

export const mapAssetSets: readonly MapAssetSet[] = [{
  id: "tatooine-outpost",
  sources: [sciFiRtsSource],
  terrain: {
    Impassable: ["/map-assets/tatooine/impassable-a.png"],
    Hazardous: ["/map-assets/tatooine/hazardous-a.png"],
    HighGround: ["/map-assets/tatooine/high-ground-a.png"],
    LightCover: [
      "/map-assets/tatooine/rocks-light-a.png",
      "/map-assets/tatooine/rocks-light-b.png",
    ],
    HeavyCover: [
      "/map-assets/tatooine/rocks-heavy-a.png",
      "/map-assets/tatooine/rocks-heavy-b.png",
    ],
    DifficultTerrain: ["/map-assets/tatooine/mineral-rough-a.png"],
    Building: [
      "/map-assets/tatooine/building-module-a.png",
      "/map-assets/tatooine/building-module-b.png",
    ],
  },
  objects: {
    DefensePoint: "/map-assets/tatooine/defense-turret.png",
    StrategicPoint: "/map-assets/tatooine/strategic-array.png",
    Generator: "/map-assets/tatooine/generator-tanks.png",
    LightFortification: "/map-assets/tatooine/light-barricade.png",
    HeavyFortification: "/map-assets/tatooine/heavy-bunker.png",
  },
}, {
  id: "endor-forest",
  sources: [foliagePackSource, sciFiRtsSource],
  terrain: {
    Impassable: ["/map-assets/endor/impassable-a.png"],
    Hazardous: ["/map-assets/endor/hazardous-a.png"],
    HighGround: ["/map-assets/endor/high-ground-a.png"],
    LightCover: [
      "/map-assets/endor/forest-floor-a.png",
      "/map-assets/endor/forest-floor-b.png",
    ],
    HeavyCover: [
      "/map-assets/endor/forest-tree-a.png",
      "/map-assets/endor/forest-tree-b.png",
    ],
    DifficultTerrain: [
      "/map-assets/endor/forest-brush-a.png",
      "/map-assets/endor/forest-brush-b.png",
    ],
    Building: [
      "/map-assets/endor/forest-building-a.png",
      "/map-assets/endor/forest-building-b.png",
    ],
  },
  objects: {
    DefensePoint: "/map-assets/endor/defense-turret.png",
    StrategicPoint: "/map-assets/endor/strategic-array.png",
    Generator: "/map-assets/endor/generator-tanks.png",
    LightFortification: "/map-assets/endor/light-barricade.png",
    HeavyFortification: "/map-assets/endor/heavy-bunker.png",
  },
}, {
  id: "hoth-ice",
  sources: [foliagePackSource, sciFiRtsSource],
  terrain: {
    Impassable: ["/map-assets/hoth/impassable-a.png"],
    Hazardous: ["/map-assets/hoth/hazardous-a.png"],
    HighGround: ["/map-assets/hoth/high-ground-a.png"],
    LightCover: [
      "/map-assets/hoth/ice-rocks-light-a.png",
      "/map-assets/hoth/ice-rocks-light-b.png",
    ],
    HeavyCover: [
      "/map-assets/hoth/snow-ridge-a.png",
      "/map-assets/hoth/snow-ridge-b.png",
    ],
    DifficultTerrain: [
      "/map-assets/hoth/ice-rough-a.png",
      "/map-assets/hoth/ice-rough-b.png",
    ],
    Building: [
      "/map-assets/hoth/ice-building-a.png",
      "/map-assets/hoth/ice-building-b.png",
    ],
  },
  objects: {
    DefensePoint: "/map-assets/hoth/defense-turret.png",
    StrategicPoint: "/map-assets/hoth/strategic-array.png",
    Generator: "/map-assets/hoth/generator-tanks.png",
    LightFortification: "/map-assets/hoth/light-barricade.png",
    HeavyFortification: "/map-assets/hoth/heavy-bunker.png",
  },
}, {
  id: "mustafar-foundry",
  sources: [sciFiRtsSource],
  terrain: {
    Impassable: ["/map-assets/mustafar/impassable-a.png"],
    Hazardous: ["/map-assets/mustafar/hazardous-a.png"],
    HighGround: ["/map-assets/mustafar/high-ground-a.png"],
    LightCover: [
      "/map-assets/mustafar/basalt-light-a.png",
      "/map-assets/mustafar/basalt-light-b.png",
    ],
    HeavyCover: [
      "/map-assets/mustafar/basalt-heavy-a.png",
      "/map-assets/mustafar/basalt-heavy-b.png",
    ],
    DifficultTerrain: [
      "/map-assets/mustafar/mineral-rough-a.png",
      "/map-assets/mustafar/mineral-rough-b.png",
    ],
    Building: [
      "/map-assets/mustafar/foundry-building-a.png",
      "/map-assets/mustafar/foundry-building-b.png",
    ],
  },
  objects: {
    DefensePoint: "/map-assets/mustafar/defense-turret.png",
    StrategicPoint: "/map-assets/mustafar/strategic-array.png",
    Generator: "/map-assets/mustafar/generator-core.png",
    LightFortification: "/map-assets/mustafar/light-barricade.png",
    HeavyFortification: "/map-assets/mustafar/heavy-bunker.png",
  },
}, {
  id: "geonosis-foundry",
  sources: [sciFiRtsSource],
  terrain: {
    Impassable: ["/map-assets/geonosis/impassable-a.png"],
    Hazardous: ["/map-assets/geonosis/hazardous-a.png"],
    HighGround: ["/map-assets/geonosis/high-ground-a.png"],
    LightCover: [
      "/map-assets/geonosis/rocks-light-a.png",
      "/map-assets/geonosis/rocks-light-b.png",
    ],
    HeavyCover: [
      "/map-assets/geonosis/spires-heavy-a.png",
      "/map-assets/geonosis/spires-heavy-b.png",
    ],
    DifficultTerrain: [
      "/map-assets/geonosis/mineral-rough-a.png",
      "/map-assets/geonosis/mineral-rough-b.png",
    ],
    Building: [
      "/map-assets/geonosis/foundry-building-a.png",
      "/map-assets/geonosis/foundry-building-b.png",
    ],
  },
  objects: {
    DefensePoint: "/map-assets/geonosis/defense-turret.png",
    StrategicPoint: "/map-assets/geonosis/strategic-array.png",
    Generator: "/map-assets/geonosis/generator-core.png",
    LightFortification: "/map-assets/geonosis/light-barricade.png",
    HeavyFortification: "/map-assets/geonosis/heavy-bunker.png",
  },
}, {
  id: "felucia-fungal",
  sources: [foliagePackSource, sciFiRtsSource],
  terrain: {
    Impassable: ["/map-assets/felucia/impassable-a.png"],
    Hazardous: ["/map-assets/felucia/hazardous-a.png"],
    HighGround: ["/map-assets/felucia/high-ground-a.png"],
    LightCover: [
      "/map-assets/felucia/alien-flora-light-a.png",
      "/map-assets/felucia/alien-flora-light-b.png",
    ],
    HeavyCover: [
      "/map-assets/felucia/fungal-growth-heavy-a.png",
      "/map-assets/felucia/fungal-growth-heavy-b.png",
    ],
    DifficultTerrain: [
      "/map-assets/felucia/fungal-rough-a.png",
      "/map-assets/felucia/fungal-rough-b.png",
    ],
    Building: [
      "/map-assets/felucia/outpost-building-a.png",
      "/map-assets/felucia/outpost-building-b.png",
    ],
  },
  objects: {
    DefensePoint: "/map-assets/felucia/defense-turret.png",
    StrategicPoint: "/map-assets/felucia/strategic-array.png",
    Generator: "/map-assets/felucia/generator-tanks.png",
    LightFortification: "/map-assets/felucia/light-barricade.png",
    HeavyFortification: "/map-assets/felucia/heavy-bunker.png",
  },
}, {
  id: "christophsis-crystal",
  sources: [sciFiRtsSource],
  terrain: {
    Impassable: ["/map-assets/christophsis/impassable-a.png"],
    Hazardous: ["/map-assets/christophsis/hazardous-a.png"],
    HighGround: ["/map-assets/christophsis/high-ground-a.png"],
    LightCover: [
      "/map-assets/christophsis/crystal-rocks-light-a.png",
      "/map-assets/christophsis/crystal-rocks-light-b.png",
    ],
    HeavyCover: [
      "/map-assets/christophsis/crystal-ridge-heavy-a.png",
      "/map-assets/christophsis/crystal-ridge-heavy-b.png",
    ],
    DifficultTerrain: [
      "/map-assets/christophsis/crystal-rough-a.png",
      "/map-assets/christophsis/crystal-rough-b.png",
    ],
    Building: [
      "/map-assets/christophsis/city-building-a.png",
      "/map-assets/christophsis/city-building-b.png",
    ],
  },
  objects: {
    DefensePoint: "/map-assets/christophsis/defense-turret.png",
    StrategicPoint: "/map-assets/christophsis/strategic-array.png",
    Generator: "/map-assets/christophsis/generator-tanks.png",
    LightFortification: "/map-assets/christophsis/light-barricade.png",
    HeavyFortification: "/map-assets/christophsis/heavy-bunker.png",
  },
}, {
  id: "mandalore-city",
  sources: [mandaloreVectorSource],
  terrain: {
    Impassable: ["/map-assets/mandalore/impassable-dome.svg"],
    Hazardous: ["/map-assets/mandalore/hazardous-vent.svg"],
    HighGround: ["/map-assets/mandalore/high-ground-platform.svg"],
    LightCover: [
      "/map-assets/mandalore/light-cover-a.svg",
      "/map-assets/mandalore/light-cover-b.svg",
    ],
    HeavyCover: [
      "/map-assets/mandalore/heavy-cover-a.svg",
      "/map-assets/mandalore/heavy-cover-b.svg",
    ],
    DifficultTerrain: [
      "/map-assets/mandalore/difficult-plaza-a.svg",
      "/map-assets/mandalore/difficult-plaza-b.svg",
    ],
    Building: [
      "/map-assets/mandalore/building-dome-a.svg",
      "/map-assets/mandalore/building-dome-b.svg",
    ],
  },
  objects: {
    DefensePoint: "/map-assets/mandalore/defense-turret.svg",
    StrategicPoint: "/map-assets/mandalore/strategic-beacon.svg",
    Generator: "/map-assets/mandalore/generator-core.svg",
    LightFortification: "/map-assets/mandalore/light-barricade.svg",
    HeavyFortification: "/map-assets/mandalore/heavy-bunker.svg",
  },
}];

export function getMapAssetSet(themeId: MapThemeId): MapAssetSet | undefined {
  const assetSetId = getMapTheme(themeId).presentation.assetSetId;
  return mapAssetSets.find(({ id }) => id === assetSetId);
}

export function getMapTerrainDecorationUrl(
  themeId: MapThemeId,
  terrainType: TerrainType,
  x: number,
  y: number,
): string | undefined {
  const assets = getMapAssetSet(themeId)?.terrain[asDecoratedTerrainType(terrainType)];
  if (!assets?.length) return undefined;
  return assets[assetVariant(x, y, assets.length)];
}

export function getMapObjectAssetUrl(
  themeId: MapThemeId,
  objectType: BattlefieldObjectType,
): string | undefined {
  return getMapAssetSet(themeId)?.objects[objectType];
}

function asDecoratedTerrainType(terrainType: TerrainType): DecoratedTerrainType {
  return terrainType as DecoratedTerrainType;
}

function assetVariant(x: number, y: number, count: number): number {
  const hash = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  return hash % count;
}
