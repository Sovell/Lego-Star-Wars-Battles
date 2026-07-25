import type { ActivationToken, Army, Battle } from "../../types";
import { randomIndex, systemRandom, type RandomSource } from "../random";
import { findArmy, findUnit } from "./state";

export function buildActivationBag(armies: Army[]): ActivationToken[] {
  return armies.flatMap((army) =>
    army.units
      .filter((unit) => unit.status !== "Destroyed")
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
      log: "Wszystkie zywe jednostki wykonaly juz rozkaz. Mozesz zakonczyc ture.",
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
    log: `Wylosowano aktywacje: ${pickedToken.faction}.`,
  };
}

export function getRemainingActivationCount(battle: Battle): number {
  return battle.armies.reduce(
    (total, army) => total + army.units.filter(isAwaitingActivation).length,
    0,
  );
}

export function canEndTurn(battle: Battle): boolean {
  return !battle.activeActivation && getRemainingActivationCount(battle) === 0;
}

function getAvailableActivationTokens(battle: Battle): ActivationToken[] {
  const armiesWithPendingUnits = new Set(
    battle.armies
      .filter((army) => army.units.some(isAwaitingActivation))
      .map((army) => army.id),
  );

  return battle.activationBag.filter(
    (token) => !token.used && armiesWithPendingUnits.has(token.armyId),
  );
}

function isAwaitingActivation(unit: Army["units"][number]): boolean {
  return unit.status !== "Activated" && unit.status !== "Destroyed";
}

export function validateUnitActivation(battle: Battle, unitId: string): string | undefined {
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
    return `Ten token nalezy do armii ${activeArmy.playerName}. Wybierz jednostke tej armii.`;
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

  if (unit.status === "Activated") {
    return "Ta jednostka juz wykonala rozkaz w tej turze.";
  }

  return undefined;
}
