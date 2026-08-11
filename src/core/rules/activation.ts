import type { ActivationToken, Army, Battle } from "../../types";
import { randomIndex, systemRandom, type RandomSource } from "../random";
import { findArmy, findUnit } from "./state";

export const MAX_ACTIVATIONS_PER_ARMY = 8;

export function buildActivationBag(armies: Army[]): ActivationToken[] {
  return armies.flatMap((army) =>
    army.units
      .filter((unit) => unit.status !== "Destroyed")
      .slice(0, MAX_ACTIVATIONS_PER_ARMY)
      .map((unit, index) => ({
        id: `${army.id}_token_${unit.id}_${index}`,
        armyId: army.id,
        faction: army.faction,
        used: false,
      })),
  );
}

export function drawActivation(battle: Battle, randomSource: RandomSource = systemRandom): {
  battle: Battle;
  token?: ActivationToken;
  log: string;
} {
  if (battle.activeActivation) {
    return {
      battle,
      log: "Najpierw wykorzystaj aktualnie wylosowany token aktywacji.",
    };
  }

  const unusedTokens = getAvailableActivationTokens(battle);
  if (unusedTokens.length === 0) {
    return {
      battle: { ...battle, activeActivation: undefined },
      log: "Wszystkie rozkazy tej tury zostaly wykorzystane. Mozesz zakonczyc ture.",
    };
  }

  const pickedToken = unusedTokens[randomIndex(unusedTokens.length, randomSource)];
  const nextBattle = {
    ...battle,
    activeActivation: pickedToken,
    activationBag: battle.activationBag.map((token) =>
      token.id === pickedToken.id ? { ...token, used: true } : token,
    ),
  };

  return {
    battle: nextBattle,
    token: pickedToken,
    log: `Wylosowano rozkaz dla armii: ${pickedToken.faction}.`,
  };
}

export function getRemainingActivationCount(battle: Battle): number {
  return getAvailableActivationTokens(battle).length + (battle.activeActivation ? 1 : 0);
}

export function getTurnActivationCount(battle: Battle): number {
  return getEligibleActivationTokens(battle).length;
}

export function getArmyActivationCounts(
  battle: Battle,
  armyId: string,
): { remaining: number; total: number } {
  const eligible = getEligibleActivationTokens(battle)
    .filter((token) => token.armyId === armyId);
  return {
    remaining: getAvailableActivationTokens(battle)
      .filter((token) => token.armyId === armyId).length +
      (battle.activeActivation?.armyId === armyId ? 1 : 0),
    total: eligible.length,
  };
}

export function canEndTurn(battle: Battle): boolean {
  return !battle.activeActivation && getRemainingActivationCount(battle) === 0;
}

function getAvailableActivationTokens(battle: Battle): ActivationToken[] {
  const eligible = getEligibleActivationTokens(battle);
  return battle.armies.flatMap((army) => {
    const pendingUnitCount = army.units.filter(isAwaitingActivation).length;
    const activeOrderCount = battle.activeActivation?.armyId === army.id ? 1 : 0;
    const availableUnitCount = Math.max(0, pendingUnitCount - activeOrderCount);
    return eligible
      .filter((token) => token.armyId === army.id && !token.used)
      .slice(0, availableUnitCount);
  });
}

function getEligibleActivationTokens(battle: Battle): ActivationToken[] {
  return battle.armies.flatMap((army) => {
    const tokens = battle.activationBag.filter((token) => token.armyId === army.id);
    const activeToken = battle.activeActivation?.armyId === army.id
      ? tokens.find((token) => token.id === battle.activeActivation?.id)
      : undefined;
    if (!activeToken || tokens.indexOf(activeToken) < MAX_ACTIVATIONS_PER_ARMY) {
      return tokens.slice(0, MAX_ACTIVATIONS_PER_ARMY);
    }
    return [
      ...tokens.slice(0, MAX_ACTIVATIONS_PER_ARMY - 1),
      activeToken,
    ];
  });
}

function isAwaitingActivation(unit: Army["units"][number]): boolean {
  return unit.status !== "Activated" && unit.status !== "Destroyed";
}

export type UnitActivationValidationOptions = {
  allowPinned?: boolean;
};

export function validateUnitActivation(
  battle: Battle,
  unitId: string,
  options: UnitActivationValidationOptions = {},
): string | undefined {
  const token = battle.activeActivation;
  if (!token) {
    return "Najpierw wylosuj token aktywacji.";
  }

  const activeArmy = findArmy(battle, token.armyId);
  if (!activeArmy) {
    return "Aktywna armia nie istnieje w stanie bitwy.";
  }

  const unit = findUnit(battle, unitId);
  if (!unit) {
    return "Nie znaleziono jednostki.";
  }

  if (unit.armyId !== token.armyId) {
    return `Ten token należy do armii ${activeArmy.playerName}. Wybierz jednostkę tej armii.`;
  }

  const pendingAdvanceUnit = activeArmy.units.find(
    (candidate) =>
      candidate.status !== "Destroyed" &&
      candidate.activeEffects?.includes("advance_pending"),
  );
  if (pendingAdvanceUnit && pendingAdvanceUnit.id !== unit.id) {
    return "Najpierw dokończ Advance jednostki, która rozpoczęła ruch.";
  }

  if (unit.status === "Destroyed") {
    return "Zniszczona jednostka nie moze otrzymac rozkazu.";
  }

  if (unit.status === "Pinned" && !options.allowPinned) {
    return "Przygwożdżona jednostka może wykonać wyłącznie Rally.";
  }

  if (unit.status === "Activated") {
    return "Ta jednostka juz wykonala rozkaz w tej turze.";
  }

  return undefined;
}
