"""Generate the DJ Assistant source app icon (1024x1024 PNG) and tray glyphs.

Design ("Groove Meter"): rounded-square dark tile with a diagonal gradient, a
soft top sheen, vinyl groove rings behind level-meter EQ bars with detached
peak-hold caps, and a subtle gradient border. Mirrors ``assets/logo.svg``;
the tray glyphs mirror ``assets/tray-on-dark.svg`` / ``tray-on-light.svg``.

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
ICONS_DIR = os.path.join(OUT_DIR, "icons")

# Brand palette (from assets/logo.svg)
BG_TOP = (23, 27, 37)         # #171B25
BG_BOTTOM = (10, 12, 17)      # #0A0C11
BAR_TOP = (92, 225, 255)      # #5CE1FF
BAR_BOTTOM = (0, 144, 255)    # #0090FF
BORDER_TOP = (46, 52, 74)     # #2E344A
BORDER_BOTTOM = (26, 31, 43)  # #1A1F2B
SHEEN_ALPHA = 20              # ~8% white highlight at the top edge

# Groove Meter geometry on the 128-unit canvas (shared with assets/logo.svg)
BAR_XS = [18, 32, 46, 60, 74, 88, 102]
BAR_W = 8
BAR_BASE = 88
BAR_HS = [26, 42, 58, 74, 58, 42, 26]
CAP_H = 4
CAP_GAP = 3
DISC_C = (64, 96)
GROOVE_RS = [26, 20, 14]
GROOVE_W = 1.5
SPINDLE_R = 3
ARC_R = 23
ARC_W = 2
ARC_ALPHA = 0.35

# Tray glyph geometry on the 32-unit canvas (shared with assets/tray-*.svg)
TRAY_SIZE = 32
TRAY_XS = [4.5, 9.5, 14.5, 19.5, 24.5]
TRAY_W = 3
TRAY_BASE = 21
TRAY_HS = [7, 11, 15, 11, 7]
TRAY_CAP_H = 2
TRAY_CAP_GAP = 1
TRAY_DISC_C = (16, 23)
TRAY_ARC_R = 8.5
TRAY_ARC_W = 2
TRAY_SPINDLE_R = 1.5
TRAY_DARK = {
    "bar": BAR_TOP,
    "cap": (217, 246, 255),   # #D9F6FF
    "arc_alpha": 0.6,
}
TRAY_LIGHT = {
    "bar": (37, 99, 235),     # #2563EB
    "cap": (6, 182, 212),     # #06B6D4
    "arc_alpha": 0.55,
}


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


def draw_disc(d: ImageDraw.ImageDraw, sx, center, groove_rs, groove_w, arc_r, arc_w, arc_color, spindle_r, spindle_color) -> None:
    """Vinyl groove rings, a lower sheen arc, and the spindle dot."""
    cx, cy = sx(center[0]), sx(center[1])
    for r in groove_rs:
        rr = sx(r)
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=BORDER_TOP + (255,), width=max(1, int(sx(groove_w))))
    rr = sx(arc_r)
    d.arc([cx - rr, cy - rr, cx + rr, cy + rr], start=30, end=150, fill=arc_color, width=max(1, int(sx(arc_w))))
    rr = sx(spindle_r)
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=spindle_color)


def bar_rects(sx, xs, w, base, hs, cap_h, cap_gap):
    """Yield (bar_box, cap_box) pairs in scaled pixels."""
    for x, h in zip(xs, hs):
        top = base - h
        yield (
            [sx(x), sx(top), sx(x + w), sx(base)],
            [sx(x), sx(top - cap_gap - cap_h), sx(x + w), sx(top - cap_gap)],
        )


def build() -> Image.Image:
    def sx(v: float) -> float:
        return v * S / 128.0

    # --- Background tile -------------------------------------------------
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bg_grad = make_diagonal_gradient(S, BG_TOP, BG_BOTTOM).convert("RGBA")
    mask = rounded_mask(S, radius=int(S * 0.22))
    tile.paste(bg_grad, (0, 0), mask)

    # --- Soft top sheen (depth) -----------------------------------------
    tile.alpha_composite(make_sheen(S, mask))

    # --- Vinyl disc behind the bars --------------------------------------
    disc = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw_disc(
        ImageDraw.Draw(disc), sx, DISC_C, GROOVE_RS, GROOVE_W,
        ARC_R, ARC_W, BAR_TOP + (int(255 * ARC_ALPHA),), SPINDLE_R, BAR_TOP + (255,),
    )
    tile.alpha_composite(disc)

    # --- EQ bars + peak caps ---------------------------------------------
    rects = list(bar_rects(sx, BAR_XS, BAR_W, BAR_BASE, BAR_HS, CAP_H, CAP_GAP))

    def glow(std: float, opacity: float) -> Image.Image:
        """Blurred copy of the bars and caps at the given opacity."""
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for bar_box, cap_box in rects:
            ld.rounded_rectangle(bar_box, radius=sx(4), fill=BAR_TOP + (255,))
            ld.rounded_rectangle(cap_box, radius=sx(2), fill=BAR_TOP + (255,))
        layer = layer.filter(ImageFilter.GaussianBlur(std))
        a = np.array(layer)
        a[:, :, 3] = (a[:, :, 3] * opacity).astype(np.uint8)
        return Image.fromarray(a, "RGBA")

    # Two layers: a wide soft bloom plus a tight halo.
    tile.alpha_composite(glow(sx(5), 0.55))
    tile.alpha_composite(glow(sx(1.5), 0.9))

    # Solid bars with vertical gradient
    bar_grad = make_vertical_gradient(S, BAR_TOP, BAR_BOTTOM).convert("RGBA")
    for (bar_box, cap_box) in rects:
        x0, y0, x1, y1 = (int(v) for v in bar_box)
        w, h = x1 - x0, y1 - y0
        # Full gradient ramp per bar: crop a 1px-wide full-height column and
        # resize it to the bar so every bar spans cyan->blue (cropping the top
        # h/S would leave tall bars short of blue and tint short bars cyan).
        bar_tile = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        bar_tile.paste(bar_grad.crop((0, 0, 1, S)).resize((w, h)), (0, 0))
        bar_mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(bar_mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=int(sx(4)), fill=255)
        bar_tile.putalpha(bar_mask)
        tile.paste(bar_tile, (x0, y0), bar_mask)

    # Peak-hold caps in the bright top color
    cap_layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cap_layer)
    for _, cap_box in rects:
        cd.rounded_rectangle(cap_box, radius=sx(2), fill=BAR_TOP + (255,))
    tile.alpha_composite(cap_layer)

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


def build_tray(colors: dict) -> Image.Image:
    """Tile-free tray glyph at 4x supersampling, downscaled to 32px."""
    t = TRAY_SIZE * SS

    def sx(v: float) -> float:
        return v * t / TRAY_SIZE

    img = Image.new("RGBA", (t, t), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bar = colors["bar"]
    arc_color = bar + (int(255 * colors["arc_alpha"]),)
    cx, cy = sx(TRAY_DISC_C[0]), sx(TRAY_DISC_C[1])
    rr = sx(TRAY_ARC_R)
    d.arc([cx - rr, cy - rr, cx + rr, cy + rr], start=30, end=150, fill=arc_color, width=max(1, int(sx(TRAY_ARC_W))))
    rr = sx(TRAY_SPINDLE_R)
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=bar + (255,))
    for bar_box, cap_box in bar_rects(sx, TRAY_XS, TRAY_W, TRAY_BASE, TRAY_HS, TRAY_CAP_H, TRAY_CAP_GAP):
        d.rounded_rectangle(bar_box, radius=sx(1.5), fill=bar + (255,))
        d.rounded_rectangle(cap_box, radius=sx(1), fill=colors["cap"] + (255,))
    return img.resize((TRAY_SIZE, TRAY_SIZE), Image.LANCZOS)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(ICONS_DIR, exist_ok=True)
    icon = build()
    icon.save(OUT_PNG, "PNG")
    print(f"Wrote {OUT_PNG} ({icon.size[0]}x{icon.size[1]})")
    for name, colors in (("tray-on-dark", TRAY_DARK), ("tray-on-light", TRAY_LIGHT)):
        glyph = build_tray(colors)
        for suffix, size in (("", TRAY_SIZE), ("@2x", TRAY_SIZE * 2)):
            path = os.path.join(ICONS_DIR, f"{name}{suffix}.png")
            glyph.resize((size, size), Image.LANCZOS).save(path, "PNG")
            print(f"Wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()