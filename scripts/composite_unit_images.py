from collections import deque
from pathlib import Path
import sys

from PIL import Image, ImageFilter


def edge_white_mask(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
      r, g, b = pixels[x, y]
      return r >= 244 and g >= 244 and b >= 244 and abs(r - g) <= 10 and abs(g - b) <= 10

    def add(x: int, y: int) -> None:
      index = y * width + x
      if visited[index] or not is_background(x, y):
        return
      visited[index] = 1
      queue.append((x, y))

    for x in range(width):
      add(x, 0)
      add(x, height - 1)
    for y in range(height):
      add(0, y)
      add(width - 1, y)

    while queue:
      x, y = queue.popleft()
      if x > 0:
        add(x - 1, y)
      if x < width - 1:
        add(x + 1, y)
      if y > 0:
        add(x, y - 1)
      if y < height - 1:
        add(x, y + 1)

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
      for x in range(width):
        if visited[y * width + x]:
          alpha_pixels[x, y] = 0

    return alpha.filter(ImageFilter.GaussianBlur(0.8))


def make_backdrop(background: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    bg = background.convert("RGB")
    bg_ratio = bg.width / bg.height
    out_ratio = width / height

    if bg_ratio > out_ratio:
      new_height = height
      new_width = int(height * bg_ratio)
    else:
      new_width = width
      new_height = int(width / bg_ratio)

    bg = bg.resize((new_width, new_height), Image.Resampling.LANCZOS)
    left = (new_width - width) // 2
    top = (new_height - height) // 2
    bg = bg.crop((left, top, left + width, top + height))

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    vignette = Image.new("L", (width, height), 0)
    vignette_pixels = vignette.load()
    cx, cy = width / 2, height / 2
    max_dist = (cx * cx + cy * cy) ** 0.5
    for y in range(height):
      for x in range(width):
        dist = (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / max_dist
        vignette_pixels[x, y] = int(max(0, min(120, (dist - 0.35) * 180)))
    overlay.putalpha(vignette.filter(ImageFilter.GaussianBlur(8)))
    return Image.alpha_composite(bg.convert("RGBA"), overlay)


def composite(source_path: Path, background: Image.Image, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    alpha = edge_white_mask(source)
    subject = source.copy()
    subject.putalpha(alpha)
    backdrop = make_backdrop(background, source.size)
    result = Image.alpha_composite(backdrop, subject)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path)


def main() -> int:
    if len(sys.argv) < 4:
      print("Usage: composite_unit_images.py BACKGROUND INPUT OUTPUT [INPUT OUTPUT ...]")
      return 2

    background = Image.open(sys.argv[1])
    pairs = sys.argv[2:]
    if len(pairs) % 2:
      print("Input/output arguments must be pairs.")
      return 2

    for index in range(0, len(pairs), 2):
      composite(Path(pairs[index]), background, Path(pairs[index + 1]))
      print(f"Wrote {pairs[index + 1]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
