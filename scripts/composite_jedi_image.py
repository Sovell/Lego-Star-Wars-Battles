from collections import deque
from pathlib import Path
import sys

from PIL import Image, ImageFilter

from composite_unit_images import make_backdrop


def is_background_pixel(pixel: tuple[int, int, int]) -> bool:
    r, g, b = pixel
    max_channel = max(r, g, b)
    min_channel = min(r, g, b)
    saturation = max_channel - min_channel

    blue_gray = b >= r and g >= r and b >= 75 and saturation <= 80
    dark_wall = max_channel < 95 and saturation <= 55
    rainy_blue = b > 105 and g > 90 and r < 110
    return blue_gray or dark_wall or rainy_blue


def edge_background_alpha(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def add(x: int, y: int) -> None:
        index = y * width + x
        if visited[index] or not is_background_pixel(pixels[x, y]):
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

    return alpha.filter(ImageFilter.GaussianBlur(0.9))


def main() -> int:
    if len(sys.argv) != 4:
        print("Usage: composite_jedi_image.py BACKGROUND INPUT OUTPUT")
        return 2

    background = Image.open(sys.argv[1])
    source = Image.open(sys.argv[2]).convert("RGBA")
    alpha = edge_background_alpha(source)
    subject = source.copy()
    subject.putalpha(alpha)
    backdrop = make_backdrop(background, source.size)
    Image.alpha_composite(backdrop, subject).save(sys.argv[3])
    print(f"Wrote {sys.argv[3]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
