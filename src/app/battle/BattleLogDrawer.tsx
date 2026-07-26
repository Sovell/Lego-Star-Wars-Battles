import type { ReactNode } from "react";

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
  return (
    <section className={`battleLogDrawer ${open ? "open" : ""}`}>
      <button
        aria-expanded={open}
        className="battleDrawerToggle"
        onClick={() => onOpenChange(!open)}
      >
        {open ? "Zwiń dane bitwy" : "Dziennik i jednostki"}
      </button>
      {open ? (
        <div className="battleDrawerPanel">
          <div className="intelTabs battleDrawerTabs">
            <button
              className={activeTab === "logs" ? "active" : ""}
              onClick={() => onTabChange("logs")}
            >
              Dziennik
            </button>
            <button
              className={activeTab === "armies" ? "active" : ""}
              onClick={() => onTabChange("armies")}
            >
              Jednostki
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
