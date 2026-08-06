import type { BoardViewModel } from "./board-view-model";
import type { BoardInteractionModel } from "./board-interaction-model";
import type { BattlefieldVisualEvent } from "./battlefield-visual-events";

export type BoardRendererMode = "dom" | "pixi";

export function resolveBoardRendererMode(
  _enableRendererSwitch: boolean,
  renderer: BoardRendererMode,
): BoardRendererMode {
  return renderer;
}

export type BoardRendererProps = {
  deploymentZoneCells?: ReadonlySet<string>;
  interactionDisabled: boolean;
  interactionModel: BoardInteractionModel;
  selectedUnitId: string;
  visualEvent?: BattlefieldVisualEvent;
  viewModel: BoardViewModel;
  onCellClick: (x: number, y: number) => void;
  onSelectedUnitChange: (unitId: string) => void;
};
