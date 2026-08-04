import { describe, expect, it } from "vitest";
import { resolveBoardRendererMode } from "./board-renderer";

describe("board renderer selection", () => {
  it("keeps Pixi as the production renderer when the developer switch is hidden", () => {
    expect(resolveBoardRendererMode(false, "pixi")).toBe("pixi");
  });

  it("keeps the selected renderer while the developer switch is enabled", () => {
    expect(resolveBoardRendererMode(true, "pixi")).toBe("pixi");
  });
});
