import { describe, expect, it } from "vitest";
import { generateDeploymentZones } from "./deployment-zone-generator";

describe("generated deployment zones", () => {
  it("places two opposing armies on opposite board edges", () => {
    const zones = generateDeploymentZones({
      width: 8,
      height: 8,
      armies: [army("a", 1), army("b", 2)],
      defenderArmySlot: 0,
    });

    expect(uniqueXs(zones[0].cells)).toEqual([0, 1]);
    expect(uniqueXs(zones[1].cells)).toEqual([6, 7]);
    expect(zones[0].cells).toHaveLength(16);
    expect(zones[1].cells).toHaveLength(16);
  });

  it("moves the selected defender team to the left edge", () => {
    const zones = generateDeploymentZones({
      width: 8,
      height: 8,
      armies: [army("a", 1), army("b", 2)],
      defenderArmySlot: 1,
    });

    expect(uniqueXs(zones[1].cells)).toEqual([0, 1]);
    expect(uniqueXs(zones[0].cells)).toEqual([6, 7]);
  });

  it("splits one edge into adjacent sectors for allied armies", () => {
    const zones = generateDeploymentZones({
      width: 8,
      height: 8,
      armies: [army("a", 1), army("b", 1), army("c", 2)],
      defenderArmySlot: 0,
    });

    expect(uniqueXs(zones[0].cells)).toEqual([0, 1]);
    expect(uniqueYs(zones[0].cells)).toEqual([0, 1, 2, 3]);
    expect(uniqueXs(zones[1].cells)).toEqual([0, 1]);
    expect(uniqueYs(zones[1].cells)).toEqual([4, 5, 6, 7]);
    expect(uniqueXs(zones[2].cells)).toEqual([6, 7]);
  });

  it("keeps two allied pairs on opposite edges", () => {
    const zones = generateDeploymentZones({
      width: 8,
      height: 8,
      armies: [army("a", 1), army("b", 2), army("c", 1), army("d", 2)],
      defenderArmySlot: 0,
    });

    expect(uniqueXs(zones[0].cells)).toEqual([0, 1]);
    expect(uniqueXs(zones[2].cells)).toEqual([0, 1]);
    expect(uniqueXs(zones[1].cells)).toEqual([6, 7]);
    expect(uniqueXs(zones[3].cells)).toEqual([6, 7]);
    expect(allCellsAreUnique(zones)).toBe(true);
  });

  it("uses four non-overlapping edges for a four-way battle", () => {
    const zones = generateDeploymentZones({
      width: 8,
      height: 8,
      armies: [army("a"), army("b"), army("c"), army("d")],
      defenderArmySlot: 0,
    });

    expect(uniqueXs(zones[0].cells)).toEqual([0, 1]);
    expect(uniqueXs(zones[1].cells)).toEqual([6, 7]);
    expect(uniqueYs(zones[2].cells)).toEqual([0, 1]);
    expect(uniqueXs(zones[2].cells)).toEqual([2, 3, 4, 5]);
    expect(uniqueYs(zones[3].cells)).toEqual([6, 7]);
    expect(uniqueXs(zones[3].cells)).toEqual([2, 3, 4, 5]);
    expect(allCellsAreUnique(zones)).toBe(true);
  });

  it("rejects unsupported army counts and overlapping board geometry", () => {
    expect(() => generateDeploymentZones({
      width: 8,
      height: 8,
      armies: [army("a"), army("b"), army("c"), army("d"), army("e")],
    })).toThrow("Map generation supports at most four armies.");
    expect(() => generateDeploymentZones({
      width: 3,
      height: 3,
      armies: [army("a"), army("b")],
      depth: 2,
    })).toThrow("Deployment depth is too large for this board.");
  });
});

function army(id: string, teamId?: 1 | 2) {
  return { id, ...(teamId ? { teamId } : {}) };
}

function uniqueXs(cells: Array<{ x: number; y: number }>): number[] {
  return [...new Set(cells.map(({ x }) => x))].sort((left, right) => left - right);
}

function uniqueYs(cells: Array<{ x: number; y: number }>): number[] {
  return [...new Set(cells.map(({ y }) => y))].sort((left, right) => left - right);
}

function allCellsAreUnique(zones: Array<{ cells: Array<{ x: number; y: number }> }>): boolean {
  const keys = zones.flatMap((zone) => zone.cells.map(({ x, y }) => `${x},${y}`));
  return new Set(keys).size === keys.length;
}
