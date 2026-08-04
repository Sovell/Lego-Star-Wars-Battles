import { describe, expect, it } from "vitest";
import { zoomCameraAtPoint } from "./board-camera";

describe("board camera", () => {
  it("keeps the world point under the cursor fixed while zooming", () => {
    const camera = { zoom: 1, x: 0, y: 0 };
    const cursor = { x: -240, y: -160 };
    const next = zoomCameraAtPoint(camera, 2, cursor);

    expect(next).toEqual({ zoom: 2, x: 240, y: 160 });
    expect((cursor.x - next.x) / next.zoom).toBe((cursor.x - camera.x) / camera.zoom);
    expect((cursor.y - next.y) / next.zoom).toBe((cursor.y - camera.y) / camera.zoom);
  });

  it("still supports zoom controls anchored at the viewport centre", () => {
    expect(zoomCameraAtPoint({ zoom: 1, x: 30, y: -20 }, 1.5, { x: 0, y: 0 }))
      .toEqual({ zoom: 1.5, x: 45, y: -30 });
  });
});
