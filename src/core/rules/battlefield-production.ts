import { unitTemplates } from "../../data";
import type { Battle, BattlefieldObject, UnitInstance } from "../../types";
import { isTerrainEnterable } from "../terrain-definitions";
import { isOnBoard, type GridPosition } from "./geometry";
import { isPositionFree } from "./occupancy";
import { getTerrainAtPosition } from "./terrain";

export type BattlefieldProductionResult = {
  battle: Battle;
  spawnedUnitIds: string[];
};

/** Resolves installations that become ready when a new battle round begins. */
export function resolveBattlefieldProduction(
  battle: Battle,
  nextTurn: number,
): BattlefieldProductionResult {
  let nextBattle = battle;
  const spawnedUnitIds: string[] = [];

  for (const object of battle.board.objects ?? []) {
    const production = object.production;
    if (
      object.status !== "Active" ||
      !object.controllerArmyId ||
      !production ||
      production.remainingSpawns <= 0 ||
      nextTurn < production.nextProductionTurn
    ) {
      continue;
    }

    const template = unitTemplates.find((candidate) => candidate.id === production.templateId);
    const army = nextBattle.armies.find((candidate) => candidate.id === object.controllerArmyId);
    const position = findProductionPosition(nextBattle, object);
    if (!template || !army || !position) continue;

    const summoned: UnitInstance = {
      id: `${object.id}-${template.id}-${crypto.randomUUID()}`,
      templateId: template.id,
      armyId: army.id,
      currentHp: template.maxHp,
      suppression: 0,
      abilityCooldowns: {},
      position,
      status: "Ready",
      hidden: false,
    };
    spawnedUnitIds.push(summoned.id);
    nextBattle = {
      ...nextBattle,
      armies: nextBattle.armies.map((candidate) =>
        candidate.id === army.id
          ? { ...candidate, units: [...candidate.units, summoned] }
          : candidate
      ),
      board: {
        ...nextBattle.board,
        objects: (nextBattle.board.objects ?? []).map((candidate) =>
          candidate.id === object.id
            ? {
                ...candidate,
                production: {
                  ...production,
                  nextProductionTurn: nextTurn + production.intervalRounds,
                  remainingSpawns: production.remainingSpawns - 1,
                },
              }
            : candidate
        ),
      },
    };
  }

  return { battle: nextBattle, spawnedUnitIds };
}

function findProductionPosition(
  battle: Battle,
  object: BattlefieldObject,
): GridPosition | undefined {
  for (let y = object.position.y - 1; y <= object.position.y + 1; y += 1) {
    for (let x = object.position.x - 1; x <= object.position.x + 1; x += 1) {
      const position = { x, y };
      if (
        (x !== object.position.x || y !== object.position.y) &&
        isOnBoard(battle, position) &&
        isTerrainEnterable(getTerrainAtPosition(battle, position)) &&
        isPositionFree(battle, position) &&
        !(battle.board.objects ?? []).some((candidate) =>
          candidate.status === "Active" &&
          candidate.position.x === x &&
          candidate.position.y === y
        )
      ) {
        return position;
      }
    }
  }
  return undefined;
}
