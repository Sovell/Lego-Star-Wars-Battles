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

  it("uses range one for standard infantry blasters", () => {
    const standardWeaponIds = [
      "dc_15_blaster_rifles",
      "e_5_blaster_rifles",
      "clone_squad_blaster_rifles",
      "command_squad_blaster_rifles",
      "engineer_blaster_rifles",
      "b1_squad_e_5_blaster_rifles",
      "arc_blaster_carbine",
      "rex_dual_dc_17",
      "bx_blaster_rifle",
    ];
    const weapons = unitTemplates.flatMap((template) => template.weapons);

    for (const weaponId of standardWeaponIds) {
      expect(weapons.find((weapon) => weapon.id === weaponId)?.range, weaponId).toBe(1);
    }
  });

  it("reserves longer ranges for heavy and specialist weapons", () => {
    const weapons = unitTemplates.flatMap((template) => template.weapons);

    expect(weapons.find((weapon) => weapon.id === "aat_heavy_cannon")?.range).toBe(2);
    expect(weapons.find((weapon) => weapon.id === "cody_dc_15a_rifle")?.range).toBe(2);
    expect(weapons.find((weapon) => weapon.id === "laat_laser_cannons")?.range).toBe(3);
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
