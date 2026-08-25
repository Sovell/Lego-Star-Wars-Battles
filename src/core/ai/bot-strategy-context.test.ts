import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { createBattlefieldObject } from "../battlefield-objects";
import { createBattle } from "../battle-state";
import {
  christophsisBreakLineScenario,
  controlTerritoryScenario,
  feluciaAmbushScenario,
  protectGeneratorScenario,
  survivalTestScenario,
} from "../scenario/scenarios";
import { createTerrainTile } from "../terrain-definitions";
import { aggressiveBotDoctrine, defensiveBotDoctrine } from "./bot-doctrine";
import { createBotStrategyContext } from "./bot-strategy-context";

describe("bot strategy context", () => {
  it("does not target territory owned by an allied army", () => {
    let battle = createBattle();
    battle = {
      ...battle,
      activeActivation: {
        id: "bot-token",
        armyId: "army_separatists",
        faction: "Separatists",
        used: true,
      },
      armies: battle.armies.map((army) => ({
        ...army,
        teamId: 1,
        units: army.units.map((unit, index) => ({
          ...unit,
          status: army.id === "army_separatists" && index === 0
            ? "Ready"
            : "Activated",
        })),
      })),
      board: {
        ...battle.board,
        objects: [
          createBattlefieldObject("StrategicPoint", { x: 1, y: 1 }),
          createBattlefieldObject("StrategicPoint", { x: 5, y: 3 }),
        ],
      },
    };
    battle = patchUnit(battle, "sep_unit_1", { position: { x: 7, y: 4 } });

    const context = createBotStrategyContext(
      battle,
      controlTerritoryScenario,
      "army_separatists",
      aggressiveBotDoctrine,
      {
        scenarioId: controlTerritoryScenario.id,
        status: "Active",
        roundsCompleted: 0,
        territoryOwners: { "1,1": "army_republic" },
      },
    );

    expect(context?.movementTarget).toEqual({ x: 5, y: 3 });
    expect(context?.objectiveName).toBe("terytorium");
  });

  it("targets an enemy reachable by a real route instead of one behind a wall", () => {
    let battle = createBattle();
    battle = {
      ...battle,
      board: {
        width: 5,
        height: 5,
        objects: [],
        tiles: Array.from(
          { length: 5 },
          (_, y) => createTerrainTile("Impassable", 2, y),
        ),
      },
      activeActivation: {
        id: "bot-token",
        armyId: "army_separatists",
        faction: "Separatists",
        used: true,
      },
      armies: battle.armies.map((army) => ({
        ...army,
        units: army.units.map((unit) => ({
          ...unit,
          position: null,
          status: "Activated" as const,
        })),
      })),
    };
    battle = patchUnit(battle, "sep_unit_1", {
      position: { x: 0, y: 2 },
      status: "Ready",
    });
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 4, y: 2 } });
    battle = patchUnit(battle, "rep_unit_2", { position: { x: 1, y: 4 } });

    const context = createBotStrategyContext(
      battle,
      survivalTestScenario,
      "army_separatists",
      aggressiveBotDoctrine,
    );

    expect(context?.movementTarget).toEqual({ x: 1, y: 4 });
  });

  it("gives a defender an enemy fallback when the scenario has no fixed objective", () => {
    let battle = readyRepublicContextBattle();
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 0, y: 2 } });
    battle = patchUnit(battle, "sep_unit_1", { position: { x: 6, y: 2 } });

    const context = createBotStrategyContext(
      battle,
      survivalTestScenario,
      "army_republic",
      defensiveBotDoctrine,
    );

    expect(context?.movementTarget).toEqual({ x: 6, y: 2 });
  });

  it("intercepts an enemy with line of fire on a protected objective", () => {
    let battle = readyRepublicContextBattle();
    battle = patchUnit(battle, "rep_unit_1", { position: { x: 0, y: 2 } });
    battle = patchUnit(battle, "sep_unit_1", { position: { x: 4, y: 2 } });
    battle = {
      ...battle,
      board: {
        ...battle.board,
        objects: [createBattlefieldObject("Generator", { x: 3, y: 2 })],
      },
    };

    const context = createBotStrategyContext(
      battle,
      protectGeneratorScenario,
      "army_republic",
      defensiveBotDoctrine,
    );

    expect(context?.movementTarget).toEqual({ x: 4, y: 2 });
  });

  it("targets the current progressive-control stage", () => {
    let battle = readyRepublicContextBattle();
    const objectives = [2, 4, 6].map((x) =>
      createBattlefieldObject("StrategicPoint", { x, y: 3 })
    );
    battle = {
      ...battle,
      board: { ...battle.board, objects: objectives },
    };

    const context = createBotStrategyContext(
      battle,
      christophsisBreakLineScenario,
      "army_republic",
      aggressiveBotDoctrine,
      {
        scenarioId: christophsisBreakLineScenario.id,
        status: "Active",
        roundsCompleted: 0,
        objectiveStage: 1,
      },
    );

    expect(context?.movementTarget).toEqual({ x: 4, y: 3 });
    expect(context?.objectiveName).toBe(objectives[1].name);
  });

  it("targets the extraction zone for the extracting team", () => {
    const battle = readyRepublicContextBattle();

    const context = createBotStrategyContext(
      battle,
      feluciaAmbushScenario,
      "army_republic",
      defensiveBotDoctrine,
      {
        scenarioId: feluciaAmbushScenario.id,
        status: "Active",
        roundsCompleted: 3,
      },
    );

    expect(context?.movementTarget?.x).toBe(7);
    expect(context?.objectiveName).toBe("strefa ewakuacji");
  });
});

function readyRepublicContextBattle(): Battle {
  const battle = createBattle();
  return {
    ...battle,
    activeActivation: {
      id: "republic-token",
      armyId: "army_republic",
      faction: "Republic",
      used: true,
    },
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => ({
        ...unit,
        status: unit.id === "rep_unit_1" ? "Ready" as const : "Activated" as const,
      })),
    })),
  };
}

function patchUnit(
  battle: Battle,
  unitId: string,
  patch: Partial<UnitInstance>,
): Battle {
  return {
    ...battle,
    armies: battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => unit.id === unitId ? { ...unit, ...patch } : unit),
    })),
  };
}
