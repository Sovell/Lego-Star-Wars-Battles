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
import { resolveBattlefieldProduction } from "./rules/battlefield-production";
import { resolveDelayedBattlefieldEffects } from "./rules/delayed-battlefield-effects";

export type BattleAction =
  | { type: "DrawActivation" }
  | { type: "PassActivation" }
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
  | { type: "ActivationPassed"; armyId: string }
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

    case "PassActivation": {
      const activeActivation = battle.activeActivation;
      if (!activeActivation) {
        return {
          battle,
          events: [],
          log: "Brak aktywnego rozkazu do pominięcia.",
        };
      }

      return {
        battle: { ...battle, activeActivation: undefined },
        events: [{ type: "ActivationPassed", armyId: activeActivation.armyId }],
        log: "Aktywny rozkaz został pominięty.",
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
      const nextBattle = result.battle === battle
        ? battle
        : context.victoryMode === "Scenario"
          ? result.battle
          : applyVictoryState(result.battle);
      const events: BattleEvent[] = result.battle === battle
        ? []
        : [{ type: "AbilityUsed", unitId: action.unitId, abilityId: action.abilityId }];

      const destroyedUnitIds = new Set([
        ...(result.destroyedUnitIds ?? []),
        ...(result.destroyedUnitId ? [result.destroyedUnitId] : []),
      ]);
      for (const destroyedUnitId of destroyedUnitIds) {
        events.push({ type: "UnitDestroyed", unitId: destroyedUnitId });
      }
      for (const army of nextBattle.armies) {
        if (
          army.units.some((unit) => destroyedUnitIds.has(unit.id)) &&
          army.units.every((unit) => unit.status === "Destroyed")
        ) {
          events.push({ type: "ArmyEliminated", armyId: army.id });
        }
      }
      if (nextBattle.phase === "Finished" && battle.phase !== "Finished") {
        events.push({
          type: "BattleFinished",
          winnerArmyId: nextBattle.armies.find((army) =>
            army.units.some((unit) => unit.status !== "Destroyed")
          )?.id,
        });
      }

      return { battle: nextBattle, events, log: result.log };
    }

    case "EndTurn": {
      if (!canEndTurn(battle)) {
        const log = battle.activeActivation
          ? "Nie mozna zakonczyc tury: najpierw wykorzystaj aktywny token."
          : `Nie mozna zakonczyc tury: ${getRemainingActivationCount(battle)} rozkazow pozostalo w puli.`;

        return { battle, events: [], log };
      }

      const armies = battle.armies.map((army) => ({
        ...army,
        units: army.units.map((unit) => {
          const hospital = unit.position
            ? battle.board.objects?.find((object) =>
                object.status === "Active" &&
                (object.healingPerRound ?? 0) > 0 &&
                object.position.x === unit.position?.x &&
                object.position.y === unit.position.y
              )
            : undefined;
          const template = getTemplate(unit);
          const healedUnit = hospital && unit.status !== "Destroyed"
            ? {
                ...unit,
                currentHp: Math.min(template.maxHp, unit.currentHp + (hospital.healingPerRound ?? 0)),
              }
            : unit;
          return resetUnitForNextTurn(healedUnit, template);
        }),
      }));
      const delayedEffects = resolveDelayedBattlefieldEffects(
        { ...battle, armies },
        battle.turn + 1,
      );
      const production = resolveBattlefieldProduction(delayedEffects.battle, battle.turn + 1);
      const advancedBattle: Battle = {
        ...production.battle,
        turn: battle.turn + 1,
        activationBag: buildActivationBag(production.battle.armies),
        activeActivation: undefined,
        phase: "Activation",
      };
      const nextBattle = context.victoryMode === "Scenario"
        ? advancedBattle
        : applyVictoryState(advancedBattle);
      const endTurnEvents: BattleEvent[] = delayedEffects.destroyedUnitIds.map((unitId) => ({
        type: "UnitDestroyed" as const,
        unitId,
      }));
      for (const army of nextBattle.armies) {
        if (
          army.units.some((unit) => delayedEffects.destroyedUnitIds.includes(unit.id)) &&
          army.units.every((unit) => unit.status === "Destroyed")
        ) {
          endTurnEvents.push({ type: "ArmyEliminated", armyId: army.id });
        }
      }
      endTurnEvents.push({ type: "TurnEnded", turn: nextBattle.turn });
      if (nextBattle.phase === "Finished" && battle.phase !== "Finished") {
        endTurnEvents.push({
          type: "BattleFinished",
          winnerArmyId: nextBattle.armies.find((army) =>
            army.units.some((unit) => unit.status !== "Destroyed")
          )?.id,
        });
      }

      return {
        battle: nextBattle,
        events: endTurnEvents,
        log: [
          `Tura ${battle.turn} zakonczona.`,
          delayedEffects.resolvedStrikeCount > 0
            ? `Wsparcie ogniowe uderzyło w ${delayedEffects.resolvedStrikeCount} oznaczony obszar.`
            : "",
          production.spawnedUnitIds.length > 0
            ? `Fabryki droidów wystawiły ${production.spawnedUnitIds.length} oddział(y) B1.`
            : "",
        ].filter(Boolean).join(" "),
      };
    }
  }
}
