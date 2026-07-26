import { describe, expect, it } from "vitest";
import { createBattlefieldObject } from "../core/battlefield-objects";
import { starterArmies } from "../data";
import {
  createInitialBattleSnapshot,
  createScenarioDraft,
  prepareComposerDraft,
  restartDraftFromBattle,
  startBattleFromDraft,
} from "./scenario-draft";

describe("scenario draft flow", () => {
  it("starts a battle from a full independent copy of the draft", () => {
    const draft = createScenarioDraft("survival_test", {
      armies: starterArmies,
      board: {
        width: 8,
        height: 8,
        tiles: [{
          x: 2,
          y: 3,
          terrainType: "LightCover",
          defenseBonus: 1,
          attackBonus: 0,
          movementCost: 1,
          blocksLineOfSight: false,
        }],
        objects: [createBattlefieldObject("Generator", { x: 4, y: 4 })],
      },
    });
    draft.armies[0].units[0].currentHp = 1;
    draft.armies[0].units[0].status = "Pinned";

    const battle = startBattleFromDraft(draft);
    draft.board.tiles[0].terrainType = "HeavyCover";
    draft.board.objects![0].currentHp = 1;
    draft.armies[0].units[0].position = null;

    expect(battle.board.tiles[0].terrainType).toBe("LightCover");
    expect(battle.board.objects![0]).toMatchObject({
      currentHp: 8,
      status: "Active",
    });
    expect(battle.armies[0].units[0]).toMatchObject({
      currentHp: 3,
      status: "Ready",
    });
    expect(battle.armies[0].units[0].position).not.toBeNull();
  });

  it("restores initial unit and object health and status on restart", () => {
    const started = startBattleFromDraft(createScenarioDraft("survival_test", {
      armies: starterArmies,
      board: {
        width: 8,
        height: 8,
        tiles: [],
        objects: [createBattlefieldObject("Generator", { x: 5, y: 2 })],
      },
    }));
    const initialSnapshot = createInitialBattleSnapshot(started);
    started.armies[0].units[0].currentHp = 0;
    started.armies[0].units[0].status = "Destroyed";
    started.board.objects![0].currentHp = 0;
    started.board.objects![0].status = "Destroyed";

    const restarted = restartDraftFromBattle(initialSnapshot, "survival_test");

    expect(restarted.armies[0].units[0]).toMatchObject({
      currentHp: 3,
      status: "Ready",
    });
    expect(restarted.board.objects![0]).toMatchObject({
      currentHp: 8,
      status: "Active",
      position: { x: 5, y: 2 },
    });
  });

  it("preserves the map from setup but creates an empty draft from the menu", () => {
    const current = createScenarioDraft("territory_control", {
      board: {
        width: 8,
        height: 8,
        tiles: [],
        objects: [createBattlefieldObject("StrategicPoint", { x: 7, y: 7 })],
      },
    });

    const fromSetup = prepareComposerDraft("setup", current, "survival_test");
    const fromMenu = prepareComposerDraft("menu", current, "survival_test");

    expect(fromSetup.board).toEqual(current.board);
    expect(fromSetup.board).not.toBe(current.board);
    expect(fromMenu.board.objects).toEqual([]);
    expect(fromMenu.scenarioId).toBe("survival_test");
  });
});
