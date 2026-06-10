from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFilter


SIZE = 256
OUT = Path("public/terrain-textures")


def noise_base(colors: list[tuple[int, int, int]], seed: int) -> Image.Image:
    random.seed(seed)
    img = Image.new("RGB", (SIZE, SIZE), colors[0])
    pixels = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            color = random.choice(colors)
            jitter = random.randint(-10, 10)
            pixels[x, y] = tuple(max(0, min(255, channel + jitter)) for channel in color)
    return img.filter(ImageFilter.GaussianBlur(1.1))


def add_grid(draw: ImageDraw.ImageDraw, color: tuple[int, int, int, int], step: int = 32) -> None:
    for pos in range(0, SIZE + 1, step):
        draw.line((pos, 0, pos, SIZE), fill=color, width=1)
        draw.line((0, pos, SIZE, pos), fill=color, width=1)


def open_ground() -> Image.Image:
    img = noise_base([(42, 48, 54), (35, 42, 49), (50, 54, 58)], 11).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    add_grid(draw, (120, 140, 150, 35), 32)
    return img


def light_cover() -> Image.Image:
    img = noise_base([(32, 61, 45), (40, 76, 54), (26, 50, 38)], 22).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    random.seed(23)
    for _ in range(24):
        x = random.randint(0, SIZE)
        y = random.randint(0, SIZE)
        radius = random.randint(12, 28)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(65, 115, 72, 90))
    add_grid(draw, (155, 190, 150, 30), 32)
    return img.filter(ImageFilter.GaussianBlur(0.3))


def heavy_cover() -> Image.Image:
    img = noise_base([(47, 48, 56), (56, 53, 62), (37, 41, 48)], 33).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    random.seed(34)
    for _ in range(11):
        x = random.randint(-20, SIZE - 30)
        y = random.randint(-20, SIZE - 30)
        w = random.randint(45, 90)
        h = random.randint(20, 55)
        draw.rounded_rectangle((x, y, x + w, y + h), radius=4, fill=(80, 78, 86, 150))
        draw.line((x + 6, y + h - 5, x + w - 6, y + 5), fill=(20, 22, 27, 80), width=3)
    add_grid(draw, (180, 180, 190, 28), 32)
    return img


def building() -> Image.Image:
    img = noise_base([(62, 65, 70), (78, 79, 82), (48, 52, 58)], 44).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    add_grid(draw, (20, 22, 27, 90), 32)
    for pos in range(0, SIZE + 1, 64):
        draw.line((pos, 0, pos, SIZE), fill=(170, 176, 180, 55), width=2)
        draw.line((0, pos, SIZE, pos), fill=(170, 176, 180, 55), width=2)
    random.seed(45)
    for _ in range(16):
        x = random.randint(8, SIZE - 40)
        y = random.randint(8, SIZE - 40)
        draw.rectangle((x, y, x + 22, y + 12), fill=(120, 135, 145, 80))
    return img


def difficult_terrain() -> Image.Image:
    img = noise_base([(69, 55, 36), (58, 47, 34), (82, 68, 45)], 55).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    random.seed(56)
    for _ in range(45):
        x = random.randint(0, SIZE)
        y = random.randint(0, SIZE)
        length = random.randint(18, 45)
        angle = random.random() * math.tau
        x2 = x + math.cos(angle) * length
        y2 = y + math.sin(angle) * length
        draw.line((x, y, x2, y2), fill=(120, 102, 70, 80), width=random.randint(2, 5))
    add_grid(draw, (170, 140, 90, 30), 32)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    textures = {
        "open.png": open_ground(),
        "light-cover.png": light_cover(),
        "heavy-cover.png": heavy_cover(),
        "building.png": building(),
        "difficult-terrain.png": difficult_terrain(),
    }
    for name, image in textures.items():
        image.save(OUT / name)
        print(f"Wrote {OUT / name}")


if __name__ == "__main__":
    main()
