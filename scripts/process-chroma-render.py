"""Crop a browser render and turn a green-screen background into transparency."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--crop", default="0,0,512,512")
    parser.add_argument("--chroma-key", action="store_true")
    args = parser.parse_args()

    left, top, right, bottom = (int(value) for value in args.crop.split(","))
    image = Image.open(args.input).convert("RGBA").crop((left, top, right, bottom))

    if args.chroma_key:
        pixels = np.asarray(image, dtype=np.float32)
        rgb = pixels[..., :3]
        # A green-screen composite can be expressed as foreground * alpha plus
        # pure green * (1 - alpha). Green excess therefore recovers edge alpha
        # without leaving a bright halo around antialiased silhouettes.
        green_excess = np.clip(
            rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2]),
            0.0,
            255.0,
        )
        alpha = 1.0 - green_excess / 255.0
        alpha[alpha < 0.06] = 0.0
        safe_alpha = np.maximum(alpha, 1.0 / 255.0)

        foreground = rgb.copy()
        foreground[..., 0] = rgb[..., 0] / safe_alpha
        foreground[..., 1] = (rgb[..., 1] - (1.0 - alpha) * 255.0) / safe_alpha
        foreground[..., 2] = rgb[..., 2] / safe_alpha

        output = np.empty_like(pixels)
        output[..., :3] = np.clip(foreground, 0.0, 255.0)
        output[..., 3] = alpha * 255.0
        image = Image.fromarray(output.astype(np.uint8), "RGBA")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, optimize=True)


if __name__ == "__main__":
    main()
