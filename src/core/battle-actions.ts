import type {
  AttackResult,
  Battle,
  BattlefieldObjectType,
  ObjectAttackResult,
  OrderType,
} from "../types";
import {
  buildActivationBag,
  canEndTurn,
  drawActivation,
  getRemainingActivationCount,
} from "./rules/activation";
import { resolveAttack } from "./rules/combat";
import { resolveObjectAttack } from "./rules/object-combat";
import { advanceUnit, moveUnit } from "./rules/movement";
import { deployUnit } from "./rules/deployment";
import { resetUnitForNextTurn } from "./rules/morale";
import { applyOrder } from "./rules/orders";
import { getTemplate } from "./rules/state";
import { applyVictoryState } from "./rules/victory";
import { createD6Roller, type DiceRoller, type RandomSource } from "./random";
import { useActiveAbility } from "./rules/active-abilities";
import type { ScenarioDefinition } from "./scenario/scenario-types";

export type BattleAction =
  | { type: "DrawActivation" }
  | { type: "MoveUnit"; unitId: string; targetPosition: { x: number; y: number } }
  | { type: "AdvanceUnit"; unitId: string; targetPosition: { x: number; y: number } }
  | { type: "DeployUnit"; unitId: string; targetPosition: { x: number; y: number } }
  | { type: "ApplyOrder"; unitId: string; order: OrderType }
  | { type: "Attack"; attackerId: string; defenderId: string; weaponId: string }
  | { type: "AttackObject"; attackerId: string; objectId: string; weaponId: string }
  | {
      type: "UseAbility";
      unitId: string;
      abilityId: string;
      targetUnitId?: string;
      targetPosition?: { x: number; y: number };
    }
  | { type: "EndTurn" };

export type BattleEvent =
  | { type: "ActivationDrawn"; armyId: string }
  | { type: "UnitMoved"; unitId: string; position: { x: number; y: number } }
  | { type: "UnitDeployed"; unitId: string; position: { x: number; y: number } }
  | { type: "OrderApplied"; unitId: string; order: OrderType }
  | { type: "AbilityUsed"; unitId: string; abilityId: string }
  | { type: "AttackResolved"; result: AttackResult }
  | { type: "UnitDestroyed"; unitId: string }
  | { type: "UnitRetreated"; unitId: string; position: { x: number; y: number } }
  | { type: "ArmyEliminated"; armyId: string }
  | { type: "BattlefieldObjectDamaged"; objectId: string; damage: number }
  | {
      type: "BattlefieldObjectDestroyed";
      objectId: string;
      objectType: BattlefieldObjectType;
    }
  | { type: "TurnEnded"; turn: number }
  | { type: "BattleFinished"; winnerArmyId?: string };

export type BattleActionContext = {
  randomSource?: RandomSource;
  rollD6?: DiceRoller;
  victoryMode?: "Elimination" | "Scenario";
  scenario?: ScenarioDefinition;
};

export type BattleActionResult = {
  battle: Battle;
  events: BattleEvent[];
  log: string;
  attackResult?: AttackResult;
  objectAttackResult?: ObjectAttackResult;
};

