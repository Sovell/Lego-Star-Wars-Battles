import { describe, expect, it } from "vitest";
import type { Battle } from "../../types";
import { createBattle } from "../battle-state";
import { createMissionState } from "../scenario/scenario-engine";
import {
  christophsisBreakLineScenario,
  controlTerritoryScenario,
  feluciaAmbushScenario,
  geonosisDroidFoundryScenario,
  survivalTestScenario,
} from "../scenario/scenarios";
import { resolveDefaultBotProfile, runBotTurn } from "./bot-turn-runner";

describe("bot turn runner", () => {
  it("preserves defensive and aggressive defaults based on mission allegiance", () => {
    const battle = createBattle();
    const mission = createMissionState(
      survivalTestScenario,
      battle.armies,
      "army_republic",
    );

    expect(resolveDefaultBotProfile(battle, mission, survivalTestScenario, "army_republic"))
      .toBe("defensive");
    expect(resolveDefaultBotProfile(battle, mission, survivalTestScenario, "army_separatists"))
      .toBe("aggressive");
  });

  it("selects objective-aware profiles from scenario roles", () => {
    const battle = createBattle();
    const cases = [
      [geonosisDroidFoundryScenario, "army_republic", "objective"],
      [christophsisBreakLineScenario, "army_republic", "objective"],
      [feluciaAmbushScenario, "army_republic", "objective"],
      [feluciaAmbushScenario, "army_separatists", "hunter"],
      [controlTerritoryScenario, "army_republic", "objective"],
      [controlTerritoryScenario, "army_separatists", "objective"],
    ] as const;

    for (const [scenario, armyId, expected] of cases) {
      const mission = createMissionState(
        scenario,
        battle.armies,
        battle.armies[scenario.defaultDefenderArmySlot ?? 0].id,
      );
      expect(resolveDefaultBotProfile(battle, mission, scenario, armyId)).toBe(expected);
    }
  });

  it("accepts an explicit profile override without UI strategy wiring", () => {
    const baseBattle = createBattle();
    const battle: Battle = {
      ...baseBattle,
      armies: baseBattle.armies.map((army) => ({
        ...army,
        units: army.units.map((unit, index) =>
          army.id === "army_separatists"
            ? {
                ...unit,
                status: index === 0 ? "Pinned" as const : "Activated" as const,
                suppression: index === 0 ? 2 : 0,
              }
            : unit
        ),
      })),
      activeActivation: {
        id: "bot-token",
        armyId: "army_separatists",
        faction: "Separatists",
        used: true,
      },
    };
    const mission = createMissionState(
      survivalTestScenario,
      battle.armies,
      "army_republic",
    );

    const result = runBotTurn({
      session: { battle, mission },
      scenario: survivalTestScenario,
      armyId: "army_separatists",
      profile: "defensive",
    });

    expect(result.steps[0].decision.action).toMatchObject({
      type: "ApplyOrder",
      order: "Rally",
    });
    expect(result.stopReason).toBe("activation-completed");
  });
});
