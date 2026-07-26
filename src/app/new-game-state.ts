import { createBattle } from "../core/battle-state";
import type { Battle, Board } from "../types";

export function createEmptyBoard(width = 8, height = 8): Board {
  return {
    width,
    height,
    tiles: [],
    objects: [],
  };
}

export function createNewGameBattle(): Battle {
  return {
    ...createBattle([]),
    board: createEmptyBoard(),
  };
}
