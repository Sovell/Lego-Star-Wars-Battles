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
  const terrainBonus = getTerrainAtUnit(battle, defender)?.defenseBonus ?? 0;
  if (!defender.position) {
    return terrainBonus;
  }

  const fortificationBonus = (battle.board.objects ?? [])
    .filter(
      (object) =>
        object.status === "Active" &&
        object.position.x === defender.position?.x &&
        object.position.y === defender.position?.y,
    )
    .reduce((highestBonus, object) => Math.max(highestBonus, object.defenseBonus), 0);

  return terrainBonus + fortificationBonus;
}
