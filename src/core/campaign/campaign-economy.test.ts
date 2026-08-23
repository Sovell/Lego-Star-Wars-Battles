import { describe, expect, it } from "vitest";
import {
  BASE_CONSTRUCTION_COST,
  deployCampaignReserves,
  getCampaignArmyPointCost,
  getCampaignIncomeBreakdown,
  getRequiredBaseLevel,
  processCampaignEconomy,
  queueBaseConstruction,
  queueBaseUpgrade,
  queueCampaignRecruitment,
} from "./campaign-economy";
import { createCampaignState, createStandardCampaignPlayers } from "./campaign-state";
import type { CampaignBaseLevel, CampaignState } from "./campaign-types";

describe("campaign economy", () => {
  it("collects sector income once per turn and uses the existing point scale", () => {
    const initial = createCampaign();
    const republicIncome = getCampaignIncomeBreakdown(initial, "player-1");
    const separatistIncome = getCampaignIncomeBreakdown(initial, "player-2");
    const processed = processCampaignEconomy(initial);

    expect(republicIncome.sectorIncome).toBeGreaterThan(0);
    expect(separatistIncome.sectorIncome).toBeGreaterThan(0);
    expect(initial.planets.flatMap(({ sectors }) => sectors)
      .every(({ income }) => income >= 2 && income <= 4)).toBe(true);
    expect(processed.state.players.find(({ id }) => id === "player-1")?.credits)
      .toBe(10 + republicIncome.total);
    expect(processed.state.players.find(({ id }) => id === "player-2")?.credits)
      .toBe(10 + separatistIncome.total);
    expect(() => processCampaignEconomy(processed.state)).toThrow(/already collected/);
    expect(getCampaignArmyPointCost([{ templateId: "clone_trooper_squad" }])).toBe(10);
  });

  it("awards a full-planet bonus and the stipend for each controlled campaign headquarters", () => {
    const state = fullyControlPlanet(
      fullyControlPlanet(createCampaign(), "endor", "player-1", "Republic"),
      "geonosis",
      "player-2",
      "Separatists",
    );
    const republicIncome = getCampaignIncomeBreakdown(state, "player-1");
    const separatistIncome = getCampaignIncomeBreakdown(state, "player-2");

    expect(republicIncome.planetControlBonus).toBeGreaterThanOrEqual(2);
    expect(republicIncome.capitalStipend).toBe(5);
    expect(separatistIncome.capitalStipend).toBe(5);
  });

  it("builds and upgrades one base per fully controlled planet on following turns", () => {
    let state = withCredits(
      processCampaignEconomy(
        fullyControlPlanet(createCampaign(), "felucia", "player-1", "Republic"),
      ).state,
      "player-1",
      200,
    );
    state = queueBaseConstruction(state, "player-1", "felucia");
    expect(state.players[0].credits).toBe(200 - BASE_CONSTRUCTION_COST[1]);
    expect(state.bases).toHaveLength(0);
    expect(state.constructionQueue[0]).toMatchObject({
      targetLevel: 1,
      completesOnTurn: 2,
    });

    state = processNextIncome(state);
    expect(state.bases[0]).toMatchObject({
      id: "base:player-1:felucia",
      level: 1,
      ownerPlayerId: "player-1",
    });
    state = withCredits(state, "player-1", 200);
    state = queueBaseUpgrade(state, "player-1", state.bases[0].id);
    expect(state.players[0].credits).toBe(200 - BASE_CONSTRUCTION_COST[2]);
    state = processNextIncome(state);
    expect(state.bases[0].level).toBe(2);

    state = withCredits(state, "player-1", 200);
    state = queueBaseUpgrade(state, "player-1", state.bases[0].id);
    state = processNextIncome(state);
    expect(state.bases[0].level).toBe(3);
    expect(() => queueBaseUpgrade(state, "player-1", state.bases[0].id))
      .toThrow(/already level 3/);
    expect(() => queueBaseConstruction(state, "player-1", "felucia"))
      .toThrow(/already has a base/);
  });

  it("uses base levels to gate regular, support, hero and heavy recruitment", () => {
    expect(getRequiredBaseLevel("clone_trooper_squad")).toBe(1);
    expect(getRequiredBaseLevel("clone_medic_squad")).toBe(2);
    expect(getRequiredBaseLevel("yoda")).toBe(2);
    expect(getRequiredBaseLevel("commander_cody")).toBe(2);
    expect(getRequiredBaseLevel("at_rt_scout_walker")).toBe(3);

    let state = economyWithBase(1);
    expect(() => queueCampaignRecruitment(
      state,
      "player-1",
      "base:player-1:felucia",
      "clone_medic_squad",
    )).toThrow(/level 2/);
    state = queueCampaignRecruitment(
      state,
      "player-1",
      "base:player-1:felucia",
      "clone_trooper_squad",
      2,
    );
    expect(state.recruitmentQueue[0]).toMatchObject({ cost: 20, completesOnTurn: 2 });
    state = processNextIncome(state);
    expect(state.reserves).toHaveLength(2);
    expect(state.reserves.every(({ templateId }) => templateId === "clone_trooper_squad"))
      .toBe(true);

    state = withBaseLevel(withCredits(state, "player-1", 200), 2);
    state = queueCampaignRecruitment(
      state,
      "player-1",
      "base:player-1:felucia",
      "yoda",
    );
    expect(state.heroes.find(({ heroId }) => heroId === "yoda")?.status).toBe("Queued");
    state = processNextIncome(state);
    expect(state.heroes.find(({ heroId }) => heroId === "yoda")).toMatchObject({
      status: "Reserve",
      ownerPlayerId: "player-1",
      reservePlanetId: "felucia",
    });
  });

  it("turns planetary reserves into a new army and enforces its point limit", () => {
    let state = economyWithBase(2);
    state = {
      ...state,
      reserves: [
        {
          id: "reserve-1",
          templateId: "clone_trooper_squad",
          ownerPlayerId: "player-1",
          factionId: "Republic",
          planetId: "felucia",
          sourceOrderId: "test-order",
        },
        {
          id: "reserve-2",
          templateId: "clone_medic_squad",
          ownerPlayerId: "player-1",
          factionId: "Republic",
          planetId: "felucia",
          sourceOrderId: "test-order",
        },
      ],
      heroes: state.heroes.map((hero) => hero.heroId === "yoda"
        ? {
            ...hero,
            status: "Reserve",
            ownerPlayerId: "player-1",
            reservePlanetId: "felucia",
          }
        : hero),
    };
    state = deployCampaignReserves(state, {
      playerId: "player-1",
      planetId: "felucia",
      unitIds: ["reserve-1", "reserve-2"],
      heroIds: ["yoda"],
      armyName: "Felucia Relief Force",
    });
    const army = state.armies.find(({ id }) => id === "player-1-army-2")!;

    expect(army).toMatchObject({
      name: "Felucia Relief Force",
      planetId: "felucia",
      heroIds: ["yoda"],
    });
    expect(army.units.map(({ id }) => id)).toEqual(["reserve-1", "reserve-2"]);
    expect(state.reserves).toHaveLength(0);
    expect(state.heroes.find(({ heroId }) => heroId === "yoda"))
      .toMatchObject({ status: "Assigned", assignedArmyId: army.id });

    const limited = {
      ...economyWithBase(1),
      rules: { ...state.rules, armyPointLimit: 5 },
      reserves: [{
        id: "too-expensive",
        templateId: "clone_trooper_squad",
        ownerPlayerId: "player-1",
        factionId: "Republic" as const,
        planetId: "felucia",
        sourceOrderId: "test-order",
      }],
    };
    expect(() => deployCampaignReserves(limited, {
      playerId: "player-1",
      planetId: "felucia",
      unitIds: ["too-expensive"],
    })).toThrow(/point limit exceeded/);
  });

  it("rejects construction before full planetary control", () => {
    const processed = processCampaignEconomy(createCampaign()).state;
    expect(() => queueBaseConstruction(processed, "player-1", "felucia"))
      .toThrow(/does not fully control/);
  });
});

