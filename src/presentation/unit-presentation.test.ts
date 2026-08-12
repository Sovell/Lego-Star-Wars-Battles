import { describe, expect, it } from "vitest";
import type { Army, UnitInstance, UnitTemplate } from "../types";
import {
  getUnitArmyLabel,
  getUnitTokenFallbackImageUrl,
  getUnitTokenImageUrl,
} from "./unit-presentation";

describe("unit token presentation", () => {
  it("uses an optimized token portrait with the original photo as fallback", () => {
    const template = unitTemplate("/unit-images/photos/clone-trooper.jpg");

    expect(getUnitTokenImageUrl(template))
      .toBe("/unit-images/tokens/clone-trooper.jpg");
    expect(getUnitTokenFallbackImageUrl(template))
      .toBe("/unit-images/photos/clone-trooper.jpg");
  });

  it("uses a non-photo unit image directly", () => {
    const template = unitTemplate("/unit-images/jedi-task-force-scifi.png");

    expect(getUnitTokenImageUrl(template))
      .toBe("/unit-images/jedi-task-force-scifi.png");
    expect(getUnitTokenFallbackImageUrl(template)).toBeUndefined();
  });

  it("keeps the text-only fallback for templates without artwork", () => {
    const template = unitTemplate(undefined);

    expect(getUnitTokenImageUrl(template)).toBeUndefined();
    expect(getUnitTokenFallbackImageUrl(template)).toBeUndefined();
  });

  it("identifies both the army and team in unit selection lists", () => {
    const unit = unitInstance("army-republic-2");
    const army: Army = {
      id: "army-republic-2",
      playerName: "Gracz 3",
      faction: "Republic",
      teamId: 1,
      control: "Human",
      units: [unit],
    };

    expect(getUnitArmyLabel(unit, [army])).toBe("Gracz 3 · Drużyna 1");
    expect(getUnitArmyLabel(unit, [army], "en")).toBe("Gracz 3 · Team 1");
  });

  it("handles a unit whose army is missing from legacy data", () => {
    expect(getUnitArmyLabel(unitInstance("missing-army"), [])).toBe("Nieznana armia");
  });
});

function unitTemplate(imageUrl: string | undefined): UnitTemplate {
  return {
    id: "test-unit",
    name: "Test Unit",
    faction: "Republic",
    category: "infantry",
    role: "Line",
    imageUrl,
    keywords: [],
    weapons: [],
    maxHp: 1,
    armorSave: 6,
    movement: 1,
    morale: 1,
    command: 1,
    abilities: [],
    cost: 1,
  };
}

function unitInstance(armyId: string): UnitInstance {
  return {
    id: "test-instance",
    templateId: "test-unit",
    armyId,
    currentHp: 1,
    suppression: 0,
    position: null,
    status: "Ready",
    hidden: false,
  };
}
