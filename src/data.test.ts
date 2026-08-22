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
  it("uses separate battlefield and card artwork for Anakin", () => {
    const anakin = unitTemplates.find((template) => template.id === "anakin_skywalker");

    expect(anakin).toMatchObject({
      imageUrl: "/unit-images/photos/anakin-skywalker.jpg",
      portraitImageUrl: "/unit-images/portraits/anakin-skywalker.png",
      battlefieldSpriteUrl: "/unit-images/sprites/anakin-skywalker.png",
    });
  });

  it("uses separate battlefield and card artwork for Obi-Wan", () => {
    const obiWan = unitTemplates.find((template) => template.id === "obi_wan_kenobi");

    expect(obiWan).toMatchObject({
      imageUrl: "/unit-images/photos/obi-wan-kenobi.jpg",
      portraitImageUrl: "/unit-images/portraits/obi-wan-kenobi.png",
      battlefieldSpriteUrl: "/unit-images/sprites/obi-wan-kenobi.png",
    });
  });

  it("uses dedicated battlefield and card artwork for Dooku, Mace and Ventress", () => {
    const dooku = unitTemplates.find((template) => template.id === "count_dooku");
    const mace = unitTemplates.find((template) => template.id === "mace_windu");
    const ventress = unitTemplates.find((template) => template.id === "asajj_ventress");

    expect(dooku).toMatchObject({
      portraitImageUrl: "/unit-images/portraits/count-dooku.png",
      battlefieldSpriteUrl: "/unit-images/sprites/count-dooku.png",
    });
    expect(mace).toMatchObject({
      portraitImageUrl: "/unit-images/portraits/mace-windu.png",
      battlefieldSpriteUrl: "/unit-images/sprites/mace-windu.png",
    });
    expect(ventress).toMatchObject({
      imageUrl: "/unit-images/photos/asajj-ventress.jpg",
      portraitImageUrl: "/unit-images/portraits/asajj-ventress.png",
      battlefieldSpriteUrl: "/unit-images/sprites/asajj-ventress.png",
    });
  });

  it("uses dedicated battlefield and card artwork for Ahsoka and Grievous", () => {
    const ahsoka = unitTemplates.find((template) => template.id === "ahsoka_tano");
    const grievous = unitTemplates.find((template) => template.id === "general_grievous");

    expect(ahsoka).toMatchObject({
      imageUrl: "/unit-images/photos/ahsoka-tano.jpg",
      portraitImageUrl: "/unit-images/portraits/ahsoka-tano.png",
      battlefieldSpriteUrl: "/unit-images/sprites/ahsoka-tano.png",
    });
    expect(grievous).toMatchObject({
      portraitImageUrl: "/unit-images/portraits/general-grievous.png",
      battlefieldSpriteUrl: "/unit-images/sprites/general-grievous.png",
    });
  });

  it("uses separate battlefield and card artwork for Jango Fett", () => {
    const jango = unitTemplates.find((template) => template.id === "jango_fett");

    expect(jango).toMatchObject({
      imageUrl: "/unit-images/photos/jango-fett.jpg",
      portraitImageUrl: "/unit-images/portraits/jango-fett.png",
      battlefieldSpriteUrl: "/unit-images/sprites/jango-fett.png",
    });
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

  it("shares B1 Droid battlefield and card artwork across its variants", () => {
    const b1Templates = unitTemplates.filter((template) => [
      "b1_droid_regiment",
      "b1_droid_squad",
      "b1_recon_squad",
      "b1_battle_droid_commander_squad",
    ].includes(template.id));

    expect(b1Templates).toHaveLength(4);
    expect(b1Templates.map((template) => ({
      portrait: template.portraitImageUrl,
      sprite: template.battlefieldSpriteUrl,
    }))).toEqual(Array.from({ length: 4 }, () => ({
      portrait: "/unit-images/portraits/b1-droid.png",
      sprite: "/unit-images/sprites/b1-droid.png",
    })));
  });

  it("uses separate battlefield and card artwork for B2 Super Battle Droids", () => {
    const b2 = unitTemplates.find((template) => template.id === "super_battle_droid_squad");

    expect(b2).toMatchObject({
      imageUrl: "/unit-images/photos/b2-super-battle-droid.jpg",
      portraitImageUrl: "/unit-images/portraits/b2-droid.png",
      battlefieldSpriteUrl: "/unit-images/sprites/b2-droid.png",
    });
  });

  it("shares Clone Trooper battlefield and card artwork across the battalion and squad", () => {
    const cloneTemplates = unitTemplates.filter((template) =>
      ["clone_trooper_battalion", "clone_trooper_squad"].includes(template.id)
    );

    expect(cloneTemplates).toHaveLength(2);
    expect(cloneTemplates.map((template) => ({
      portrait: template.portraitImageUrl,
      sprite: template.battlefieldSpriteUrl,
    }))).toEqual([
      {
        portrait: "/unit-images/portraits/clone-trooper.png",
        sprite: "/unit-images/sprites/clone-trooper.png",
      },
      {
        portrait: "/unit-images/portraits/clone-trooper.png",
        sprite: "/unit-images/sprites/clone-trooper.png",
      },
    ]);
  });

  it("reuses the Clone Trooper artwork with role-specific armor markings", () => {
    const cloneVariants = unitTemplates.filter((template) => [
      "clone_command_squad",
      "clone_assault_squad",
      "clone_engineers_332nd",
      "clone_commando_section",
      "clone_medic_squad",
    ].includes(template.id));

    expect(cloneVariants.map((template) => ({
      portrait: template.portraitImageUrl,
      sprite: template.battlefieldSpriteUrl,
    }))).toEqual([
      { portrait: "/unit-images/portraits/clone-trooper.png", sprite: "/unit-images/sprites/clone-command-squad.png" },
      { portrait: "/unit-images/portraits/clone-trooper.png", sprite: "/unit-images/sprites/clone-assault-squad.png" },
      { portrait: "/unit-images/portraits/clone-trooper.png", sprite: "/unit-images/sprites/clone-engineers-332nd.png" },
      { portrait: "/unit-images/portraits/clone-trooper.png", sprite: "/unit-images/sprites/clone-commando.png" },
      { portrait: "/unit-images/portraits/clone-trooper.png", sprite: "/unit-images/sprites/clone-medic.png" },
    ]);
  });

  it("normalizes legacy battlefield sprite height to the newer render scale", () => {
    const scaledSpriteIds = [
      "clone_trooper_battalion",
      "clone_trooper_squad",
      "clone_command_squad",
      "clone_assault_squad",
      "clone_engineers_332nd",
      "clone_commando_section",
      "clone_medic_squad",
      "yoda",
      "anakin_skywalker",
      "arc_trooper",
    ];
    const scaledSprites = unitTemplates.filter((template) => scaledSpriteIds.includes(template.id));

    expect(scaledSprites).toHaveLength(scaledSpriteIds.length);
    expect(scaledSprites.every((template) => template.battlefieldSpriteScale === 0.86)).toBe(true);
    expect(unitTemplates.find((template) => template.id === "darth_maul")?.battlefieldSpriteScale)
      .toBe(0.8);
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
