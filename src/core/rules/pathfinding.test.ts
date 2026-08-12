import { describe, expect, it } from "vitest";
import type { Battle } from "../../types";
import { createBattle } from "../battle-state";
import { createTerrainTile } from "../terrain-definitions";
import { findPath, getPathCost, getReachableCells } from "./pathfinding";

describe("shared pathfinding", () => {
  it("chooses a cheaper route around difficult terrain", () => {
    const battle = emptyBattle(3, 3);
    battle.board.tiles = [createTerrainTile("DifficultTerrain", 1, 1)];

    const result = findPath(battle, { x: 0, y: 1 }, { x: 2, y: 1 }, {
      movementBudget: 2,
    });

    expect(result?.cost).toBe(2);
    expect(result?.path).not.toContainEqual({ x: 1, y: 1 });
  });

  it("routes through the only gap in an impassable wall", () => {
    const battle = emptyBattle(5, 5);
    battle.board.tiles = Array.from(
      { length: 4 },
      (_, y) => createTerrainTile("Impassable", 2, y),
    );

    const result = findPath(battle, { x: 0, y: 1 }, { x: 4, y: 1 }, {
      movementBudget: 2,
    });

    expect(result).toBeDefined();
    expect(result?.path).toContainEqual({ x: 2, y: 4 });
  });

  it("reports an unreachable destination behind a complete wall", () => {
    const battle = emptyBattle(5, 5);
    battle.board.tiles = Array.from(
      { length: 5 },
      (_, y) => createTerrainTile("Impassable", 2, y),
    );

    expect(findPath(battle, { x: 0, y: 2 }, { x: 4, y: 2 })).toBeUndefined();
  });

  it("does not squeeze diagonally between two blocked cells", () => {
    const battle = emptyBattle(2, 2);
    battle.board.tiles = [
      createTerrainTile("Impassable", 1, 0),
      createTerrainTile("Impassable", 0, 1),
    ];

    expect(findPath(battle, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeUndefined();
  });

  it("treats units as blockers but may route to an occupied goal for AI planning", () => {
    const battle = emptyBattle(3, 1);
    battle.armies[1].units[0].position = { x: 2, y: 0 };

    expect(getPathCost(battle, { x: 0, y: 0 }, { x: 2, y: 0 }))
      .toBeUndefined();
    expect(getPathCost(battle, { x: 0, y: 0 }, { x: 2, y: 0 }, {
      allowOccupiedTarget: true,
    })).toBe(2);
  });

  it("returns the same cost map used to determine legal movement cells", () => {
    const battle = emptyBattle(4, 3);
    battle.board.tiles = [createTerrainTile("DifficultTerrain", 1, 1)];

    const reachable = getReachableCells(battle, { x: 0, y: 1 }, 2);
    const difficult = reachable.find(({ position }) =>
      position.x === 1 && position.y === 1
    );
    const beyond = reachable.find(({ position }) =>
      position.x === 2 && position.y === 1
    );

    expect(difficult?.cost).toBe(2);
    expect(beyond?.cost).toBe(2);
    expect(beyond?.path).not.toContainEqual({ x: 1, y: 1 });
  });
});

function emptyBattle(width: number, height: number): Battle {
  const battle = createBattle();
  return {
    ...battle,
    board: { width, height, tiles: [], objects: [] },
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => ({ ...unit, position: null })),
    })),
  };
}
