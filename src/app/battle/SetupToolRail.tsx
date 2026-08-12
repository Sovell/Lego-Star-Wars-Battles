import type { ReactNode } from "react";
import { useI18n } from "../../i18n";

export type SetupToolMode = "units" | "terrain" | "objects" | "deployment";

export function SetupToolRail({
  children,
  mapEditingLocked = false,
  mode,
  onModeChange,
}: {
  children: ReactNode;
  mapEditingLocked?: boolean;
  mode: SetupToolMode;
  onModeChange: (mode: SetupToolMode) => void;
}) {
  const { text } = useI18n();
  return (
    <aside className="setupToolRail" aria-label={text("Narzędzia przygotowania mapy", "Map setup tools")}>
      <div className="setupToolRailHeader">
        <span>{text("Przygotowanie", "Setup")}</span>
        <strong>
          {mode === "units"
            ? text("Jednostki", "Units")
            : mode === "terrain"
              ? text("Teren", "Terrain")
              : mode === "objects"
                ? text("Obiekty", "Objects")
                : text("Strefy", "Zones")}
        </strong>
      </div>
      <div className="segmented setupToolModes">
        <button className={mode === "units" ? "active" : ""} onClick={() => onModeChange("units")}>
          {text("Jednostki", "Units")}
        </button>
        {!mapEditingLocked ? (
          <>
            <button className={mode === "terrain" ? "active" : ""} onClick={() => onModeChange("terrain")}>
              {text("Teren", "Terrain")}
            </button>
            <button className={mode === "objects" ? "active" : ""} onClick={() => onModeChange("objects")}>
              {text("Obiekty", "Objects")}
            </button>
            <button className={mode === "deployment" ? "active" : ""} onClick={() => onModeChange("deployment")}>
              {text("Strefy", "Zones")}
            </button>
          </>
        ) : null}
      </div>
      <div className="setupToolRailContent">{children}</div>
    </aside>
  );
}
