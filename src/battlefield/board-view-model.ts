import { getTemplate } from "../core/battle-state";
import type { MissionState } from "../core/scenario/scenario-types";
import { getUnitInitials, getUnitTokenImageUrl } from "../presentation/unit-presentation";
import type {
  Battle,
  BattlefieldObject,
  FactionId,
  TerrainTile,
  UnitInstance,
  UnitTemplate,
} from "../types";

export type BoardPosition = {
  x: number;
  y: number;
};

export type BoardTokenViewModel = {
  unit: UnitInstance;
  template: UnitTemplate;
  unitId: string;
  armyId: string;
  faction?: FactionId;
  name: string;
  initials: string;
  imageUrl?: string;
};

export type TerritoryViewModel = {
  armyId: string;
  faction?: FactionId;
};

export type BoardViewModel = {
  width: number;
  height: number;
  positions: BoardPosition[];
  tilesByPosition: ReadonlyMap<string, TerrainTile>;
  objectsByPosition: ReadonlyMap<string, BattlefieldObject>;
  unitsByPosition: ReadonlyMap<string, BoardTokenViewModel[]>;
  territoryByPosition: ReadonlyMap<string, TerritoryViewModel>;
};

export function boardPositionKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function createBoardViewModel(
  battle: Battle,
  mission: MissionState,
): BoardViewModel {
  const tilesByPosition = new Map(
    battle.board.tiles.map((tile) => [boardPositionKey(tile.x, tile.y), tile]),
  );
  const objectsByPosition = new Map(
    (battle.board.objects ?? []).map((object) => [
      boardPositionKey(object.position.x, object.position.y),
      object,
    ]),
  );
  const armiesById = new Map(battle.armies.map((army) => [army.id, army]));
  const unitsByPosition = new Map<string, BoardTokenViewModel[]>();

  for (const army of battle.armies) {
    for (const unit of army.units) {
      if (!unit.position) {
        continue;
      }
      const template = getTemplate(unit);
      const key = boardPositionKey(unit.position.x, unit.position.y);
      const token: BoardTokenViewModel = {
        unit,
        template,
        unitId: unit.id,
        armyId: army.id,
        faction: army.faction,
        name: template.name,
        initials: getUnitInitials(template),
        imageUrl: getUnitTokenImageUrl(template),
      };
      unitsByPosition.set(key, [...(unitsByPosition.get(key) ?? []), token]);
    }
  }

  const territoryByPosition = new Map<string, TerritoryViewModel>();
  for (const [key, armyId] of Object.entries(mission.territoryOwners ?? {})) {
    territoryByPosition.set(key, {
      armyId,
      faction: armiesById.get(armyId)?.faction,
    });
  }

  return {
    width: battle.board.width,
    height: battle.board.height,
    positions: Array.from(
      { length: battle.board.width * battle.board.height },
      (_, index) => ({
        x: index % battle.board.width,
        y: Math.floor(index / battle.board.width),
      }),
    ),
    tilesByPosition,
    objectsByPosition,
    unitsByPosition,
    territoryByPosition,
  };
}
