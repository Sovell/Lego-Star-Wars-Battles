import type { Battle, CombatLogEntry, OrderType } from "../types";
import type { MissionState } from "../core/scenario/scenario-types";
import type { ScenarioDraft } from "./scenario-draft";
import type { GamePhase } from "./types/game-phase";

export type RecoverableAppView = "home" | "setup" | "battle" | "composer" | "rules";

export type ActiveSessionRecovery = {
  schemaVersion: 1;
  savedAt: string;
  view: RecoverableAppView;
  gamePhase: Extract<GamePhase, "Playing">;
  battle: Battle;
  battleStartSnapshot?: Battle;
  scenarioDraft: ScenarioDraft;
  mission: MissionState;
  logs: CombatLogEntry[];
  activeArmyId?: string;
  selectedUnitId: string;
  targetUnitId: string;
  selectedWeaponId: string;
  selectedOrder: OrderType;
  armyJson: string;
  debugMode: boolean;
};

export type ActiveSessionRecoveryInput = Omit<
  ActiveSessionRecovery,
  "schemaVersion" | "savedAt"
>;

export type RecoveryStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const ACTIVE_SESSION_KEY = "lego-star-wars-battles:recovery:active-session";
const recoverableViews: readonly RecoverableAppView[] = [
  "home",
  "setup",
  "battle",
  "composer",
  "rules",
];
const recoverableOrders: readonly OrderType[] = [
  "Move",
  "Advance",
  "Rally",
  "Attack",
  "Overwatch",
];

export function saveActiveSessionRecovery(
  session: ActiveSessionRecoveryInput,
  storage: RecoveryStorage | undefined = getBrowserStorage(),
): void {
  if (!storage) return;
  const recovery: ActiveSessionRecovery = {
    ...session,
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(recovery));
  } catch {
    // Recovery must never interrupt the active battle (for example on quota errors).
  }
}

export function loadActiveSessionRecovery(
  storage: RecoveryStorage | undefined = getBrowserStorage(),
): ActiveSessionRecovery | undefined {
  if (!storage) return undefined;
  try {
    const rawRecovery = storage.getItem(ACTIVE_SESSION_KEY);
    if (!rawRecovery) return undefined;
    const recovery = JSON.parse(rawRecovery) as Partial<ActiveSessionRecovery>;
    if (!isActiveSessionRecovery(recovery)) {
      clearActiveSessionRecovery(storage);
      return undefined;
    }
    return recovery;
  } catch {
    clearActiveSessionRecovery(storage);
    return undefined;
  }
}

export function clearActiveSessionRecovery(
  storage: RecoveryStorage | undefined = getBrowserStorage(),
): void {
  try {
    storage?.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // A failed cleanup must not block starting or restarting a scenario.
  }
}

function isActiveSessionRecovery(
  recovery: Partial<ActiveSessionRecovery>,
): recovery is ActiveSessionRecovery {
  return recovery.schemaVersion === 1 &&
    recovery.gamePhase === "Playing" &&
    isRecord(recovery.battle) &&
    isRecord(recovery.scenarioDraft) &&
    isRecord(recovery.mission) &&
    Array.isArray(recovery.logs) &&
    recoverableViews.includes(recovery.view as RecoverableAppView) &&
    typeof recovery.selectedUnitId === "string" &&
    typeof recovery.targetUnitId === "string" &&
    typeof recovery.selectedWeaponId === "string" &&
    recoverableOrders.includes(recovery.selectedOrder as OrderType) &&
    typeof recovery.armyJson === "string" &&
    typeof recovery.debugMode === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getBrowserStorage(): RecoveryStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
