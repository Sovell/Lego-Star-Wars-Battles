import { describe, expect, it } from "vitest";
import {
  getMapAssetSet,
  getMapObjectAssetUrl,
  getMapTerrainDecorationUrl,
} from "./map-theme-assets";

const generatedThemes = [
  ["desert-outpost", "tatooine"],
  ["forest-moon", "endor"],
  ["ice-front", "hoth"],
  ["volcanic-foundry", "mustafar"],
  ["geonosis-foundry", "geonosis"],
  ["felucia-wilds", "felucia"],
  ["christophsis-crystal-city", "christophsis"],
  ["mandalore-city", "mandalore"],
  ["separatist-warship", "separatist-ship"],
  ["republic-warship", "republic-ship"],
] as const;

describe("map theme assets", () => {
  it.each(generatedThemes)("registers generated artwork first for %s", (themeId) => {
    expect(getMapAssetSet(themeId)?.sources[0]).toMatchObject({
      url: "/map-assets/generated/README.md",
      license: "Project asset",
    });
  });

  it("retains the earlier free and vector packs as documented fallback sources", () => {
    expect(getMapAssetSet("desert-outpost")?.sources.map(({ name }) => name))
      .toContain("Kenney Sci-Fi RTS");
    expect(getMapAssetSet("forest-moon")?.sources.map(({ name }) => name))
      .toEqual(expect.arrayContaining(["Kenney Foliage Pack", "Kenney Sci-Fi RTS"]));
    expect(getMapAssetSet("separatist-warship")?.sources[1]?.url)
      .toBe("/map-assets/separatist-ship/README.md");
    expect(getMapAssetSet("republic-warship")?.sources[1]?.url)
      .toBe("/map-assets/republic-ship/README.md");
  });

  it("registers generated Ryloth and research-station bundles", () => {
    expect(getMapAssetSet("ryloth-badlands")?.sources[0]?.url)
      .toBe("/map-assets/ryloth/README.md");
    expect(getMapTerrainDecorationUrl("ryloth-badlands", "Open", 2, 3))
      .toBe("/map-assets/ryloth/open-ground-brick-v2.png");
    expect(getMapTerrainDecorationUrl("ryloth-badlands", "Building", 2, 3))
      .toBe("/map-assets/ryloth/habitat-building-brick-v2.png");
    expect(getMapAssetSet("republic-research-station")?.sources[0]?.url)
      .toBe("/map-assets/republic-research-station/README.md");
    expect(getMapTerrainDecorationUrl("republic-research-station", "Building", 2, 3))
      .toBe("/map-assets/republic-research-station/laboratory-building-brick-v2.png");
  });

  it("selects terrain decoration consistently, including open ground", () => {
    const first = getMapTerrainDecorationUrl("desert-outpost", "LightCover", 2, 3);
    const replay = getMapTerrainDecorationUrl("desert-outpost", "LightCover", 2, 3);

    expect(first).toBe(replay);
    expect(getMapTerrainDecorationUrl("desert-outpost", "Open", 2, 3))
      .toBe("/map-assets/generated/tatooine/open-ground-brick-v2.png");
  });

  it.each(generatedThemes)("maps %s terrain to its generated theme directory", (themeId, slug) => {
    const directory = `/map-assets/generated/${slug}/`;
    for (const terrainType of [
      "Open",
      "LightCover",
      "HeavyCover",
      "DifficultTerrain",
      "Building",
      "Impassable",
      "Hazardous",
      "HighGround",
    ] as const) {
      expect(getMapTerrainDecorationUrl(themeId, terrainType, 2, 3)?.startsWith(directory))
        .toBe(true);
    }
  });

  it.each([
    ["ryloth-badlands", "/map-assets/ryloth/"],
    ["republic-research-station", "/map-assets/republic-research-station/"],
  ] as const)("keeps %s on its dedicated generated bundle", (themeId, directory) => {
    expect(getMapTerrainDecorationUrl(themeId, "Open", 2, 3)?.startsWith(directory))
      .toBe(true);
    expect(getMapTerrainDecorationUrl(themeId, "LightCover", 2, 3)?.startsWith(directory))
      .toBe(true);
  });

  it.each(generatedThemes)("maps standard battlefield objects for %s to generated artwork", (themeId, slug) => {
    const directory = `/map-assets/generated/${slug}/`;
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

  it("uses the shared field-hospital icon on every theme", () => {
    expect(getMapObjectAssetUrl("desert-outpost", "LightFortification", "field-hospital"))
      .toBe("/map-assets/shared/field-hospital.png");
    expect(getMapObjectAssetUrl("republic-research-station", "LightFortification", "field-hospital"))
      .toBe("/map-assets/shared/field-hospital.png");
  });

  it("uses dedicated droid-foundry artwork on every theme", () => {
    expect(getMapObjectAssetUrl("felucia-wilds", "HeavyFortification", "droid-foundry"))
      .toBe("/map-assets/geonosis/foundry-building-a.png");
    expect(getMapObjectAssetUrl("republic-research-station", "HeavyFortification", "droid-foundry"))
      .toBe("/map-assets/geonosis/foundry-building-a.png");
  });

  it("uses a visible beacon for delayed fire missions", () => {
    expect(getMapObjectAssetUrl("christophsis-crystal-city", "LightFortification", "fire-mission-target"))
      .toBe("/map-assets/mandalore/strategic-beacon.svg");
  });
});
