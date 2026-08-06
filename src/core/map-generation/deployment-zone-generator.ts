import { getArmyTeamId } from "../army-relations";
import type { DeploymentZone } from "../scenario/scenario-types";
import type {
  MapGenerationArmy,
  MapGenerationArmyLayout,
} from "./map-generation-types";

export type DeploymentEdge = "left" | "right" | "top" | "bottom";

export function createMapArmyLayout(
  armies: MapGenerationArmy[] = [],
): MapGenerationArmyLayout[] {
  validateArmies(armies);
  return armies.map((army) => ({
    armyId: army.id,
    teamId: getArmyTeamId(army),
  }));
}

export function generateDeploymentZones({
  width,
  height,
  armies,
  defenderArmySlot,
  depth = 2,
}: {
  width: number;
  height: number;
  armies?: MapGenerationArmy[];
  defenderArmySlot?: number;
  depth?: number;
}): DeploymentZone[] {
  const armyLayout = createMapArmyLayout(armies);
  if (armyLayout.length === 0) return [];
  validateDepth(depth, width, height);
  if (
    defenderArmySlot !== undefined &&
    (!Number.isInteger(defenderArmySlot) || defenderArmySlot < 0 || defenderArmySlot >= armyLayout.length)
  ) {
    throw new Error("Defender army slot must refer to a configured army.");
  }

  const teamGroups = groupArmiesByTeam(armyLayout);
  const defenderTeamId = defenderArmySlot === undefined
    ? teamGroups[0].teamId
    : armyLayout[defenderArmySlot].teamId;
  const orderedGroups = [
    ...teamGroups.filter(({ teamId }) => teamId === defenderTeamId),
    ...teamGroups.filter(({ teamId }) => teamId !== defenderTeamId),
  ];
  const edges = selectEdges(orderedGroups.length);
  const zones: DeploymentZone[] = [];

  orderedGroups.forEach((group, groupIndex) => {
    const edge = edges[groupIndex];
    const axis = getEdgeAxis(edge, width, height, depth, edges);
    if (axis.length < group.armySlots.length) {
      throw new Error(`Board edge ${edge} is too short for allied deployment sectors.`);
    }
    group.armySlots.forEach((armySlot, allyIndex) => {
      const start = Math.floor(allyIndex * axis.length / group.armySlots.length);
      const end = Math.floor((allyIndex + 1) * axis.length / group.armySlots.length);
      zones.push({
        id: `army-slot-${armySlot}-entry`,
        armySlot,
        cells: createSectorCells(edge, axis.slice(start, end), width, height, depth),
      });
    });
  });

  assertDisjointZones(zones);
  return zones.sort((left, right) => left.armySlot - right.armySlot);
}

function groupArmiesByTeam(armyLayout: MapGenerationArmyLayout[]) {
  const groups: Array<{ teamId: MapGenerationArmyLayout["teamId"]; armySlots: number[] }> = [];
  armyLayout.forEach((army, armySlot) => {
    const existing = groups.find(({ teamId }) => teamId === army.teamId);
    if (existing) existing.armySlots.push(armySlot);
    else groups.push({ teamId: army.teamId, armySlots: [armySlot] });
  });
  return groups;
}

function selectEdges(teamCount: number): DeploymentEdge[] {
  if (teamCount === 1) return ["left"];
  return ["left", "right", "top", "bottom"].slice(0, teamCount) as DeploymentEdge[];
}

function getEdgeAxis(
  edge: DeploymentEdge,
  width: number,
  height: number,
  depth: number,
  usedEdges: DeploymentEdge[],
): number[] {
  if (edge === "left" || edge === "right") {
    return Array.from({ length: height }, (_, index) => index);
  }
  const leftInset = usedEdges.includes("left") ? depth : 0;
  const rightInset = usedEdges.includes("right") ? depth : 0;
  return Array.from(
    { length: Math.max(0, width - leftInset - rightInset) },
    (_, index) => leftInset + index,
  );
}

function createSectorCells(
  edge: DeploymentEdge,
  axis: number[],
  width: number,
  height: number,
  depth: number,
): Array<{ x: number; y: number }> {
  if (edge === "left" || edge === "right") {
    const startX = edge === "left" ? 0 : width - depth;
    return axis.flatMap((y) =>
      Array.from({ length: depth }, (_, offset) => ({ x: startX + offset, y }))
    );
  }
  const startY = edge === "top" ? 0 : height - depth;
  return axis.flatMap((x) =>
    Array.from({ length: depth }, (_, offset) => ({ x, y: startY + offset }))
  );
}

function validateArmies(armies: MapGenerationArmy[] = []): void {
  if (armies.length > 4) throw new Error("Map generation supports at most four armies.");
  const ids = new Set<string>();
  for (const army of armies) {
    if (!army.id || ids.has(army.id)) {
      throw new Error("Map generation requires unique, non-empty army IDs.");
    }
    ids.add(army.id);
  }
}

function validateDepth(depth: number, width: number, height: number): void {
  if (!Number.isInteger(depth) || depth <= 0) {
    throw new Error("Deployment depth must be a positive integer.");
  }
  if (depth * 2 > width || depth * 2 > height) {
    throw new Error("Deployment depth is too large for this board.");
  }
}

function assertDisjointZones(zones: DeploymentZone[]): void {
  const occupied = new Set<string>();
  for (const zone of zones) {
    if (zone.cells.length === 0) throw new Error(`Deployment zone ${zone.id} is empty.`);
    for (const { x, y } of zone.cells) {
      const key = `${x},${y}`;
      if (occupied.has(key)) throw new Error(`Deployment zones overlap at ${key}.`);
      occupied.add(key);
    }
  }
}
