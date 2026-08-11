import { describe, expect, it } from "vitest";
import { createBattle, getTemplate } from "../battle-state";
import { createTerrainTile } from "../terrain-definitions";
import { resolveAttack } from "./combat";
import { moveUnit } from "./movement";
import { lineOfSight } from "./geometry";

function readyBattle() {
  const battle = createBattle();
  battle.board = { width: 4, height: 4, tiles: [], objects: [] };
  const attacker = battle.armies[0].units[1];
  const defender = battle.armies[1].units[0];
  attacker.position = { x: 1, y: 1 };
  attacker.status = "Ready";
  attacker.movedThisTurn = false;
  attacker.suppression = 0;
  defender.position = { x: 2, y: 1 };
  defender.status = "Ready";
  battle.activeActivation = {
    id: "terrain-test",
    armyId: attacker.armyId,
    faction: battle.armies[0].faction,
    used: false,
  };
  return { battle, attacker, defender };
}

describe("advanced terrain rules", () => {
  it("rejects movement onto impassable terrain", () => {
    const { battle, attacker } = readyBattle();
    battle.board.tiles = [createTerrainTile("Impassable", 2, 2)];

    const result = moveUnit(battle, attacker.id, { x: 2, y: 2 });

    expect(result.battle).toBe(battle);
    expect(result.log).toContain("nie moze dotrzec");
  });

  it("treats impassable terrain as a line-of-sight blocker", () => {
    const { battle } = readyBattle();
    battle.board.tiles = [createTerrainTile("Impassable", 1, 0)];

    expect(lineOfSight(battle, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });

  it("adds suppression after entering hazardous terrain", () => {
    const { battle, attacker } = readyBattle();
    battle.board.tiles = [createTerrainTile("Hazardous", 2, 2)];

    const result = moveUnit(battle, attacker.id, { x: 2, y: 2 });
    const movedUnit = result.battle.armies[0].units.find(({ id }) => id === attacker.id);

    expect(movedUnit?.suppression).toBe(1);
    expect(result.log).toContain("suppression +1");
  });

  it("applies the high-ground attack bonus to the hit threshold", () => {
    const elevated = readyBattle();
    elevated.battle.board.tiles = [createTerrainTile("HighGround", 1, 1)];
    const weaponId = getTemplate(elevated.attacker).weapons[0].id;

    const elevatedResult = resolveAttack(
      elevated.battle,
      elevated.attacker.id,
      elevated.defender.id,
      weaponId,
      () => 3,
    );
    const level = readyBattle();
    const levelResult = resolveAttack(
      level.battle,
      level.attacker.id,
      level.defender.id,
      weaponId,
      () => 3,
    );

    expect(elevatedResult.result?.hits).toBeGreaterThan(0);
    expect(levelResult.result?.hits).toBe(0);
  });
});
