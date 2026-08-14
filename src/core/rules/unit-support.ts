import type { Battle, UnitInstance } from "../../types";
import { areArmiesAllied } from "../army-relations";
import { distance } from "./geometry";
import { findUnit, replaceUnit } from "./state";

export type SupportMode = "attack" | "defense";

export function linkUnitSupport(
  battle: Battle,
  providerId: string,
  receiverId: string,
  mode: SupportMode,
): { battle: Battle; error?: string } {
  const normalizedBattle = clearBrokenSupportLinks(battle);
  const provider = findUnit(normalizedBattle, providerId);
  const receiver = findUnit(normalizedBattle, receiverId);
  if (!provider || !receiver || provider.id === receiver.id) {
    return { battle, error: "Wybierz inną sojuszniczą jednostkę." };
  }
  if (!provider.position || !receiver.position || distance(provider.position, receiver.position) > 1) {
    return { battle, error: "Jednostki muszą stać na sąsiednich polach." };
  }
  if (!areArmiesAllied(battle, provider.armyId, receiver.armyId)) {
    return { battle, error: "Wsparcia można udzielić tylko sojusznikowi." };
  }
  if (provider.status === "Destroyed" || receiver.status === "Destroyed") {
    return { battle, error: "Zniszczona jednostka nie może tworzyć pary wsparcia." };
  }
  if (provider.supportLink || receiver.supportLink) {
    return { battle, error: "Każda jednostka może należeć tylko do jednej dwuosobowej pary." };
  }

  const withProvider = replaceUnit(normalizedBattle, {
    ...provider,
    supportLink: { partnerUnitId: receiver.id, role: "provider", mode },
  });
  return {
    battle: replaceUnit(withProvider, {
      ...receiver,
      supportLink: { partnerUnitId: provider.id, role: "receiver", mode },
    }),
  };
}

export function getActiveSupportProvider(
  battle: Battle,
  receiver: UnitInstance,
  mode: SupportMode,
): UnitInstance | undefined {
  if (receiver.supportLink?.role !== "receiver" || receiver.supportLink.mode !== mode) {
    return undefined;
  }
  const provider = findUnit(battle, receiver.supportLink.partnerUnitId);
  if (
    !provider?.position ||
    !receiver.position ||
    provider.status === "Destroyed" ||
    provider.supportLink?.role !== "provider" ||
    provider.supportLink.partnerUnitId !== receiver.id ||
    provider.supportLink.mode !== mode ||
    distance(provider.position, receiver.position) > 1
  ) {
    return undefined;
  }
  return provider;
}

export function clearBrokenSupportLinks(battle: Battle): Battle {
  let next = battle;
  for (const unit of battle.armies.flatMap((army) => army.units)) {
    if (!unit.supportLink) continue;
    const partner = findUnit(battle, unit.supportLink.partnerUnitId);
    const isBroken =
      !partner ||
      unit.status === "Destroyed" ||
      partner.status === "Destroyed" ||
      !unit.position ||
      !partner.position ||
      distance(unit.position, partner.position) > 1 ||
      partner.supportLink?.partnerUnitId !== unit.id;
    if (isBroken) {
      next = replaceUnit(next, { ...unit, supportLink: undefined });
    }
  }
  return next;
}

export function unlinkUnitSupport(battle: Battle, unitId: string): Battle {
  const unit = findUnit(battle, unitId);
  if (!unit?.supportLink) return battle;
  const partner = findUnit(battle, unit.supportLink.partnerUnitId);
  let next = replaceUnit(battle, { ...unit, supportLink: undefined });
  if (partner?.supportLink?.partnerUnitId === unit.id) {
    next = replaceUnit(next, { ...partner, supportLink: undefined });
  }
  return next;
}
