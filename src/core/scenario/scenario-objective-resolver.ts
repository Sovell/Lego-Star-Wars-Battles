import type { Battle, BattlefieldObject, UnitInstance } from "../../types";
import { areArmiesAllied, areArmiesEnemies } from "../army-relations";
import type { GridPosition } from "../rules/geometry";
import { getPathCost } from "../rules/pathfinding";
import { getTemplate } from "../rules/state";
import type { MissionState, ScenarioDefinition } from "./scenario-types";

export type ScenarioObjectiveTarget = {
  kind: "BattlefieldObject" | "Zone";
  name: string;
  position: GridPosition;
  object?: BattlefieldObject;
  canAttackObject: boolean;
};

export type ResolveScenarioObjectiveOptions = {
  battle: Battle;
  scenario: ScenarioDefinition;
  mission?: MissionState;
  armyId: string;
  units: UnitInstance[];
};

/**
 * Resolves the current operational objective shared by every bot doctrine.
 * The resolver owns scenario semantics; the doctrine still decides whether to
 * assault the objective, hold it, or prefer a tactically stronger action.
 */
export function resolveScenarioObjective({
  battle,
  scenario,
  mission,
  armyId,
  units,
}: ResolveScenarioObjectiveOptions): ScenarioObjectiveTarget | undefined {
  const condition = scenario.victoryCondition;

  if (condition.type === "ProtectObject" || condition.type === "DefendPoint") {
    const objectiveType = condition.type === "ProtectObject"
      ? condition.objectType
      : condition.objectiveType;
    return toObjectTarget(
      selectNearestObject(
        battle,
        units,
        (battle.board.objects ?? []).filter((object) =>
          object.type === objectiveType && object.status === "Active"
        ),
      ),
      canArmyAssaultDefendedObjective(battle, scenario, mission, armyId),
    );
  }

  if (condition.type === "DestroyObjects") {
    return toObjectTarget(
      selectNearestObject(
        battle,
        units,
        (battle.board.objects ?? []).filter((object) =>
          object.type === condition.objectType && object.status === "Active"
        ),
      ),
      canArmyAssaultDefendedObjective(battle, scenario, mission, armyId),
    );
  }

  if (condition.type === "ProgressiveControl" || condition.type === "RescueAndExtract") {
    const armySlot = condition.type === "ProgressiveControl"
      ? condition.attackerArmySlot
      : condition.rescuerArmySlot;
    const objectiveArmy = battle.armies[armySlot];
    if (!objectiveArmy || !areArmiesAllied(battle, armyId, objectiveArmy.id)) {
      return undefined;
    }
    const objectives = orderScenarioObjectivesFromDeployment(
      (battle.board.objects ?? []).filter((object) =>
        object.type === condition.objectiveType && object.status === "Active"
      ),
      scenario.deploymentZones.find(
        (zone) => zone.armySlot === armySlot,
      )?.cells ?? [],
    );
    return toObjectTarget(objectives[mission?.objectiveStage ?? 0], false);
  }

  if (condition.type === "SurviveAndExtract") {
    const extractingArmy = battle.armies[condition.armySlot];
    if (!extractingArmy || !areArmiesAllied(battle, armyId, extractingArmy.id)) {
      return undefined;
    }
    const zone = scenario.zones?.find((candidate) => candidate.id === condition.zoneId);
    const position = selectNearestPosition(battle, units, zone?.cells ?? []);
    return position
      ? {
          kind: "Zone",
          name: "strefa ewakuacji",
          position,
          canAttackObject: false,
        }
      : undefined;
  }

  return undefined;
}

/** Keeps bot targeting and mission progression on exactly the same stage order. */
export function orderScenarioObjectivesFromDeployment<
  T extends { position: GridPosition },
>(objectives: T[], deploymentCells: GridPosition[]): T[] {
  const origin = deploymentCells.length > 0
    ? {
        x: deploymentCells.reduce((sum, cell) => sum + cell.x, 0) / deploymentCells.length,
        y: deploymentCells.reduce((sum, cell) => sum + cell.y, 0) / deploymentCells.length,
      }
    : { x: 0, y: 0 };
  return [...objectives].sort((left, right) =>
    manhattanDistance(left.position, origin) - manhattanDistance(right.position, origin)
  );
}

function toObjectTarget(
  object: BattlefieldObject | undefined,
  canAttackObject: boolean,
): ScenarioObjectiveTarget | undefined {
  return object
    ? {
        kind: "BattlefieldObject",
        name: object.name,
        position: object.position,
        object,
        canAttackObject,
      }
    : undefined;
}

function selectNearestObject(
  battle: Battle,
  units: UnitInstance[],
  objects: BattlefieldObject[],
): BattlefieldObject | undefined {
  return [...objects].sort((left, right) =>
    nearestPathDistance(battle, units, left.position) -
      nearestPathDistance(battle, units, right.position) ||
    left.position.y - right.position.y ||
    left.position.x - right.position.x ||
    left.id.localeCompare(right.id)
  )[0];
}

function selectNearestPosition(
  battle: Battle,
  units: UnitInstance[],
  positions: GridPosition[],
): GridPosition | undefined {
  return [...positions].sort((left, right) =>
    nearestPathDistance(battle, units, left) - nearestPathDistance(battle, units, right) ||
    left.y - right.y || left.x - right.x
  )[0];
}

function nearestPathDistance(
  battle: Battle,
  units: UnitInstance[],
  target: GridPosition,
): number {
  const costs = units.flatMap((unit) => {
    if (!unit.position) return [];
    const cost = getPathCost(battle, unit.position, target, {
      unitId: unit.id,
      movementBudget: Math.max(1, getTemplate(unit).movement),
      allowOccupiedTarget: true,
    });
    return cost === undefined ? [] : [cost];
  });
  if (costs.length > 0) return Math.min(...costs);
  const geometricDistances = units.flatMap((unit) =>
    unit.position ? [manhattanDistance(unit.position, target)] : []
  );
  return Number.MAX_SAFE_INTEGER / 2 + (
    geometricDistances.length > 0 ? Math.min(...geometricDistances) : 0
  );
}

function canArmyAssaultDefendedObjective(
  battle: Battle,
  scenario: ScenarioDefinition,
  mission: MissionState | undefined,
  armyId: string,
): boolean {
  const defenderArmyId = mission?.defenderArmyId ??
    battle.armies[scenario.defaultDefenderArmySlot ?? 0]?.id;
  return Boolean(defenderArmyId && areArmiesEnemies(battle, armyId, defenderArmyId));
}

function manhattanDistance(left: GridPosition, right: GridPosition): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}
