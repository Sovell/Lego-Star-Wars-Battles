import type { ReactNode } from "react";
import type { GamePhase } from "../types/game-phase";
import { useI18n } from "../../i18n";

export function BattleInspector({
  children,
  phase,
  tone = "neutral",
}: {
  children: ReactNode;
  phase: GamePhase;
  tone?: "neutral" | "republic" | "separatists";
}) {
  const { text } = useI18n();
  return (
    <aside
      className="battleInspector"
      data-tone={tone}
      aria-label={text("Inspektor bitwy", "Battle inspector")}
    >
      <header className="battleInspectorHeader">
        <span>{phase === "Preparation" ? text("Odprawa", "Briefing") : text("Moduł misji", "Mission module")}</span>
        <strong>{phase === "Preparation" ? text("Gotowość do bitwy", "Battle readiness") : text("Cel i status", "Objective and status")}</strong>
      </header>
      <div className="battleInspectorContent">{children}</div>
    </aside>
  );
}
