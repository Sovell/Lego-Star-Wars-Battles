import { describe, expect, it } from "vitest";
import { unitTemplates } from "../data";
import type { Army, UnitInstance } from "../types";
import {
  filterDuplicateHeroReinforcements,
  getDuplicateHeroTemplateIds,
  hasUniqueHeroes,
  isHeroTemplate,
} from "./army-roster";

describe("army roster hero uniqueness", () => {
  it("recognizes heroes stored as commanders", () => {
    const captainRex = unitTemplates.find((template) => template.id === "captain_rex")!;

    expect(captainRex.category).toBe("commander");
    expect(isHeroTemplate(captainRex)).toBe(true);
  });

  it("detects the same hero across allied armies", () => {
    const armies = [
      army("first", [unit("first-rex", "captain_rex", "first")]),
      army("second", [unit("second-rex", "captain_rex", "second")]),
    ];

    expect(getDuplicateHeroTemplateIds(armies)).toEqual(["captain_rex"]);
    expect(hasUniqueHeroes(armies)).toBe(false);
  });

  it("allows different heroes and repeated regular units", () => {
    const armies = [army("first", [
      unit("rex", "captain_rex", "first"),
      unit("clone-1", "clone_trooper_squad", "first"),
      unit("clone-2", "clone_trooper_squad", "first"),
    ]), army("second", [unit("dooku", "count_dooku", "second")])];

    expect(hasUniqueHeroes(armies)).toBe(true);
  });

  it("skips a duplicate hero in reinforcements without removing regular units", () => {
    const armies = [army("first", [unit("rex", "captain_rex", "first")])];
    const requested = [
      unitTemplates.find((template) => template.id === "captain_rex")!,
      unitTemplates.find((template) => template.id === "clone_trooper_squad")!,
      unitTemplates.find((template) => template.id === "captain_rex")!,
    ];

    expect(filterDuplicateHeroReinforcements(armies, requested).map(({ id }) => id))
      .toEqual(["clone_trooper_squad"]);
  });
});

function army(id: string, units: UnitInstance[]): Army {
  return {
    id,
    playerName: id,
    faction: id === "second" ? "Separatists" : "Republic",
    units,
  };
}

function unit(id: string, templateId: string, armyId: string): UnitInstance {
  return {
    id,
    templateId,
    armyId,
    currentHp: 1,
    suppression: 0,
    position: null,
    status: "Ready",
    hidden: false,
  };
}
