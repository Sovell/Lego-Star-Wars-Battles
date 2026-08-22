"""Create colored Clone Trooper sprite variants from the shared transparent render.

The source figure stays white.  Only bright armor pixels inside the selected marking
shapes are recolored, preserving the original LEGO shading and black linework.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "unit-images" / "sprites" / "clone-trooper.png"
OUTPUT_DIR = SOURCE.parent


def polygon_mask(points: list[tuple[int, int]]) -> np.ndarray:
    mask = Image.new("L", (512, 512))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return np.asarray(mask) > 0


def union_mask(*shapes: list[tuple[int, int]]) -> np.ndarray:
    result = np.zeros((512, 512), dtype=bool)
    for shape in shapes:
        result |= polygon_mask(shape)
    return result


MARKINGS = {
    "clone-command-squad.png": {
        "color": (65, 157, 235),
        "shapes": [
            [(244, 43), (274, 48), (274, 153), (258, 170), (243, 150)],
            [(195, 149), (224, 161), (221, 180), (201, 174)],
            [(292, 149), (318, 174), (294, 180), (291, 161)],
            [(165, 199), (190, 202), (187, 274), (165, 270)],
            [(322, 200), (346, 200), (349, 270), (326, 274)],
            [(205, 206), (218, 207), (219, 303), (207, 301)],
            [(290, 207), (304, 206), (304, 300), (292, 302)],
        ],
    },
    "clone-assault-squad.png": {
        "color": (220, 67, 64),
        "shapes": [
            [(205, 70), (310, 70), (310, 90), (205, 90)],
            [(242, 44), (274, 48), (270, 80), (245, 79)],
            [(196, 151), (225, 162), (222, 178), (202, 173)],
            [(292, 151), (318, 173), (295, 178), (291, 162)],
            [(163, 210), (190, 210), (186, 232), (163, 233)],
            [(322, 210), (348, 210), (349, 233), (325, 232)],
            [(211, 268), (301, 268), (302, 287), (211, 287)],
        ],
    },
    "clone-engineers-332nd.png": {
        "color": (239, 132, 36),
        "shapes": [
            [(211, 54), (232, 46), (280, 152), (259, 166)],
            [(287, 50), (303, 64), (265, 154), (247, 165)],
            [(164, 200), (189, 202), (188, 253), (164, 250)],
            [(323, 201), (347, 201), (349, 250), (325, 253)],
            [(212, 301), (301, 301), (302, 319), (211, 319)],
        ],
    },
    "clone-commando.png": {
        "color": (55, 76, 83),
        "shapes": [
            [(204, 89), (310, 89), (306, 128), (282, 151), (229, 151), (205, 127)],
            [(197, 151), (221, 159), (229, 184), (205, 177)],
            [(289, 159), (316, 151), (308, 177), (283, 184)],
            [(204, 206), (305, 206), (301, 303), (208, 303)],
            [(162, 201), (189, 201), (188, 274), (164, 270)],
            [(323, 201), (348, 201), (349, 270), (326, 274)],
        ],
    },
    "clone-medic.png": {
        "color": (43, 180, 131),
        "shapes": [
            [(245, 44), (273, 49), (273, 151), (258, 165), (244, 150)],
            [(164, 205), (190, 204), (188, 250), (164, 250)],
            [(323, 204), (348, 205), (349, 250), (325, 250)],
            [(246, 235), (267, 235), (267, 255), (246, 255)],
            [(237, 244), (276, 244), (276, 266), (237, 266)],
        ],
    },
}


def recolor(source: np.ndarray, marking: np.ndarray, color: tuple[int, int, int]) -> np.ndarray:
    result = source.copy()
    rgb = result[..., :3].astype(np.float32)
    alpha = result[..., 3] > 0
    brightness = rgb.mean(axis=2)
    armor = alpha & (brightness > 115) & (np.max(rgb, axis=2) - np.min(rgb, axis=2) < 90)
    selected = marking & armor
    shade = np.clip(brightness / 235, 0.22, 1.08)[..., None]
    color_rgb = np.asarray(color, dtype=np.float32) * shade
    rgb[selected] = rgb[selected] * 0.2 + color_rgb[selected] * 0.8
    result[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return result


def main() -> None:
    source = np.asarray(Image.open(SOURCE).convert("RGBA"))
    for filename, variant in MARKINGS.items():
        mask = union_mask(*variant["shapes"])
        image = Image.fromarray(recolor(source, mask, variant["color"]), "RGBA")
        image.save(OUTPUT_DIR / filename)


if __name__ == "__main__":
    main()
