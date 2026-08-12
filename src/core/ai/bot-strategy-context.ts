import type { Battle, BattlefieldObject, UnitInstance } from "../../types";
import { areArmiesAllied, areArmiesEnemies } from "../army-relations";
import { isPositionFree } from "../rules/occupancy";
import type { GridPosition } from "../rules/geometry";
import { getPathCost } from "../rules/pathfinding";
import { getTemplate } from "../rules/state";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import type { BotDoctrine } from "./bot-doctrine";
import type { BotDecisionContext } from "./bot-controller";

export type BotStrategyContext = {
  battle: Battle;
  scenario: ScenarioDefinition;
  mission?: MissionState;
  armyId: string;
  doctrine: BotDoctrine;
  units: UnitInstance[];
  objective?: BattlefieldObject;
  objectiveName?: string;
  movementTarget?: GridPosition;
  objectiveObjectId?: string;
  decisionSeed: string;
};

export function createBotStrategyContext(
  battle: Battle,
  scenario: ScenarioDefinition,
  armyId: string,
  doctrine: BotDoctrine,
  mission?: MissionState,
  decisionContext?: BotDecisionContext,
): BotStrategyContext | undefined {
  if (battle.activeActivation?.armyId !== armyId) return undefined;

  const availableUnits = battle.armies
    .find((army) => army.id === armyId)
    ?.units.filter((unit) => unit.status !== "Activated" && unit.status !== "Destroyed") ?? [];
  const pendingAdvanceUnit = availableUnits.find((unit) =>
    unit.activeEffects?.includes("advance_pending")
  );
  const units = pendingAdvanceUnit ? [pendingAdvanceUnit] : availableUnits;
  if (units.length === 0) return undefined;

  const objective = getScenarioObjective(battle, scenario);
  const territoryTarget = scenario.victoryCondition.type === "ControlTerritory"
    ? findTerritoryTarget(battle, mission, units, armyId, doctrine.objectivePolicy)
    : undefined;
  const enemyTarget = doctrine.objectivePolicy === "Assault"
    ? findNearestEnemyPosition(battle, units, armyId)
    : undefined;
  const movementTarget = objective?.position ?? territoryTarget ?? enemyTarget;

  return {
    battle,
    scenario,
    mission,
    armyId,
    doctrine,
    units,
    objective,
    objectiveName: objective?.name ??
      (scenario.victoryCondition.type === "ControlTerritory" ? "terytorium" : undefined),
    movementTarget,
    objectiveObjectId:
      doctrine.objectivePolicy === "Assault" && objective?.destructible
        ? objective.id
        : undefined,
    decisionSeed: decisionContext?.seed ??
      `${battle.id}:${battle.turn}:${battle.activeActivation.id}:${armyId}`,
  };
}

function getScenarioObjective(
  battle: Battle,
  scenario: ScenarioDefinition,
): BattlefieldObject | undefined {
  const objectiveType = scenario.victoryCondition.type === "ProtectObject"
    ? scenario.victoryCondition.objectType
    : scenario.victoryCondition.type === "DefendPoint"
      ? scenario.victoryCondition.objectiveType
      : undefined;
  return objectiveType
    ? battle.board.objects?.find(
        (object) => object.type === objectiveType && object.status === "Active"
      )
    : undefined;
}

function findTerritoryTarget(
  battle: Battle,
  mission: MissionState | undefined,
  units: UnitInstance[],
  armyId: string,
  policy: BotDoctrine["objectivePolicy"],
): GridPosition | undefined {
  const candidates: GridPosition[] = [];
  for (let y = 0; y < battle.board.height; y += 1) {
    for (let x = 0; x < battle.board.width; x += 1) {
      const position = { x, y };
      if (
        !isTerritoryOwnedByTeam(battle, mission, position, armyId) &&
        isPositionFree(battle, position)
      ) {
        candidates.push(position);
      }
    }
  }

  const reachableCandidates = candidates.filter((candidate) =>
    nearestPathDistance(battle, units, candidate) < Number.MAX_SAFE_INTEGER
  );
  const target = reachableCandidates.sort((left, right) => {
    const strategicDifference = Number(isStrategicPosition(battle, right)) -
      Number(isStrategicPosition(battle, left));
    if (strategicDifference !== 0) return strategicDifference;
    return nearestPathDistance(battle, units, left) - nearestPathDistance(battle, units, right) ||
      left.y - right.y || left.x - right.x;
  })[0];
  if (target || policy === "Assault") return target;

  return battle.board.objects
    ?.filter((object) => object.type === "StrategicPoint" && object.status === "Active")
    .sort((left, right) =>
      nearestPathDistance(battle, units, left.position) - nearestPathDistance(battle, units, right.position)
    )[0]?.position;
}

function findNearestEnemyPosition(
  battle: Battle,
  units: UnitInstance[],
  armyId: string,
): GridPosition | undefined {
  return battle.armies
    .filter((army) => areArmiesEnemies(battle, army.id, armyId))
    .flatMap((army) => army.units)
    .filter((unit) => unit.status !== "Destroyed" && unit.position)
    .map((unit) => ({
      position: unit.position!,
      pathCost: nearestPathDistance(battle, units, unit.position!, true),
    }))
    .filter(({ pathCost }) => pathCost < Number.MAX_SAFE_INTEGER)
    .sort((left, right) =>
      left.pathCost - right.pathCost ||
      left.position.y - right.position.y ||
      left.position.x - right.position.x
    )[0]?.position;
}

function isTerritoryOwnedByTeam(
  battle: Battle,
  mission: MissionState | undefined,
  position: GridPosition,
  armyId: string,
): boolean {
  const ownerArmyId = mission?.territoryOwners?.[`${position.x},${position.y}`];
  return ownerArmyId ? areArmiesAllied(battle, ownerArmyId, armyId) : false;
}

function isStrategicPosition(battle: Battle, position: GridPosition): boolean {
  return Boolean(battle.board.objects?.some(
    (object) =>
      object.type === "StrategicPoint" &&
      object.status === "Active" &&
      object.position.x === position.x &&
      object.position.y === position.y
  ));
}

function nearestPathDistance(
  battle: Battle,
  units: UnitInstance[],
  target: GridPosition,
  allowOccupiedTarget = false,
): number {
  const costs = units.flatMap((unit) => {
    if (!unit.position) return [];
    const movementBudget = Math.max(1, getUnitMovementBudget(unit));
    const cost = getPathCost(battle, unit.position, target, {
      unitId: unit.id,
      movementBudget,
      allowOccupiedTarget,
    });
    return cost === undefined ? [] : [cost];
  });
  return costs.length > 0 ? Math.min(...costs) : Number.MAX_SAFE_INTEGER;
}

function getUnitMovementBudget(unit: UnitInstance): number {
  const template = getTemplate(unit);
  return template.movement + (unit.activeEffects?.includes("movement_bonus:1") ? 1 : 0);
}
