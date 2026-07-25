import type { AttackResult, Battle, UnitInstance } from "../../types";
import { validateUnitActivation } from "./activation";
import { getAttackDiceBonus, getDamageBonus, getNumericAbilityEffect } from "./abilities";
import { distance, lineOfSight } from "./geometry";
import {
  crossedCriticalHpThreshold,
  getStatusAfterDamage,
  resolveMoraleRetreat,
} from "./morale";
import { getTemplate, findUnit, replaceUnit } from "./state";
import { getDefenseBonus } from "./terrain";
import { randomD6, type DiceRoller } from "../random";

export function resolveAttack(
  battle: Battle,
  attackerId: string,
  defenderId: string,
  weaponId: string,
  rollD6: DiceRoller = randomD6,
): { battle: Battle; result?: AttackResult; log: string } {
  const validationError = validateUnitActivation(battle, attackerId);
  if (validationError) {
    return { battle, log: validationError };
  }

  const attacker = findUnit(battle, attackerId);
  const defender = findUnit(battle, defenderId);

  if (!attacker || !defender) {
    return { battle, log: "Wybierz atakujacego i cel." };
  }

  if (attacker.armyId === defender.armyId) {
    return { battle, log: "Cel musi nalezec do przeciwnej armii." };
  }

  if (defender.status === "Destroyed") {
    return { battle, log: "Nie mozna atakowac zniszczonej jednostki." };
  }

  if (!attacker.position || !defender.position) {
    return { battle, log: "Atak wymaga, aby obie jednostki byly wystawione na mapie." };
  }

  const attackerTemplate = getTemplate(attacker);
  const defenderTemplate = getTemplate(defender);
  const weapon = attackerTemplate.weapons.find((profile) => profile.id === weaponId);

  if (!weapon) {
    return { battle, log: `${attackerTemplate.name} nie ma wybranej broni.` };
  }

  const targetDistance = distance(attacker.position, defender.position);
  if (targetDistance > weapon.range) {
    return {
      battle,
      log: `${defenderTemplate.name} jest poza zasiegiem ${weapon.name}: ${targetDistance}/${weapon.range}.`,
    };
  }

  if (!lineOfSight(battle, attacker.position, defender.position)) {
    return {
      battle,
      log: `${attackerTemplate.name} nie ma linii widzenia do ${defenderTemplate.name}.`,
    };
  }

  const cloneBonus =
    attackerTemplate.abilities.includes("clone_training") && attacker.suppression === 0
      ? getNumericAbilityEffect(attackerTemplate, "hit_bonus_without_suppression")
      : 0;
  const coverPenalty = getDefenseBonus(battle, defender);
  const attackerSuppressionPenalty = Math.min(2, attacker.suppression);
  const hitTarget = Math.min(6, Math.max(2, 4 + coverPenalty + attackerSuppressionPenalty - cloneBonus));
  const attackDiceBonus = getAttackDiceBonus(battle, attacker, defender);
  const attackDice = Math.max(1, weapon.attacks + attackDiceBonus);
  const hitRolls = rollD6Pool(attackDice, rollD6);
  const hits = hitRolls.filter((roll) => roll >= hitTarget).length;
  const antiVehicleBonus =
    weapon.keywords.includes("AntiVehicle") && defenderTemplate.keywords.includes("Vehicle")
      ? getNumericAbilityEffect(attackerTemplate, "anti_vehicle_damage_bonus")
      : 0;
  const categoryDamageBonus = getDamageBonus(attackerTemplate, defenderTemplate);
  const shieldReduction =
    defenderTemplate.abilities.includes("shield_generators") && targetDistance > 1
      ? getNumericAbilityEffect(defenderTemplate, "ranged_shield_damage_reduction")
      : 0;
  const forceReduction = getNumericAbilityEffect(defenderTemplate, "damage_reduction");
  const armorSave = defenderTemplate.armorSave ?? 7;
  const armorRolls = armorSave <= 6 ? rollD6Pool(hits, rollD6) : [];
  const savedHits = armorRolls.filter((roll) => roll >= armorSave).length;
  const unsavedHits = Math.max(0, hits - savedHits);
  const rawDamage = unsavedHits > 0 ? unsavedHits * weapon.damage + antiVehicleBonus + categoryDamageBonus : 0;
  const damageMultiplier = readIncomingDamageMultiplier(defender);
  const damage = Math.max(
    0,
    Math.floor((rawDamage - shieldReduction - forceReduction) * damageMultiplier),
  );
  const suppression = hits > 0 ? 1 : 0;
  const nextHp = Math.max(0, defender.currentHp - damage);
  const nextSuppression = defender.suppression + suppression;
  const nextDefender: UnitInstance = {
    ...defender,
    currentHp: nextHp,
    position: nextHp === 0 ? null : defender.position,
    suppression: nextSuppression,
    status: getStatusAfterDamage(defender, defenderTemplate, nextHp, nextSuppression),
  };
  const nextAttacker: UnitInstance = {
    ...attacker,
    status: "Activated",
    activeEffects: attacker.activeEffects?.filter((effect) => effect !== "advance_pending"),
  };
  let nextBattle: Battle = {
    ...replaceUnit(replaceUnit(battle, nextDefender), nextAttacker),
    activeActivation: undefined,
  };
  const moraleResult = crossedCriticalHpThreshold(
    defenderTemplate,
    defender.currentHp,
    nextHp,
  )
    ? resolveMoraleRetreat(nextBattle, defender.id, attacker.position, rollD6)
    : undefined;
  if (moraleResult) {
    nextBattle = moraleResult.battle;
  }

  return {
    battle: nextBattle,
    result: {
      attackerId: attacker.id,
      defenderId: defender.id,
      defenderPosition: defender.position,
      weaponName: weapon.name,
      hitRolls,
      armorRolls,
      hits,
      unsavedHits,
      damage,
      suppression,
      destroyed: nextHp === 0,
      ...(moraleResult ? { moraleRolls: moraleResult.rolls } : {}),
      ...(moraleResult?.retreatedTo ? { retreatedTo: moraleResult.retreatedTo } : {}),
    },
    log: `${attackerTemplate.name} strzela z ${weapon.name} do ${defenderTemplate.name}: zasieg ${targetDistance}/${weapon.range}, ataki ${attackDice}${attackDiceBonus ? ` (+${attackDiceBonus})` : ""}, rzuty ${hitRolls.join(", ")}, trafienia ${hits}, save ${armorRolls.length ? armorRolls.join(", ") : "-"}, przebicia ${unsavedHits}, bonus obrazen +${categoryDamageBonus}, tarcza -${shieldReduction}, obrazenia ${damage}, suppression +${suppression}.${moraleResult ? ` Morale ${moraleResult.rolls.join("+")} ${moraleResult.failed ? moraleResult.retreatedTo ? `nieudane: odwrot na ${moraleResult.retreatedTo.x}, ${moraleResult.retreatedTo.y}.` : "nieudane: brak wolnego pola odwrotu." : "zdane: jednostka utrzymuje pozycje."}` : ""}`,
  };
}

function readIncomingDamageMultiplier(unit: UnitInstance): number {
  const effect = unit.activeEffects?.find((candidate) =>
    candidate.startsWith("incoming_damage_multiplier:"),
  );
  const percentage = effect ? Number(effect.split(":")[1]) : 100;
  return Number.isFinite(percentage) ? percentage / 100 : 1;
}

function rollD6Pool(count: number, rollD6: DiceRoller): number[] {
  return Array.from({ length: count }, rollD6);
}
