import { useState } from "react";
import { mapThemes, type MapThemeId } from "../../core/map-generation";
import {
  getScenarioMapScale,
  type ScenarioMapGenerationState,
  type ScenarioMapScale,
} from "../scenario-draft";
import {
  localizeThemeDescription,
  localizeThemeName,
  useI18n,
} from "../../i18n";
import "./MapGeneratorPanel.css";

type GenerationAction = "current-seed" | "next-seed";

export function MapGeneratorPanel({
  boardHeight,
  boardWidth,
  canGenerate,
  hasManualMap,
  settings,
  onGenerate,
  onSettingsChange,
  onSizeChange,
}: {
  boardHeight: number;
  boardWidth: number;
  canGenerate: boolean;
  hasManualMap: boolean;
  settings: ScenarioMapGenerationState;
  onGenerate: (useNextSeed: boolean) => void;
  onSettingsChange: (
    patch: Partial<Pick<ScenarioMapGenerationState, "themeId" | "seed">>,
  ) => void;
  onSizeChange: (scale: ScenarioMapScale) => void;
}) {
  const { language, text } = useI18n();
  const [pendingAction, setPendingAction] = useState<GenerationAction>();
  const [pendingSize, setPendingSize] = useState<ScenarioMapScale>();
  const selectedTheme = mapThemes.find(({ id }) => id === settings.themeId) ?? mapThemes[0];
  const generated = settings.lastRecipe;
  const mapScale = getScenarioMapScale({ width: boardWidth, height: boardHeight });
  const settingsChanged = Boolean(
    generated && (
      generated.seed !== settings.seed || generated.themeId !== settings.themeId ||
      generated.width !== boardWidth || generated.height !== boardHeight
    )
  );

  function requestGeneration(action: GenerationAction): void {
    if (hasManualMap) {
      setPendingAction(action);
      return;
    }
    onGenerate(action === "next-seed");
  }

  function confirmGeneration(): void {
    if (!pendingAction) return;
    onGenerate(pendingAction === "next-seed");
    setPendingAction(undefined);
  }

  function requestSizeChange(scale: ScenarioMapScale): void {
    if (scale === mapScale) return;
    if (hasManualMap || generated) {
      setPendingSize(scale);
      return;
    }
    onSizeChange(scale);
  }

  function confirmSizeChange(): void {
    if (!pendingSize) return;
    onSizeChange(pendingSize);
    setPendingSize(undefined);
  }

  return (
    <section className="mapGeneratorPanel">
      <div className="mapGeneratorHeader">
        <div>
          <span>{text("Motyw planetarny", "Planetary theme")}</span>
          <strong>{localizeThemeName(language, selectedTheme.id, selectedTheme.name)}</strong>
        </div>
        <small>{boardWidth} × {boardHeight}</small>
      </div>
      <div
        className="mapThemePreview"
        style={{
          background: `linear-gradient(135deg, ${selectedTheme.presentation.palette.ground}, ${selectedTheme.presentation.palette.shadow})`,
          borderColor: selectedTheme.presentation.palette.accent,
        }}
      >
        <span style={{ background: selectedTheme.presentation.palette.terrain.open }} />
        <span style={{ background: selectedTheme.presentation.palette.terrain.lightCover }} />
        <span style={{ background: selectedTheme.presentation.palette.terrain.difficultTerrain }} />
        <small>{localizeThemeDescription(language, selectedTheme.id, selectedTheme.description)}</small>
      </div>
      <p>{text("Układ uwzględni scenariusz, drużyny, obrońcę i strefy wejścia.", "The layout will account for the scenario, teams, defender, and deployment zones.")}</p>
      <div className="mapGeneratorFields">
        <label>
          {text("Rozmiar", "Size")}
          <select
            value={mapScale}
            onChange={(event) => requestSizeChange(Number(event.target.value) as ScenarioMapScale)}
          >
            <option value={1}>{text("Standardowa — 8 × 8", "Standard — 8 × 8")}</option>
            <option value={2}>{text("Podwójna — 16 × 16", "Double — 16 × 16")}</option>
          </select>
        </label>
        <label>
          {text("Motyw", "Theme")}
          <select
            value={settings.themeId}
            onChange={(event) => onSettingsChange({
              themeId: event.target.value as MapThemeId,
            })}
          >
            {mapThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>{localizeThemeName(language, theme.id, theme.name)}</option>
            ))}
          </select>
        </label>
        <label>
          {text("Ziarno", "Seed")}
          <input
            max={0xffffffff}
            min={0}
            step={1}
            type="number"
            value={settings.seed}
            onChange={(event) => onSettingsChange({ seed: Number(event.target.value) })}
          />
        </label>
      </div>
      {generated ? (
        <small className="mapGeneratorRecipe">
          {text("Ostatnio wygenerowano seed", "Last generated seed")} {generated.seed} · {text("generator", "generator")} v{generated.generatorVersion}
        </small>
      ) : null}
      <div className="mapGeneratorActions">
        <button
          className="primaryButton"
          disabled={!canGenerate}
          type="button"
          onClick={() => requestGeneration("current-seed")}
        >
          {generated
            ? settingsChanged
              ? text("Zastosuj seed", "Apply seed")
              : text("Odtwórz mapę", "Recreate map")
            : text("Generuj mapę", "Generate map")}
        </button>
        {generated ? (
          <button
            className="secondaryButton"
            disabled={!canGenerate}
            type="button"
            onClick={() => requestGeneration("next-seed")}
          >
            {text("Generuj ponownie", "Generate again")}
          </button>
        ) : null}
      </div>
      {!canGenerate ? (
        <small className="mapGeneratorHint">
          {text("Generator wymaga od 2 do 4 skonfigurowanych armii.", "The generator requires 2 to 4 configured armies.")}
        </small>
      ) : null}
      {pendingAction ? (
        <div className="mapGeneratorWarning" role="alert">
          <strong>{text("Zastąpić ręcznie przygotowaną mapę?", "Replace the manually prepared map?")}</strong>
          <span>{text("Teren, obiekty i strefy rozmieszczenia zostaną wygenerowane od nowa.", "Terrain, objects, and deployment zones will be generated again.")}</span>
          <div>
            <button className="dangerButton" type="button" onClick={confirmGeneration}>
              {text("Zastąp mapę", "Replace map")}
            </button>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setPendingAction(undefined)}
            >
              {text("Anuluj", "Cancel")}
            </button>
          </div>
        </div>
      ) : null}
      {pendingSize ? (
        <div className="mapGeneratorWarning" role="alert">
          <strong>{text("Zmienić rozmiar i zastąpić mapę?", "Resize and replace the map?")}</strong>
          <span>{text(
            `Powstanie nowa mapa ${8 * pendingSize} × ${8 * pendingSize}. Teren, obiekty i strefy rozmieszczenia zostaną wygenerowane ponownie.`,
            `A new ${8 * pendingSize} × ${8 * pendingSize} map will be created. Terrain, objects, and deployment zones will be regenerated.`,
          )}</span>
          <div>
            <button className="dangerButton" type="button" onClick={confirmSizeChange}>
              {text("Zmień rozmiar", "Change size")}
            </button>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setPendingSize(undefined)}
            >
              {text("Anuluj", "Cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
