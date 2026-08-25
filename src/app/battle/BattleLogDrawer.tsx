import type { ReactNode } from "react";
import { useI18n } from "../../i18n";

export type BattleDrawerTab = "logs" | "save";

export function BattleLogDrawer({
  activeTab,
  logs,
  onOpenChange,
  onTabChange,
  open,
  save,
}: {
  activeTab: BattleDrawerTab;
  logs: ReactNode;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: BattleDrawerTab) => void;
  open: boolean;
  save?: ReactNode;
}) {
  const { text } = useI18n();
  return (
    <section
      aria-label={text("Narzędzia wywiadowcze", "Intel tools")}
      className={`battleLogDrawer ${open ? "open" : ""}`}
    >
      <button
        aria-expanded={open}
        className="battleDrawerToggle"
        onClick={() => onOpenChange(!open)}
      >
        {open ? text("Zwiń narzędzia Intel", "Hide intel tools") : text("Narzędzia Intel", "Intel tools")}
      </button>
      {open ? (
        <div className="battleDrawerPanel">
          <div className="intelTabs battleDrawerTabs">
            <button
              aria-pressed={activeTab === "logs"}
              className={activeTab === "logs" ? "active" : ""}
              onClick={() => onTabChange("logs")}
            >
              {text("Dziennik", "Log")}
            </button>
            {save ? (
              <button
                aria-pressed={activeTab === "save"}
                className={activeTab === "save" ? "active" : ""}
                onClick={() => onTabChange("save")}
              >
                {text("Zapis", "Save")}
              </button>
            ) : null}
          </div>
          <div className="battleDrawerContent">
            {activeTab === "save" && save ? save : logs}
          </div>
        </div>
      ) : null}
    </section>
  );
}
