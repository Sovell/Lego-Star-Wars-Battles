import { describe, expect, it } from "vitest";
import { unitTemplates } from "../../data";
import { createCampaignState, createStandardCampaignPlayers } from "./campaign-state";

describe("campaign core", () => {
  it("creates a deterministic 1v1 campaign with three sectors per planet", () => {
    const input = {
      id: "clone-wars",
      name: "The Clone Wars",
      seed: 2026,
      players: createStandardCampaignPlayers(["Rex", "Grievous"]),
    };

    const campaign = createCampaignState(input);

    expect(createCampaignState(input)).toEqual(campaign);
    expect(campaign.turn).toBe(1);
    expect(campaign.phase).toBe("Income");
    expect(campaign.players.map(({ factionId }) => factionId)).toEqual([
      "Republic",
      "Separatists",
    ]);
    expect(campaign.planets).toHaveLength(9);
    expect(campaign.planets.every(({ sectors }) => sectors.length === 3)).toBe(true);
    expect(campaign.armies).toHaveLength(2);
  });

  it("supports two commanders per faction without splitting a sector between players", () => {
    const campaign = createCampaignState({
      id: "four-commanders",
      name: "Four Commanders",
      seed: 7,
      players: createStandardCampaignPlayers(["Rex", "Cody", "Grievous", "Dooku"]),
    });

    expect(campaign.players).toHaveLength(4);
    expect(campaign.armies).toHaveLength(4);
    expect(new Set(campaign.armies.map(({ ownerPlayerId }) => ownerPlayerId)).size).toBe(4);
    for (const planet of campaign.planets) {
      const controllersByFaction = new Map<string, Set<string>>();
      for (const sector of planet.sectors) {
        if (!sector.controllerPlayerId || sector.ownerFactionId === "Neutral") continue;
        const controllers = controllersByFaction.get(sector.ownerFactionId) ?? new Set<string>();
        controllers.add(sector.controllerPlayerId);
        controllersByFaction.set(sector.ownerFactionId, controllers);
      }
      for (const controllers of controllersByFaction.values()) expect(controllers.size).toBe(1);
    }
  });

  it("keeps campaign units independent from transient battle state", () => {
    const campaign = createCampaignState({
      id: "clean-units",
      name: "Clean Units",
      seed: 11,
      players: createStandardCampaignPlayers(["Republic", "Separatists"]),
    });

    const unit = campaign.armies[0].units[0] as unknown as Record<string, unknown>;
    expect(unit).toEqual({
      id: "player-1-army-1-unit-1",
      templateId: "clone_trooper_squad",
    });
    expect(unit.currentHp).toBeUndefined();
    expect(unit.position).toBeUndefined();
    expect(unit.suppression).toBeUndefined();
  });

  it("initializes every named hero with three total lives and no army assignment", () => {
    const campaign = createCampaignState({
      id: "heroes",
      name: "Heroes",
      seed: 12,
      players: createStandardCampaignPlayers(["Republic", "Separatists"]),
    });
    const heroTemplates = unitTemplates.filter((template) =>
      template.category === "hero" || template.keywords.includes("Hero")
    );

    expect(campaign.heroes).toHaveLength(heroTemplates.length);
    expect(campaign.heroes.every((hero) =>
      hero.livesRemaining === 3 &&
      hero.level === 1 &&
      hero.xp === 0 &&
      hero.availableFromTurn === 1 &&
      hero.assignedArmyId === undefined
    )).toBe(true);
  });

  it("rejects unsupported or asymmetric player configurations", () => {
    expect(() => createStandardCampaignPlayers(["Solo"])).toThrow(/2 or 4/);
    expect(() => createCampaignState({
      id: "bad",
      name: "Bad Setup",
      seed: 1,
      players: [
        { id: "r1", name: "R1", factionId: "Republic" },
        { id: "r2", name: "R2", factionId: "Republic" },
      ],
    })).toThrow(/same number/);
  });
});
