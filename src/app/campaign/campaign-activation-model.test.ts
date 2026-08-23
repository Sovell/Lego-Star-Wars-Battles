import { describe, expect, it } from "vitest";
import {
  beginCampaignActivationPhase,
  createCampaignState,
  createStandardCampaignPlayers,
  processCampaignEconomy,
  startNextCampaignTurn,
  type CampaignState,
} from "../../core/campaign";
import {
  applyCampaignActivationAction,
  getCampaignActivationDetails,
  getCampaignDestinationAction,
} from "./campaign-activation-model";

describe("campaign activation screen model", () => {
  it("only exposes the active commander's unactivated armies", () => {
    const state = activationState();
    const details = getCampaignActivationDetails(state, "player-2-army-1");

    expect(details.selectableArmies.map(({ id }) => id)).toEqual(["player-1-army-1"]);
    expect(details.selectedArmy).toBeUndefined();
    expect(details.legalRoutes).toEqual([]);
  });

  it("exposes routes with their hyperlane path and marks hostile destinations as invasions", () => {
    const state = activationState(withSeparatistArmyOn(createCampaign(), "mustafar"));
    const details = getCampaignActivationDetails(state, "player-1-army-1");
    const mustafar = details.legalRoutes.find(({ destinationPlanetId }) => destinationPlanetId === "mustafar")!;

    expect(mustafar).toMatchObject({
      planetIds: ["felucia", "mustafar"],
      movementCost: 1,
      encounter: "EnemyArmy",
    });
    expect(getCampaignDestinationAction(state, "player-1-army-1", "mustafar"))
      .toEqual({ kind: "Invasion", armyId: "player-1-army-1", destinationPlanetId: "mustafar" });
    expect(() => getCampaignDestinationAction(state, "player-1-army-1", "coruscant"))
      .toThrow(/not reachable/);
  });

  it("moves to a friendly destination and hands initiative to the next commander", () => {
    const state = activationState();
    expect(getCampaignDestinationAction(state, "player-1-army-1", "hoth"))
      .toEqual({ kind: "Move", armyId: "player-1-army-1", destinationPlanetId: "hoth" });
    const result = applyCampaignActivationAction(state, {
      kind: "Move",
      armyId: "player-1-army-1",
      destinationPlanetId: "hoth",
    });

    expect(result.outcome).toBe("Moved");
    expect(result.state.armies[0]).toMatchObject({ planetId: "hoth", activatedThisTurn: true });
    expect(result.state.activePlayerId).toBe("player-2");
  });

  it("captures an undefended current-planet sector without opening a battle", () => {
    const state = activationState();
    const target = getCampaignActivationDetails(state, "player-1-army-1").legalSectorTargets[0]!;
    const result = applyCampaignActivationAction(state, {
      kind: "SectorAssault",
      armyId: "player-1-army-1",
      sectorId: target.sectorId,
    });

    expect(result.outcome).toBe("CapturedWithoutBattle");
    expect(result.state.phase).toBe("Activation");
    expect(result.state.activePlayerId).toBe("player-2");
  });

  it("can finish an activation without movement and enters Resolution after every army acts", () => {
    let state = activationState();
    state = applyCampaignActivationAction(state, {
      kind: "Finish",
      armyId: "player-1-army-1",
    }).state;
    state = applyCampaignActivationAction(state, {
      kind: "Finish",
      armyId: "player-2-army-1",
    }).state;

    expect(state.phase).toBe("Resolution");
    expect(startNextCampaignTurn(state)).toMatchObject({ turn: 2, phase: "Income" });
  });
});

function createCampaign(): CampaignState {
  return processCampaignEconomy(createCampaignState({
    id: "activation-screen-test",
    name: "Activation screen test",
    seed: 2026,
    players: createStandardCampaignPlayers(["Rex", "Grievous"]),
  })).state;
}

function activationState(state: CampaignState = createCampaign()): CampaignState {
  return beginCampaignActivationPhase(state);
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
