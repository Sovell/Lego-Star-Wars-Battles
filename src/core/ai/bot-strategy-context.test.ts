import { describe, expect, it } from "vitest";
import type { Battle, UnitInstance } from "../../types";
import { createBattlefieldObject } from "../battlefield-objects";
import { createBattle } from "../battle-state";
import { controlTerritoryScenario } from "../scenario/scenarios";
import { aggressiveBotDoctrine } from "./bot-doctrine";
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
});

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
