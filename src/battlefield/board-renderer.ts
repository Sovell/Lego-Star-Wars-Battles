import type { BoardViewModel } from "./board-view-model";
import type { BoardInteractionModel } from "./board-interaction-model";

export type BoardRendererMode = "dom" | "pixi";

export function resolveBoardRendererMode(
  enableRendererSwitch: boolean,
  renderer: BoardRendererMode,
): BoardRendererMode {
  return enableRendererSwitch ? renderer : "dom";
}

export type BoardRendererProps = {
  interactionDisabled: boolean;
  interactionModel: BoardInteractionModel;
  selectedUnitId: string;
  viewModel: BoardViewModel;
  onCellClick: (x: number, y: number) => void;
  onSelectedUnitChange: (unitId: string) => void;
};
