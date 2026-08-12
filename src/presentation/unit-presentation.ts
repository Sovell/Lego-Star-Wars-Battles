import type { Army, UnitInstance, UnitTemplate } from "../types";
import type { Language } from "../i18n";

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

export function getUnitArmyLabel(
  unit: UnitInstance,
  armies: readonly Army[],
  language: Language = "pl",
): string {
  const army = armies.find((candidate) => candidate.id === unit.armyId);
  if (!army) return language === "pl" ? "Nieznana armia" : "Unknown army";

  const armyName = army.playerName.trim() || army.faction;
  const teamLabel = army.teamId
    ? `${language === "pl" ? "Drużyna" : "Team"} ${army.teamId}`
    : language === "pl" ? "bez drużyny" : "no team";
  return `${armyName} · ${teamLabel}`;
}
