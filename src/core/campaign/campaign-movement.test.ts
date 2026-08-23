import { describe, expect, it } from "vitest";
import { processCampaignEconomy } from "./campaign-economy";
import {
  beginCampaignActivationPhase,
  finishCampaignArmyActivation,
  getLegalCampaignRoutes,
  moveCampaignArmy,
  startNextCampaignTurn,
} from "./campaign-movement";
import { createCampaignState, createStandardCampaignPlayers } from "./campaign-state";
import type { CampaignState } from "./campaign-types";

describe("campaign hyperlane movement", () => {
  it("finds every planet reachable within three movement points", () => {
    const state = beginCampaignActivationPhase(createCampaign());
    const routes = getLegalCampaignRoutes(state, "player-1-army-1");

    expect(routes.find(({ destinationPlanetId }) => destinationPlanetId === "hoth"))
      .toMatchObject({ movementCost: 1, planetIds: ["felucia", "hoth"] });
    expect(routes.find(({ destinationPlanetId }) => destinationPlanetId === "mandalore"))
      .toMatchObject({ movementCost: 2 });
    expect(routes.find(({ destinationPlanetId }) => destinationPlanetId === "christophsis"))
      .toMatchObject({ movementCost: 3 });
    expect(routes.find(({ destinationPlanetId }) => destinationPlanetId === "ryloth"))
      .toMatchObject({
        movementCost: 3,
        planetIds: ["felucia", "endor", "mandalore", "ryloth"],
      });
    expect(getLegalCampaignRoutes(state, "player-1-army-1", [{
      id: "too-expensive",
      fromPlanetId: "felucia",
      toPlanetId: "hoth",
      movementCost: 4,
    }])).toEqual([]);
  });

  it("allows entering an enemy army's planet but never searches beyond it", () => {
    const state = beginCampaignActivationPhase(withSeparatistArmyOn(createCampaign(), "mustafar"));
    const routes = getLegalCampaignRoutes(state, "player-1-army-1");

    expect(routes.find(({ destinationPlanetId }) => destinationPlanetId === "mustafar"))
      .toMatchObject({ movementCost: 1, encounter: "EnemyArmy" });
    expect(routes.some(({ destinationPlanetId }) => destinationPlanetId === "geonosis"))
      .toBe(false);
    expect(routes.some(({ destinationPlanetId }) => destinationPlanetId === "tatooine"))
      .toBe(false);
  });

  it("treats an undefended enemy base as a route blocker", () => {
    const campaign = createCampaign();
    const mustafarSector = campaign.planets
      .find(({ planetId }) => planetId === "mustafar")!.sectors[0];
    const state = beginCampaignActivationPhase({
      ...campaign,
      armies: campaign.armies.filter(({ factionId }) => factionId === "Republic"),
      bases: [{
        id: "mustafar-base",
        ownerPlayerId: "player-2",
        factionId: "Separatists",
        planetId: "mustafar",
        sectorId: mustafarSector.sectorId,
        level: 1,
      }],
    });

    expect(getLegalCampaignRoutes(state, "player-1-army-1")
      .find(({ destinationPlanetId }) => destinationPlanetId === "mustafar"))
      .toMatchObject({ encounter: "EnemyBase" });
    expect(getLegalCampaignRoutes(state, "player-1-army-1")
      .some(({ destinationPlanetId }) => destinationPlanetId === "geonosis"))
      .toBe(false);
  });

  it("reports a combined encounter when an army protects its base", () => {
    const campaign = withSeparatistArmyOn(createCampaign(), "mustafar");
    const mustafarSector = campaign.planets
      .find(({ planetId }) => planetId === "mustafar")!.sectors[0];
    const state = beginCampaignActivationPhase({
      ...campaign,
      bases: [{
        id: "mustafar-base",
        ownerPlayerId: "player-2",
        factionId: "Separatists",
        planetId: "mustafar",
        sectorId: mustafarSector.sectorId,
        level: 2,
      }],
    });

    expect(getLegalCampaignRoutes(state, "player-1-army-1")
      .find(({ destinationPlanetId }) => destinationPlanetId === "mustafar")?.encounter)
      .toBe("EnemyArmyAndBase");
  });

  it("allows allied commanders to share a route without blocking one another", () => {
    const state = beginCampaignActivationPhase(createCampaign([
      "Rex",
      "Cody",
      "Grievous",
      "Dooku",
    ]));
    const route = getLegalCampaignRoutes(state, "player-1-army-1")
      .find(({ destinationPlanetId }) => destinationPlanetId === "mandalore");

    expect(state.armies.find(({ ownerPlayerId }) => ownerPlayerId === "player-2")?.planetId)
      .toBe("endor");
    expect(route).toMatchObject({
      planetIds: ["felucia", "endor", "mandalore"],
      movementCost: 2,
    });
    expect(route?.encounter).toBeUndefined();
  });

  it("moves immutably, spends one activation and hands initiative to the opponent", () => {
    const initial = beginCampaignActivationPhase(createCampaign());
    const { state, movement } = moveCampaignArmy(initial, "player-1-army-1", "hoth");

    expect(initial.armies[0].planetId).toBe("felucia");
    expect(state.armies[0]).toMatchObject({
      planetId: "hoth",
      activatedThisTurn: true,
      movementPointsRemaining: 2,
    });
    expect(movement.route.planetIds).toEqual(["felucia", "hoth"]);
    expect(state.activePlayerId).toBe("player-2");
    expect(() => moveCampaignArmy(state, "player-1-army-1", "endor"))
      .toThrow(/already activated|active player/);
  });

  it("alternates all four commanders and resets armies on the next turn", () => {
    let state = beginCampaignActivationPhase(createCampaign([
      "Rex",
      "Cody",
      "Grievous",
      "Dooku",
    ]));

    expect(state.initiativeOrder).toEqual(["player-1", "player-3", "player-2", "player-4"]);
    for (const playerId of state.initiativeOrder) {
      expect(state.activePlayerId).toBe(playerId);
      state = finishCampaignArmyActivation(state, `${playerId}-army-1`);
    }
    expect(state.phase).toBe("Resolution");
    expect(state.activePlayerId).toBeUndefined();
    expect(state.armies.every(({ activatedThisTurn }) => activatedThisTurn)).toBe(true);

    state = startNextCampaignTurn(state);
    expect(state.turn).toBe(2);
    expect(state.phase).toBe("Income");
    expect(state.history?.slice(-2).map(({ type }) => type)).toEqual([
      "TurnEnded",
      "TurnStarted",
    ]);
    expect(state.armies.every((army) =>
      !army.activatedThisTurn && army.movementPointsRemaining === 3
    )).toBe(true);
    expect(() => beginCampaignActivationPhase(state)).toThrow(/Process campaign economy/);
    state = beginCampaignActivationPhase(processCampaignEconomy(state).state);
    expect(state.phase).toBe("Activation");
    expect(state.activePlayerId).toBe("player-1");
  });

  it("rejects invalid initiative orders and movement outside the activation phase", () => {
    const campaign = createCampaign();
    expect(() => moveCampaignArmy(campaign, "player-1-army-1", "hoth"))
      .toThrow(/Income/);
    expect(() => beginCampaignActivationPhase(campaign, ["player-1", "player-1"]))
      .toThrow(/every campaign player exactly once/);
  });
});

function createCampaign(names: readonly string[] = ["Rex", "Grievous"]): CampaignState {
  return processCampaignEconomy(createCampaignState({
    id: "movement-test",
    name: "Movement Test",
    seed: 2026,
    players: createStandardCampaignPlayers(names),
  })).state;
}

function withSeparatistArmyOn(state: CampaignState, planetId: string): CampaignState {
  const sectorId = state.planets.find((planet) => planet.planetId === planetId)!.sectors[0].sectorId;
  return {
    ...state,
    armies: state.armies.map((army) => army.factionId === "Separatists"
      ? { ...army, planetId, sectorId }
      : army),
  };
}
