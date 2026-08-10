import { useState } from "react";
import { mapThemes, type MapThemeId } from "../../core/map-generation";
import type { ScenarioMapGenerationState } from "../scenario-draft";
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
}) {
  const [pendingAction, setPendingAction] = useState<GenerationAction>();
  const selectedTheme = mapThemes.find(({ id }) => id === settings.themeId) ?? mapThemes[0];
  const generated = settings.lastRecipe;
  const settingsChanged = Boolean(
    generated && (
      generated.seed !== settings.seed || generated.themeId !== settings.themeId
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

  return (
    <section className="mapGeneratorPanel">
      <div className="mapGeneratorHeader">
        <div>
          <span>Generator mapy</span>
          <strong>{selectedTheme.name}</strong>
        </div>
        <small>{boardWidth} × {boardHeight}</small>
      </div>
      <p>
        Układ uwzględni aktualny scenariusz, drużyny, obrońcę i strefy wejścia.
      </p>
      <div className="mapGeneratorFields">
        <label>
          Motyw
          <select
            value={settings.themeId}
            onChange={(event) => onSettingsChange({
              themeId: event.target.value as MapThemeId,
            })}
          >
            {mapThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.name}</option>
            ))}
          </select>
        </label>
        <label>
          Seed
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
          Ostatnio wygenerowano seed {generated.seed} · generator v{generated.generatorVersion}
        </small>
      ) : null}
      <div className="mapGeneratorActions">
        <button
          className="primaryButton"
          disabled={!canGenerate}
          type="button"
          onClick={() => requestGeneration("current-seed")}
        >
          {generated ? settingsChanged ? "Zastosuj seed" : "Odtwórz mapę" : "Generuj mapę"}
        </button>
        {generated ? (
          <button
            className="secondaryButton"
            disabled={!canGenerate}
            type="button"
            onClick={() => requestGeneration("next-seed")}
          >
            Generuj ponownie
          </button>
        ) : null}
      </div>
      {!canGenerate ? (
        <small className="mapGeneratorHint">
          Generator wymaga od 2 do 4 skonfigurowanych armii.
        </small>
      ) : null}
      {pendingAction ? (
        <div className="mapGeneratorWarning" role="alert">
          <strong>Zastąpić ręcznie przygotowaną mapę?</strong>
          <span>Teren, obiekty i strefy rozmieszczenia zostaną wygenerowane od nowa.</span>
          <div>
            <button className="dangerButton" type="button" onClick={confirmGeneration}>
              Zastąp mapę
            </button>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setPendingAction(undefined)}
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
