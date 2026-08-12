import type { Battle } from "../../types";
import { isTerrainEnterable } from "../terrain-definitions";
import { isOnBoard, type GridPosition } from "./geometry";
import { getUnitAtPosition } from "./occupancy";
import { getTerrainAtPosition } from "./terrain";

export type PathfindingOptions = {
  unitId?: string;
  movementBudget?: number;
  maxCost?: number;
  allowOccupiedTarget?: boolean;
};

export type PathResult = {
  path: GridPosition[];
  cost: number;
};

export type ReachableCell = {
  position: GridPosition;
  cost: number;
  path: GridPosition[];
};

type SearchState = {
  costs: Map<string, number>;
  previous: Map<string, GridPosition>;
};

/** Finds the cheapest legal route on the board using terrain movement costs. */
export function findPath(
  battle: Battle,
  start: GridPosition,
  target: GridPosition,
  options: PathfindingOptions = {},
): PathResult | undefined {
  if (!isOnBoard(battle, start) || !isOnBoard(battle, target)) return undefined;
  const state = searchPaths(battle, start, target, options);
  const cost = state.costs.get(positionKey(target));
  if (cost === undefined) return undefined;
  return { cost, path: reconstructPath(state.previous, start, target) };
}

/** Returns every field reachable within one movement budget and its cheapest path. */
export function getReachableCells(
  battle: Battle,
  start: GridPosition,
  movementBudget: number,
  options: Omit<PathfindingOptions, "movementBudget" | "maxCost"> = {},
): ReachableCell[] {
  if (!isOnBoard(battle, start) || movementBudget < 0) return [];
  const state = searchPaths(battle, start, undefined, {
    ...options,
    movementBudget,
    maxCost: movementBudget,
  });
  return [...state.costs.entries()]
    .filter(([key]) => key !== positionKey(start))
    .map(([key, cost]) => {
      const position = parsePositionKey(key);
      return {
        position,
        cost,
        path: reconstructPath(state.previous, start, position),
      };
    })
    .sort((left, right) =>
      left.cost - right.cost ||
      left.position.y - right.position.y ||
      left.position.x - right.position.x
    );
}

export function getPathCost(
  battle: Battle,
  start: GridPosition,
  target: GridPosition,
  options: PathfindingOptions = {},
): number | undefined {
  return findPath(battle, start, target, options)?.cost;
}

function searchPaths(
  battle: Battle,
  start: GridPosition,
  target: GridPosition | undefined,
  options: PathfindingOptions,
): SearchState {
  const costs = new Map<string, number>([[positionKey(start), 0]]);
  const previous = new Map<string, GridPosition>();
  const queue: Array<{ position: GridPosition; cost: number }> = [{ position: start, cost: 0 }];
  const movementBudget = Math.max(1, Math.floor(options.movementBudget ?? 1));
  const maxCost = options.maxCost ?? Number.POSITIVE_INFINITY;

  while (queue.length > 0) {
    queue.sort((left, right) =>
      left.cost - right.cost ||
      left.position.y - right.position.y ||
      left.position.x - right.position.x
    );
    const current = queue.shift();
    if (!current || current.cost > (costs.get(positionKey(current.position)) ?? Infinity)) continue;
    if (target && samePosition(current.position, target)) break;

    for (const position of adjacentPositions(current.position)) {
      const isTarget = Boolean(target && samePosition(position, target));
      if (!canEnter(battle, current.position, position, {
        ...options,
        allowOccupiedTarget: isTarget && options.allowOccupiedTarget,
      })) continue;
      const terrainCost = Math.max(1, getTerrainAtPosition(battle, position)?.movementCost ?? 1);
      // A unit with MOV 1 may still spend its whole move to enter one difficult tile.
      const stepCost = Math.min(movementBudget, terrainCost);
      const nextCost = current.cost + stepCost;
      const key = positionKey(position);
      if (nextCost > maxCost || nextCost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, nextCost);
      previous.set(key, current.position);
      queue.push({ position, cost: nextCost });
    }
  }

  return { costs, previous };
}

function canEnter(
  battle: Battle,
  from: GridPosition,
  to: GridPosition,
  options: PathfindingOptions,
): boolean {
  if (!isOnBoard(battle, to) || !isTerrainEnterable(getTerrainAtPosition(battle, to))) {
    return false;
  }
  if (!options.allowOccupiedTarget && getUnitAtPosition(battle, to, options.unitId)) {
    return false;
  }
  if (from.x === to.x || from.y === to.y) return true;

  // Diagonal movement cannot squeeze between two walls. Units block their own
  // fields, but do not create an artificial solid wall across a diagonal.
  const horizontal = { x: to.x, y: from.y };
  const vertical = { x: from.x, y: to.y };
  return isPassableCorner(battle, horizontal) || isPassableCorner(battle, vertical);
}

function isPassableCorner(
  battle: Battle,
  position: GridPosition,
): boolean {
  return isOnBoard(battle, position) &&
    isTerrainEnterable(getTerrainAtPosition(battle, position));
}

function reconstructPath(
  previous: Map<string, GridPosition>,
  start: GridPosition,
  target: GridPosition,
): GridPosition[] {
  const path = [target];
  let current = target;
  while (!samePosition(current, start)) {
    const predecessor = previous.get(positionKey(current));
    if (!predecessor) return [];
    path.push(predecessor);
    current = predecessor;
  }
  return path.reverse();
}

function adjacentPositions(position: GridPosition): GridPosition[] {
  const positions: GridPosition[] = [];
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -1; x <= 1; x += 1) {
      if (x !== 0 || y !== 0) positions.push({ x: position.x + x, y: position.y + y });
    }
  }
  return positions;
}

function samePosition(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y;
}

function positionKey(position: GridPosition): string {
  return `${position.x},${position.y}`;
}

function parsePositionKey(key: string): GridPosition {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}
