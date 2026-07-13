import type { Battle, TerrainTile, UnitInstance } from "../../types";
import type { GridPosition } from "./geometry";

export function getTerrainAtPosition(
  battle: Battle,
  position: GridPosition,
): TerrainTile | undefined {
  return battle.board.tiles.find((tile) => tile.x === position.x && tile.y === position.y);
}

export function getTerrainAtUnit(battle: Battle, unit: UnitInstance): TerrainTile | undefined {
  const position = unit.position;
  if (!position) {
    return undefined;
  }

  return getTerrainAtPosition(battle, position);
}

export function getDefenseBonus(battle: Battle, defender: UnitInstance): number {
  return getTerrainAtUnit(battle, defender)?.defenseBonus ?? 0;
}
