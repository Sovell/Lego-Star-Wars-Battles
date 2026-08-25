import { describe, expect, it } from "vitest";
import { hasUniqueHeroes, isHeroTemplate } from "../army-roster";
import { unitTemplates } from "../../data";
import { narrativeMissions } from "./scenarios";
import {
  buildScenarioPresetArmies,
  getScenarioArmyPreset,
} from "./scenario-army-presets";

describe("scenario army presets", () => {
  it.each(narrativeMissions.map(({ id }) => [id]))(
    "%s provides a valid unique-hero roster",
    (scenarioId) => {
      const preset = getScenarioArmyPreset(scenarioId);
      expect(preset).toBeDefined();

      const armies = buildScenarioPresetArmies(preset!, "pl");
      expect(armies).toHaveLength(2);
      expect(armies.every((army) => army.units.length > 0)).toBe(true);
      expect(hasUniqueHeroes(armies)).toBe(true);
      expect(armies.every((army) => army.units.filter((unit) => {
        const template = unitTemplates.find(({ id }) => id === unit.templateId);
        return template && isHeroTemplate(template);
      }).length <= 2)).toBe(true);
      expect(armies.flatMap((army) => army.units).every((unit) => unit.position === null))
        .toBe(true);
    },
  );
});
