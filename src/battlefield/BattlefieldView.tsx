import { lazy, Suspense, useMemo, useState } from "react";
import type { MissionState, ScenarioDefinition } from "../core/scenario/scenario-types";
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

const PixiMapBoard = lazy(async () => {
  const module = await import("./PixiMapBoard");
  return { default: module.PixiMapBoard };
});

export function BattlefieldView({
  battle,
  enableRendererSwitch = false,
  interactionDisabled,
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
  enableRendererSwitch?: boolean;
  interactionDisabled: boolean;
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
  const [renderer, setRenderer] = useState<BoardRendererMode>("pixi");
  const activeRenderer = resolveBoardRendererMode(enableRendererSwitch, renderer);
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
    interactionDisabled,
    interactionModel,
    selectedUnitId,
    visualEvent,
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
      {interactionModel.hint ? (
        <div className={`boardInteractionHint ${interactionModel.mode}`} role="status">
          {interactionModel.hint}
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
