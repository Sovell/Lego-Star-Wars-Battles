import type { ActivationToken, Army, Battle } from "../../types";
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

export function drawActivation(battle: Battle): {
  battle: Battle;
  token?: ActivationToken;
  log: string;
} {
  const unusedTokens = battle.activationBag.filter((token) => !token.used);
  if (unusedTokens.length === 0) {
    return { battle: { ...battle, activeActivation: undefined }, log: "Worek aktywacji jest pusty." };
  }

  const pickedToken = unusedTokens[Math.floor(Math.random() * unusedTokens.length)];
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

  if (unit.status === "Destroyed") {
    return "Zniszczona jednostka nie moze otrzymac rozkazu.";
  }

  if (unit.status === "Activated") {
    return "Ta jednostka juz wykonala rozkaz w tej turze.";
  }

  return undefined;
}