export function applyBattleAction(
  battle: Battle,
  action: BattleAction,
  context: BattleActionContext = {},
): BattleActionResult {
  switch (action.type) {
    case "DrawActivation": {
      const result = drawActivation(battle, context.randomSource);

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

    case "AdvanceUnit": {
      const result = advanceUnit(battle, action.unitId, action.targetPosition);

      return {
        battle: result.battle,
        events: result.battle === battle
          ? []
          : [{ type: "UnitMoved", unitId: action.unitId, position: action.targetPosition }],
        log: result.log,
      };
    }

    case "DeployUnit": {
      if (!context.scenario) {
        return {
          battle,
          events: [],
          log: "Brak definicji scenariusza wymaganej do wejścia z rezerwy.",
        };
      }
      const result = deployUnit(
        battle,
        context.scenario,
        action.unitId,
        action.targetPosition,
      );

      return {
        battle: result.battle,
        events: result.battle === battle
          ? []
          : [{
              type: "UnitDeployed",
              unitId: action.unitId,
              position: action.targetPosition,
            }],
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
      const defenderArmyId = battle.armies
        .flatMap((army) => army.units)
        .find((unit) => unit.id === action.defenderId)?.armyId;
      const rollD6 = context.rollD6 ??
        (context.randomSource ? createD6Roller(context.randomSource) : undefined);
      const result = resolveAttack(
        battle,
        action.attackerId,
        action.defenderId,
        action.weaponId,
        rollD6,
      );
      const nextBattle = context.victoryMode === "Scenario"
        ? result.battle
        : applyVictoryState(result.battle);
      const events: BattleEvent[] = result.result ? [{ type: "AttackResolved", result: result.result }] : [];

      if (result.result?.destroyed) {
        events.push({ type: "UnitDestroyed", unitId: action.defenderId });

        const defenderArmy = nextBattle.armies.find((army) => army.id === defenderArmyId);
        if (defenderArmy && defenderArmy.units.every((unit) => unit.status === "Destroyed")) {
          events.push({ type: "ArmyEliminated", armyId: defenderArmy.id });
        }
      }

      if (result.result?.retreatedTo) {
        events.push({
          type: "UnitRetreated",
          unitId: action.defenderId,
          position: result.result.retreatedTo,
        });
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

    case "AttackObject": {
      const rollD6 = context.rollD6 ??
        (context.randomSource ? createD6Roller(context.randomSource) : undefined);
      const result = resolveObjectAttack(
        battle,
        action.attackerId,
        action.objectId,
        action.weaponId,
        rollD6,
      );
      const events: BattleEvent[] = [];

      if (result.result) {
        events.push({
          type: "BattlefieldObjectDamaged",
          objectId: result.result.objectId,
          damage: result.result.damage,
        });
        if (result.result.destroyed) {
          events.push({
            type: "BattlefieldObjectDestroyed",
            objectId: result.result.objectId,
            objectType: result.result.objectType,
          });
        }
      }

      return {
        battle: result.battle,
        events,
        log: result.log,
        objectAttackResult: result.result,
      };
    }

    case "UseAbility": {
      const rollD6 = context.rollD6 ??
        (context.randomSource ? createD6Roller(context.randomSource) : undefined);
      const result = useActiveAbility(
        battle,
        action,
        rollD6 ?? (() => Math.floor(Math.random() * 6) + 1),
      );
      const events: BattleEvent[] = result.battle === battle
        ? []
        : [{ type: "AbilityUsed", unitId: action.unitId, abilityId: action.abilityId }];

      if (result.destroyedUnitId) {
        events.push({ type: "UnitDestroyed", unitId: result.destroyedUnitId });
        const destroyedArmy = result.battle.armies.find((army) =>
          army.units.some((unit) => unit.id === result.destroyedUnitId),
        );
        if (destroyedArmy?.units.every((unit) => unit.status === "Destroyed")) {
          events.push({ type: "ArmyEliminated", armyId: destroyedArmy.id });
        }
      }

      return { battle: result.battle, events, log: result.log };
    }

    case "EndTurn": {
      if (!canEndTurn(battle)) {
        const log = battle.activeActivation
          ? "Nie mozna zakonczyc tury: najpierw wykorzystaj aktywny token."
          : `Nie mozna zakonczyc tury: ${getRemainingActivationCount(battle)} jednostek nadal czeka na rozkaz.`;

        return { battle, events: [], log };
      }

      const armies = battle.armies.map((army) => ({
        ...army,
        units: army.units.map((unit) => resetUnitForNextTurn(unit, getTemplate(unit))),
      }));
      const advancedBattle: Battle = {
        ...battle,
        turn: battle.turn + 1,
        armies,
        activationBag: buildActivationBag(armies),
        activeActivation: undefined,
        phase: "Activation",
      };
      const nextBattle = context.victoryMode === "Scenario"
        ? advancedBattle
        : applyVictoryState(advancedBattle);

      return {
        battle: nextBattle,
        events: [{ type: "TurnEnded", turn: nextBattle.turn }],
        log: `Tura ${battle.turn} zakonczona.`,
      };
    }
  }
}
