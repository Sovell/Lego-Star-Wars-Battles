import type { ReactNode } from "react";
import type { GamePhase } from "../types/game-phase";

export function BattleInspector({
  children,
  phase,
}: {
  children: ReactNode;
  phase: GamePhase;
}) {
  return (
    <aside className="battleInspector" aria-label="Inspektor bitwy">
      <header className="battleInspectorHeader">
        <span>{phase === "Preparation" ? "Konfiguracja" : "Inspektor"}</span>
        <strong>{phase === "Preparation" ? "Scenariusz i wybór" : "Przebieg bitwy"}</strong>
      </header>
      <div className="battleInspectorContent">{children}</div>
    </aside>
  );
}
