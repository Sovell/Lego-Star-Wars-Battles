import { lazy, Suspense, useMemo, useState } from "react";
import type { MissionState, ScenarioDefinition } from "../core/scenario/scenario-types";
import { getMapTheme, type MapThemeId } from "../core/map-generation";
import type { AbilityDefinition, Battle, OrderType } from "../types";
import type { BattlefieldVisualEvent } from "./battlefield-visual-events";
import { createBoardInteractionModel } from "./board-interaction-model";
import { createBoardViewModel } from "./board-view-model";
import {
  resolveBoardRendererMode,
  type BoardRendererMode,
  type BoardRendererProps,
} from "./board-renderer";
import { DomMapBoard } from "./DomMapBoard";
import "./battlefield-view.css";
import { localizeThemeName, useI18n, type Language } from "../i18n";

const PixiMapBoard = lazy(async () => {
  const module = await import("./PixiMapBoard");
  return { default: module.PixiMapBoard };
});

export function BattlefieldView({
  battle,
  deploymentZoneCells,
  enableRendererSwitch = false,
  interactionDisabled,
  mapThemeId,
  mission,
  missionActive,
  scenario,
  selectedAbility,
  abilityTargetPosition,
  abilityTargetUnitId,
  selectedOrder,
  selectedWeaponId,
  selectedUnitId,
  selectingAbilityPosition,
  selectingMovePosition,
  targetUnitId,
  visualEvent,
  onCellClick,
  onSelectedUnitChange,
}: {
  battle: Battle;
  deploymentZoneCells?: Array<{ x: number; y: number }>;
  enableRendererSwitch?: boolean;
  interactionDisabled: boolean;
  mapThemeId: MapThemeId;
  mission: MissionState;
  missionActive: boolean;
  scenario: ScenarioDefinition;
  selectedAbility?: AbilityDefinition;
  abilityTargetPosition?: { x: number; y: number };
  abilityTargetUnitId?: string;
  selectedOrder: OrderType;
  selectedWeaponId: string;
  selectedUnitId: string;
  selectingAbilityPosition: boolean;
  selectingMovePosition: boolean;
  targetUnitId?: string;
  visualEvent?: BattlefieldVisualEvent;
  onCellClick: (x: number, y: number) => void;
  onSelectedUnitChange: (unitId: string) => void;
}) {
  const { language, text } = useI18n();
  const [renderer, setRenderer] = useState<BoardRendererMode>("pixi");
  const activeRenderer = resolveBoardRendererMode(enableRendererSwitch, renderer);
  const mapTheme = getMapTheme(mapThemeId);
  const viewModel = useMemo(
    () => createBoardViewModel(battle, mission),
    [battle, mission],
  );
  const interactionModel = useMemo(
    () => createBoardInteractionModel({
      battle,
      scenario,
      interactionDisabled,
      missionActive,
      selectedUnitId,
      selectedOrder,
      selectedWeaponId,
      selectingMovePosition,
      selectingAbilityPosition,
      selectedAbility,
      abilityTargetUnitId,
      abilityTargetPosition,
      targetUnitId,
    }),
    [
      abilityTargetPosition,
      abilityTargetUnitId,
      battle,
      interactionDisabled,
      missionActive,
      scenario,
      selectedAbility,
      selectedOrder,
      selectedUnitId,
      selectedWeaponId,
      selectingAbilityPosition,
      selectingMovePosition,
      targetUnitId,
    ],
  );
  const rendererProps: BoardRendererProps = {
    deploymentZoneCells: new Set(
      deploymentZoneCells?.map((cell) => `${cell.x},${cell.y}`) ?? [],
    ),
    scenarioZoneCells: new Set(
      scenario.zones?.flatMap((zone) =>
        zone.cells.map((cell) => `${cell.x},${cell.y}`)
      ) ?? [],
    ),
    interactionDisabled,
    interactionModel,
    language,
    mapThemeId,
    selectedUnitId,
    visualEvent,
    viewModel,
    onCellClick,
    onSelectedUnitChange,
  };

  return (
    <section className="battlefieldView">
      <div
        className="mapThemeBadge"
        style={{
          borderColor: mapTheme.presentation.palette.accent,
          color: mapTheme.presentation.palette.accent,
        }}
      >
        <span>{localizeThemeName(language, mapTheme.id, mapTheme.name)}</span>
        <small>{mapTheme.presentation.groundTextureId}</small>
      </div>
      {enableRendererSwitch ? (
        <div className="rendererSwitch" role="group" aria-label={text("Renderer planszy", "Board renderer")}>
          <span>Renderer</span>
          <button
            className={renderer === "dom" ? "active" : ""}
            onClick={() => setRenderer("dom")}
          >
            DOM
          </button>
          <button
            className={renderer === "pixi" ? "active" : ""}
            onClick={() => setRenderer("pixi")}
          >
            Pixi
          </button>
          {renderer === "pixi" ? <small>{text("Renderer eksperymentalny", "Experimental renderer")}</small> : null}
        </div>
      ) : null}
      {interactionModel.hint ? (
        <div className={`boardInteractionHint ${interactionModel.mode}`} role="status">
          {localizeInteractionHint(language, interactionModel.hint)}
        </div>
      ) : null}
      {activeRenderer === "pixi" ? (
        <Suspense fallback={<div className="pixiMapLoading">{text("Uruchamianie Pixi…", "Starting Pixi…")}</div>}>
          <PixiMapBoard {...rendererProps} />
        </Suspense>
      ) : (
        <DomMapBoard {...rendererProps} />
      )}
    </section>
  );
}

function localizeInteractionHint(language: Language, hint: string): string {
  if (language === "pl") return hint;
  const translations: Record<string, string> = {
    "Niebieskie pola: legalne wejście jednostki z rezerwy.": "Blue tiles: legal entry points for a reserve unit.",
    "Zielone pola: legalny zasięg ruchu.": "Green tiles: legal movement range.",
    "Zielone pola: legalny cel pozycyjny zdolności.": "Green tiles: legal positional ability targets.",
    "Czerwone pola: legalne cele wybranej broni.": "Red tiles: legal targets for the selected weapon.",
    "Fioletowe pola: legalne cele wybranej zdolności.": "Purple tiles: legal targets for the selected ability.",
  };
  return translations[hint] ?? hint;
}
