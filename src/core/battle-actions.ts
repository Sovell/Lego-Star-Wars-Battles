import type { AttackResult, Battle, OrderType } from "../types";
import { buildActivationBag, drawActivation } from "./rules/activation";
import { resolveAttack } from "./rules/combat";
import { moveUnit } from "./rules/movement";
import { resetUnitForNextTurn } from "./rules/morale";
import { applyOrder } from "./rules/orders";
import { getTemplate } from "./rules/state";
import { applyVictoryState } from "./rules/victory";
import type { DiceRoller } from "./random";

export type BattleAction =
  | { type: "DrawActivation" }
  | { type: "MoveUnit"; unitId: string; targetPosition: { x: number; y: number } }
  | { type: "ApplyOrder"; unitId: string; order: OrderType }
  | { type: "Attack"; attackerId: string; defenderId: string; weaponId: string }
  | { type: "EndTurn" };

export type BattleEvent =
  | { type: "ActivationDrawn"; armyId: string }
  | { type: "UnitMoved"; unitId: string; position: { x: number; y: number } }
  | { type: "OrderApplied"; unitId: string; order: OrderType }
  | { type: "AttackResolved"; result: AttackResult }
  | { type: "UnitDestroyed"; unitId: string }
  | { type: "TurnEnded"; turn: number }
  | { type: "BattleFinished"; winnerArmyId?: string };

export type BattleActionContext = {
  rollD6?: DiceRoller;
};

export type BattleActionResult = {
  battle: Battle;
  events: BattleEvent[];
  log: string;
  attackResult?: AttackResult;
};

export function applyBattleAction(
  battle: Battle,
  action: BattleAction,
  context: BattleActionContext = {},
): BattleActionResult {
  switch (action.type) {
    case "DrawActivation": {
      const result = drawActivation(battle);

      return {
        battle: result.battle,
        events: result.token ? [{ type: "ActivationDrawn", armyId: result.token.armyId }] : [],
        log: result.log,
      };
    }

    case "MoveUnit": {
      const result = moveUnit(battle, action.unitId, action.targetPosition);

      return {
        battle: result.battle,
        events: result.battle === battle ? [] : [{ type: "UnitMoved", unitId: action.unitId, position: action.targetPosition }],
        log: result.log,
      };
    }

    case "ApplyOrder": {
      const result = applyOrder(battle, action.unitId, action.order);

      return {
        battle: result.battle,
        events: result.battle === battle ? [] : [{ type: "OrderApplied", unitId: action.unitId, order: action.order }],
        log: result.log,
      };
    }

    case "Attack": {
      const result = resolveAttack(
        battle,
        action.attackerId,
        action.defenderId,
        action.weaponId,
        context.rollD6,
      );
      const nextBattle = applyVictoryState(result.battle);
      const events: BattleEvent[] = result.result ? [{ type: "AttackResolved", result: result.result }] : [];

      if (result.result?.destroyed) {
        events.push({ type: "UnitDestroyed", unitId: action.defenderId });
      }

      if (nextBattle.phase === "Finished" && battle.phase !== "Finished") {
        events.push({
          type: "BattleFinished",
          winnerArmyId: nextBattle.armies.find((army) =>
            army.units.some((unit) => unit.status !== "Destroyed"),
          )?.id,
        });
      }

      return {
        battle: nextBattle,
        events,
        log: result.log,
        attackResult: result.result,
      };
    }

    case "EndTurn": {
      const armies = battle.armies.map((army) => ({
        ...army,
        units: army.units.map((unit) => resetUnitForNextTurn(unit, getTemplate(unit))),
      }));
      const nextBattle = applyVictoryState({
        ...battle,
        turn: battle.turn + 1,
        armies,
        activationBag: buildActivationBag(armies),
        activeActivation: undefined,
        phase: "Activation",
      });

      return {
        battle: nextBattle,
        events: [{ type: "TurnEnded", turn: nextBattle.turn }],
        log: `Tura ${battle.turn} zakonczona.`,
      };
    }
  }
}
