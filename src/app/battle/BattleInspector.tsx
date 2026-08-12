import type { ReactNode } from "react";
import type { GamePhase } from "../types/game-phase";
import { useI18n } from "../../i18n";

export function BattleInspector({
  children,
  phase,
}: {
  children: ReactNode;
  phase: GamePhase;
}) {
  const { text } = useI18n();
  return (
    <aside className="battleInspector" aria-label={text("Inspektor bitwy", "Battle inspector")}>
      <header className="battleInspectorHeader">
        <span>{phase === "Preparation" ? text("Konfiguracja", "Setup") : text("Inspektor", "Inspector")}</span>
        <strong>{phase === "Preparation" ? text("Scenariusz i wybór", "Scenario and selection") : text("Przebieg bitwy", "Battle status")}</strong>
      </header>
      <div className="battleInspectorContent">{children}</div>
    </aside>
  );
}
