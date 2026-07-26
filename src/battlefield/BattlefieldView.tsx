import { lazy, Suspense, useMemo, useState } from "react";
import type { MissionState } from "../core/scenario/scenario-types";
import type { Battle } from "../types";
import { createBoardViewModel } from "./board-view-model";
import {
  resolveBoardRendererMode,
  type BoardRendererMode,
  type BoardRendererProps,
} from "./board-renderer";
import { DomMapBoard } from "./DomMapBoard";
import "./battlefield-view.css";

const PixiMapBoard = lazy(async () => {
  const module = await import("./PixiMapBoard");
  return { default: module.PixiMapBoard };
});

export function BattlefieldView({
  battle,
  enableRendererSwitch = false,
  interactionDisabled,
  mission,
  selectedUnitId,
  onCellClick,
  onSelectedUnitChange,
}: {
  battle: Battle;
  enableRendererSwitch?: boolean;
  interactionDisabled: boolean;
  mission: MissionState;
  selectedUnitId: string;
  onCellClick: (x: number, y: number) => void;
  onSelectedUnitChange: (unitId: string) => void;
}) {
  const [renderer, setRenderer] = useState<BoardRendererMode>("dom");
  const activeRenderer = resolveBoardRendererMode(enableRendererSwitch, renderer);
  const viewModel = useMemo(
    () => createBoardViewModel(battle, mission),
    [battle, mission],
  );
  const rendererProps: BoardRendererProps = {
    interactionDisabled,
    selectedUnitId,
    viewModel,
    onCellClick,
    onSelectedUnitChange,
  };

  return (
    <section className="battlefieldView">
      {enableRendererSwitch ? (
        <div className="rendererSwitch" role="group" aria-label="Renderer planszy">
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
          {renderer === "pixi" ? <small>Renderer eksperymentalny</small> : null}
        </div>
      ) : null}
      {activeRenderer === "pixi" ? (
        <Suspense fallback={<div className="pixiMapLoading">Uruchamianie Pixi…</div>}>
          <PixiMapBoard {...rendererProps} />
        </Suspense>
      ) : (
        <DomMapBoard {...rendererProps} />
      )}
    </section>
  );
}
