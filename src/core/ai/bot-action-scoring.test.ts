import { describe, expect, it } from "vitest";
import type { Battle, TerrainTile, UnitInstance } from "../../types";
import { createBattle } from "../battle-state";
import type { LegalPositionAction } from "../legal-actions";
import { getTemplate } from "../rules/state";
import { chooseBestBotAction } from "./bot-action-scoring";
import { aggressiveBotDoctrine, defensiveBotDoctrine } from "./bot-doctrine";

describe("bot action scoring", () => {
  it("uses the doctrine to trade movement progress for defensive terrain", () => {
    let battle = patchUnit(createBattle(), "rep_unit_1", { position: { x: 4, y: 0 } });
    battle = setTileDefense(battle, { x: 2, y: 0 }, 0);
    battle = setTileDefense(battle, { x: 3, y: 0 }, 2);
    const actions: LegalPositionAction[] = [
      { type: "AdvanceUnit", unitId: "rep_unit_1", targetPosition: { x: 2, y: 0 } },
      { type: "AdvanceUnit", unitId: "rep_unit_1", targetPosition: { x: 3, y: 0 } },
    ];
    const commonContext = { battle, movementTarget: { x: 0, y: 0 } };

    expect(chooseBestBotAction(actions, {
      ...commonContext,
      doctrine: aggressiveBotDoctrine,
    })?.action).toMatchObject({ targetPosition: { x: 2, y: 0 } });
    expect(chooseBestBotAction(actions, {
      ...commonContext,
      doctrine: defensiveBotDoctrine,
    })?.action).toMatchObject({ targetPosition: { x: 3, y: 0 } });
  });

  it("ranks a lethal attack above a non-lethal target", () => {
    let battle = createBattle();
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 2, y: 2 } });
    battle = patchUnit(battle, "sep_unit_1", { currentHp: 1, position: { x: 3, y: 2 } });
    battle = patchUnit(battle, "sep_unit_2", { currentHp: 8, position: { x: 2, y: 3 } });
    const attacker = battle.armies.flatMap((army) => army.units)
      .find((unit) => unit.id === "rep_unit_1")!;
    const weaponId = getTemplate(attacker).weapons[0].id;

    const best = chooseBestBotAction([
      { type: "Attack", attackerId: attacker.id, defenderId: "sep_unit_2", weaponId },
      { type: "Attack", attackerId: attacker.id, defenderId: "sep_unit_1", weaponId },
    ], { battle, doctrine: aggressiveBotDoctrine });

    expect(best?.action).toMatchObject({ type: "Attack", defenderId: "sep_unit_1" });
  });

  it("prefers Rally according to suppression pressure", () => {
    const battle = patchUnit(createBattle(), "rep_unit_1", { suppression: 2 });
    const best = chooseBestBotAction([
      { type: "ApplyOrder", unitId: "rep_unit_1", order: "Overwatch" },
      { type: "ApplyOrder", unitId: "rep_unit_1", order: "Rally" },
    ], { battle, doctrine: defensiveBotDoctrine });

    expect(best?.action).toMatchObject({ order: "Rally" });
  });
});

function patchUnit(
  battle: Battle,
  unitId: string,
  patch: Partial<UnitInstance>,
): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => unit.id === unitId ? { ...unit, ...patch } : unit),
    })),
  };
}

function setTileDefense(
  battle: Battle,
  position: { x: number; y: number },
  defenseBonus: number,
): Battle {
  const existing = battle.board.tiles.find(
    (tile) => tile.x === position.x && tile.y === position.y
  );
  const replacement: TerrainTile = {
    ...(existing ?? {
      ...position,
      terrainType: "Open",
      attackBonus: 0,
      movementCost: 1,
      blocksLineOfSight: false,
    }),
    defenseBonus,
  };
  return {
    ...battle,
    board: {
      ...battle.board,
      tiles: existing
        ? battle.board.tiles.map((tile) => tile === existing ? replacement : tile)
        : [...battle.board.tiles, replacement],
    },
  };
}
