import { describe, expect, it } from "vitest";
import { starterArmies } from "../../data";
import type { Army, UnitInstance } from "../../types";
import { applyBattleAction } from "../battle-actions";
import { createBattle } from "../battle-state";
import {
  buildActivationBag,
  canEndTurn,
  getArmyActivationCounts,
  getRemainingActivationCount,
  getTurnActivationCount,
  MAX_ACTIVATIONS_PER_ARMY,
} from "./activation";

describe("per-army activation limit", () => {
  it("grants at most eight orders to each army", () => {
    const armies = [createArmy("alpha", 12), createArmy("beta", 9), createArmy("gamma", 3)];
    const bag = buildActivationBag(armies);

    expect(bag.filter(({ armyId }) => armyId === "alpha")).toHaveLength(8);
    expect(bag.filter(({ armyId }) => armyId === "beta")).toHaveLength(8);
    expect(bag.filter(({ armyId }) => armyId === "gamma")).toHaveLength(3);
    expect(bag).toHaveLength(19);
  });

  it("ends the turn after eight orders while excess units stay ready in reserve", () => {
    const army = createArmy("alpha", 10);
    const battle = createBattle([army]);
    battle.armies[0].units = battle.armies[0].units.map((unit, index) => ({
      ...unit,
      status: index < MAX_ACTIVATIONS_PER_ARMY ? "Activated" : "Ready",
      position: index < MAX_ACTIVATIONS_PER_ARMY ? { x: index, y: 0 } : null,
    }));
    battle.activationBag = battle.activationBag.map((token) => ({ ...token, used: true }));

    expect(getRemainingActivationCount(battle)).toBe(0);
    expect(canEndTurn(battle)).toBe(true);

    const nextTurn = applyBattleAction(battle, { type: "EndTurn" }).battle;
    expect(nextTurn.turn).toBe(2);
    expect(nextTurn.activationBag).toHaveLength(8);
    expect(nextTurn.armies[0].units.slice(8)).toMatchObject([
      { status: "Ready", position: null },
      { status: "Ready", position: null },
    ]);
  });

  it("reports the capped total and counts a drawn order until it is resolved", () => {
    const battle = createBattle([createArmy("alpha", 10)]);
    const drawn = applyBattleAction(battle, { type: "DrawActivation" }, {
      randomSource: () => 0,
    }).battle;

    expect(getTurnActivationCount(drawn)).toBe(8);
    expect(getRemainingActivationCount(drawn)).toBe(8);
    expect(getArmyActivationCounts(drawn, "alpha")).toEqual({ remaining: 8, total: 8 });
  });
});

function createArmy(id: string, unitCount: number): Army {
  const templateUnit = starterArmies[0].units[0];
  return {
    ...structuredClone(starterArmies[0]),
    id,
    playerName: id,
    units: Array.from({ length: unitCount }, (_, index): UnitInstance => ({
      ...structuredClone(templateUnit),
      id: `${id}-unit-${index + 1}`,
      armyId: id,
      position: null,
      status: "Ready",
    })),
  };
}
