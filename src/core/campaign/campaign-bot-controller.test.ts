import { describe, expect, it } from "vitest";
import {
  beginCampaignActivationPhase,
  createCampaignState,
  createStandardCampaignPlayers,
  finishCampaignArmyActivation,
  processCampaignEconomy,
  type CampaignState,
} from "./index";
import {
  chooseCampaignBotAction,
  runNextCampaignBotAction,
} from "./campaign-bot-controller";

describe("CampaignBotController", () => {
  it("uses deterministic priorities to establish a base on its controlled headquarters", () => {
    const state = withCredits(fullyControlPlanet(processedCampaign(), "geonosis", "player-2", "Separatists"), "player-2", 100);
    const first = chooseCampaignBotAction(state);
    const second = chooseCampaignBotAction(state);

    expect(first).toEqual(second);
    expect(first).toMatchObject({ kind: "BuildBase", playerId: "player-2", planetId: "geonosis" });
    expect(runNextCampaignBotAction(state)?.state.constructionQueue[0]).toMatchObject({
      ownerPlayerId: "player-2",
      planetId: "geonosis",
      targetLevel: 1,
    });
  });

  it("recruits when a base is available and deploys ready reserves without exceeding limits", () => {
    const baseState = withBotBase(withCredits(
      fullyControlPlanet(processedCampaign(), "geonosis", "player-2", "Separatists"),
      "player-2",
      30,
    ));
    expect(chooseCampaignBotAction(baseState)).toMatchObject({
      kind: "Recruit",
      playerId: "player-2",
    });

    const reserveState = {
      ...withCredits(baseState, "player-2", 0),
      reserves: [{
        id: "bot-reserve-1",
        templateId: "b1_droid_squad",
        ownerPlayerId: "player-2",
        factionId: "Separatists" as const,
        planetId: "geonosis",
        sourceOrderId: "test-order",
      }],
    };
    const step = runNextCampaignBotAction(reserveState);
    expect(step?.action).toMatchObject({ kind: "DeployReserves", playerId: "player-2" });
    expect(step?.state.reserves).toHaveLength(0);
    expect(step?.state.armies.some((army) => army.ownerPlayerId === "player-2" && army.planetId === "geonosis")).toBe(true);
  });

  it("attacks a local enemy command sector and opens a campaign battle when defended", () => {
    let state = beginCampaignActivationPhase(processedCampaign());
    state = finishCampaignArmyActivation(state, "player-1-army-1");
    state = {
      ...state,
      planets: state.planets.map((planet) => ({
        ...planet,
        sectors: planet.sectors.map((sector, index) =>
          planet.planetId === "christophsis" && index === 0
            ? { ...sector, ownerFactionId: "Republic" as const, controllerPlayerId: "player-1" }
            : { ...sector, ownerFactionId: "Separatists" as const, controllerPlayerId: "player-2" }
        ),
      })),
    };

    const step = runNextCampaignBotAction(state);
    expect(step?.action).toMatchObject({ kind: "SectorAssault", playerId: "player-2" });
    expect(step).toMatchObject({ battleRequired: true });
    expect(step?.state.phase).toBe("Battle");
  });

  it("ends activation rather than taking a purposeless move", () => {
    let state = beginCampaignActivationPhase(processedCampaign());
    state = finishCampaignArmyActivation(state, "player-1-army-1");
    state = {
      ...state,
      armies: state.armies.filter(({ id }) => id !== "player-1-army-1"),
      planets: state.planets.map((planet) => ({
        ...planet,
        sectors: planet.sectors.map((sector) => ({
          ...sector,
          ownerFactionId: "Separatists" as const,
          controllerPlayerId: "player-2",
        })),
      })),
    };

    expect(chooseCampaignBotAction(state)).toMatchObject({
      kind: "FinishActivation",
      playerId: "player-2",
    });
  });
});

function processedCampaign(): CampaignState {
  return processCampaignEconomy(createCampaignState({
    id: "campaign-bot-test",
    name: "Campaign Bot Test",
    seed: 2026,
    players: createStandardCampaignPlayers(["Rex", "Grievous"], ["Human", "Bot"]),
  })).state;
}

function fullyControlPlanet(
  state: CampaignState,
  planetId: string,
  playerId: string,
  factionId: "Republic" | "Separatists",
): CampaignState {
  return {
    ...state,
    planets: state.planets.map((planet) => planet.planetId === planetId
      ? {
          ...planet,
          sectors: planet.sectors.map((sector) => ({
            ...sector,
            ownerFactionId: factionId,
            controllerPlayerId: playerId,
          })),
        }
      : planet),
  };
}

function withCredits(state: CampaignState, playerId: string, credits: number): CampaignState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, credits } : player),
  };
}

function withBotBase(state: CampaignState): CampaignState {
  const planet = state.planets.find(({ planetId }) => planetId === "geonosis")!;
  return {
    ...state,
    bases: [{
      id: "base:player-2:geonosis",
      ownerPlayerId: "player-2",
      factionId: "Separatists",
      planetId: "geonosis",
      sectorId: planet.sectors.find(({ role }) => role === "Command")!.sectorId,
      level: 1,
    }],
  };
}
