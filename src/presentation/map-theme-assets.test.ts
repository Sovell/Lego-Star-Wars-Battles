import { describe, expect, it } from "vitest";
import {
  getMapAssetSet,
  getMapObjectAssetUrl,
  getMapTerrainDecorationUrl,
} from "./map-theme-assets";

describe("map theme assets", () => {
  it("registers the Tatooine bundle with its CC0 source", () => {
    expect(getMapAssetSet("desert-outpost")?.source).toEqual({
      name: "Kenney Sci-Fi RTS",
      url: "https://kenney.nl/assets/sci-fi-rts",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    });
    expect(getMapAssetSet("forest-moon")).toBeUndefined();
  });

  it("selects terrain decoration variants deterministically", () => {
    const first = getMapTerrainDecorationUrl("desert-outpost", "LightCover", 2, 3);
    const replay = getMapTerrainDecorationUrl("desert-outpost", "LightCover", 2, 3);
    const other = getMapTerrainDecorationUrl("desert-outpost", "LightCover", 3, 3);

    expect(first).toBe(replay);
    expect(first).not.toBe(other);
    expect(getMapTerrainDecorationUrl("desert-outpost", "Open", 2, 3)).toBeUndefined();
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
});
