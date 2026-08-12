import type { ReactNode } from "react";
import { useI18n } from "../../i18n";

export type BattleDrawerTab = "logs" | "armies";

export function BattleLogDrawer({
  activeTab,
  armies,
  logs,
  onOpenChange,
  onTabChange,
  open,
}: {
  activeTab: BattleDrawerTab;
  armies: ReactNode;
  logs: ReactNode;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: BattleDrawerTab) => void;
  open: boolean;
}) {
  const { text } = useI18n();
  return (
    <section className={`battleLogDrawer ${open ? "open" : ""}`}>
      <button
        aria-expanded={open}
        className="battleDrawerToggle"
        onClick={() => onOpenChange(!open)}
      >
        {open ? text("Zwiń dane bitwy", "Hide battle data") : text("Dziennik i jednostki", "Log and units")}
      </button>
      {open ? (
        <div className="battleDrawerPanel">
          <div className="intelTabs battleDrawerTabs">
            <button
              className={activeTab === "logs" ? "active" : ""}
              onClick={() => onTabChange("logs")}
            >
              {text("Dziennik", "Log")}
            </button>
            <button
              className={activeTab === "armies" ? "active" : ""}
              onClick={() => onTabChange("armies")}
            >
              {text("Jednostki", "Units")}
            </button>
          </div>
          <div className="battleDrawerContent">
            {activeTab === "armies" ? armies : logs}
          </div>
        </div>
      ) : null}
    </section>
  );
}
