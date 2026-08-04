import { describe, expect, it } from "vitest";
import { createBattle } from "../core/battle-state";
import { createBattlefieldVisualEvent } from "./battlefield-visual-events";

describe("battlefield visual events", () => {
  it("projects a combat result onto stable board coordinates", () => {
    const battle = createBattle();
    const attacker = battle.armies[0].units[0];
    const defender = battle.armies[1].units[0];
    attacker.position = { x: 1, y: 2 };
    defender.position = { x: 5, y: 4 };

    expect(createBattlefieldVisualEvent(7, battle, {
      attackResult: {
        attackerId: attacker.id,
        defenderId: defender.id,
        defenderPosition: defender.position,
        weaponName: "Blaster",
        hitRolls: [6],
        armorRolls: [],
        hits: 1,
        unsavedHits: 1,
        damage: 2,
        suppression: 1,
        destroyed: false,
      },
    })).toMatchObject({
      id: 7,
      source: { x: 1, y: 2 },
      target: { x: 5, y: 4 },
      damage: 2,
    });
  });

  it("does not emit an effect when the attacker is in reserve", () => {
    const battle = createBattle();
    const attacker = battle.armies[0].units[0];
    attacker.position = null;

    expect(createBattlefieldVisualEvent(1, battle, {
      objectAttackResult: {
        attackerId: attacker.id,
        objectId: "generator",
        objectType: "Generator",
        objectPosition: { x: 4, y: 4 },
        weaponName: "Blaster",
        hitRolls: [],
        armorRolls: [],
        hits: 0,
        unsavedHits: 0,
        damage: 0,
        destroyed: false,
      },
    })).toBeUndefined();
  });
});
