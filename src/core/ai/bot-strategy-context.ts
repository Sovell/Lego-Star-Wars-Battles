import type { Battle, BattlefieldObject, UnitInstance } from "../../types";
import { areArmiesAllied, areArmiesEnemies } from "../army-relations";
import { isPositionFree } from "../rules/occupancy";
import { distance, type GridPosition } from "../rules/geometry";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import type { BotDoctrine } from "./bot-doctrine";

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
};

export function createBotStrategyContext(
  battle: Battle,
  scenario: ScenarioDefinition,
  armyId: string,
  doctrine: BotDoctrine,
  mission?: MissionState,
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
  const origins = units.flatMap((unit) => unit.position ? [unit.position] : []);
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

  const target = candidates.sort((left, right) => {
    const strategicDifference = Number(isStrategicPosition(battle, right)) -
      Number(isStrategicPosition(battle, left));
    if (strategicDifference !== 0) return strategicDifference;
    return nearestDistance(origins, left) - nearestDistance(origins, right) ||
      left.y - right.y || left.x - right.x;
  })[0];
  if (target || policy === "Assault") return target;

  return battle.board.objects
    ?.filter((object) => object.type === "StrategicPoint" && object.status === "Active")
    .sort((left, right) =>
      nearestDistance(origins, left.position) - nearestDistance(origins, right.position)
    )[0]?.position;
}

function findNearestEnemyPosition(
  battle: Battle,
  units: UnitInstance[],
  armyId: string,
): GridPosition | undefined {
  const origins = units.flatMap((unit) => unit.position ? [unit.position] : []);
  return battle.armies
    .filter((army) => areArmiesEnemies(battle, army.id, armyId))
    .flatMap((army) => army.units)
    .filter((unit) => unit.status !== "Destroyed" && unit.position)
    .map((unit) => unit.position!)
    .sort((left, right) =>
      nearestDistance(origins, left) - nearestDistance(origins, right) ||
      left.y - right.y || left.x - right.x
    )[0];
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

function nearestDistance(origins: GridPosition[], target: GridPosition): number {
  return origins.length > 0
    ? Math.min(...origins.map((origin) => distance(origin, target)))
    : Number.MAX_SAFE_INTEGER;
}
