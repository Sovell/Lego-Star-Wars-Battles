import { describe, expect, it } from "vitest";
import { resolveBoardRendererMode } from "./board-renderer";

describe("board renderer selection", () => {
  it("forces the DOM renderer when the developer switch is disabled", () => {
    expect(resolveBoardRendererMode(false, "pixi")).toBe("dom");
  });

  it("keeps the selected renderer while the developer switch is enabled", () => {
    expect(resolveBoardRendererMode(true, "pixi")).toBe("pixi");
  });
});
