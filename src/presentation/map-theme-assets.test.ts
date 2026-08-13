import { describe, expect, it } from "vitest";
import {
  getMapAssetSet,
  getMapObjectAssetUrl,
  getMapTerrainDecorationUrl,
} from "./map-theme-assets";

describe("map theme assets", () => {
  it("registers every planetary bundle with its CC0 sources", () => {
    expect(getMapAssetSet("desert-outpost")?.sources).toEqual([{
      name: "Kenney Sci-Fi RTS",
      url: "https://kenney.nl/assets/sci-fi-rts",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    }]);
    expect(getMapAssetSet("forest-moon")?.sources.map(({ name }) => name))
      .toEqual(["Kenney Foliage Pack", "Kenney Sci-Fi RTS"]);
    expect(getMapAssetSet("ice-front")?.sources.map(({ name }) => name))
      .toEqual(["Kenney Foliage Pack", "Kenney Sci-Fi RTS"]);
    expect(getMapAssetSet("volcanic-foundry")?.sources.map(({ name }) => name))
      .toEqual(["Kenney Sci-Fi RTS"]);
    expect(getMapAssetSet("geonosis-foundry")?.sources.map(({ name }) => name))
      .toEqual(["Kenney Sci-Fi RTS"]);
    expect(getMapAssetSet("felucia-wilds")?.sources.map(({ name }) => name))
      .toEqual(["Kenney Foliage Pack", "Kenney Sci-Fi RTS"]);
    expect(getMapAssetSet("christophsis-crystal-city")?.sources.map(({ name }) => name))
      .toEqual(["Kenney Sci-Fi RTS"]);
    expect(getMapAssetSet("mandalore-city")?.sources.map(({ name }) => name))
      .toEqual(["LEGO Star Wars Battles — Mandalore vector pack"]);
  });

  it("registers both starship vector bundles", () => {
    expect(getMapAssetSet("separatist-warship")?.sources[0]?.url)
      .toBe("/map-assets/separatist-ship/README.md");
    expect(getMapAssetSet("republic-warship")?.sources[0]?.url)
      .toBe("/map-assets/republic-ship/README.md");
  });

  it("selects terrain decoration variants deterministically", () => {
    const first = getMapTerrainDecorationUrl("desert-outpost", "LightCover", 2, 3);
    const replay = getMapTerrainDecorationUrl("desert-outpost", "LightCover", 2, 3);
    const other = getMapTerrainDecorationUrl("desert-outpost", "LightCover", 3, 3);

    expect(first).toBe(replay);
    expect(first).not.toBe(other);
    expect(getMapTerrainDecorationUrl("desert-outpost", "Open", 2, 3)).toBeUndefined();
  });

  it.each([
    ["desert-outpost", "/map-assets/tatooine/"],
    ["forest-moon", "/map-assets/endor/"],
    ["ice-front", "/map-assets/hoth/"],
    ["volcanic-foundry", "/map-assets/mustafar/"],
    ["geonosis-foundry", "/map-assets/geonosis/"],
    ["felucia-wilds", "/map-assets/felucia/"],
    ["christophsis-crystal-city", "/map-assets/christophsis/"],
    ["mandalore-city", "/map-assets/mandalore/"],
    ["separatist-warship", "/map-assets/separatist-ship/"],
    ["republic-warship", "/map-assets/republic-ship/"],
  ] as const)("maps %s terrain to its own asset directory", (themeId, directory) => {
    expect(getMapTerrainDecorationUrl(themeId, "LightCover", 2, 3)?.startsWith(directory))
      .toBe(true);
    expect(getMapTerrainDecorationUrl(themeId, "HeavyCover", 2, 3)?.startsWith(directory))
      .toBe(true);
    expect(getMapTerrainDecorationUrl(themeId, "DifficultTerrain", 2, 3)?.startsWith(directory))
      .toBe(true);
    expect(getMapTerrainDecorationUrl(themeId, "Building", 2, 3)?.startsWith(directory))
      .toBe(true);
    expect(getMapTerrainDecorationUrl(themeId, "Impassable", 2, 3)?.startsWith(directory))
      .toBe(true);
    expect(getMapTerrainDecorationUrl(themeId, "Hazardous", 2, 3)?.startsWith(directory))
      .toBe(true);
    expect(getMapTerrainDecorationUrl(themeId, "HighGround", 2, 3)?.startsWith(directory))
      .toBe(true);
  });

  it("maps every battlefield object to themed Tatooine artwork", () => {
    expect(getMapObjectAssetUrl("desert-outpost", "DefensePoint"))
      .toBe("/map-assets/tatooine/defense-turret.png");
    expect(getMapObjectAssetUrl("desert-outpost", "StrategicPoint"))
      .toBe("/map-assets/tatooine/strategic-array.png");
    expect(getMapObjectAssetUrl("desert-outpost", "Generator"))
      .toBe("/map-assets/tatooine/generator-tanks.png");
    expect(getMapObjectAssetUrl("desert-outpost", "LightFortification"))
      .toBe("/map-assets/tatooine/light-barricade.png");
    expect(getMapObjectAssetUrl("desert-outpost", "HeavyFortification"))
      .toBe("/map-assets/tatooine/heavy-bunker.png");
  });

  it.each([
    ["forest-moon", "/map-assets/endor/"],
    ["ice-front", "/map-assets/hoth/"],
    ["volcanic-foundry", "/map-assets/mustafar/"],
    ["geonosis-foundry", "/map-assets/geonosis/"],
    ["felucia-wilds", "/map-assets/felucia/"],
    ["christophsis-crystal-city", "/map-assets/christophsis/"],
    ["mandalore-city", "/map-assets/mandalore/"],
    ["separatist-warship", "/map-assets/separatist-ship/"],
    ["republic-warship", "/map-assets/republic-ship/"],
  ] as const)("maps every battlefield object for %s", (themeId, directory) => {
    for (const objectType of [
      "DefensePoint",
      "StrategicPoint",
      "Generator",
      "LightFortification",
      "HeavyFortification",
    ] as const) {
      expect(getMapObjectAssetUrl(themeId, objectType)?.startsWith(directory)).toBe(true);
    }
  });

  it("uses dedicated rescue objective artwork on starship maps", () => {
    expect(getMapObjectAssetUrl("separatist-warship", "StrategicPoint", "r2-d2"))
      .toBe("/map-assets/separatist-ship/r2-d2.svg");
    expect(getMapObjectAssetUrl("republic-warship", "StrategicPoint", "extraction"))
      .toBe("/map-assets/republic-ship/extraction-airlock.svg");
  });
});
