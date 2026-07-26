export type SquareBoardLayout = {
  boardHeight: number;
  boardWidth: number;
  cellSize: number;
  x: number;
  y: number;
};

export function calculateSquareBoardLayout({
  columns,
  gap,
  height,
  padding,
  rows,
  width,
}: {
  columns: number;
  gap: number;
  height: number;
  padding: number;
  rows: number;
  width: number;
}): SquareBoardLayout {
  const availableCellWidth =
    (width - padding * 2 - gap * Math.max(0, columns - 1)) / Math.max(1, columns);
  const availableCellHeight =
    (height - padding * 2 - gap * Math.max(0, rows - 1)) / Math.max(1, rows);
  const cellSize = Math.max(1, Math.min(availableCellWidth, availableCellHeight));
  const boardWidth = cellSize * columns + gap * Math.max(0, columns - 1);
  const boardHeight = cellSize * rows + gap * Math.max(0, rows - 1);

  return {
    boardHeight,
    boardWidth,
    cellSize,
    x: Math.max(padding, (width - boardWidth) / 2),
    y: Math.max(padding, (height - boardHeight) / 2),
  };
}
