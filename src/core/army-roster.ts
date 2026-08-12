import { unitTemplates } from "../data";
import type { Army, UnitTemplate } from "../types";

const rosterTemplateById = new Map(
  unitTemplates.map((template) => [template.id, template]),
);

export function isHeroTemplate(template: UnitTemplate): boolean {
  return template.category === "hero" || template.keywords.includes("Hero");
}

export function getDuplicateHeroTemplateIds(armies: readonly Army[]): string[] {
  const heroCounts = new Map<string, number>();

  for (const unit of armies.flatMap((army) => army.units)) {
    const template = rosterTemplateById.get(unit.templateId);
    if (!template || !isHeroTemplate(template)) continue;
    heroCounts.set(template.id, (heroCounts.get(template.id) ?? 0) + 1);
  }

  return [...heroCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([templateId]) => templateId)
    .sort();
}

export function hasUniqueHeroes(armies: readonly Army[]): boolean {
  return getDuplicateHeroTemplateIds(armies).length === 0;
}

export function filterDuplicateHeroReinforcements(
  armies: readonly Army[],
  requestedTemplates: readonly UnitTemplate[],
): UnitTemplate[] {
  const usedHeroIds = new Set(
    armies.flatMap((army) => army.units)
      .map((unit) => rosterTemplateById.get(unit.templateId))
      .filter((template): template is UnitTemplate => Boolean(template && isHeroTemplate(template)))
      .map((template) => template.id),
  );

  return requestedTemplates.filter((template) => {
    if (!isHeroTemplate(template)) return true;
    if (usedHeroIds.has(template.id)) return false;
    usedHeroIds.add(template.id);
    return true;
  });
}
