import { abilities, taskForces } from "../../data";
import type { AbilityDefinition, Battle, UnitInstance } from "../../types";
import { areArmiesAllied } from "../army-relations";
import type { DiceRoller } from "../random";
import { createBattlefieldObject } from "../battlefield-objects";
import { distance, isOnBoard, type GridPosition } from "./geometry";
import { isPositionFree } from "./occupancy";
import { resolveAttack } from "./combat";
import { findUnit, getTemplate, replaceUnit } from "./state";
import { validateUnitActivation } from "./activation";
import { crossedCriticalHpThreshold, resolveMoraleRetreat } from "./morale";

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

  const remainingCooldown = source.abilityCooldowns?.[ability.id] ?? 0;
  if (remainingCooldown > 0) {
    return {
      battle,
      log: `${ability.name} jest jeszcze niedostępne przez ${remainingCooldown} rund.`,
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
        if (isOnBoard(nextBattle, pushedPosition) && isPositionFree(nextBattle, pushedPosition, nextTarget.id)) {
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
        distance(source.position, targetPosition) > (ability.effect.value ?? 0) ||
        !isPositionFree(battle, targetPosition, source.id)
      ) {
        return { battle, log: "Wybierz wolne pole w zasięgu specjalnego ruchu." };
      }
      return finishAbility(
        replaceUnit(battle, { ...source, position: targetPosition, movedThisTurn: true }),
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
        replaceUnit(battle, { ...source, position: destination, movedThisTurn: true }),
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
        ? replaceUnit(attack.battle, { ...attackerAfterAttack, position: targetPosition })
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
        isPositionFree(battle, candidate, excludedUnitId)
      ) {
        result.push(candidate);
      }
    }
  }
  return result;
}
