import { randomIndex, type RandomSource } from "../random";
import type { MapGenerationMotif } from "./map-generation-types";

export type MapClusterShape = "compact" | "linear" | "organic";

export type MapTopologyPlan = {
  motif: MapGenerationMotif;
  corridorCells: ReadonlySet<string>;
  clusterShape: MapClusterShape;
};

export function createMapTopologyPlan({
  motif,
  width,
  height,
  random,
}: {
  motif: MapGenerationMotif;
  width: number;
  height: number;
  random: RandomSource;
}): MapTopologyPlan {
  const corridorCells = new Set<string>();

  switch (motif) {
    case "open-outpost":
      addWideCross(corridorCells, width, height);
      addCentralClearing(corridorCells, width, height);
      return { motif, corridorCells, clusterShape: "compact" };
    case "forest-lanes":
      addWindingHorizontal(corridorCells, width, height, random);
      addWindingHorizontal(corridorCells, width, height, random);
      addWindingVertical(corridorCells, width, height, random);
      return { motif, corridorCells, clusterShape: "organic" };
    case "ice-fields":
      addWindingHorizontal(corridorCells, width, height, random);
      addWindingVertical(corridorCells, width, height, random);
      addCentralClearing(corridorCells, width, height);
      return { motif, corridorCells, clusterShape: "compact" };
    case "lava-channels":
      addWindingHorizontal(corridorCells, width, height, random);
      addWindingVertical(corridorCells, width, height, random);
      return { motif, corridorCells, clusterShape: "linear" };
    case "canyons":
      addWindingHorizontal(corridorCells, width, height, random);
      addWindingHorizontal(corridorCells, width, height, random);
      addWindingVertical(corridorCells, width, height, random);
      return { motif, corridorCells, clusterShape: "linear" };
    case "organic-islands":
      addWindingHorizontal(corridorCells, width, height, random);
      addWindingVertical(corridorCells, width, height, random);
      addDiagonalRoute(corridorCells, width, height, random);
      return { motif, corridorCells, clusterShape: "organic" };
    case "urban-grid":
      addUrbanStreets(corridorCells, width, height);
      return { motif, corridorCells, clusterShape: "compact" };
  }
}

function addWideCross(cells: Set<string>, width: number, height: number): void {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  for (let x = 0; x < width; x += 1) {
    add(cells, x, centerY, width, height);
    if (height >= 6) add(cells, x, centerY - 1, width, height);
  }
  for (let y = 0; y < height; y += 1) {
    add(cells, centerX, y, width, height);
    if (width >= 6) add(cells, centerX - 1, y, width, height);
  }
}

function addCentralClearing(cells: Set<string>, width: number, height: number): void {
  const minimumX = Math.floor(width / 3);
  const maximumX = Math.max(minimumX, Math.ceil(width * 2 / 3) - 1);
  const minimumY = Math.floor(height / 3);
  const maximumY = Math.max(minimumY, Math.ceil(height * 2 / 3) - 1);
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) add(cells, x, y, width, height);
  }
}

function addWindingHorizontal(
  cells: Set<string>,
  width: number,
  height: number,
  random: RandomSource,
): void {
  let y = randomIndex(height, random);
  for (let x = 0; x < width; x += 1) {
    add(cells, x, y, width, height);
    if (x < width - 1) {
      const nextY = clamp(y + corridorStep(random), 0, height - 1);
      add(cells, x, nextY, width, height);
      y = nextY;
    }
  }
}

function addWindingVertical(
  cells: Set<string>,
  width: number,
  height: number,
  random: RandomSource,
): void {
  let x = randomIndex(width, random);
  for (let y = 0; y < height; y += 1) {
    add(cells, x, y, width, height);
    if (y < height - 1) {
      const nextX = clamp(x + corridorStep(random), 0, width - 1);
      add(cells, nextX, y, width, height);
      x = nextX;
    }
  }
}

function addDiagonalRoute(
  cells: Set<string>,
  width: number,
  height: number,
  random: RandomSource,
): void {
  if (width === 1 || height === 1) return;
  const reverse = random() >= 0.5;
  let previousY = reverse ? height - 1 : 0;
  for (let x = 0; x < width; x += 1) {
    const progress = x / (width - 1);
    const target = Math.round(progress * (height - 1));
    const y = reverse ? height - 1 - target : target;
    add(cells, x, y, width, height);
    const start = Math.min(previousY, y);
    const end = Math.max(previousY, y);
    for (let bridgeY = start; bridgeY <= end; bridgeY += 1) {
      add(cells, x, bridgeY, width, height);
    }
    previousY = y;
  }
}

function addUrbanStreets(cells: Set<string>, width: number, height: number): void {
  const streetXs = urbanStreetCoordinates(width);
  const streetYs = urbanStreetCoordinates(height);
  for (const x of streetXs) {
    for (let y = 0; y < height; y += 1) add(cells, x, y, width, height);
  }
  for (const y of streetYs) {
    for (let x = 0; x < width; x += 1) add(cells, x, y, width, height);
  }
}

function urbanStreetCoordinates(size: number): number[] {
  if (size <= 2) return [0];
  const coordinates: number[] = [];
  for (let coordinate = 1; coordinate < size; coordinate += 3) {
    coordinates.push(coordinate);
  }
  return coordinates.length > 0 ? coordinates : [Math.floor(size / 2)];
}

function corridorStep(random: RandomSource): -1 | 0 | 1 {
  const roll = random();
  if (roll < 0.25) return -1;
  if (roll >= 0.75) return 1;
  return 0;
}

function add(
  cells: Set<string>,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (x >= 0 && y >= 0 && x < width && y < height) cells.add(`${x},${y}`);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
