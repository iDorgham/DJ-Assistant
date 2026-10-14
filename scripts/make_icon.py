"""Generate the DJ Assistant source app icon (1024x1024 PNG).

Design: rounded-square dark tile with a diagonal gradient, a soft top sheen,
glowing EQ bars, and a subtle gradient border. Mirrors ``assets/logo.svg``.

Run:  python scripts/make_icon.py
Then: pnpm --filter @dj-assistant/desktop exec tauri icon <output png>
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
SS = 4  # supersample factor for smooth edges
S = SIZE * SS

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps", "desktop", "src-tauri")
OUT_PNG = os.path.abspath(os.path.join(OUT_DIR, "app-icon.png"))

# Brand palette (from assets/logo.svg)
BG_TOP = (23, 27, 37)         # #171B25
BG_BOTTOM = (10, 12, 17)      # #0A0C11
BAR_TOP = (92, 225, 255)      # #5CE1FF
BAR_BOTTOM = (0, 144, 255)    # #0090FF
BORDER_TOP = (46, 52, 74)     # #2E344A
BORDER_BOTTOM = (26, 31, 43)  # #1A1F2B
SHEEN_ALPHA = 20              # ~8% white highlight at the top edge


def make_diagonal_gradient(size: int, top_color, bottom_color) -> Image.Image:
    """Diagonal gradient from top-left to bottom-right."""
    axis = np.linspace(0.0, 1.0, size, dtype=np.float32)
    t = (axis[None, :] + axis[:, None]) / 2.0  # top-left 0 -> bottom-right 1
    arr = np.empty((size, size, 3), dtype=np.uint8)
    for i in range(3):
        arr[:, :, i] = (top_color[i] + (bottom_color[i] - top_color[i]) * t).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def make_vertical_gradient(size: int, top_color, bottom_color) -> Image.Image:
    """Vertical gradient from top to bottom."""
    axis = np.linspace(0.0, 1.0, size, dtype=np.float32)
    t = axis[:, None]  # top 0 -> bottom 1
    arr = np.empty((size, size, 3), dtype=np.uint8)
    for i in range(3):
        arr[:, :, i] = (top_color[i] + (bottom_color[i] - top_color[i]) * t).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def make_sheen(size: int, mask: Image.Image) -> Image.Image:
    """White highlight fading from the top edge, clipped to the tile mask."""
    axis = np.linspace(0.0, 1.0, size, dtype=np.float32)
    alpha = np.clip((0.45 - axis) / 0.45, 0.0, 1.0) * SHEEN_ALPHA  # top -> 0 by 45%
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    arr[..., 0:3] = 255
    arr[..., 3] = np.repeat(alpha[:, None], size, axis=1).astype(np.uint8)
    arr[..., 3] = (arr[..., 3].astype(np.float32) * (np.array(mask, dtype=np.float32) / 255.0)).astype(
        np.uint8
    )
    return Image.fromarray(arr, "RGBA")


def build() -> Image.Image:
    # --- Background tile -------------------------------------------------
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bg_grad = make_diagonal_gradient(S, BG_TOP, BG_BOTTOM).convert("RGBA")
    mask = rounded_mask(S, radius=int(S * 0.22))
    tile.paste(bg_grad, (0, 0), mask)

    # --- Soft top sheen (depth) -----------------------------------------
    tile.alpha_composite(make_sheen(S, mask))

    # --- EQ bars ---------------------------------------------------------
    # SVG: 7 bars centered, each 8 wide, heights 26..88, y positions 51..20
    # Scale from 128 to S
    def sx(v: float) -> float:
        return v * S / 128.0

    bar_w = sx(8)
    bar_xs = [sx(18), sx(32), sx(46), sx(60), sx(74), sx(88), sx(102)]
    bar_ys = [sx(51), sx(41), sx(30), sx(20), sx(30), sx(41), sx(51)]
    bar_hs = [sx(26), sx(46), sx(68), sx(88), sx(68), sx(46), sx(26)]

    def glow(std: float, opacity: float) -> Image.Image:
        """Blurred copy of the bars at the given opacity."""
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for x, y, h in zip(bar_xs, bar_ys, bar_hs):
            ld.rounded_rectangle([x, y, x + bar_w, y + h], radius=sx(4), fill=BAR_TOP + (255,))
        layer = layer.filter(ImageFilter.GaussianBlur(std))
        a = np.array(layer)
        a[:, :, 3] = (a[:, :, 3] * opacity).astype(np.uint8)
        return Image.fromarray(a, "RGBA")

    # Two layers: a wide soft bloom plus a tight halo.
    tile.alpha_composite(glow(sx(5), 0.55))
    tile.alpha_composite(glow(sx(1.5), 0.9))

    # Solid bars with vertical gradient
    bar_grad = make_vertical_gradient(S, BAR_TOP, BAR_BOTTOM).convert("RGBA")
    for x, y, h in zip(bar_xs, bar_ys, bar_hs):
        # Full gradient ramp per bar: crop a 1px-wide full-height column and
        # resize it to the bar so every bar spans cyan→blue (cropping the top
        # h/S would leave tall bars short of blue and tint short bars cyan).
        bar_tile = Image.new("RGBA", (int(bar_w), int(h)), (0, 0, 0, 0))
        bar_tile.paste(bar_grad.crop((0, 0, 1, S)).resize((int(bar_w), int(h))), (0, 0))
        # Round the corners of the bar tile
        bar_mask = Image.new("L", (int(bar_w), int(h)), 0)
        ImageDraw.Draw(bar_mask).rounded_rectangle(
            [0, 0, int(bar_w) - 1, int(h) - 1], radius=int(sx(4)), fill=255
        )
        bar_tile.putalpha(bar_mask)
        tile.paste(bar_tile, (int(x), int(y)), bar_mask)

    # --- Gradient border -------------------------------------------------
    ring = Image.new("L", (S, S), 0)
    ImageDraw.Draw(ring).rounded_rectangle(
        [sx(1.5), sx(1.5), sx(126.5), sx(126.5)],
        radius=int(sx(30)),
        outline=255,
        width=int(sx(3)),
    )
    border_grad = make_vertical_gradient(S, BORDER_TOP, BORDER_BOTTOM).convert("RGBA")
    tile.paste(border_grad, (0, 0), ring)

    # --- Clip to tile shape & downscale ---------------------------------
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(tile, (0, 0), mask)
    return out.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    icon = build()
    icon.save(OUT_PNG, "PNG")
    print(f"Wrote {OUT_PNG} ({icon.size[0]}x{icon.size[1]})")


if __name__ == "__main__":
    main()
