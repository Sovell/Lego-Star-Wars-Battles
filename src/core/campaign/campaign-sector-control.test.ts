import { describe, expect, it } from "vitest";
import { processCampaignEconomy } from "./campaign-economy";
import { beginCampaignActivationPhase } from "./campaign-movement";
import {
  attackCampaignSector,
  getCampaignPlanetController,
  getLegalCampaignSectorTargets,
  invadeCampaignPlanet,
  resolveCampaignConflict,
} from "./campaign-sector-control";
import { createCampaignState, createStandardCampaignPlayers } from "./campaign-state";
import type { CampaignState } from "./campaign-types";

describe("campaign sector control", () => {
  it("captures an undefended sector without starting a tactical battle", () => {
    const initial = beginCampaignActivationPhase(createCampaign());
    const felucia = getPlanet(initial, "felucia");
    const neutralSector = felucia.sectors.find(({ ownerFactionId }) => ownerFactionId === "Neutral")!;

    const { state, action } = attackCampaignSector(
      initial,
      "player-1-army-1",
      neutralSector.sectorId,
    );

    expect(action.type).toBe("CapturedWithoutBattle");
    expect(state.phase).toBe("Activation");
    expect(state.activePlayerId).toBe("player-2");
    expect(getSector(state, "felucia", neutralSector.sectorId)).toMatchObject({
      ownerFactionId: "Republic",
      controllerPlayerId: "player-1",
      fortificationLevel: 0,
    });
    expect(getCampaignPlanetController(state, "felucia")).toBe("Republic");
  });

  it("creates a conflict for a defended sector and retreats the defeated defender", () => {
    const campaign = createCampaign();
    const target = getPlanet(campaign, "felucia").sectors[2];
    const prepared = beginCampaignActivationPhase({
      ...campaign,
      planets: campaign.planets.map((planet) => planet.planetId === "felucia"
        ? {
            ...planet,
            sectors: planet.sectors.map((sector) => sector.sectorId === target.sectorId
              ? { ...sector, ownerFactionId: "Separatists", controllerPlayerId: "player-2" }
              : sector),
          }
        : planet),
      armies: campaign.armies.map((army) => army.factionId === "Separatists"
        ? { ...army, planetId: "felucia", sectorId: target.sectorId }
        : army),
    });

    const attack = attackCampaignSector(prepared, "player-1-army-1", target.sectorId);
    expect(attack.action.type).toBe("BattleRequired");
    expect(attack.state.phase).toBe("Battle");
    expect(attack.state.pendingConflict).toMatchObject({
      kind: "SectorAssault",
      defenderArmyId: "player-2-army-1",
    });

    const resolution = resolveCampaignConflict(attack.state, {
      conflictId: attack.state.pendingConflict!.id,
      winnerFactionId: "Republic",
    });
    expect(resolution.capturedSector).toBe(true);
    expect(resolution.retreatedArmyIds).toContain("player-2-army-1");
    expect(getSector(resolution.state, "felucia", target.sectorId).ownerFactionId)
      .toBe("Republic");
    expect(resolution.state.armies.find(({ id }) => id === "player-2-army-1")?.planetId)
      .toBe("mustafar");
    expect(resolution.state.phase).toBe("Activation");
    expect(resolution.state.activePlayerId).toBe("player-2");
  });

  it("retreats a failed invasion to its origin when no bridgehead exists", () => {
    const prepared = beginCampaignActivationPhase(withSeparatistArmyOn(
      createCampaign(),
      "mustafar",
    ));
    const invasion = invadeCampaignPlanet(prepared, "player-1-army-1", "mustafar");

    expect(invasion.action.type).toBe("BattleRequired");
    expect(invasion.state.armies.find(({ id }) => id === "player-1-army-1")?.planetId)
      .toBe("mustafar");
    const resolution = resolveCampaignConflict(invasion.state, {
      conflictId: invasion.state.pendingConflict!.id,
      winnerFactionId: "Separatists",
    });

    expect(resolution.capturedSector).toBe(false);
    expect(resolution.retreatedArmyIds).toContain("player-1-army-1");
    expect(resolution.state.armies.find(({ id }) => id === "player-1-army-1"))
      .toMatchObject({ planetId: "felucia", sectorId: "kway-teow" });
  });

  it("keeps a defeated attacker on a planet where it already owns a bridgehead", () => {
    const campaign = withSeparatistArmyOn(createCampaign(), "mustafar");
    const bridgehead = getPlanet(campaign, "mustafar").sectors[2];
    const prepared = beginCampaignActivationPhase({
      ...campaign,
      planets: campaign.planets.map((planet) => planet.planetId === "mustafar"
        ? {
            ...planet,
            sectors: planet.sectors.map((sector) => sector.sectorId === bridgehead.sectorId
              ? { ...sector, ownerFactionId: "Republic", controllerPlayerId: "player-1" }
              : sector),
          }
        : planet),
    });
    const invasion = invadeCampaignPlanet(prepared, "player-1-army-1", "mustafar");
    const resolution = resolveCampaignConflict(invasion.state, {
      conflictId: invasion.state.pendingConflict!.id,
      winnerFactionId: "Separatists",
    });

    expect(resolution.state.armies.find(({ id }) => id === "player-1-army-1"))
      .toMatchObject({ planetId: "mustafar", sectorId: bridgehead.sectorId });
  });

  it("locks a capital command sector until the other two sectors are captured", () => {
    const campaign = withCapital(createCampaign(), "geonosis", "Separatists");
    const geonosis = getPlanet(campaign, "geonosis");
    const command = geonosis.sectors.find(({ role }) => role === "Command")!;
    const landing = geonosis.sectors.find(({ role }) => role === "Landing")!;
    const infrastructure = geonosis.sectors.find(({ role }) => role === "Infrastructure")!;
    let state = beginCampaignActivationPhase({
      ...campaign,
      planets: campaign.planets.map((planet) => planet.planetId === "geonosis"
        ? {
            ...planet,
            sectors: planet.sectors.map((sector) => sector.sectorId === landing.sectorId
              ? { ...sector, ownerFactionId: "Republic", controllerPlayerId: "player-1" }
              : sector),
          }
        : planet),
      armies: campaign.armies.map((army) => army.id === "player-1-army-1"
        ? { ...army, planetId: "geonosis", sectorId: landing.sectorId }
        : army),
    });

    expect(getLegalCampaignSectorTargets(state, "player-1-army-1").map(({ sectorId }) => sectorId))
      .not.toContain(command.sectorId);
    expect(() => attackCampaignSector(state, "player-1-army-1", command.sectorId))
      .toThrow(/locked/);

    state = {
      ...state,
      planets: state.planets.map((planet) => planet.planetId === "geonosis"
        ? {
            ...planet,
            sectors: planet.sectors.map((sector) => sector.sectorId === infrastructure.sectorId
              ? { ...sector, ownerFactionId: "Republic", controllerPlayerId: "player-1" }
              : sector),
          }
        : planet),
    };
    const finalAttack = attackCampaignSector(state, "player-1-army-1", command.sectorId);
    expect(finalAttack.action.type).toBe("BattleRequired");
    const resolution = resolveCampaignConflict(finalAttack.state, {
      conflictId: finalAttack.state.pendingConflict!.id,
      winnerFactionId: "Republic",
    });

    expect(resolution.state.phase).toBe("Finished");
    expect(resolution.state.winnerFactionId).toBe("Republic");
    expect(getCampaignPlanetController(resolution.state, "geonosis")).toBe("Republic");
  });

  it("destroys a captured base without ending the campaign on an ordinary planet", () => {
    const campaign = createCampaign();
    const target = getPlanet(campaign, "felucia").sectors[2];
    const prepared = beginCampaignActivationPhase({
      ...campaign,
      planets: campaign.planets.map((planet) => planet.planetId === "felucia"
        ? {
            ...planet,
            sectors: planet.sectors.map((sector) => sector.sectorId === target.sectorId
              ? { ...sector, ownerFactionId: "Separatists", controllerPlayerId: "player-2" }
              : sector),
          }
        : planet),
      bases: [{
        id: "felucia-base",
        ownerPlayerId: "player-2",
        factionId: "Separatists",
        planetId: "felucia",
        sectorId: target.sectorId,
        level: 1,
      }],
    });
    const attack = attackCampaignSector(prepared, "player-1-army-1", target.sectorId);
    expect(attack.state.pendingConflict?.defenderBaseId).toBe("felucia-base");
    const resolution = resolveCampaignConflict(attack.state, {
      conflictId: attack.state.pendingConflict!.id,
      winnerFactionId: "Republic",
    });

    expect(resolution.state.bases).toHaveLength(0);
    expect(getCampaignPlanetController(resolution.state, "felucia")).toBe("Republic");
    expect(resolution.state.phase).toBe("Activation");
    expect(resolution.state.winnerFactionId).toBeUndefined();
  });

  it("reports neutral and contested planets without granting full control", () => {
    const campaign = createCampaign();
    expect(getCampaignPlanetController(campaign, "felucia")).toBe("Contested");
    expect(getCampaignPlanetController(campaign, "hoth")).toBe("Neutral");
  });
});

function createCampaign(): CampaignState {
  return processCampaignEconomy(createCampaignState({
    id: "sector-test",
    name: "Sector Test",
    seed: 2026,
    players: createStandardCampaignPlayers(["Rex", "Grievous"]),
  })).state;
}

function getPlanet(state: CampaignState, planetId: string) {
  return state.planets.find((planet) => planet.planetId === planetId)!;
}

function getSector(state: CampaignState, planetId: string, sectorId: string) {
  return getPlanet(state, planetId).sectors.find((sector) => sector.sectorId === sectorId)!;
}

function withSeparatistArmyOn(state: CampaignState, planetId: string): CampaignState {
  const sectorId = getPlanet(state, planetId).sectors[0].sectorId;
  return {
    ...state,
    armies: state.armies.map((army) => army.factionId === "Separatists"
      ? { ...army, planetId, sectorId }
      : army),
  };
}

function withCapital(
  state: CampaignState,
  planetId: string,
  capitalOf: "Republic" | "Separatists",
): CampaignState {
  return {
    ...state,
    planets: state.planets.map((planet) => planet.planetId === planetId
      ? { ...planet, capitalOf }
      : planet),
  };
}
