import { abilities, taskForces, unitTemplates } from "../../data";
import type { AbilityDefinition, Battle, UnitInstance } from "../../types";
import { areArmiesAllied, areArmiesEnemies } from "../army-relations";
import type { DiceRoller } from "../random";
import { createBattlefieldObject } from "../battlefield-objects";
import { distance, isOnBoard, type GridPosition } from "./geometry";
import { isPositionFree } from "./occupancy";
import { resolveAttack } from "./combat";
import { findUnit, getTemplate, replaceUnit } from "./state";
import { validateUnitActivation } from "./activation";
import { crossedCriticalHpThreshold, getStatusAfterDamage, resolveMoraleRetreat } from "./morale";
import { isTerrainEnterable } from "../terrain-definitions";
import { getTerrainAtPosition } from "./terrain";
import {
  clearBrokenSupportLinks,
  linkUnitSupport,
  unlinkUnitSupport,
  type SupportMode,
} from "./unit-support";

export type UseAbilityInput = {
  unitId: string;
  abilityId: string;
  targetUnitId?: string;
  targetPosition?: GridPosition;
};

export type AbilityUseResult = {
  battle: Battle;
  log: string;
  destroyedUnitId?: string;
  destroyedUnitIds?: string[];
};

export function getUnitActiveAbilities(
  battle: Battle,
  unit: UnitInstance,
): AbilityDefinition[] {
  const templateAbilityIds = new Set(getTemplate(unit).abilities);
  const army = battle.armies.find((candidate) => candidate.id === unit.armyId);
  for (const selection of army?.taskForces ?? []) {
    const taskForce = taskForces.find(
      (candidate) =>
        candidate.id === selection.taskForceId &&
        candidate.heroId === unit.templateId,
    );
    if (taskForce) {
      templateAbilityIds.add(taskForce.bonusAbility);
    }
  }

  return abilities.filter(
    (ability) => ability.type === "active" && templateAbilityIds.has(ability.id),
  );
}

export function useActiveAbility(
  battle: Battle,
  input: UseAbilityInput,
  rollD6: DiceRoller,
): AbilityUseResult {
  const validationError = validateUnitActivation(battle, input.unitId);
  if (validationError) {
    return { battle, log: validationError };
  }

  const source = findUnit(battle, input.unitId);
  if (!source) {
    return { battle, log: "Nie znaleziono jednostki używającej zdolności." };
  }

  const ability = getUnitActiveAbilities(battle, source).find(
    (candidate) => candidate.id === input.abilityId,
  );
  if (!ability) {
    return { battle, log: "Wybrana aktywna zdolność nie należy do tej jednostki." };
  }

  if (
    ability.usesPerBattle !== undefined &&
    (source.usedAbilities ?? []).filter((abilityId) => abilityId === ability.id).length >=
      ability.usesPerBattle
  ) {
    return {
      battle,
      log: `${ability.name} zostało już wykorzystane w tej bitwie.`,
    };
  }

  const remainingCooldown = source.abilityCooldowns?.[ability.id] ?? 0;
  if (remainingCooldown > 0) {
    return {
      battle,
      log: `${ability.name} jest jeszcze niedostępne przez ${remainingCooldown} rund.`,
    };
  }

  if (
    ability.effect.type === "bonus_move_then_melee_attack" &&
    source.activeEffects?.includes("advance_pending")
  ) {
    return {
      battle,
      log: `${ability.name} nie może zostać użyte po wykonaniu Advance.`,
    };
  }

  return applyAbilityEffect(battle, source, ability, input, rollD6);
}

