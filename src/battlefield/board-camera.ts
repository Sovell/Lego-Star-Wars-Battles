export type BoardCamera = {
  zoom: number;
  x: number;
  y: number;
};

export function zoomCameraAtPoint(
  camera: BoardCamera,
  nextZoom: number,
  point: { x: number; y: number },
): BoardCamera {
  if (camera.zoom <= 0 || nextZoom <= 0 || camera.zoom === nextZoom) {
    return { ...camera, zoom: nextZoom };
  }

  const zoomRatio = nextZoom / camera.zoom;
  return {
    zoom: nextZoom,
    x: point.x - (point.x - camera.x) * zoomRatio,
    y: point.y - (point.y - camera.y) * zoomRatio,
  };
}
