import { describe, expect, it } from "vitest";
import { createEmptyBoard, createNewGameBattle } from "./new-game-state";

describe("new game state", () => {
  it("starts without armies, terrain or battlefield objects", () => {
    const battle = createNewGameBattle();

    expect(battle.armies).toEqual([]);
    expect(battle.activationBag).toEqual([]);
    expect(battle.board).toEqual({
      width: 8,
      height: 8,
      tiles: [],
      objects: [],
    });
  });

  it("creates independent empty board collections", () => {
    const first = createEmptyBoard();
    const second = createEmptyBoard();

    expect(first.tiles).not.toBe(second.tiles);
    expect(first.objects).not.toBe(second.objects);
  });
});
