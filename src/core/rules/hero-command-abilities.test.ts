import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { applyBattleAction } from "../battle-actions";
import { createBattle } from "../battle-state";
import { createSequenceDiceRoller } from "../random";
import { resolveAttack } from "./combat";
import { resolveDelayedBattlefieldEffects } from "./delayed-battlefield-effects";
import { getUnitMovementBonus } from "./movement";
import { resetUnitForNextTurn } from "./morale";
import { findUnit, getTemplate, templateById } from "./state";

describe("expanded hero abilities", () => {
  it("runs Anakin's airstrike along a selected line", () => {
    const battle = isolatedBattle("anakin_skywalker", "b1_droid_squad");
    const anakin = place(battle, "rep_unit_1", { x: 1, y: 1 });
    const target = place(battle, "sep_unit_1", { x: 3, y: 1 });
    activate(battle, anakin);

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: anakin.id,
      abilityId: "aggressive_air_support",
      targetPosition: { x: 4, y: 1 },
    });

    expect(findUnit(result.battle, target.id)).toMatchObject({ currentHp: 5, suppression: 1 });
    expect(findUnit(result.battle, anakin.id)?.usedAbilities).toContain("aggressive_air_support");
  });

  it("telegraphs Obi-Wan's fire mission and resolves it next round", () => {
    const battle = isolatedBattle("obi_wan_kenobi", "b1_droid_squad");
    const obiWan = place(battle, "rep_unit_1", { x: 1, y: 1 });
    const target = place(battle, "sep_unit_1", { x: 3, y: 3 });
    activate(battle, obiWan);

    const scheduled = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: obiWan.id,
      abilityId: "coordinated_fire_mission",
      targetPosition: { x: 3, y: 3 },
    });
    expect(scheduled.battle.board.objects).toContainEqual(expect.objectContaining({
      visualId: "fire-mission-target",
      delayedStrike: expect.objectContaining({ resolveTurn: 2, radius: 1 }),
    }));

    const resolved = resolveDelayedBattlefieldEffects(scheduled.battle, 2);
    expect(findUnit(resolved.battle, target.id)).toMatchObject({ currentHp: 5, suppression: 2 });
    expect(resolved.battle.board.objects?.some((object) => object.delayedStrike)).toBe(false);
  });

  it("lets Ahsoka leap into melee with Acrobatic Flank", () => {
    const battle = isolatedBattle("ahsoka_tano", "b1_droid_squad");
    const ahsoka = place(battle, "rep_unit_1", { x: 1, y: 1 });
    const target = place(battle, "sep_unit_1", { x: 4, y: 1 });
    activate(battle, ahsoka);

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: ahsoka.id,
      abilityId: "acrobatic_flank",
      targetUnitId: target.id,
    }, { rollD6: createSequenceDiceRoller([6, 6, 6, 6, 6, 6, 6, 1, 1, 1, 1, 1, 1, 1, 6, 6]) });

    expect(findUnit(result.battle, ahsoka.id)).toMatchObject({
      status: "Activated",
      movedThisTurn: true,
    });
    expect(findUnit(result.battle, ahsoka.id)?.position).not.toEqual({ x: 1, y: 1 });
    expect(findUnit(result.battle, target.id)?.currentHp).toBeLessThan(8);
  });

  it("lets Yoda reorganize up to two nearby allies", () => {
    const battle = isolatedBattle("yoda", "b1_droid_squad");
    const yoda = place(battle, "rep_unit_1", { x: 2, y: 2 });
    const first = place(battle, "rep_unit_2", { x: 3, y: 2 });
    const second = place(battle, "rep_unit_3", { x: 2, y: 3 });
    first.status = "Activated";
    first.suppression = 2;
    first.movedThisTurn = true;
    second.status = "Pinned";
    second.suppression = 4;
    activate(battle, yoda);
    const previousTokens = battle.activationBag.length;

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: yoda.id,
      abilityId: "guidance_of_the_force",
    });

    expect(findUnit(result.battle, first.id)).toMatchObject({ status: "Ready", suppression: 0, movedThisTurn: false });
    expect(findUnit(result.battle, second.id)).toMatchObject({ status: "Ready", suppression: 0 });
    expect(result.battle.activationBag).toHaveLength(previousTokens + 2);
  });

  it("makes Shatterpoint ignore cover and worsen armor", () => {
    const battle = isolatedBattle("mace_windu", "b1_droid_squad");
    const mace = place(battle, "rep_unit_1", { x: 2, y: 2 });
    const clone = configureUnit(battle.armies[0].units[1], "clone_trooper_squad", { x: 3, y: 3 });
    const target = place(battle, "sep_unit_1", { x: 4, y: 3 });
    activate(battle, mace);
    const marked = applyBattleAction(battle, {
      type: "UseAbility", unitId: mace.id, abilityId: "shatterpoint", targetUnitId: target.id,
    }).battle;
    activate(marked, clone);

    const attack = resolveAttack(
      marked,
      clone.id,
      target.id,
      getTemplate(clone).weapons[0].id,
      createSequenceDiceRoller([4, 4, 4, 4, 4]),
    );

    expect(attack.result).toMatchObject({ hits: 5, armorRolls: [], damage: 5 });
  });

  it("lets Rex clear suppression and grant a clone another activation", () => {
    const battle = isolatedBattle("captain_rex", "b1_droid_squad");
    const rex = place(battle, "rep_unit_1", { x: 2, y: 2 });
    const clone = configureUnit(battle.armies[0].units[1], "clone_trooper_squad", { x: 3, y: 2 });
    clone.status = "Activated";
    clone.suppression = 3;
    activate(battle, rex);
    const previousTokens = battle.activationBag.length;

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: rex.id,
      abilityId: "experience_outranks_everything",
      targetUnitId: clone.id,
    });

    expect(findUnit(result.battle, clone.id)).toMatchObject({ status: "Ready", suppression: 0 });
    expect(result.battle.activationBag).toHaveLength(previousTokens + 1);
  });

  it("lets Cody designate a target for coordinated clone fire", () => {
    const battle = isolatedBattle("commander_cody", "b1_droid_squad");
    const cody = place(battle, "rep_unit_1", { x: 2, y: 2 });
    const clone = configureUnit(battle.armies[0].units[1], "clone_trooper_squad", { x: 3, y: 3 });
    const target = place(battle, "sep_unit_1", { x: 4, y: 3 });
    activate(battle, cody);
    const marked = applyBattleAction(battle, {
      type: "UseAbility", unitId: cody.id, abilityId: "target_designation", targetUnitId: target.id,
    }).battle;
    activate(marked, clone);

    const attack = resolveAttack(
      marked,
      clone.id,
      target.id,
      getTemplate(clone).weapons[0].id,
      createSequenceDiceRoller([5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1]),
    );

    expect(attack.result).toMatchObject({ hits: 6, damage: 6 });
    expect(attack.result?.hitRolls).toHaveLength(6);
  });

  it("lets Dooku deny a unit and spend an enemy activation", () => {
    const battle = isolatedBattle("count_dooku", "clone_trooper_squad", false);
    const dooku = place(battle, "sep_unit_1", { x: 3, y: 3 });
    const target = place(battle, "rep_unit_1", { x: 1, y: 2 });
    activate(battle, dooku);
    const unusedBefore = battle.activationBag.filter((token) =>
      token.armyId === target.armyId && !token.used
    ).length;

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: dooku.id,
      abilityId: "master_manipulator",
      targetUnitId: target.id,
    });

    expect(findUnit(result.battle, target.id)?.status).toBe("Activated");
    expect(result.battle.activationBag.filter((token) =>
      token.armyId === target.armyId && !token.used
    )).toHaveLength(unusedBefore - 1);
  });

  it("keeps Maul's hunt through rounds and grants movement against a living hero", () => {
    const battle = isolatedBattle("darth_maul", "obi_wan_kenobi", false);
    const maul = place(battle, "sep_unit_1", { x: 4, y: 4 });
    const target = place(battle, "rep_unit_1", { x: 2, y: 2 });
    activate(battle, maul);

    const result = applyBattleAction(battle, {
      type: "UseAbility",
      unitId: maul.id,
      abilityId: "relentless_hunt",
      targetUnitId: target.id,
    });
    const huntedMaul = findUnit(result.battle, maul.id)!;

    expect(getUnitMovementBonus(result.battle, huntedMaul)).toBe(1);
    expect(resetUnitForNextTurn(huntedMaul, getTemplate(huntedMaul)).activeEffects)
      .toContain(`relentless_hunt:${target.id}`);
  });

  it("gives Ventress a second leap-and-attack option", () => {
    const ventress = templateById.get("asajj_ventress")!;
    expect(ventress.abilities).toContain("assassins_ambush");
  });
});

