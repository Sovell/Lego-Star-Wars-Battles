import { describe, expect, it } from "vitest";
import { processCampaignEconomy } from "../../core/campaign";
import { createCampaignState, createStandardCampaignPlayers } from "../../core/campaign/campaign-state";
import type { CampaignState } from "../../core/campaign/campaign-types";
import {
  getCampaignEconomyDetails,
  getCampaignReserveDeploymentPreview,
} from "./campaign-economy-model";

describe("campaign economy model", () => {
  it("only opens management after income and exposes fully controlled base sites", () => {
    const initial = fullyControlFelucia(createCampaign());
    expect(getCampaignEconomyDetails(initial, "player-1").economyOpen).toBe(false);

    const details = getCampaignEconomyDetails(processCampaignEconomy(initial).state, "player-1");
    expect(details.economyOpen).toBe(true);
    expect(details.controlledPlanets.map(({ planetId }) => planetId)).toContain("felucia");
  });

  it("derives recruitment levels and unavailable heroes from campaign state", () => {
    const details = getCampaignEconomyDetails(processCampaignEconomy(createCampaign()).state, "player-1");
    expect(details.recruitmentOptions.find(({ templateId }) => templateId === "clone_trooper_squad"))
      .toMatchObject({ requiredBaseLevel: 1 });
    expect(details.recruitmentOptions.find(({ templateId }) => templateId === "clone_medic_squad"))
      .toMatchObject({ requiredBaseLevel: 2 });
    expect(details.recruitmentOptions.find(({ templateId }) => templateId === "at_rt_scout_walker"))
      .toMatchObject({ requiredBaseLevel: 3 });
    expect(details.recruitmentOptions.find(({ templateId }) => templateId === "yoda"))
      .toMatchObject({ isHero: true, heroAvailable: true });
  });

  it("previews reserve deployment against the army points and hero limits", () => {
    const state = {
      ...processCampaignEconomy(fullyControlFelucia(createCampaign())).state,
      bases: [{
        id: "base:player-1:felucia",
        ownerPlayerId: "player-1",
        factionId: "Republic" as const,
        planetId: "felucia",
        sectorId: "felucia-command",
        level: 1 as const,
      }],
      rules: { ...createCampaign().rules, armyPointLimit: 5 },
      reserves: [{
        id: "reserve-1",
        templateId: "clone_trooper_squad",
        ownerPlayerId: "player-1",
        factionId: "Republic" as const,
        planetId: "felucia",
        sourceOrderId: "test-order",
      }],
    };
    const preview = getCampaignReserveDeploymentPreview(
      state,
      "player-1",
      "felucia",
      ["reserve-1"],
      [],
    );

    expect(preview).toMatchObject({ pointCost: 10, pointLimit: 5, canDeploy: false });
  });
});

function createCampaign(): CampaignState {
  return createCampaignState({
    id: "economy-view-test",
    name: "Economy View Test",
    seed: 2026,
    players: createStandardCampaignPlayers(["Rex", "Grievous"]),
  });
}

function fullyControlFelucia(state: CampaignState): CampaignState {
  return {
    ...state,
    planets: state.planets.map((planet) => planet.planetId === "felucia"
      ? {
          ...planet,
          sectors: planet.sectors.map((sector) => ({
            ...sector,
            ownerFactionId: "Republic" as const,
            controllerPlayerId: "player-1",
          })),
        }
      : planet),
  };
}
