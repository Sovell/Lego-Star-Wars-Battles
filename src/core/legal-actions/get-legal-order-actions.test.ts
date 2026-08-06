import { describe, expect, it } from "vitest";
import { createBattle } from "../battle-state";
import { getLegalOrderActions } from "./get-legal-order-actions";

function createReadyBattle() {
  const battle = createBattle();
  const source = battle.armies[0].units[0];
  source.status = "Ready";
  battle.activeActivation = {
    id: "legal-order-test-activation",
    armyId: source.armyId,
    faction: battle.armies[0].faction,
    used: false,
  };
  return battle;
}

describe("getLegalOrderActions", () => {
  it("offers Overwatch to a ready unit", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];

    expect(getLegalOrderActions(battle, source.id)).toEqual([{
      type: "ApplyOrder",
      unitId: source.id,
      order: "Overwatch",
    }]);
  });

  it("adds Rally only when the unit has suppression", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];
    source.suppression = 2;

    expect(getLegalOrderActions(battle, source.id)).toEqual([
      { type: "ApplyOrder", unitId: source.id, order: "Rally" },
      { type: "ApplyOrder", unitId: source.id, order: "Overwatch" },
    ]);
  });

  it("offers only Rally to a pinned unit", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];
    source.status = "Pinned";
    source.suppression = 3;

    expect(getLegalOrderActions(battle, source.id)).toEqual([{
      type: "ApplyOrder",
      unitId: source.id,
      order: "Rally",
    }]);
  });

  it("allows only finishing an Advance while it is pending", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];
    source.suppression = 2;
    source.activeEffects = ["advance_pending"];

    expect(getLegalOrderActions(battle, source.id)).toEqual([{
      type: "ApplyOrder",
      unitId: source.id,
      order: "Advance",
    }]);
  });

  it("keeps Overwatch available to a reserve unit", () => {
    const battle = createReadyBattle();
    const source = battle.armies[0].units[0];
    source.position = null;

    expect(getLegalOrderActions(battle, source.id)).toContainEqual({
      type: "ApplyOrder",
      unitId: source.id,
      order: "Overwatch",
    });
  });

  it("returns no orders when the active token blocks the unit", () => {
    const battle = createReadyBattle();
    const blockedUnit = battle.armies[1].units[0];

    expect(getLegalOrderActions(battle, blockedUnit.id)).toEqual([]);
  });
});
