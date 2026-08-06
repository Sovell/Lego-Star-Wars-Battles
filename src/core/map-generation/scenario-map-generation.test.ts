import { describe, expect, it } from "vitest";
import {
  controlTerritoryScenario,
  defendPointScenario,
  protectGeneratorScenario,
  survivalTestScenario,
} from "../scenario/scenarios";
import type { BattlefieldObject } from "../../types";
import { validateMapConnectivity } from "./map-connectivity";
import { generateMap } from "./map-generator";
import { getMapScenarioRequirements } from "./scenario-map-requirements";

describe("scenario-aware map generation", () => {
  it("derives required map objects from victory conditions", () => {
    expect(getMapScenarioRequirements(survivalTestScenario).requiredObjects).toEqual([]);
    expect(getMapScenarioRequirements(protectGeneratorScenario).requiredObjects).toEqual([{
      objectType: "Generator",
      count: 1,
      placement: "defender-side",
    }]);
    expect(getMapScenarioRequirements(defendPointScenario).requiredObjects).toEqual([{
      objectType: "DefensePoint",
      count: 1,
      placement: "defender-side",
    }]);
    expect(getMapScenarioRequirements(controlTerritoryScenario).requiredObjects).toEqual([{
      objectType: "StrategicPoint",
      count: 3,
      placement: "distributed",
    }]);
  });

  it("places exactly one protected generator close to the defender side", () => {
    const result = generateScenarioMap(protectGeneratorScenario, 42);
    const generators = objectsOfType(result.board.objects, "Generator");

    expect(generators).toHaveLength(1);
    expect(distanceToDeploymentZone(
      generators[0],
      protectGeneratorScenario.deploymentZones[0].cells,
    )).toBe(1);
    expect(result.recipe.scenarioId).toBe(protectGeneratorScenario.id);
    expect(result.recipe.defenderArmySlot).toBe(0);
    expect(validateMapConnectivity(result.board).valid).toBe(true);
  });

  it("places exactly one defense point close to the configured defender", () => {
    const result = generateScenarioMap(defendPointScenario, 1138);
    const defensePoints = objectsOfType(result.board.objects, "DefensePoint");

    expect(defensePoints).toHaveLength(1);
    expect(distanceToDeploymentZone(
      defensePoints[0],
      defendPointScenario.deploymentZones[0].cells,
    )).toBe(1);
  });

  it("honors an explicitly selected defender army slot", () => {
    const result = generateMap({
      width: 8,
      height: 8,
      seed: 1138,
      themeId: "desert-outpost",
      scenario: defendPointScenario,
      defenderArmySlot: 1,
    });
    const defensePoint = objectsOfType(result.board.objects, "DefensePoint")[0];

    expect(distanceToDeploymentZone(
      defensePoint,
      defendPointScenario.deploymentZones[1].cells,
    )).toBe(1);
    expect(result.recipe.defenderArmySlot).toBe(1);
  });

  it("uses generated army zones when placing the selected defender objective", () => {
    const result = generateMap({
      width: 8,
      height: 8,
      seed: 1138,
      themeId: "desert-outpost",
      scenario: defendPointScenario,
      defenderArmySlot: 1,
      armies: [
        { id: "attacker", teamId: 2 },
        { id: "defender", teamId: 1 },
        { id: "ally", teamId: 1 },
      ],
    });
    const defensePoint = objectsOfType(result.board.objects, "DefensePoint")[0];
    const defenderZone = result.deploymentZones.find(({ armySlot }) => armySlot === 1)!;
    const allyZone = result.deploymentZones.find(({ armySlot }) => armySlot === 2)!;

    expect(uniqueXs(defenderZone.cells)).toEqual([0, 1]);
    expect(uniqueXs(allyZone.cells)).toEqual([0, 1]);
    expect(distanceToDeploymentZone(defensePoint, defenderZone.cells)).toBe(1);
    expect(result.recipe.armyLayout).toEqual([
      { armyId: "attacker", teamId: 2 },
      { armyId: "defender", teamId: 1 },
      { armyId: "ally", teamId: 1 },
    ]);
    const deploymentKeys = new Set(
      result.deploymentZones.flatMap((zone) =>
        zone.cells.map(({ x, y }) => `${x},${y}`)
      ),
    );
    expect(result.board.tiles.every(({ x, y }) => !deploymentKeys.has(`${x},${y}`))).toBe(true);
    expect(result.board.objects?.every(({ position }) =>
      !deploymentKeys.has(`${position.x},${position.y}`)
    )).toBe(true);
  });

  it("rejects a defender slot outside the supported four armies", () => {
    expect(() => generateMap({
      width: 8,
      height: 8,
      seed: 1,
      themeId: "desert-outpost",
      scenario: defendPointScenario,
      defenderArmySlot: 4,
    })).toThrow("Defender army slot must be an integer from 0 to 3.");
  });

  it("distributes three strategic points outside deployment zones", () => {
    const result = generateScenarioMap(controlTerritoryScenario, 1977);
    const strategicPoints = objectsOfType(result.board.objects, "StrategicPoint");
    const deploymentCells = new Set(
      controlTerritoryScenario.deploymentZones.flatMap((zone) =>
        zone.cells.map(({ x, y }) => `${x},${y}`)
      ),
    );

    expect(strategicPoints).toHaveLength(3);
    expect(strategicPoints.every(({ position }) =>
      !deploymentCells.has(`${position.x},${position.y}`)
    )).toBe(true);
    expect(pairDistances(strategicPoints).every((distance) => distance >= 2)).toBe(true);
  });

  it("uses only the theme fortification budget for a survival scenario", () => {
    const result = generateScenarioMap(survivalTestScenario, 2005);
    const objects = result.board.objects ?? [];

    expect(objects.length).toBeGreaterThanOrEqual(3);
    expect(objects.length).toBeLessThanOrEqual(5);
    expect(objects.every(({ type }) =>
      type === "LightFortification" || type === "HeavyFortification"
    )).toBe(true);
  });

  it("keeps scenario objects deterministic as part of the seed", () => {
    const first = generateScenarioMap(controlTerritoryScenario, 66);
    const second = generateScenarioMap(controlTerritoryScenario, 66);

    expect(first).toEqual(second);
    expect(new Set(first.board.objects?.map(({ id }) => id)).size)
      .toBe(first.board.objects?.length);
  });
});

function generateScenarioMap(
  scenario: typeof survivalTestScenario,
  seed: number,
) {
  return generateMap({
    width: 8,
    height: 8,
    seed,
    themeId: "desert-outpost",
    scenario,
  });
}

function objectsOfType(
  objects: BattlefieldObject[] | undefined,
  type: BattlefieldObject["type"],
): BattlefieldObject[] {
  return (objects ?? []).filter((object) => object.type === type);
}

function distanceToDeploymentZone(
  object: BattlefieldObject,
  cells: Array<{ x: number; y: number }>,
): number {
  return Math.min(...cells.map((cell) => distance(object.position, cell)));
}

function pairDistances(objects: BattlefieldObject[]): number[] {
  return objects.flatMap((object, index) =>
    objects.slice(index + 1).map((other) => distance(object.position, other.position))
  );
}

function distance(first: { x: number; y: number }, second: { x: number; y: number }): number {
  return Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y));
}

function uniqueXs(cells: Array<{ x: number; y: number }>): number[] {
  return [...new Set(cells.map(({ x }) => x))].sort((left, right) => left - right);
}
