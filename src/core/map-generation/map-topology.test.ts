import { describe, expect, it } from "vitest";
import { createSeededRandomSource } from "../random";
import type { MapGenerationMotif } from "./map-generation-types";
import { createMapTopologyPlan } from "./map-topology";

const motifs: MapGenerationMotif[] = [
  "open-outpost",
  "forest-lanes",
  "ice-fields",
  "lava-channels",
  "canyons",
  "organic-islands",
  "urban-grid",
];

describe("planetary map topology", () => {
  it("is deterministic and gives every motif a distinct route signature", () => {
    const signatures = motifs.map((motif) => {
      const first = createMapTopologyPlan({
        motif,
        width: 12,
        height: 12,
        random: createSeededRandomSource(1138),
      });
      const second = createMapTopologyPlan({
        motif,
        width: 12,
        height: 12,
        random: createSeededRandomSource(1138),
      });

      expect([...first.corridorCells]).toEqual([...second.corridorCells]);
      return `${first.clusterShape}:${[...first.corridorCells].sort().join("|")}`;
    });

    expect(new Set(signatures).size).toBe(motifs.length);
  });

  it.each(motifs)("keeps both board axes connected for %s", (motif) => {
    for (let seed = 0; seed < 25; seed += 1) {
      const plan = createMapTopologyPlan({
        motif,
        width: 8,
        height: 8,
        random: createSeededRandomSource(seed),
      });

      expect(hasOppositeEdgeRoute(plan.corridorCells, 8, 8, "horizontal"), `seed ${seed}`)
        .toBe(true);
      expect(hasOppositeEdgeRoute(plan.corridorCells, 8, 8, "vertical"), `seed ${seed}`)
        .toBe(true);
    }
  });
});

function hasOppositeEdgeRoute(
  cells: ReadonlySet<string>,
  width: number,
  height: number,
  axis: "horizontal" | "vertical",
): boolean {
  const starts: Position[] = [];
  if (axis === "horizontal") {
    for (let y = 0; y < height; y += 1) if (cells.has(`0,${y}`)) starts.push({ x: 0, y });
  } else {
    for (let x = 0; x < width; x += 1) if (cells.has(`${x},0`)) starts.push({ x, y: 0 });
  }
  const queue = [...starts];
  const visited = new Set(queue.map(({ x, y }) => `${x},${y}`));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (axis === "horizontal" ? current.x === width - 1 : current.y === height - 1) return true;
    for (const next of neighbors(current, width, height)) {
      const key = `${next.x},${next.y}`;
      if (cells.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return false;
}

function neighbors(position: Position, width: number, height: number): Position[] {
  return [
    { x: position.x - 1, y: position.y },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y - 1 },
    { x: position.x, y: position.y + 1 },
  ].filter(({ x, y }) => x >= 0 && y >= 0 && x < width && y < height);
}

type Position = { x: number; y: number };
