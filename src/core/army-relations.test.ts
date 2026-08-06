import { describe, expect, it } from "vitest";
import type { Army } from "../types";
import {
  areArmiesAllied,
  areArmiesEnemies,
  getArmyControl,
  withDefaultArmyConfiguration,
} from "./army-relations";

describe("army relations", () => {
  it("treats configured armies on the same team as allies", () => {
    const battle = { armies: [army("a", 1), army("b", 1), army("c", 2)] };

    expect(areArmiesAllied(battle, "a", "b")).toBe(true);
    expect(areArmiesEnemies(battle, "a", "c")).toBe(true);
  });

  it("keeps different armies from legacy saves hostile", () => {
    const battle = { armies: [army("a"), army("b")] };

    expect(areArmiesAllied(battle, "a", "b")).toBe(false);
    expect(areArmiesAllied(battle, "a", "a")).toBe(true);
  });

  it("defaults legacy armies to human control", () => {
    expect(getArmyControl(army("a"))).toBe("Human");
    expect(getArmyControl({ ...army("bot"), control: "Bot" })).toBe("Bot");
  });

  it("migrates legacy scenario sides to a human defender and bot attackers", () => {
    const configured = withDefaultArmyConfiguration(
      [army("a"), army("b"), army("c")],
      "b",
    );

    expect(configured.map(({ id, teamId, control }) => ({ id, teamId, control }))).toEqual([
      { id: "a", teamId: 2, control: "Bot" },
      { id: "b", teamId: 1, control: "Human" },
      { id: "c", teamId: 2, control: "Bot" },
    ]);
  });
});

function army(id: string, teamId?: 1 | 2): Army {
  return {
    id,
    playerName: id,
    faction: id,
    ...(teamId ? { teamId } : {}),
    units: [],
  };
}
