"""Generate the DJ Assistant source app icon (1024x1024 PNG).

Design: rounded-square dark tile, blue->cyan diagonal gradient, vinyl disc with
grooves, center label, and a highlight sheen. Matches the brand colors used in
apps/desktop/src/App.tsx (blue-600 -> cyan-400 on #0f1117).

Run:  python scripts/make_icon.py
Then: pnpm --filter @dj-assistant/desktop exec tauri icon <output png>
"""

from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
SS = 4  # supersample factor for smooth edges
S = SIZE * SS

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps", "desktop", "src-tauri")
OUT_PNG = os.path.abspath(os.path.join(OUT_DIR, "app-icon.png"))

# Brand palette
BG_DARK = (15, 17, 23)
BLUE = (37, 99, 235)      # blue-600
CYAN = (34, 211, 238)     # cyan-400
DISC_DARK = (24, 27, 38)
LABEL = (59, 130, 246)


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def make_gradient(size: int) -> Image.Image:
    """Diagonal blue->cyan gradient (vectorized for speed)."""
    axis = np.linspace(0.0, 1.0, size, dtype=np.float32)
    t = (axis[None, :] + axis[:, None]) / 2.0  # top-left 0 -> bottom-right 1
    arr = np.empty((size, size, 3), dtype=np.uint8)
    for i in range(3):
        arr[:, :, i] = (BLUE[i] + (CYAN[i] - BLUE[i]) * t).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def build() -> Image.Image:
    # --- Background tile -------------------------------------------------
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = make_gradient(S).convert("RGBA")
    mask = rounded_mask(S, radius=int(S * 0.22))
    tile.paste(grad, (0, 0), mask)

    draw = ImageDraw.Draw(tile)

    # --- Vinyl disc ------------------------------------------------------
    cx = cy = S / 2
    disc_r = S * 0.335

    draw.ellipse(
        [cx - disc_r, cy - disc_r, cx + disc_r, cy + disc_r],
        fill=DISC_DARK + (255,),
        outline=(255, 255, 255, 46),
        width=int(S * 0.004),
    )

    # Grooves
    for i in range(13):
        r = disc_r * (0.52 + i * 0.036)
        if r >= disc_r * 0.97:
            break
        alpha = 58 if i % 2 == 0 else 34
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            outline=(255, 255, 255, alpha),
            width=max(1, int(S * 0.0022)),
        )

    # --- Center label ----------------------------------------------------
    label_r = disc_r * 0.38
    label = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(label)
    grad_small = make_gradient(S)
    lmask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(lmask).ellipse(
        [cx - label_r, cy - label_r, cx + label_r, cy + label_r], fill=255
    )
    label.paste(grad_small.convert("RGBA"), (0, 0), lmask)
    tile.alpha_composite(label)

    # Spindle hole
    hole_r = label_r * 0.20
    draw.ellipse(
        [cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r],
        fill=BG_DARK + (255,),
    )

    # --- Tonearm / needle accent ----------------------------------------
    arm_w = S * 0.019
    draw.line(
        [(cx + disc_r * 0.60, cy - disc_r * 1.34), (cx + disc_r * 1.06, cy - disc_r * 0.30)],
        fill=(255, 255, 255, 190),
        width=int(arm_w),
    )
    pivot_r = S * 0.030
    pxc, pyc = cx + disc_r * 1.06, cy - disc_r * 0.30
    draw.ellipse(
        [pxc - pivot_r, pyc - pivot_r, pxc + pivot_r, pyc + pivot_r],
        fill=(255, 255, 255, 225),
    )

    # --- Specular sheen --------------------------------------------------
    sheen = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.ellipse(
        [cx - disc_r * 1.30, cy - disc_r * 1.55, cx + disc_r * 0.15, cy - disc_r * 0.10],
        fill=(255, 255, 255, 34),
    )
    sheen = sheen.filter(ImageFilter.GaussianBlur(S * 0.035))
    sheen.putalpha(Image.composite(sheen.getchannel("A"), Image.new("L", (S, S), 0), mask))
    tile.alpha_composite(sheen)

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
