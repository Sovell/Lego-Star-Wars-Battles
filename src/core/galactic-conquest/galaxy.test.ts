import { describe, expect, it } from "vitest";
import { getMapTheme } from "../map-generation";
import {
  createGalacticConquest,
  createProvinceBattleRequest,
  galacticHyperlanes,
  galacticPlanets,
  getGalacticPlanet,
  lockedGalacticLocations,
} from "./galaxy";

describe("galactic conquest galaxy", () => {
  it("creates exactly three provinces per playable planet", () => {
    const state = createGalacticConquest(42);
    expect(state.planets).toHaveLength(9);
    expect(state.planets.every(({ provinces }) => provinces.length === 3)).toBe(true);
    for (const planetState of state.planets) {
      const definition = getGalacticPlanet(planetState.planetId);
      expect(planetState.provinces.some(({ id, fixed }) =>
        id === definition.fixedProvince.id && fixed
      )).toBe(true);
      expect(new Set(planetState.provinces.map(({ id }) => id)).size).toBe(3);
    }
  });

  it("selects variable provinces deterministically while allowing campaign variety", () => {
    expect(createGalacticConquest(2026)).toEqual(createGalacticConquest(2026));
    const first = createGalacticConquest(1).planets.flatMap(({ provinces }) =>
      provinces.filter(({ fixed }) => !fixed).map(({ planetId, id }) => `${planetId}/${id}`)
    );
    const second = createGalacticConquest(2).planets.flatMap(({ provinces }) =>
      provinces.filter(({ fixed }) => !fixed).map(({ planetId, id }) => `${planetId}/${id}`)
    );
    expect(second).not.toEqual(first);
  });

  it("keeps routes reciprocal and every planet connected to the strategic graph", () => {
    for (const planet of galacticPlanets) {
      expect(planet.neighbors.length).toBeGreaterThan(0);
      for (const neighborId of planet.neighbors) {
        expect(getGalacticPlanet(neighborId).neighbors).toContain(planet.id);
      }
    }
  });

  it("exposes each hyperlane once and keeps movement independent from render distance", () => {
    expect(new Set(galacticHyperlanes.map(({ id }) => id)).size).toBe(galacticHyperlanes.length);
    expect(galacticHyperlanes.every(({ movementCost }) => movementCost === 1)).toBe(true);
    for (const lane of galacticHyperlanes) {
      expect(getGalacticPlanet(lane.fromPlanetId).neighbors).toContain(lane.toPlanetId);
      expect(getGalacticPlanet(lane.toPlanetId).neighbors).toContain(lane.fromPlanetId);
    }
  });

  it("keeps future locations visible in the galaxy model without making them playable", () => {
    const allLocationIds = [
      ...galacticPlanets.map(({ id }) => id),
      ...lockedGalacticLocations.map(({ id }) => id),
    ];
    expect(new Set(allLocationIds).size).toBe(allLocationIds.length);
    expect(lockedGalacticLocations.every(({ playable }) => !playable)).toBe(true);
    expect(lockedGalacticLocations.find(({ id }) => id === "coruscant")?.capitalOf)
      .toBe("Republic");
    expect(lockedGalacticLocations.find(({ id }) => id === "raxus-secundus")?.capitalOf)
      .toBe("Separatists");
  });

  it("uses a galactic layout with the Core central and remote systems on the rim", () => {
    expect(lockedGalacticLocations.find(({ id }) => id === "coruscant")?.position)
      .toEqual({ x: 50, y: 48 });
    expect(lockedGalacticLocations.find(({ id }) => id === "kamino")?.position)
      .toEqual({ x: 7, y: 83 });
    expect(getGalacticPlanet("tatooine").position).toEqual({ x: 86, y: 80 });
    expect(getGalacticPlanet("hoth").position).toEqual({ x: 13, y: 45 });
  });

  it("uses Endor and Geonosis as the playable campaign headquarters", () => {
    expect(getGalacticPlanet("endor")).toMatchObject({
      playable: true,
      capitalOf: "Republic",
    });
    expect(getGalacticPlanet("geonosis")).toMatchObject({
      playable: true,
      capitalOf: "Separatists",
    });
  });

  it("routes a province conflict into the existing battle generator contract", () => {
    const state = createGalacticConquest(77);
    const target = state.planets.find(({ planetId }) => planetId === "geonosis")!.provinces[0];
    const request = createProvinceBattleRequest(state, "geonosis", target.id, "Republic");

    expect(request.themeId).toBe("geonosis-foundry");
    expect(request.defenderFaction).toBe("Separatists");
    expect(request.archetype).toBe("DestroyObjects");
    expect(getMapTheme(request.themeId).id).toBe(request.themeId);
    expect(createProvinceBattleRequest(state, "geonosis", target.id, "Republic"))
      .toEqual(request);
  });
});
