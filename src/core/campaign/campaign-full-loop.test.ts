import { describe, expect, it } from "vitest";
import {
  attackCampaignSector,
  beginCampaignActivationPhase,
  createCampaignBattlePackage,
  createCampaignState,
  createStandardCampaignPlayers,
  finishCampaignArmyActivation,
  processCampaignEconomy,
  resolveCampaignBattle,
  startNextCampaignTurn,
  type CampaignState,
} from "./index";

describe("campaign full loop", () => {
  it("runs income, a defended-sector battle, resolution, and the next turn", () => {
    const initial = createCampaign();
    const targetId = initial.planets.find(({ planetId }) => planetId === "felucia")!
      .sectors.find(({ ownerFactionId }) => ownerFactionId === "Neutral")!.sectorId;
    let state = processCampaignEconomy(withDefendedFeluciaSector(initial, targetId)).state;
    state = beginCampaignActivationPhase(state);
    const target = sector(state, "felucia", targetId);
    const conflict = attackCampaignSector(state, "player-1-army-1", target.sectorId).state;

    const battle = createCampaignBattlePackage(conflict);
    state = resolveCampaignBattle(conflict, battle, battle.battle, "Republic").state;
    expect(state.pendingConflict).toBeUndefined();
    expect(sector(state, "felucia", target.sectorId)).toMatchObject({
      ownerFactionId: "Republic",
      controllerPlayerId: "player-1",
    });

    state = finishCampaignArmyActivation(state, "player-2-army-1");
    expect(state.phase).toBe("Resolution");
    state = startNextCampaignTurn(state);

    expect(state).toMatchObject({ turn: 2, phase: "Income", incomeCollectedForTurn: 1 });
    expect(state.history?.slice(-3).map(({ type }) => type)).toEqual([
      "ArmyActivationFinished",
      "TurnEnded",
      "TurnStarted",
    ]);
  });

  it("finishes the campaign when the battle loop captures an enemy headquarters", () => {
    let state = processCampaignEconomy(withGeonosisHeadquartersReady(createCampaign())).state;
    state = beginCampaignActivationPhase(state);
    const command = state.planets.find(({ planetId }) => planetId === "geonosis")!
      .sectors.find(({ role }) => role === "Command")!;
    const conflict = attackCampaignSector(state, "player-1-army-1", command.sectorId).state;
    const battle = createCampaignBattlePackage(conflict);
    state = resolveCampaignBattle(conflict, battle, battle.battle, "Republic").state;

    expect(state).toMatchObject({ phase: "Finished", winnerFactionId: "Republic" });
    expect(state.history?.at(-1)).toMatchObject({
      type: "BattleResolved",
      winnerFactionId: "Republic",
      planetId: "geonosis",
      sectorId: command.sectorId,
    });
  });
});

function createCampaign(): CampaignState {
  return createCampaignState({
    id: "full-loop-test",
    name: "Full Loop Test",
    seed: 20260823,
    players: createStandardCampaignPlayers(["Rex", "Grievous"]),
  });
}

function withDefendedFeluciaSector(state: CampaignState, targetId: string): CampaignState {
  return {
    ...state,
    planets: state.planets.map((planet) => planet.planetId !== "felucia" ? planet : {
      ...planet,
      sectors: planet.sectors.map((candidate) => candidate.sectorId !== targetId ? candidate : {
        ...candidate, ownerFactionId: "Separatists", controllerPlayerId: "player-2",
      }),
    }),
    armies: state.armies.map((army) => army.id !== "player-2-army-1" ? army : {
      ...army, planetId: "felucia", sectorId: targetId,
    }),
  };
}

function withGeonosisHeadquartersReady(state: CampaignState): CampaignState {
  const geonosis = state.planets.find(({ planetId }) => planetId === "geonosis")!;
  const command = geonosis.sectors.find(({ role }) => role === "Command")!;
  return {
    ...state,
    planets: state.planets.map((planet) => planet.planetId !== "geonosis" ? planet : {
      ...planet,
      sectors: planet.sectors.map((candidate) => candidate.sectorId === command.sectorId
        ? { ...candidate, ownerFactionId: "Separatists", controllerPlayerId: "player-2" }
        : { ...candidate, ownerFactionId: "Republic", controllerPlayerId: "player-1" }),
    }),
    armies: state.armies.map((army) => army.id === "player-1-army-1"
      ? { ...army, planetId: "geonosis", sectorId: geonosis.sectors.find(({ role }) => role === "Landing")!.sectorId }
      : army.id === "player-2-army-1"
        ? { ...army, planetId: "geonosis", sectorId: command.sectorId }
        : army),
  };
}

function sector(state: CampaignState, planetId: string, sectorId: string) {
  const found = state.planets.find(({ planetId: candidateId }) => candidateId === planetId)
    ?.sectors.find(({ sectorId: candidateId }) => candidateId === sectorId);
  if (!found) throw new Error(`Missing ${planetId}/${sectorId} in test campaign.`);
  return found;
}
