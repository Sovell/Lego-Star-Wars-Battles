import type { ReactNode } from "react";
import type { GamePhase } from "../types/game-phase";
import { useI18n } from "../../i18n";
import "../styles/battle-shell.css";

export function BattleShell({
  actionBar,
  battlefield,
  drawer,
  header,
  inspector,
  notifications,
  overlay,
  phase,
  setupTools,
  unitPanel,
  unitPanelOpen = false,
  onUnitPanelOpenChange,
}: {
  actionBar?: ReactNode;
  battlefield: ReactNode;
  drawer: ReactNode;
  header?: ReactNode;
  inspector: ReactNode;
  notifications?: ReactNode;
  overlay?: ReactNode;
  phase: GamePhase;
  setupTools?: ReactNode;
  unitPanel?: ReactNode;
  unitPanelOpen?: boolean;
  onUnitPanelOpenChange?: (open: boolean) => void;
}) {
  const { text } = useI18n();
  const showUnitPanel = Boolean(unitPanel && unitPanelOpen);

  return (
    <section className="battleShell">
      {header}
      <div
        className={`battleShellFrame ${
          phase === "Preparation" ? "battleShellPreparation" : "battleShellPlaying"
        } ${showUnitPanel ? "battleShellWithUnitPanel" : ""}`}
      >
        {setupTools}
        {showUnitPanel ? (
          <aside className="battleUnitPanel" aria-label={text("Karta wybranej jednostki", "Selected unit card")}>
            <header className="battleUnitPanelHeader">
              <div>
                <span>{text("Jednostka", "Unit")}</span>
                <strong>{text("Karta jednostki", "Unit card")}</strong>
              </div>
              <button
                type="button"
                aria-label={text("Schowaj kartę jednostki", "Hide unit card")}
                title={text("Schowaj kartę jednostki", "Hide unit card")}
                onClick={() => onUnitPanelOpenChange?.(false)}
              >
                &lsaquo;
              </button>
            </header>
            <div className="battleUnitPanelContent">{unitPanel}</div>
          </aside>
        ) : null}
        <section className="battleStage">
          {battlefield}
          {unitPanel && !unitPanelOpen ? (
            <button
              className="battleUnitPanelToggle"
              type="button"
              aria-label={text("Pokaż kartę jednostki", "Show unit card")}
              onClick={() => onUnitPanelOpenChange?.(true)}
            >
              <span>{text("Jednostka", "Unit")}</span>
              <strong>{text("Karta jednostki", "Unit card")}</strong>
              <b aria-hidden="true">&rsaquo;</b>
            </button>
          ) : null}
          {overlay ? <div className="battleStageOverlay">{overlay}</div> : null}
        </section>
        {inspector}
        {actionBar}
        <section className="battleUtilityRail">
          {drawer}
          {notifications}
        </section>
      </div>
    </section>
  );
}
