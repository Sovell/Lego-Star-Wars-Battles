import { describe, expect, it } from "vitest";
import { abilities } from "./data";
import {
  localizeAbilityDescription,
  localizeAbilityName,
  localizeFaction,
  localizeOrder,
  localizeScenarioDescription,
  localizeScenarioName,
  localizeTerrainShortLabel,
  localizeThemeName,
  localizeUnitName,
  localizeUnitStatus,
} from "./i18n";

describe("presentation localization", () => {
  it("separates Polish and English scenario content", () => {
    expect(localizeScenarioName("pl", "mandalore-battle-for-sectors", "fallback"))
      .toBe("Mandalore: Bitwa o sektory");
    expect(localizeScenarioName("en", "mandalore-battle-for-sectors", "fallback"))
      .toBe("Mandalore: Battle for the Sectors");
    expect(localizeScenarioDescription("en", "felucia-ambush", "fallback"))
      .toContain("extraction zone");
  });

  it("localizes themes and board terminology", () => {
    expect(localizeThemeName("pl", "mandalore-city", "fallback"))
      .toBe("Mandalore — Sektory Sundari");
    expect(localizeThemeName("en", "mandalore-city", "fallback"))
      .toBe("Mandalore — Sundari Sectors");
    expect(localizeTerrainShortLabel("pl", "Hazardous")).toBe("RYZYKO");
    expect(localizeTerrainShortLabel("en", "Hazardous")).toBe("HAZARD");
  });

  it("localizes domain values without changing their identifiers", () => {
    expect(localizeOrder("pl", "Advance")).toBe("Natarcie");
    expect(localizeOrder("en", "Advance")).toBe("Advance");
    expect(localizeUnitStatus("pl", "Pinned")).toBe("Przygwożdżona");
    expect(localizeUnitStatus("en", "Pinned")).toBe("Pinned");
    expect(localizeFaction("pl", "Republic")).toBe("Republika");
    expect(localizeFaction("en", "Republic")).toBe("Republic");
  });

  it("uses original English unit content and a Polish presentation layer", () => {
    expect(localizeUnitName("pl", "clone_trooper_battalion", "Clone Trooper Battalion"))
      .toBe("Batalion żołnierzy-klonów");
    expect(localizeUnitName("en", "clone_trooper_battalion", "Clone Trooper Battalion"))
      .toBe("Clone Trooper Battalion");

    const forcePush = abilities.find((ability) => ability.id === "force_push")!;
    expect(localizeAbilityName("pl", forcePush)).toBe("Pchnięcie Mocą");
    expect(localizeAbilityName("en", forcePush)).toBe("Force Push");
    expect(localizeAbilityDescription("en", forcePush)).toContain("pushes the target");

    expect(localizeUnitName("pl", "count_dooku", "Count Dooku")).toBe("Hrabia Dooku");
    expect(localizeUnitName("en", "count_dooku", "Count Dooku")).toBe("Count Dooku");
    const forceLightning = abilities.find((ability) => ability.id === "force_lightning")!;
    expect(localizeAbilityName("pl", forceLightning)).toBe("Błyskawice Mocy");
    expect(localizeAbilityDescription("en", forceLightning)).toContain("4 damage");
  });
});
