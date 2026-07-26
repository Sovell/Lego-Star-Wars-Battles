import type { BoardViewModel } from "./board-view-model";

export type BoardRendererMode = "dom" | "pixi";

export type BoardRendererProps = {
  interactionDisabled: boolean;
  selectedUnitId: string;
  viewModel: BoardViewModel;
  onCellClick: (x: number, y: number) => void;
  onSelectedUnitChange: (unitId: string) => void;
};
