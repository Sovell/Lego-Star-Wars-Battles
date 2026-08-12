import { describe, expect, it } from "vitest";
import { unitTemplates } from "../data";
import { getUnitPresentationProfile } from "./unit-profile";

describe("unit presentation profiles", () => {
  it("provides localized lore and a distinctive theme for named characters", () => {
    const dooku = getUnitPresentationProfile("count_dooku", "Separatists");
    const mace = getUnitPresentationProfile("mace_windu", "Republic");

    expect(dooku.lore?.subtitle.pl).toBe("Upadły Jedi");
    expect(dooku.lore?.subtitle.en).toBe("Fallen Jedi");
    expect(dooku.theme.accent).not.toBe(mace.theme.accent);
  });

  it("contains both language variants whenever lore is present", () => {
    for (const template of unitTemplates) {
      const lore = getUnitPresentationProfile(template.id, template.faction).lore;
      if (!lore) continue;

      expect(lore.subtitle.pl).toBeTruthy();
      expect(lore.subtitle.en).toBeTruthy();
      expect(lore.summary.pl).toBeTruthy();
      expect(lore.summary.en).toBeTruthy();
      if (lore.details) {
        expect(lore.details.pl).toBeTruthy();
        expect(lore.details.en).toBeTruthy();
      }
    }
  });

  it("returns valid card colors for every unit template", () => {
    for (const template of unitTemplates) {
      const { theme } = getUnitPresentationProfile(template.id, template.faction);

      expect(theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.accentSoft).toContain("rgba(");
      expect(theme.accentStrong).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("falls back to faction colors for templates without a dedicated profile", () => {
    const republic = getUnitPresentationProfile("unknown_republic_unit", "Republic");
    const separatists = getUnitPresentationProfile("unknown_separatist_unit", "Separatists");

    expect(republic.theme.accent).not.toBe(separatists.theme.accent);
    expect(republic.lore).toBeUndefined();
    expect(separatists.lore).toBeUndefined();
  });
});
