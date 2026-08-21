import { describe, expect, it } from "vitest";
import { abilities, board, unitTemplates } from "./data";
import { getTemplate } from "./core/rules/state";
import type { UnitInstance } from "./types";

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

  it("keeps special ability ranges within the four-field command horizon", () => {
    for (const ability of abilities) {
      if (ability.range !== undefined) {
        expect(ability.range, ability.name).toBeLessThanOrEqual(4);
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
      abilities: ["ataru_momentum", "jar_kai_mastery", "force_prediction", "acrobatic_flank"],
    });
  });
});

describe("dedicated character artwork", () => {
  it("uses the transparent Anakin battlefield sprite", () => {
    const anakin = unitTemplates.find((template) => template.id === "anakin_skywalker");

    expect(anakin?.battlefieldSpriteUrl)
      .toBe("/unit-images/sprites/anakin-skywalker.png");
  });

  it("uses separate battlefield and card artwork for Darth Maul", () => {
    const maul = unitTemplates.find((template) => template.id === "darth_maul");

    expect(maul).toMatchObject({
      imageUrl: "/unit-images/photos/darth-maul.jpg",
      portraitImageUrl: "/unit-images/portraits/darth-maul.png",
      battlefieldSpriteUrl: "/unit-images/sprites/darth-maul.png",
    });
  });

  it("uses separate battlefield and card artwork for Yoda", () => {
    const yoda = unitTemplates.find((template) => template.id === "yoda");

    expect(yoda).toMatchObject({
      imageUrl: "/unit-images/photos/yoda.jpg",
      portraitImageUrl: "/unit-images/portraits/yoda.png",
      battlefieldSpriteUrl: "/unit-images/sprites/yoda.png",
    });
  });

  it("uses the dedicated ARC Trooper battlefield sprite", () => {
    const arcTrooper = unitTemplates.find((template) => template.id === "arc_trooper");

    expect(arcTrooper?.battlefieldSpriteUrl)
      .toBe("/unit-images/sprites/arc-trooper.png");
  });
});

describe("Clone Wars roster expansion", () => {
  it("includes all requested heroes and squads", () => {
    const ids = new Set(unitTemplates.map((template) => template.id));

    expect([...ids]).toEqual(expect.arrayContaining([
      "count_dooku",
      "general_grievous",
      "magnaguard_squad",
      "b1_battle_droid_commander_squad",
      "mace_windu",
      "hardcase",
      "dwarf_spider_droid",
    ]));
  });

  it("replaces the Droideka roster card with the Dwarf Spider Droid", () => {
    expect(unitTemplates.some((template) => template.id === "droideka_cell")).toBe(false);
    expect(unitTemplates.find((template) => template.id === "dwarf_spider_droid"))
      .toMatchObject({
        faction: "Separatists",
        category: "vehicle",
        abilities: ["heavy_cannon", "reinforced_chassis"],
      });
  });

  it("loads legacy Droideka instances as the replacement unit", () => {
    const legacyUnit: UnitInstance = {
      id: "legacy-droideka",
      templateId: "droideka_cell",
      armyId: "legacy-army",
      currentHp: 4,
      suppression: 0,
      position: null,
      status: "Ready",
      hidden: false,
    };

    expect(getTemplate(legacyUnit).id)
      .toBe("dwarf_spider_droid");
  });

  it("defines every ability referenced by the expanded roster", () => {
    const abilityIds = new Set(abilities.map((ability) => ability.id));
    const expandedTemplateIds = new Set([
      "count_dooku",
      "general_grievous",
      "magnaguard_squad",
      "b1_battle_droid_commander_squad",
      "mace_windu",
      "hardcase",
      "dwarf_spider_droid",
    ]);

    for (const template of unitTemplates.filter(({ id }) => expandedTemplateIds.has(id))) {
      for (const abilityId of template.abilities) {
        expect(abilityIds.has(abilityId), `${template.name}: ${abilityId}`).toBe(true);
      }
    }
  });
});
