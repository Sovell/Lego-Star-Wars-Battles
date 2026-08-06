import type { Battle, BattlefieldObject, UnitInstance, WeaponProfile } from "../../types";
import type { BattleAction } from "../battle-actions";
import {
  getLegalUnitActions,
  type LegalAttackAction,
  type LegalUnitAction,
} from "../legal-actions";
import { distance, type GridPosition } from "../rules/geometry";
import { getTemplate } from "../rules/state";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import type { BotDecision } from "./bot-controller";

/** Selects a legal action that prioritizes holding the scenario objective. */
export function chooseDefenderBotAction(
  battle: Battle,
  scenario: ScenarioDefinition,
  defenderArmyId: string,
  mission?: MissionState,
): BotDecision | undefined {
  if (battle.activeActivation?.armyId !== defenderArmyId) return undefined;

  const availableDefenders = battle.armies
    .find((army) => army.id === defenderArmyId)
    ?.units.filter((unit) => unit.status !== "Activated" && unit.status !== "Destroyed") ?? [];
  const pendingAdvanceUnit = availableDefenders.find((unit) =>
    unit.activeEffects?.includes("advance_pending")
  );
  const defenders = pendingAdvanceUnit ? [pendingAdvanceUnit] : availableDefenders;
  if (defenders.length === 0) return undefined;

  const legalActions = defenders.flatMap((unit) =>
    getLegalUnitActions(battle, scenario, unit.id)
  );
  const attack = chooseBestUnitAttack(battle, legalActions);
  if (attack) {
    return {
      action: attack.action,
      reason: `${getTemplate(attack.attacker).name} odpiera zagrożenie: ${getTemplate(attack.defender).name}.`,
    };
  }

  if (pendingAdvanceUnit) {
    const finishAdvance = legalActions.find(
      (action): action is Extract<BattleAction, { type: "ApplyOrder" }> =>
        action.type === "ApplyOrder" &&
        action.unitId === pendingAdvanceUnit.id &&
        action.order === "Advance",
    );
    return finishAdvance
      ? {
          action: finishAdvance,
          reason: `${getTemplate(pendingAdvanceUnit).name} kończy manewr obronny Advance.`,
        }
      : undefined;
  }

  const objective = getDefensiveObjective(battle, scenario, mission, defenderArmyId);
  const deployment = chooseReserveDeployment(battle, defenders, legalActions, objective?.position);
  if (deployment) {
    return {
      action: deployment.action,
      reason: `${getTemplate(deployment.unit).name} wchodzi z rezerwy, aby wzmocnić obronę.`,
    };
  }

  if (objective) {
    const movement = chooseDefensiveMovement(battle, defenders, legalActions, objective.position);
    if (movement) {
      return {
        action: movement.action,
        reason: `${getTemplate(movement.unit).name} zajmuje pozycję przy celu: ${objective.name}.`,
      };
    }
  }

  const legalOrders = legalActions.filter(
    (action): action is Extract<BattleAction, { type: "ApplyOrder" }> =>
      action.type === "ApplyOrder",
  );
  const rally = legalOrders
    .filter((action) => action.order === "Rally")
    .sort((left, right) =>
      getSuppression(defenders, right.unitId) - getSuppression(defenders, left.unitId)
    )[0];
  const order = rally ?? legalOrders.find((action) => action.order === "Overwatch");
  const unit = order
    ? defenders.find((candidate) => candidate.id === order.unitId)
    : undefined;
  if (!order || !unit) return undefined;

  return {
    action: order,
    reason: order.order === "Rally"
      ? `${getTemplate(unit).name} porządkuje linię obrony.`
      : `${getTemplate(unit).name} utrzymuje pozycję w trybie Overwatch.`,
  };
}

function chooseBestUnitAttack(
  battle: Battle,
  legalActions: LegalUnitAction[],
): {
  action: Extract<BattleAction, { type: "Attack" }>;
  attacker: UnitInstance;
  defender: UnitInstance;
  score: number;
} | undefined {
  const units = battle.armies.flatMap((army) => army.units);
  return legalActions
    .filter((action): action is Extract<LegalAttackAction, { type: "Attack" }> =>
      action.type === "Attack"
    )
    .flatMap((action) => {
      const attacker = units.find((unit) => unit.id === action.attackerId);
      const defender = units.find((unit) => unit.id === action.defenderId);
      const weapon = attacker
        ? getTemplate(attacker).weapons.find((candidate) => candidate.id === action.weaponId)
        : undefined;
      return attacker && defender && weapon
        ? [{
            action,
            attacker,
            defender,
            score: scoreAttack(weapon, defender),
          }]
        : [];
    })
    .sort((left, right) => right.score - left.score)[0];
}

function chooseDefensiveMovement(
  battle: Battle,
  defenders: UnitInstance[],
  legalActions: LegalUnitAction[],
  target: GridPosition,
): { action: Extract<BattleAction, { type: "AdvanceUnit" }>; unit: UnitInstance } | undefined {
  return defenders
    .filter((unit) => unit.position)
    .flatMap((unit) => {
      const currentDistance = distance(unit.position!, target);
      return legalActions
        .filter((action): action is Extract<BattleAction, { type: "AdvanceUnit" }> =>
          action.type === "AdvanceUnit" && action.unitId === unit.id
        )
        .filter((action) => distance(action.targetPosition, target) < currentDistance)
        .map((action) => ({ action, unit }));
    })
    .sort((left, right) =>
      distance(left.action.targetPosition, target) - distance(right.action.targetPosition, target)
    )[0];
}

function chooseReserveDeployment(
  battle: Battle,
  defenders: UnitInstance[],
  legalActions: LegalUnitAction[],
  target?: GridPosition,
): { action: Extract<BattleAction, { type: "DeployUnit" }>; unit: UnitInstance } | undefined {
  const destination = target ?? {
    x: Math.floor((battle.board.width - 1) / 2),
    y: Math.floor((battle.board.height - 1) / 2),
  };
  return defenders
    .filter((unit) => !unit.position)
    .flatMap((unit) =>
      legalActions
        .filter((action): action is Extract<BattleAction, { type: "DeployUnit" }> =>
          action.type === "DeployUnit" && action.unitId === unit.id
        )
        .map((action) => ({ action, unit }))
    )
    .sort((left, right) =>
      distance(left.action.targetPosition, destination) -
      distance(right.action.targetPosition, destination)
    )[0];
}

function getDefensiveObjective(
  battle: Battle,
  scenario: ScenarioDefinition,
  _mission: MissionState | undefined,
  _defenderArmyId: string,
): BattlefieldObject | undefined {
  const type = scenario.victoryCondition.type === "ProtectObject"
    ? scenario.victoryCondition.objectType
    : scenario.victoryCondition.type === "DefendPoint"
      ? scenario.victoryCondition.objectiveType
      : scenario.victoryCondition.type === "ControlTerritory"
        ? "StrategicPoint"
        : undefined;
  return type
    ? battle.board.objects?.find((object) => object.type === type && object.status === "Active")
    : undefined;
}

function scoreAttack(weapon: WeaponProfile, defender: UnitInstance): number {
  const maximumDamage = weapon.attacks * weapon.damage;
  const lethalBonus = maximumDamage >= defender.currentHp ? 10_000 : 0;
  return lethalBonus + maximumDamage * 100 - defender.currentHp;
}

function getSuppression(units: UnitInstance[], unitId: string): number {
  return units.find((unit) => unit.id === unitId)?.suppression ?? 0;
}
