import type { ReactNode } from "react";

export type SetupToolMode = "units" | "terrain" | "objects" | "deployment";

export function SetupToolRail({
  children,
  mode,
  onModeChange,
}: {
  children: ReactNode;
  mode: SetupToolMode;
  onModeChange: (mode: SetupToolMode) => void;
}) {
  return (
    <aside className="setupToolRail" aria-label="Narzędzia przygotowania mapy">
      <div className="setupToolRailHeader">
        <span>Przygotowanie</span>
        <strong>
          {mode === "units"
            ? "Jednostki"
            : mode === "terrain"
              ? "Teren"
              : mode === "objects"
                ? "Obiekty"
                : "Strefy"}
        </strong>
      </div>
      <div className="segmented setupToolModes">
        <button className={mode === "units" ? "active" : ""} onClick={() => onModeChange("units")}>
          Jednostki
        </button>
        <button className={mode === "terrain" ? "active" : ""} onClick={() => onModeChange("terrain")}>
          Teren
        </button>
        <button className={mode === "objects" ? "active" : ""} onClick={() => onModeChange("objects")}>
          Obiekty
        </button>
        <button className={mode === "deployment" ? "active" : ""} onClick={() => onModeChange("deployment")}>
          Strefy
        </button>
      </div>
      <div className="setupToolRailContent">{children}</div>
    </aside>
  );
}
