import { describe, expect, it } from "vitest";
import { createCampaignState, createStandardCampaignPlayers } from "../../core/campaign";
import { galacticPlanets, lockedGalacticLocations } from "../../core/galactic-conquest/galaxy";
import { buildCampaignMapNodes, getCampaignOverview, getSectorName } from "./campaign-screen-model";

describe("campaign screen model", () => {
  const campaign = createCampaignState({
    id: "screen-test",
    name: "Screen Test",
    seed: 77,
    players: createStandardCampaignPlayers(["Rex", "Grievous"]),
  });

  it("combines playable and locked locations without inventing strategic state", () => {
    const nodes = buildCampaignMapNodes(campaign);

    expect(nodes).toHaveLength(galacticPlanets.length + lockedGalacticLocations.length);
    expect(nodes.find(({ id }) => id === "felucia")).toMatchObject({
      playable: true,
      controller: "Contested",
      sectorControllers: ["Republic", "Republic", "Neutral"],
      armyCount: 1,
    });
    expect(nodes.find(({ id }) => id === "coruscant")).toMatchObject({
      playable: false,
      controller: "Locked",
      sectorControllers: [],
    });
  });

  it("creates stable overview counters and resolves generated sector names", () => {
    const overview = getCampaignOverview(campaign);
    const feluciaSector = campaign.planets.find(({ planetId }) => planetId === "felucia")!.sectors[0];

    expect(overview).toMatchObject({
      playablePlanets: 9,
      totalSectors: 27,
      activeArmies: 2,
    });
    expect(getSectorName("felucia", feluciaSector.sectorId)).not.toBe(feluciaSector.sectorId);
  });
});