function applyAbilityEffect(
  battle: Battle,
  source: UnitInstance,
  ability: AbilityDefinition,
  input: UseAbilityInput,
  rollD6: DiceRoller,
): AbilityUseResult {
  switch (ability.effect.type) {
    case "create_light_cover": {
      const targetPosition = input.targetPosition;
      if (
        !source.position ||
        !targetPosition ||
        !isOnBoard(battle, targetPosition) ||
        !isTerrainEnterable(getTerrainAtPosition(battle, targetPosition)) ||
        distance(source.position, targetPosition) > (ability.range ?? 1) ||
        !isPositionFree(battle, targetPosition) ||
        battle.board.objects?.some(
          (object) =>
            object.status === "Active" &&
            object.position.x === targetPosition.x &&
            object.position.y === targetPosition.y,
        )
      ) {
        return { battle, log: "Wybierz wolne sąsiednie pole pod lekką osłonę." };
      }

      return finishAbility(
        {
          ...battle,
          board: {
            ...battle.board,
            objects: [
              ...(battle.board.objects ?? []),
              createBattlefieldObject("LightFortification", targetPosition),
            ],
          },
        },
        source,
        ability,
        `${getTemplate(source).name} buduje lekką osłonę na polu ${targetPosition.x}, ${targetPosition.y}.`,
      );
    }

    case "build_field_hospital": {
      const targetPosition = input.targetPosition;
      if (
        !source.position ||
        !targetPosition ||
        !isOnBoard(battle, targetPosition) ||
        !isTerrainEnterable(getTerrainAtPosition(battle, targetPosition)) ||
        distance(source.position, targetPosition) > (ability.range ?? 1) ||
        battle.board.objects?.some((object) =>
          object.status === "Active" &&
          object.position.x === targetPosition.x &&
          object.position.y === targetPosition.y
        )
      ) {
        return { battle, log: "Wybierz wolne sąsiednie pole pod szpital polowy." };
      }
      const hospital = {
        ...createBattlefieldObject("LightFortification", targetPosition),
        name: "Szpital polowy",
        visualId: "field-hospital",
        healingPerRound: ability.effect.value ?? 2,
      };
      return finishAbility(
        {
          ...battle,
          board: { ...battle.board, objects: [...(battle.board.objects ?? []), hospital] },
        },
        source,
        ability,
        `${getTemplate(source).name} buduje szpital polowy na polu ${targetPosition.x}, ${targetPosition.y}.`,
      );
    }

    case "build_droid_foundry": {
      const targetPosition = input.targetPosition;
      const enemyAdjacent = targetPosition
        ? battle.armies.some((army) =>
            areArmiesEnemies(battle, army.id, source.armyId) &&
            army.units.some((unit) =>
              unit.status !== "Destroyed" &&
              unit.position &&
              distance(unit.position, targetPosition) <= 1
            )
          )
        : false;
      if (
        !source.position ||
        !targetPosition ||
        !isOnBoard(battle, targetPosition) ||
        !isTerrainEnterable(getTerrainAtPosition(battle, targetPosition)) ||
        distance(source.position, targetPosition) > (ability.range ?? 2) ||
        !isPositionFree(battle, targetPosition) ||
        enemyAdjacent ||
        battle.board.objects?.some((object) =>
          object.status === "Active" &&
          object.position.x === targetPosition.x &&
          object.position.y === targetPosition.y
        )
      ) {
        return {
          battle,
          log: "Wybierz kontrolowane, wolne pole poza bezpośrednim sąsiedztwem przeciwnika.",
        };
      }

      const foundry = {
        ...createBattlefieldObject("HeavyFortification", targetPosition),
        name: "Droid Foundry",
        maxHp: 10,
        currentHp: 10,
        armorSave: 4,
        defenseBonus: 0,
        blocksLineOfSight: true,
        visualId: "droid-foundry",
        controllerArmyId: source.armyId,
        production: {
          templateId: ability.effect.target ?? "b1_droid_squad",
          intervalRounds: 2,
          nextProductionTurn: battle.turn + 2,
          remainingSpawns: ability.effect.value ?? 3,
        },
      };
      return finishAbility(
        {
          ...battle,
          board: {
            ...battle.board,
            objects: [...(battle.board.objects ?? []), foundry],
          },
        },
        source,
        ability,
        `${getTemplate(source).name} zakłada fabrykę droidów na polu ${targetPosition.x}, ${targetPosition.y}.`,
      );
    }

    case "line_airstrike": {
      const targetPosition = input.targetPosition;
      if (
        !source.position ||
        !targetPosition ||
        !isOnBoard(battle, targetPosition) ||
        distance(source.position, targetPosition) < 2 ||
        distance(source.position, targetPosition) > (ability.range ?? 4)
      ) {
        return { battle, log: "Wybierz koniec linii nalotu w zasięgu od 2 do 4 pól." };
      }
      const strikeCells = linePositions(source.position, targetPosition).slice(1);
      const damage = ability.effect.value ?? 3;
      let hitCount = 0;
      const destroyedUnitIds: string[] = [];
      let nextBattle = battle;
      for (const target of battle.armies.flatMap((army) => army.units)) {
        if (
          !target.position ||
          target.status === "Destroyed" ||
          areArmiesAllied(battle, source.armyId, target.armyId) ||
          !strikeCells.some((position) =>
            position.x === target.position?.x && position.y === target.position.y
          )
        ) {
          continue;
        }
        hitCount += 1;
        const nextHp = Math.max(0, target.currentHp - damage);
        const nextSuppression = target.suppression + 1;
        if (nextHp === 0) destroyedUnitIds.push(target.id);
        nextBattle = replaceUnit(nextBattle, {
          ...target,
          currentHp: nextHp,
          suppression: nextSuppression,
          position: nextHp === 0 ? null : target.position,
          status: getStatusAfterDamage(
            target,
            getTemplate(target),
            nextHp,
            nextSuppression,
          ),
        });
      }
      const finished = finishAbility(
        clearBrokenSupportLinks(nextBattle),
        source,
        ability,
        `${getTemplate(source).name} wzywa nalot wzdłuż ${strikeCells.length} pól; trafione jednostki: ${hitCount}.`,
      );
      return { ...finished, destroyedUnitIds };
    }

    case "schedule_area_strike": {
      const targetPosition = input.targetPosition;
      if (
        !source.position ||
        !targetPosition ||
        !isOnBoard(battle, targetPosition) ||
        distance(source.position, targetPosition) > (ability.range ?? 4) ||
        battle.board.objects?.some((object) =>
          object.status === "Active" &&
          object.delayedStrike &&
          object.position.x === targetPosition.x &&
          object.position.y === targetPosition.y
        )
      ) {
        return { battle, log: "Wybierz nieoznaczone pole w zasięgu misji ogniowej." };
      }
      const marker = {
        ...createBattlefieldObject("LightFortification", targetPosition),
        name: "Cel misji ogniowej",
        maxHp: 0,
        currentHp: 0,
        destructible: false,
        defenseBonus: 0,
        visualId: "fire-mission-target",
        delayedStrike: {
          controllerArmyId: source.armyId,
          resolveTurn: battle.turn + 1,
          radius: 1,
          damage: ability.effect.value ?? 3,
          suppression: 2,
        },
      };
      return finishAbility(
        {
          ...battle,
          board: {
            ...battle.board,
            objects: [...(battle.board.objects ?? []), marker],
          },
        },
        source,
        ability,
        `${getTemplate(source).name} wyznacza pole ${targetPosition.x}, ${targetPosition.y} do ostrzału na początku następnej rundy.`,
      );
    }

    case "refresh_nearby_allies": {
      if (!source.position) return { battle, log: "Dowódca musi znajdować się na mapie." };
      const limit = ability.effect.value ?? 2;
      const targets = battle.armies
        .flatMap((army) => army.units)
        .filter((target) =>
          target.id !== source.id &&
          target.position &&
          target.status !== "Destroyed" &&
          areArmiesAllied(battle, source.armyId, target.armyId) &&
          distance(source.position!, target.position) <= (ability.range ?? 2) &&
          (target.status !== "Ready" || target.suppression > 0)
        )
        .sort((left, right) =>
          Number(right.status === "Activated") - Number(left.status === "Activated") ||
          right.suppression - left.suppression ||
          left.id.localeCompare(right.id)
        )
        .slice(0, limit);
      if (targets.length === 0) {
        return { battle, log: "Brak pobliskich jednostek wymagających reorganizacji." };
      }
      let nextBattle = battle;
      for (const target of targets) {
        nextBattle = replaceUnit(nextBattle, {
          ...target,
          suppression: 0,
          status: "Ready",
          movedThisTurn: false,
        });
      }
      nextBattle = addBonusActivationTokens(nextBattle, targets);
      return finishAbility(
        nextBattle,
        source,
        ability,
        `${getTemplate(source).name} reorganizuje ${targets.length} pobliskie jednostki.`,
      );
    }

    case "rally_and_reactivate": {
      const target = getValidTarget(battle, source, input.targetUnitId, ability, "friendly");
      if (
        !target ||
        target.id === source.id ||
        !getTemplate(target).keywords.includes("Clone")
      ) {
        return { battle, log: "Wybierz inną sojuszniczą jednostkę klonów w zasięgu." };
      }
      const nextBattle = addBonusActivationTokens(
        replaceUnit(battle, {
          ...target,
          suppression: 0,
          status: "Ready",
          movedThisTurn: false,
        }),
        [target],
      );
      return finishAbility(
        nextBattle,
        source,
        ability,
        `${getTemplate(source).name} mobilizuje ${getTemplate(target).name} do dodatkowej aktywacji.`,
      );
    }

    case "mark_shatterpoint":
    case "designate_target": {
      const target = getValidTarget(battle, source, input.targetUnitId, ability, "enemy");
      if (!target) return { battle, log: "Wybierz wrogą jednostkę w zasięgu." };
      const effect = ability.effect.type === "mark_shatterpoint"
        ? "shatterpoint"
        : `designated_target:${source.armyId}`;
      return finishAbility(
        replaceUnit(battle, {
          ...target,
          activeEffects: [...(target.activeEffects ?? []).filter((item) => item !== effect), effect],
        }),
        source,
        ability,
        `${getTemplate(source).name} oznacza ${getTemplate(target).name} zdolnością ${ability.name}.`,
      );
    }

    case "deny_activation": {
      const target = getValidTarget(battle, source, input.targetUnitId, ability, "enemy");
      if (!target || target.status === "Activated") {
        return { battle, log: "Wybierz wrogą jednostkę, która nie została jeszcze aktywowana." };
      }
      let spentToken = false;
      const nextBattle = replaceUnit({
        ...battle,
        activationBag: battle.activationBag.map((token) => {
          if (!spentToken && token.armyId === target.armyId && !token.used) {
            spentToken = true;
            return { ...token, used: true };
          }
          return token;
        }),
      }, { ...target, status: "Activated" });
      return finishAbility(
        nextBattle,
        source,
        ability,
        `${getTemplate(source).name} odbiera aktywację jednostce ${getTemplate(target).name}.`,
      );
    }

    case "mark_hunted_hero": {
      const target = getValidTarget(battle, source, input.targetUnitId, ability, "enemy");
      if (!target || !getTemplate(target).keywords.includes("Hero")) {
        return { battle, log: "Wybierz wrogiego bohatera w zasięgu polowania." };
      }
      const nextSource = {
        ...source,
        activeEffects: [
          ...(source.activeEffects ?? []).filter((effect) => !effect.startsWith("relentless_hunt:")),
          `relentless_hunt:${target.id}`,
        ],
      };
      return finishAbility(
        replaceUnit(battle, nextSource),
        source,
        ability,
        `${getTemplate(source).name} rozpoczyna nieustępliwe polowanie na ${getTemplate(target).name}.`,
      );
    }

    case "restore_hp": {
      const target = getValidTarget(battle, source, input.targetUnitId, ability, "friendly");
      if (!target || !getTemplate(target).keywords.includes("Vehicle")) {
        return { battle, log: "Naprawa wymaga uszkodzonego sojuszniczego pojazdu w zasięgu." };
      }
      const template = getTemplate(target);
      if (target.currentHp >= template.maxHp) {
        return { battle, log: `${template.name} nie wymaga naprawy.` };
      }
      const restoredHp = Math.min(template.maxHp, target.currentHp + (ability.effect.value ?? 0));
      const nextBattle = replaceUnit(battle, { ...target, currentHp: restoredHp });
      return finishAbility(
        nextBattle,
        source,
        ability,
        `${getTemplate(source).name} naprawia ${template.name}: HP ${restoredHp}/${template.maxHp}.`,
      );
    }

    case "restore_living_hp": {
      const target = getValidTarget(battle, source, input.targetUnitId, ability, "friendly");
      if (!target || getTemplate(target).keywords.includes("Vehicle")) {
        return { battle, log: "Leczenie wymaga żywej sojuszniczej jednostki niebędącej pojazdem." };
      }
      const template = getTemplate(target);
      if (target.currentHp >= template.maxHp) {
        return { battle, log: `${template.name} nie wymaga leczenia.` };
      }
      const restoredHp = Math.min(template.maxHp, target.currentHp + (ability.effect.value ?? 0));
      return finishAbility(
        replaceUnit(battle, { ...target, currentHp: restoredHp }),
        source,
        ability,
        `${getTemplate(source).name} leczy ${template.name}: HP ${restoredHp}/${template.maxHp}.`,
      );
    }

    case "entrench":
      return finishAbility(
        replaceUnit(battle, {
          ...source,
          activeEffects: [...(source.activeEffects ?? []), "entrenched"],
        }),
        source,
        ability,
        `${getTemplate(source).name} okopuje się i otrzymuje lekką osłonę do czasu ruchu.`,
      );

    case "link_support": {
      const target = input.targetUnitId;
      const mode = ability.effect.target as SupportMode;
      if (!target || (mode !== "attack" && mode !== "defense")) {
        return { battle, log: "Wybierz rodzaj i cel wsparcia." };
      }
      const linked = linkUnitSupport(battle, source.id, target, mode);
      if (linked.error) return { battle, log: linked.error };
      const receiver = findUnit(linked.battle, target)!;
      return finishAbility(
        linked.battle,
        source,
        ability,
        `${getTemplate(source).name} tworzy parę z ${getTemplate(receiver).name} i wspiera ${mode === "attack" ? "atak" : "obronę"}.`,
      );
    }

    case "summon_unit": {
      const targetPosition = input.targetPosition;
      const templateId = ability.effect.target;
      const template = templateId ? unitTemplatesById.get(templateId) : undefined;
      if (
        !template ||
        !source.position ||
        !targetPosition ||
        !isOnBoard(battle, targetPosition) ||
        distance(source.position, targetPosition) > (ability.range ?? 1) ||
        !isTerrainEnterable(getTerrainAtPosition(battle, targetPosition)) ||
        !isPositionFree(battle, targetPosition)
      ) {
        return { battle, log: "Wybierz wolne sąsiednie pole dla przywołanego wsparcia." };
      }
      const army = battle.armies.find((candidate) => candidate.id === source.armyId)!;
      const summoned: UnitInstance = {
        id: `${source.id}-${template.id}-${crypto.randomUUID()}`,
        templateId: template.id,
        armyId: source.armyId,
        currentHp: template.maxHp,
        suppression: 0,
        abilityCooldowns: {},
        position: targetPosition,
        status: "Activated",
        hidden: false,
      };
      const nextBattle = {
        ...battle,
        armies: battle.armies.map((candidate) =>
          candidate.id === army.id
            ? { ...candidate, units: [...candidate.units, summoned] }
            : candidate
        ),
      };
      return finishAbility(
        nextBattle,
        source,
        ability,
        `${getTemplate(source).name} przywołuje ${template.name}.`,
      );
    }

    case "damage_and_push":
    case "direct_damage": {
      const target = getValidTarget(battle, source, input.targetUnitId, ability, "enemy");
      if (!target) {
        return { battle, log: "Wybierz wrogą jednostkę w zasięgu zdolności." };
      }
      if (
        ability.effect.target === "enemy_in_cover" &&
        !battle.board.tiles.some(
          (tile) =>
            target.position?.x === tile.x &&
            target.position.y === tile.y &&
            tile.defenseBonus > 0,
        )
      ) {
        return { battle, log: "Ta zdolność wymaga przeciwnika znajdującego się w osłonie." };
      }

      const damage = ability.effect.value ?? 0;
      const nextHp = Math.max(0, target.currentHp - damage);
      let nextTarget: UnitInstance = {
        ...target,
        currentHp: nextHp,
        status: nextHp === 0 ? "Destroyed" : target.status,
        position: nextHp === 0 ? null : target.position,
      };
      let nextBattle = replaceUnit(battle, nextTarget);

      if (
        ability.effect.type === "damage_and_push" &&
        nextTarget.position &&
        source.position
      ) {
        const pushedPosition = stepAway(nextTarget.position, source.position);
        if (
          isOnBoard(nextBattle, pushedPosition) &&
          isTerrainEnterable(getTerrainAtPosition(nextBattle, pushedPosition)) &&
          isPositionFree(nextBattle, pushedPosition, nextTarget.id)
        ) {
          nextTarget = { ...nextTarget, position: pushedPosition };
          nextBattle = replaceUnit(nextBattle, nextTarget);
        }
      }

      const moraleResult =
        nextTarget.position &&
        source.position &&
        crossedCriticalHpThreshold(getTemplate(target), target.currentHp, nextHp)
          ? resolveMoraleRetreat(nextBattle, target.id, source.position, rollD6)
          : undefined;
      if (moraleResult) {
        nextBattle = moraleResult.battle;
      }
      nextBattle = clearBrokenSupportLinks(nextBattle);

      const finished = finishAbility(
        nextBattle,
        source,
        ability,
        `${getTemplate(source).name} używa ${ability.name}: ${getTemplate(target).name} otrzymuje ${damage} obrażeń.${moraleResult ? ` Morale ${moraleResult.rolls.join("+")} ${moraleResult.failed ? "nieudane." : "zdane."}` : ""}`,
      );
      return {
        ...finished,
        ...(nextHp === 0 ? { destroyedUnitId: target.id } : {}),
      };
    }

    case "incoming_damage_multiplier":
      return finishAbility(
        replaceUnit(battle, {
          ...source,
          activeEffects: [
            ...(source.activeEffects ?? []),
            `incoming_damage_multiplier:${ability.effect.value ?? 100}`,
          ],
        }),
        source,
        ability,
        `${getTemplate(source).name} przyjmuje postawę ${ability.name}.`,
      );

    case "bonus_move_ignore_terrain": {
      const targetPosition = input.targetPosition;
      if (
        !source.position ||
        !targetPosition ||
        !isOnBoard(battle, targetPosition) ||
        !isTerrainEnterable(getTerrainAtPosition(battle, targetPosition)) ||
        distance(source.position, targetPosition) > (ability.effect.value ?? 0) ||
        !isPositionFree(battle, targetPosition, source.id)
      ) {
        return { battle, log: "Wybierz wolne pole w zasięgu specjalnego ruchu." };
      }
      return finishAbility(
        replaceUnit(unlinkUnitSupport(battle, source.id), {
          ...source, position: targetPosition, movedThisTurn: true,
        }),
        source,
        ability,
        `${getTemplate(source).name} zmienia pozycję dzięki ${ability.name}.`,
      );
    }

    case "bonus_move_then_melee_attack": {
      const target = getValidTarget(
        battle,
        source,
        input.targetUnitId,
        { ...ability, range: (ability.effect.value ?? 0) + 1 },
        "enemy",
      );
      if (!target?.position || !source.position) {
        return { battle, log: "Wybierz przeciwnika w zasięgu szarży." };
      }
      const destination = adjacentFreePositions(battle, target.position, source.id)
        .sort((left, right) => distance(left, source.position!) - distance(right, source.position!))
        .find((position) => distance(position, source.position!) <= (ability.effect.value ?? 0));
      if (!destination) {
        return { battle, log: "Brak wolnej pozycji pozwalającej zakończyć szarżę." };
      }
      const meleeWeapon = getTemplate(source).weapons.find((weapon) => weapon.range === 1);
      if (!meleeWeapon) {
        return { battle, log: "Jednostka nie posiada broni do zakończenia szarży." };
      }
      const prepared = putAbilityOnCooldown(
        replaceUnit(unlinkUnitSupport(battle, source.id), {
          ...source, position: destination, movedThisTurn: true,
        }),
        source.id,
        ability,
      );
      const attack = resolveAttack(prepared, source.id, target.id, meleeWeapon.id, rollD6);
      return {
        battle: attack.battle,
        log: `${ability.name}: ${attack.log}`,
        ...(attack.result?.destroyed ? { destroyedUnitId: target.id } : {}),
      };
    }

    case "move_after_attack": {
      const target = getValidTarget(battle, source, input.targetUnitId, ability, "enemy");
      const targetPosition = input.targetPosition;
      const weapon = target
        ? getTemplate(source).weapons.find(
            (candidate) =>
              source.position &&
              target.position &&
              distance(source.position, target.position) <= candidate.range,
          )
        : undefined;
      if (
        !target ||
        !weapon ||
        !targetPosition ||
        !source.position ||
        distance(source.position, targetPosition) > (ability.effect.value ?? 1) ||
        !isPositionFree(battle, targetPosition, source.id)
      ) {
        return { battle, log: "Wybierz cel ataku i wolne pole odwrotu." };
      }
      const prepared = putAbilityOnCooldown(battle, source.id, ability);
      const attack = resolveAttack(prepared, source.id, target.id, weapon.id, rollD6);
      const attackerAfterAttack = findUnit(attack.battle, source.id);
      const finalBattle = attackerAfterAttack
        ? replaceUnit(unlinkUnitSupport(attack.battle, source.id), {
            ...attackerAfterAttack, position: targetPosition,
          })
        : attack.battle;
      return {
        battle: finalBattle,
        log: `${ability.name}: ${attack.log} Następnie jednostka wycofuje się na ${targetPosition.x}, ${targetPosition.y}.`,
        ...(attack.result?.destroyed ? { destroyedUnitId: target.id } : {}),
      };
    }

    case "task_force_once_per_turn_movement_bonus":
    case "task_force_attack_bonus_against_damaged":
    case "task_force_attack_bonus_against_hero": {
      const target = getValidTarget(battle, source, input.targetUnitId, ability, "friendly");
      if (!target) {
        return { battle, log: "Wybierz sojuszniczą jednostkę w zasięgu zdolności." };
      }
      const effect = ability.effect.type === "task_force_once_per_turn_movement_bonus"
        ? "movement_bonus:1"
        : ability.effect.type === "task_force_attack_bonus_against_damaged"
          ? "attack_bonus_damaged:1"
          : "attack_bonus_hero:1";
      const nextBattle = replaceUnit(battle, {
        ...target,
        activeEffects: [...(target.activeEffects ?? []), effect],
      });
      return finishAbility(
        nextBattle,
        source,
        ability,
        `${getTemplate(source).name} wspiera ${getTemplate(target).name} zdolnością ${ability.name}.`,
      );
    }

    default:
      return { battle, log: `${ability.name} nie ma jeszcze obsługiwanego efektu.` };
  }
}

