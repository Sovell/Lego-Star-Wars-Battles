import type { Battle } from "../../types";

export type GridPosition = {
  x: number;
  y: number;
};

export function distance(from: GridPosition, to: GridPosition): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}

export function isOnBoard(battle: Battle, position: GridPosition): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < battle.board.width &&
    position.y < battle.board.height
  );
}

export function lineOfSight(battle: Battle, from: GridPosition, to: GridPosition): boolean {
  const steps = distance(from, to);
  if (steps <= 1) {
    return true;
  }

  for (let step = 1; step < steps; step += 1) {
    const x = Math.round(from.x + ((to.x - from.x) * step) / steps);
    const y = Math.round(from.y + ((to.y - from.y) * step) / steps);
    const tile = battle.board.tiles.find((terrain) => terrain.x === x && terrain.y === y);
    const blockingObject = (battle.board.objects ?? []).find(
      (object) =>
        object.status === "Active" &&
        object.blocksLineOfSight &&
        object.position.x === x &&
        object.position.y === y,
    );

    if (tile?.blocksLineOfSight || blockingObject) {
      return false;
    }
  }

  return true;
}
