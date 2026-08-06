import type { Battle } from "../../types";
import type { BattleAction } from "../battle-actions";
import { applyOrder } from "../rules/orders";
import { findUnit } from "../rules/state";

export type LegalOrderAction = Extract<BattleAction, { type: "ApplyOrder" }>;

/**
 * Generates semantic, non-positional orders accepted by the rules engine.
 * A pending Advance must be resolved before any other order. Overwatch also
 * remains available in reserve so an activation cannot deadlock when every
 * deployment cell is occupied.
 */
export function getLegalOrderActions(
  battle: Battle,
  unitId: string,
): LegalOrderAction[] {
  const unit = findUnit(battle, unitId);
  if (!unit) return [];

  const candidates: LegalOrderAction[] = unit.status === "Pinned"
    ? [{ type: "ApplyOrder", unitId, order: "Rally" }]
    : unit.activeEffects?.includes("advance_pending")
    ? [{ type: "ApplyOrder", unitId, order: "Advance" }]
    : [
        ...(unit.suppression > 0
          ? [{ type: "ApplyOrder" as const, unitId, order: "Rally" as const }]
          : []),
        { type: "ApplyOrder", unitId, order: "Overwatch" },
      ];

  return candidates.filter((action) =>
    applyOrder(battle, unitId, action.order).battle !== battle
  );
}
