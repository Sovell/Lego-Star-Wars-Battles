import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { GamePhase } from "../types/game-phase";
import { useI18n } from "../../i18n";

export function BattleInspector({
  children,
  armiesPanel,
  phase,
  tone = "neutral",
}: {
  children: ReactNode;
  armiesPanel?: ReactNode;
  phase: GamePhase;
  tone?: "neutral" | "republic" | "separatists";
}) {
  const { text } = useI18n();
  const [activeTab, setActiveTab] = useState<"mission" | "armies">("mission");
  const missionTabId = useId();
  const armiesTabId = useId();
  const missionPanelId = useId();
  const armiesPanelId = useId();
  const missionTabRef = useRef<HTMLButtonElement>(null);
  const armiesTabRef = useRef<HTMLButtonElement>(null);
  const tabsEnabled = phase !== "Preparation" && armiesPanel !== undefined;
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === "Home"
      ? "mission"
      : event.key === "End"
        ? "armies"
        : activeTab === "mission" ? "armies" : "mission";
    setActiveTab(nextTab);
    (nextTab === "mission" ? missionTabRef : armiesTabRef).current?.focus();
  };

  return (
    <aside
      className="battleInspector"
      data-tone={tone}
      aria-label={text("Inspektor bitwy", "Battle inspector")}
    >
      {tabsEnabled ? (
        <nav className="battleInspectorTabs" aria-label={text("Moduły inspektora", "Inspector modules")} role="tablist">
          <button
            aria-controls={missionPanelId}
            aria-selected={activeTab === "mission"}
            id={missionTabId}
            onClick={() => setActiveTab("mission")}
            onKeyDown={handleTabKeyDown}
            ref={missionTabRef}
            role="tab"
            tabIndex={activeTab === "mission" ? 0 : -1}
            type="button"
          >
            <span>{text("Moduł", "Module")}</span>
            <strong>{text("Misja", "Mission")}</strong>
          </button>
          <button
            aria-controls={armiesPanelId}
            aria-selected={activeTab === "armies"}
            id={armiesTabId}
            onClick={() => setActiveTab("armies")}
            onKeyDown={handleTabKeyDown}
            ref={armiesTabRef}
            role="tab"
            tabIndex={activeTab === "armies" ? 0 : -1}
            type="button"
          >
            <span>{text("Roster", "Roster")}</span>
            <strong>{text("Armie", "Armies")}</strong>
          </button>
        </nav>
      ) : (
        <header className="battleInspectorHeader">
          <span>{phase === "Preparation" ? text("Odprawa", "Briefing") : text("Moduł misji", "Mission module")}</span>
          <strong>{phase === "Preparation" ? text("Gotowość do bitwy", "Battle readiness") : text("Cel i status", "Objective and status")}</strong>
        </header>
      )}
      {tabsEnabled ? (
        <>
          <div
            aria-labelledby={missionTabId}
            className="battleInspectorContent"
            hidden={activeTab !== "mission"}
            id={missionPanelId}
            role="tabpanel"
          >
            {children}
          </div>
          <div
            aria-labelledby={armiesTabId}
            className="battleInspectorContent"
            hidden={activeTab !== "armies"}
            id={armiesPanelId}
            role="tabpanel"
          >
            {armiesPanel}
          </div>
        </>
      ) : (
        <div className="battleInspectorContent">{children}</div>
      )}
    </aside>
  );
}
