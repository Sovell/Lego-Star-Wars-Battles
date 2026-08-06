import type { Board, TerrainTile } from "../../types";

export type MapConnectivity = {
  horizontal: boolean;
  vertical: boolean;
  valid: boolean;
};

export function validateMapConnectivity(board: Board): MapConnectivity {
  const horizontal = hasCorridor(board, "horizontal");
  const vertical = hasCorridor(board, "vertical");
  return { horizontal, vertical, valid: horizontal && vertical };
}

function hasCorridor(board: Board, axis: "horizontal" | "vertical"): boolean {
  const terrainByPosition = new Map(
    board.tiles.map((tile) => [positionKey(tile.x, tile.y), tile]),
  );
  const starts = axis === "horizontal"
    ? Array.from({ length: board.height }, (_, y) => ({ x: 0, y }))
    : Array.from({ length: board.width }, (_, x) => ({ x, y: 0 }));
  const queue = starts.filter((position) => isCorridorPosition(position, terrainByPosition));
  const visited = new Set(queue.map(({ x, y }) => positionKey(x, y)));

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (
      (axis === "horizontal" && current.x === board.width - 1) ||
      (axis === "vertical" && current.y === board.height - 1)
    ) {
      return true;
    }
    for (const neighbor of neighbors(current, board.width, board.height)) {
      const key = positionKey(neighbor.x, neighbor.y);
      if (visited.has(key) || !isCorridorPosition(neighbor, terrainByPosition)) continue;
      visited.add(key);
      queue.push(neighbor);
    }
  }
  return false;
}

function isCorridorPosition(
  position: Position,
  terrainByPosition: ReadonlyMap<string, TerrainTile>,
): boolean {
  const terrain = terrainByPosition.get(positionKey(position.x, position.y));
  return !terrain || (terrain.movementCost <= 1 && !terrain.blocksLineOfSight);
}

function neighbors(position: Position, width: number, height: number): Position[] {
  return [
    { x: position.x - 1, y: position.y },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y - 1 },
    { x: position.x, y: position.y + 1 },
  ].filter(({ x, y }) => x >= 0 && y >= 0 && x < width && y < height);
}

function positionKey(x: number, y: number): string {
  return `${x},${y}`;
}

type Position = { x: number; y: number };
