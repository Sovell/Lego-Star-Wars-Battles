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
  const modeDescription = mode === "units"
    ? text("Wybierz oddział, a następnie wskaż pole rozmieszczenia.", "Select a unit, then choose its deployment tile.")
    : mode === "terrain"
      ? text("Wybrany typ terenu zostanie naniesiony kliknięciem.", "The selected terrain type is painted with a click.")
      : mode === "objects"
        ? text("Kliknij pole, aby umieścić albo usunąć obiekt.", "Click a tile to place or remove an object.")
        : text("Zaznacz pola wejścia dla wybranej armii.", "Mark entry tiles for the selected army.");
  return (
    <aside className="setupToolRail" aria-label={text("Narzędzia przygotowania mapy", "Map setup tools")}>
      <div className="setupToolRailHeader">
        <span>{text("Narzędzia mapy", "Map tools")}</span>
        <strong>
          {mode === "units"
            ? text("Jednostki", "Units")
            : mode === "terrain"
              ? text("Teren", "Terrain")
              : mode === "objects"
                ? text("Obiekty", "Objects")
                : text("Rozmieszczenie", "Deployment")}
        </strong>
        <small>{mapEditingLocked
          ? text("Mapa misji jest zablokowana; rozmieszczanie jednostek pozostaje aktywne.", "The mission map is locked; unit deployment remains active.")
          : modeDescription}</small>
      </div>
      <div className="segmented setupToolModes">
        <button type="button" aria-pressed={mode === "units"} className={mode === "units" ? "active" : ""} onClick={() => onModeChange("units")}>
          {text("Jednostki", "Units")}
        </button>
        {!mapEditingLocked ? (
          <>
            <button type="button" aria-pressed={mode === "terrain"} className={mode === "terrain" ? "active" : ""} onClick={() => onModeChange("terrain")}>
              {text("Teren", "Terrain")}
            </button>
            <button type="button" aria-pressed={mode === "objects"} className={mode === "objects" ? "active" : ""} onClick={() => onModeChange("objects")}>
              {text("Obiekty", "Objects")}
            </button>
            <button type="button" aria-pressed={mode === "deployment"} className={mode === "deployment" ? "active" : ""} onClick={() => onModeChange("deployment")}>
              {text("Rozmieszczenie", "Deployment")}
            </button>
          </>
        ) : null}
      </div>
      <div className="setupToolRailContent">{children}</div>
    </aside>
  );
}
