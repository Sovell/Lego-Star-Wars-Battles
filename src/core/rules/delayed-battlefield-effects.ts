import type { Battle, UnitInstance } from "../../types";
import { areArmiesAllied } from "../army-relations";
import { clearBrokenSupportLinks } from "./unit-support";
import { distance } from "./geometry";
import { getStatusAfterDamage } from "./morale";
import { getTemplate } from "./state";

export type DelayedBattlefieldEffectResult = {
  battle: Battle;
  resolvedStrikeCount: number;
  destroyedUnitIds: string[];
};

export function resolveDelayedBattlefieldEffects(
  battle: Battle,
  nextTurn: number,
): DelayedBattlefieldEffectResult {
  const dueMarkers = (battle.board.objects ?? []).filter((object) =>
    object.status === "Active" &&
    object.delayedStrike &&
    object.delayedStrike.resolveTurn <= nextTurn
  );
  if (dueMarkers.length === 0) {
    return { battle, resolvedStrikeCount: 0, destroyedUnitIds: [] };
  }

  const destroyedUnitIds: string[] = [];
  const armies = battle.armies.map((army) => ({
    ...army,
    units: army.units.map((unit) => {
      let updated = unit;
      for (const marker of dueMarkers) {
        const strike = marker.delayedStrike!;
        if (
          !updated.position ||
          updated.status === "Destroyed" ||
          areArmiesAllied(battle, updated.armyId, strike.controllerArmyId) ||
          distance(updated.position, marker.position) > strike.radius
        ) {
          continue;
        }
        const nextHp = Math.max(0, updated.currentHp - strike.damage);
        const nextSuppression = updated.suppression + strike.suppression;
        updated = {
          ...updated,
          currentHp: nextHp,
          suppression: nextSuppression,
          position: nextHp === 0 ? null : updated.position,
          status: getStatusAfterDamage(
            updated,
            getTemplate(updated),
            nextHp,
            nextSuppression,
          ),
        } satisfies UnitInstance;
        if (nextHp === 0) destroyedUnitIds.push(updated.id);
      }
      return updated;
    }),
  }));

  return {
    battle: clearBrokenSupportLinks({
      ...battle,
      armies,
      board: {
        ...battle.board,
        objects: (battle.board.objects ?? []).filter((object) =>
          !dueMarkers.some((marker) => marker.id === object.id)
        ),
      },
    }),
    resolvedStrikeCount: dueMarkers.length,
    destroyedUnitIds,
  };
}