const unitTemplatesById = new Map(unitTemplates.map((template) => [template.id, template]));

function finishAbility(
  battle: Battle,
  source: UnitInstance,
  ability: AbilityDefinition,
  log: string,
): AbilityUseResult {
  const nextBattle = putAbilityOnCooldown(battle, source.id, ability);
  const updatedSource = findUnit(nextBattle, source.id);
  return {
    battle: updatedSource
      ? {
          ...replaceUnit(nextBattle, { ...updatedSource, status: "Activated" }),
          activeActivation: undefined,
        }
      : nextBattle,
    log,
  };
}

function putAbilityOnCooldown(
  battle: Battle,
  sourceId: string,
  ability: AbilityDefinition,
): Battle {
  const source = findUnit(battle, sourceId);
  if (!source) return battle;
  return replaceUnit(battle, {
    ...source,
    usedAbilities: ability.usesPerBattle !== undefined
      ? [...(source.usedAbilities ?? []), ability.id]
      : source.usedAbilities,
    abilityCooldowns: {
      ...(source.abilityCooldowns ?? {}),
      [ability.id]: ability.cooldown ?? 1,
    },
  });
}

function getValidTarget(
  battle: Battle,
  source: UnitInstance,
  targetUnitId: string | undefined,
  ability: AbilityDefinition,
  allegiance: "friendly" | "enemy",
): UnitInstance | undefined {
  const target = targetUnitId ? findUnit(battle, targetUnitId) : undefined;
  if (
    !source.position ||
    !target?.position ||
    target.status === "Destroyed" ||
    (allegiance === "friendly") !== areArmiesAllied(battle, target.armyId, source.armyId) ||
    distance(source.position, target.position) > (ability.range ?? 1)
  ) {
    return undefined;
  }
  return target;
}