function createCampaign(): CampaignState {
  return createCampaignState({
    id: "economy-test",
    name: "Economy Test",
    seed: 2026,
    players: createStandardCampaignPlayers(["Rex", "Grievous"]),
  });
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
    players: state.players.map((player) => player.id === playerId
      ? { ...player, credits }
      : player),
  };
}

function withBaseLevel(state: CampaignState, level: CampaignBaseLevel): CampaignState {
  return {
    ...state,
    bases: state.bases.map((base) => base.id === "base:player-1:felucia"
      ? { ...base, level }
      : base),
  };
}

function economyWithBase(level: CampaignBaseLevel): CampaignState {
  const processed = processCampaignEconomy(
    fullyControlPlanet(createCampaign(), "felucia", "player-1", "Republic"),
  ).state;
  return {
    ...withCredits(processed, "player-1", 500),
    bases: [{
      id: "base:player-1:felucia",
      ownerPlayerId: "player-1",
      factionId: "Republic",
      planetId: "felucia",
      sectorId: processed.planets.find(({ planetId }) => planetId === "felucia")!.sectors
        .find(({ role }) => role === "Command")!.sectorId,
      level,
    }],
  };
}

function processNextIncome(state: CampaignState): CampaignState {
  return processCampaignEconomy({
    ...state,
    turn: state.turn + 1,
    phase: "Income",
  }).state;
}
