import { describe, expect, it } from "vitest";
import { abilities, board, unitTemplates } from "./data";

describe("operational board scale", () => {
  it("uses an 8 by 8 battlefield", () => {
    expect(board.width).toBe(8);
    expect(board.height).toBe(8);
  });

  it("keeps every unit movement between one and two fields", () => {
    for (const template of unitTemplates) {
      expect(template.movement, template.name).toBeGreaterThanOrEqual(1);
      expect(template.movement, template.name).toBeLessThanOrEqual(2);
    }
  });

  it("keeps weapon ranges local to the operational front", () => {
    for (const template of unitTemplates) {
      for (const weapon of template.weapons) {
        expect(weapon.range, `${template.name}: ${weapon.name}`).toBeGreaterThanOrEqual(1);
        expect(weapon.range, `${template.name}: ${weapon.name}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("keeps special ability ranges at two fields or less", () => {
    for (const ability of abilities) {
      if (ability.range !== undefined) {
        expect(ability.range, ability.name).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("Ahsoka Tano", () => {
  it("uses the mobile duelist ability set", () => {
    const ahsoka = unitTemplates.find((template) => template.id === "ahsoka_tano");

    expect(ahsoka).toMatchObject({
      movement: 2,
      cost: 34,
      abilities: ["ataru_momentum", "jar_kai_mastery", "force_prediction"],
    });
  });
});
