import { describe, expect, it } from "vitest";
import { calculateSquareBoardLayout } from "./board-layout";

describe("square board layout", () => {
  it("keeps cells square and centers the board in a wide viewport", () => {
    const layout = calculateSquareBoardLayout({
      columns: 8,
      gap: 4,
      height: 614,
      padding: 10,
      rows: 8,
      width: 748,
    });

    expect(layout.cellSize).toBe(70.75);
    expect(layout.boardWidth).toBe(layout.boardHeight);
    expect(layout.x).toBe(77);
    expect(layout.y).toBe(10);
  });

  it("supports non-square board dimensions without stretching cells", () => {
    const layout = calculateSquareBoardLayout({
      columns: 10,
      gap: 4,
      height: 720,
      padding: 10,
      rows: 6,
      width: 1280,
    });

    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.boardWidth).toBeCloseTo(layout.cellSize * 10 + 36);
    expect(layout.boardHeight).toBeCloseTo(layout.cellSize * 6 + 20);
  });
});
