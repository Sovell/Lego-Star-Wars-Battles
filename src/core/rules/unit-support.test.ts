import { describe, expect, it } from "vitest";
import { createBattle } from "../battle-state";
import { createSequenceDiceRoller } from "../random";
import { resolveAttack } from "./combat";
import { linkUnitSupport } from "./unit-support";

describe("two-unit support links", () => {
  it("adds one attack die while keeping provider and receiver as separate targets", () => {
    const battle = createBattle();
    const provider = battle.armies[0].units[1];
    const receiver = battle.armies[0].units[0];
    provider.templateId = "clone_commando_section";
    provider.position = { x: 1, y: 1 };
    receiver.templateId = "clone_trooper_squad";
    receiver.position = { x: 1, y: 2 };
    battle.armies[1].units[0].position = { x: 2, y: 2 };

    const linked = linkUnitSupport(battle, provider.id, receiver.id, "attack");
    expect(linked.error).toBeUndefined();
    expect(linked.battle.armies[0].units.filter((unit) => unit.supportLink)).toHaveLength(2);
    expect(provider.id).not.toBe(receiver.id);

    linked.battle.activeActivation = {
      id: "rep-token", armyId: receiver.armyId, faction: "Republic", used: true,
    };
    const attack = resolveAttack(
      linked.battle,
      receiver.id,
      battle.armies[1].units[0].id,
      "clone_squad_blaster_rifles",
      createSequenceDiceRoller([1, 1, 1, 1, 1]),
    );
    expect(attack.result?.hitRolls).toHaveLength(5);
    expect(attack.result?.attackerId).toBe(receiver.id);
  });

  it("rejects a third unit joining an existing pair", () => {
    const battle = createBattle();
    battle.armies[0].units[0].position = { x: 1, y: 1 };
    battle.armies[0].units[1].position = { x: 1, y: 2 };
    battle.armies[0].units[2].position = { x: 2, y: 1 };
    const pair = linkUnitSupport(
      battle,
      battle.armies[0].units[0].id,
      battle.armies[0].units[1].id,
      "defense",
    );
    const third = linkUnitSupport(
      pair.battle,
      battle.armies[0].units[2].id,
      battle.armies[0].units[1].id,
      "attack",
    );
    expect(third.battle).toBe(pair.battle);
    expect(third.error).toContain("dwuosobowej pary");
  });
});