function stepAway(position: GridPosition, threat: GridPosition): GridPosition {
  return {
    x: position.x + Math.sign(position.x - threat.x),
    y: position.y + Math.sign(position.y - threat.y),
  };
}

function adjacentFreePositions(
  battle: Battle,
  position: GridPosition,
  excludedUnitId: string,
): GridPosition[] {
  const result: GridPosition[] = [];
  for (let y = position.y - 1; y <= position.y + 1; y += 1) {
    for (let x = position.x - 1; x <= position.x + 1; x += 1) {
      const candidate = { x, y };
      if (
        (x !== position.x || y !== position.y) &&
        isOnBoard(battle, candidate) &&
        isTerrainEnterable(getTerrainAtPosition(battle, candidate)) &&
        isPositionFree(battle, candidate, excludedUnitId)
      ) {
        result.push(candidate);
      }
    }
  }
  return result;
}

function linePositions(from: GridPosition, to: GridPosition): GridPosition[] {
  const steps = distance(from, to);
  return Array.from({ length: steps + 1 }, (_, index) => ({
    x: Math.round(from.x + ((to.x - from.x) * index) / steps),
    y: Math.round(from.y + ((to.y - from.y) * index) / steps),
  })).filter((position, index, positions) =>
    index === 0 ||
    position.x !== positions[index - 1].x ||
    position.y !== positions[index - 1].y
  );
}

function addBonusActivationTokens(battle: Battle, units: UnitInstance[]): Battle {
  const tokens = units.flatMap((unit) => {
    const army = battle.armies.find((candidate) => candidate.id === unit.armyId);
    return army ? [{
      id: `${army.id}_command_bonus_${unit.id}_${crypto.randomUUID()}`,
      armyId: army.id,
      faction: army.faction,
      used: false,
    }] : [];
  });
  return { ...battle, activationBag: [...battle.activationBag, ...tokens] };
}
