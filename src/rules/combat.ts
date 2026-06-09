import type { AttackResult, Battle, UnitInstance } from "../types";
import { validateUnitActivation } from "./activation";
import { getNumericAbilityEffect } from "./abilities";
import { distance, lineOfSight } from "./geometry";
import { getStatusAfterDamage } from "./morale";
import { getTemplate, findUnit, replaceUnit } from "./state";
import { getDefenseBonus } from "./terrain";

export function resolveAttack(
  battle: Battle,
  attackerId: string,
  defenderId: string,
  weaponId: string,
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

  const hitRoll = Math.ceil(Math.random() * 6);
  const cloneBonus =
    attackerTemplate.abilities.includes("clone_training") && attacker.suppression === 0
      ? getNumericAbilityEffect(attackerTemplate, "hit_bonus_without_suppression")
      : 0;
  const coverPenalty = getDefenseBonus(battle, defender);
  const hitTarget = Math.max(2, 4 + coverPenalty + defender.suppression - cloneBonus);
  const hits = hitRoll >= hitTarget ? weapon.attacks : 0;
  const antiVehicleBonus =
    weapon.keywords.includes("AntiVehicle") && defenderTemplate.keywords.includes("Vehicle")
      ? getNumericAbilityEffect(attackerTemplate, "anti_vehicle_damage_bonus")
      : 0;
  const shieldReduction =
    defenderTemplate.abilities.includes("shield_generators") && hitRoll <= 2
      ? getNumericAbilityEffect(defenderTemplate, "low_roll_damage_reduction")
      : 0;
  const forceReduction = getNumericAbilityEffect(defenderTemplate, "damage_reduction");
  const rawDamage = hits > 0 ? hits * weapon.damage + antiVehicleBonus : 0;
  const damage = Math.max(0, rawDamage - shieldReduction - forceReduction);
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
  const nextAttacker: UnitInstance = { ...attacker, status: "Activated" };
  const nextBattle = {
    ...replaceUnit(replaceUnit(battle, nextDefender), nextAttacker),
    activeActivation: undefined,
  };

  return {
    battle: nextBattle,
    result: {
      attackerId: attacker.id,
      defenderId: defender.id,
      defenderPosition: defender.position,
      weaponName: weapon.name,
      hitRoll,
      hits,
      damage,
      suppression,
      destroyed: nextHp === 0,
    },
    log: `${attackerTemplate.name} strzela z ${weapon.name} do ${defenderTemplate.name}: zasieg ${targetDistance}/${weapon.range}, rzut ${hitRoll}, trafienia ${hits}, obrazenia ${damage}, suppression +${suppression}.`,
  };
}
