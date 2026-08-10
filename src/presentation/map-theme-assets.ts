import { getMapTheme, type MapThemeId } from "../core/map-generation";
import type { BattlefieldObjectType, TerrainType } from "../types";

type DecoratedTerrainType =
  | "LightCover"
  | "HeavyCover"
  | "Building"
  | "DifficultTerrain";

export type MapAssetSet = {
  id: string;
  source: {
    name: string;
    url: string;
    license: string;
    licenseUrl: string;
  };
  terrain: Partial<Record<DecoratedTerrainType, readonly string[]>>;
  objects: Partial<Record<BattlefieldObjectType, string>>;
};

export const mapAssetSets: readonly MapAssetSet[] = [{
  id: "tatooine-outpost",
  source: {
    name: "Kenney Sci-Fi RTS",
    url: "https://kenney.nl/assets/sci-fi-rts",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  terrain: {
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