function isolatedBattle(
  republicTemplateId: string,
  separatistTemplateId: string,
  republicIsSource = true,
): Battle {
  const battle = createBattle();
  battle.board = structuredClone(battle.board);
  battle.armies.forEach((army) => army.units.forEach((unit) => {
    unit.position = null;
    unit.status = "Ready";
    unit.suppression = 0;
    unit.movedThisTurn = false;
    unit.activeEffects = [];
    unit.abilityCooldowns = {};
    unit.usedAbilities = [];
  }));
  configureUnit(battle.armies[0].units[0], republicTemplateId, null);
  configureUnit(battle.armies[1].units[0], separatistTemplateId, null);
  if (!republicIsSource) {
    configureUnit(battle.armies[0].units[0], separatistTemplateId, null);
    configureUnit(battle.armies[1].units[0], republicTemplateId, null);
  }
  return battle;
}

function configureUnit(
  unit: UnitInstance,
  templateId: string,
  position: { x: number; y: number } | null,
): UnitInstance {
  unit.templateId = templateId;
  unit.currentHp = templateById.get(templateId)!.maxHp;
  unit.position = position;
  return unit;
}

function place(battle: Battle, unitId: string, position: { x: number; y: number }): UnitInstance {
  const unit = findUnit(battle, unitId)!;
  unit.position = position;
  return unit;
}

function activate(battle: Battle, unit: UnitInstance): void {
  unit.status = "Ready";
  battle.activeActivation = {
    id: `active-${unit.id}`,
    armyId: unit.armyId,
    faction: battle.armies.find((army) => army.id === unit.armyId)!.faction,
    used: true,
  };
}
