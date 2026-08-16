import { describe, expect, it } from "vitest";
import { createBattlefieldObject } from "../battlefield-objects";
import { createBattle } from "../battle-state";
import { createTerrainTile } from "../terrain-definitions";
import { resolveBattlefieldProduction } from "./battlefield-production";

function battleWithFoundry() {
  const battle = createBattle();
  battle.board = structuredClone(battle.board);
  battle.armies.forEach((army) => army.units.forEach((unit) => {
    unit.position = null;
  }));
  battle.board.objects = [{
    ...createBattlefieldObject("HeavyFortification", { x: 3, y: 3 }, "foundry"),
    name: "Droid Foundry",
    controllerArmyId: "army_separatists",
    production: {
      templateId: "b1_droid_squad",
      intervalRounds: 2,
      nextProductionTurn: 3,
      remainingSpawns: 3,
    },
  }];
  return battle;
}

describe("battlefield production", () => {
  it("spawns a ready B1 squad on schedule and advances the production cycle", () => {
    const waiting = resolveBattlefieldProduction(battleWithFoundry(), 2);
    expect(waiting.spawnedUnitIds).toEqual([]);

    const result = resolveBattlefieldProduction(waiting.battle, 3);
    const summoned = result.battle.armies[1].units.find((unit) =>
      result.spawnedUnitIds.includes(unit.id)
    );
    expect(summoned).toMatchObject({
      templateId: "b1_droid_squad",
      armyId: "army_separatists",
      status: "Ready",
    });
    expect(result.battle.board.objects?.[0].production).toMatchObject({
      nextProductionTurn: 5,
      remainingSpawns: 2,
    });
  });

  it("retries later without spending production when every exit is blocked", () => {
    const battle = battleWithFoundry();
    battle.board.tiles = [];
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 4; x += 1) {
        if (x !== 3 || y !== 3) {
          battle.board.tiles.push(createTerrainTile("Impassable", x, y));
        }
      }
    }

    const blocked = resolveBattlefieldProduction(battle, 3);
    expect(blocked.spawnedUnitIds).toEqual([]);
    expect(blocked.battle.board.objects?.[0].production).toMatchObject({
      nextProductionTurn: 3,
      remainingSpawns: 3,
    });

    blocked.battle.board.tiles = blocked.battle.board.tiles.map((tile) =>
      tile.x === 2 && tile.y === 2 ? createTerrainTile("Open", 2, 2) : tile
    );
    const retried = resolveBattlefieldProduction(blocked.battle, 4);
    expect(retried.spawnedUnitIds).toHaveLength(1);
    expect(retried.battle.board.objects?.[0].production?.remainingSpawns).toBe(2);
  });

  it("does not produce after the foundry is destroyed", () => {
    const battle = battleWithFoundry();
    battle.board.objects![0] = {
      ...battle.board.objects![0],
      currentHp: 0,
      status: "Destroyed",
    };

    expect(resolveBattlefieldProduction(battle, 3).spawnedUnitIds).toEqual([]);
  });
});
