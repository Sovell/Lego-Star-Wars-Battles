import { describe, expect, it } from "vitest";
import type { UnitTemplate } from "../types";
import {
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
