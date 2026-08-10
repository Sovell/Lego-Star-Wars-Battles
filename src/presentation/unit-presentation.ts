import type { Army, UnitInstance, UnitTemplate } from "../types";

export function getUnitInitials(template: UnitTemplate): string {
  return template.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function getUnitTokenImageUrl(template: UnitTemplate): string | undefined {
  const photoPrefix = "/unit-images/photos/";

  if (!template.imageUrl) return undefined;
  return template.imageUrl.startsWith(photoPrefix)
    ? template.imageUrl.replace(photoPrefix, "/unit-images/tokens/")
    : template.imageUrl;
}

export function getUnitTokenFallbackImageUrl(template: UnitTemplate): string | undefined {
  const photoPrefix = "/unit-images/photos/";
  return template.imageUrl?.startsWith(photoPrefix) ? template.imageUrl : undefined;
}

export function getUnitArmyLabel(unit: UnitInstance, armies: readonly Army[]): string {
  const army = armies.find((candidate) => candidate.id === unit.armyId);
  if (!army) return "Nieznana armia";

  const armyName = army.playerName.trim() || army.faction;
  const teamLabel = army.teamId ? `Team ${army.teamId}` : "bez teamu";
  return `${armyName} · ${teamLabel}`;
}
