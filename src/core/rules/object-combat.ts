import type { Battle, BattlefieldObject, ObjectAttackResult, UnitInstance } from "../../types";
import { randomD6, type DiceRoller } from "../random";
import { validateUnitActivation } from "./activation";
import { distance, lineOfSight } from "./geometry";
import { findUnit, getTemplate, replaceUnit } from "./state";

export function resolveObjectAttack(
  battle: Battle,
  attackerId: string,
  objectId: string,
  weaponId: string,
  rollD6: DiceRoller = randomD6,
): { battle: Battle; result?: ObjectAttackResult; log: string } {
  const validationError = validateUnitActivation(battle, attackerId);
  if (validationError) {
    return { battle, log: validationError };
  }

  const attacker = findUnit(battle, attackerId);
  const target = battle.board.objects?.find((object) => object.id === objectId);
  if (!attacker || !target) {
    return { battle, log: "Wybierz atakujacego i obiekt na mapie." };
  }
  if (!target.destructible) {
    return { battle, log: `${target.name} nie jest obiektem zniszczalnym.` };
  }
  if (target.status === "Destroyed") {
    return { battle, log: `${target.name} jest juz zniszczony.` };
  }
  if (!attacker.position) {
    return { battle, log: "Atakujaca jednostka musi znajdowac sie na mapie." };
  }

  const attackerTemplate = getTemplate(attacker);
  const weapon = attackerTemplate.weapons.find((profile) => profile.id === weaponId);
  if (!weapon) {
    return { battle, log: `${attackerTemplate.name} nie ma wybranej broni.` };
  }

  const targetDistance = distance(attacker.position, target.position);
  if (targetDistance > weapon.range) {
    return { battle, log: `${target.name} jest poza zasiegiem ${weapon.name}.` };
  }
  if (!lineOfSight(battle, attacker.position, target.position)) {
    return { battle, log: `${attackerTemplate.name} nie ma linii widzenia do ${target.name}.` };
  }

  const hitTarget = Math.min(6, 4 + Math.min(2, attacker.suppression));
  const hitRolls = rollD6Pool(weapon.attacks, rollD6);
  const hits = hitRolls.filter((roll) => roll >= hitTarget).length;
  const armorSave = target.armorSave ?? 7;
  const armorRolls = armorSave <= 6 ? rollD6Pool(hits, rollD6) : [];
  const savedHits = armorRolls.filter((roll) => roll >= armorSave).length;
  const unsavedHits = Math.max(0, hits - savedHits);
  const damage = unsavedHits * weapon.damage;
  const nextHp = Math.max(0, target.currentHp - damage);
  const nextTarget: BattlefieldObject = {
    ...target,
    currentHp: nextHp,
    status: nextHp === 0 ? "Destroyed" : "Active",
  };
  const nextAttacker: UnitInstance = {
    ...attacker,
    status: "Activated",
    activeEffects: attacker.activeEffects?.filter((effect) => effect !== "advance_pending"),
  };
  const nextBattle: Battle = {
    ...replaceUnit(battle, nextAttacker),
    board: {
      ...battle.board,
      objects: (battle.board.objects ?? []).map((object) =>
        object.id === target.id ? nextTarget : object,
      ),
    },
    activeActivation: undefined,
  };

  return {
    battle: nextBattle,
    result: {
      attackerId,
      objectId: target.id,
      objectType: target.type,
      objectPosition: target.position,
      weaponName: weapon.name,
      hitRolls,
      armorRolls,
      hits,
      unsavedHits,
      damage,
      destroyed: nextHp === 0,
    },
    log: `${attackerTemplate.name} atakuje ${target.name}: trafienia ${hits}, save ${
      armorRolls.length ? armorRolls.join(", ") : "-"
    }, obrazenia ${damage}, HP ${nextHp}/${target.maxHp}.`,
  };
}

function rollD6Pool(count: number, rollD6: DiceRoller): number[] {
  return Array.from({ length: count }, rollD6);
}
