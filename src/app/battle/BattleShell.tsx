import type { ReactNode } from "react";
import type { GamePhase } from "../types/game-phase";
import "../styles/battle-shell.css";

export function BattleShell({
  actionBar,
  battlefield,
  drawer,
  inspector,
  notifications,
  overlay,
  phase,
  setupTools,
}: {
  actionBar?: ReactNode;
  battlefield: ReactNode;
  drawer: ReactNode;
  inspector: ReactNode;
  notifications?: ReactNode;
  overlay?: ReactNode;
  phase: GamePhase;
  setupTools?: ReactNode;
}) {
  return (
    <section
      className={`battleShell ${
        phase === "Preparation" ? "battleShellPreparation" : "battleShellPlaying"
      }`}
    >
      {setupTools}
      <section className="battleStage">
        {battlefield}
        {overlay ? <div className="battleStageOverlay">{overlay}</div> : null}
      </section>
      {inspector}
      {actionBar}
      <section className="battleUtilityRail">
        {drawer}
        {notifications}
      </section>
    </section>
  );
}
