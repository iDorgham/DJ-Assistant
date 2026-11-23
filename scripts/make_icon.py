"""Generate the DJ Assistant source app icon (1024x1024 PNG) and tray glyphs.

Design ("The Stack"): rounded-square dark tile holding three rounded library
tiles in perspective with a glowing play triangle on the front. Mirrors
``assets/logo.svg``; the tray glyphs mirror ``assets/tray-on-dark.svg`` /
``tray-on-light.svg`` (two-layer stack, triangle knocked out).

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
ICONS_DIR = os.path.join(OUT_DIR, "icons")

# Brand palette (from assets/logo.svg)
BG_TOP = (23, 27, 37)         # #171B25
BG_BOTTOM = (10, 12, 17)      # #0A0C11
PLAY_TOP = (92, 225, 255)     # #5CE1FF
PLAY_BOTTOM = (0, 144, 255)   # #0090FF
BORDER_TOP = (46, 52, 74)     # #2E344A
BORDER_BOTTOM = (26, 31, 43)  # #1A1F2B
LAYER_TOP = (35, 41, 57)      # #232939
LAYER_MID = BORDER_TOP        # #2E344A
FRONT_TOP = (42, 49, 69)      # #2A3145
FRONT_BOTTOM = BORDER_BOTTOM  # #1A1F2B
FRONT_LINE = (58, 66, 88)     # #3A4258
SHEEN_ALPHA = 20              # ~8% white highlight at the top edge

# The Stack geometry on the 128-unit canvas (shared with assets/logo.svg)
TILE_BOX = (8, 8, 120, 120)
TILE_R = 26
TOP_BOX = (42, 24, 86, 44)
TOP_R = 9
MID_BOX = (33, 36, 95, 62)
MID_R = 10
FRONT_BOX = (24, 50, 104, 106)
FRONT_R = 12
FRONT_LINE_W = 1.5
TRI_A = (56, 65)
TRI_B = (56, 91)
TRI_C = (81, 78)
TRI_ROUND = 4

# Tray glyph geometry on the 32-unit canvas (shared with assets/tray-*.svg)
TRAY_SIZE = 32
TRAY_BACK_BOX = (8, 3, 24, 11)
TRAY_BACK_R = 3.5
TRAY_FRONT_BOX = (4, 8, 28, 29)
TRAY_FRONT_R = 5.5
TRAY_TRI_A = (13, 13.5)
TRAY_TRI_B = (13, 23.5)
TRAY_TRI_C = (22.5, 18.5)
TRAY_TRI_ROUND = 1.8
TRAY_DARK = {
    "back": PLAY_BOTTOM,
    "front_top": PLAY_TOP,
    "front_bottom": PLAY_BOTTOM,
}
TRAY_LIGHT = {
    "back": (96, 165, 250),    # #60A5FA
    "front_top": (6, 182, 212),   # #06B6D4
    "front_bottom": (37, 99, 235),  # #2563EB
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


def rounded_triangle_points(a, b, c, t: float, steps: int = 12):
    """Sample the rounded play triangle (quadratic corners, radius ~t)."""
    verts = (a, b, c)
    pts = []
    for i, v in enumerate(verts):
        p, n = verts[i - 1], verts[(i + 1) % 3]

        def unit(src, dst):
            dx, dy = dst[0] - src[0], dst[1] - src[1]
            length = math.hypot(dx, dy)
            return (dx / length, dy / length)

        u_in = unit(v, p)
        u_out = unit(v, n)
        p_in = (v[0] + t * u_in[0], v[1] + t * u_in[1])
        p_out = (v[0] + t * u_out[0], v[1] + t * u_out[1])
        if i == 0:
            pts.append(p_out)
        else:
            pts.append(p_in)
            for s in range(1, steps + 1):
                q = s / steps
                x = (1 - q) ** 2 * p_in[0] + 2 * (1 - q) * q * v[0] + q ** 2 * p_out[0]
                y = (1 - q) ** 2 * p_in[1] + 2 * (1 - q) * q * v[1] + q ** 2 * p_out[1]
                pts.append((x, y))
    # close the last corner (A) back to the first point
    v = verts[0]
    p, n = verts[-1], verts[1]
    u_in = (p[0] - v[0], p[1] - v[1])
    length = math.hypot(*u_in)
    u_in = (u_in[0] / length, u_in[1] / length)
    u_out = (n[0] - v[0], n[1] - v[1])
    length = math.hypot(*u_out)
    u_out = (u_out[0] / length, u_out[1] / length)
    p_in = (v[0] + t * u_in[0], v[1] + t * u_in[1])
    p_out = pts[0]
    for s in range(1, steps + 1):
        q = s / steps
        x = (1 - q) ** 2 * p_in[0] + 2 * (1 - q) * q * v[0] + q ** 2 * p_out[0]
        y = (1 - q) ** 2 * p_in[1] + 2 * (1 - q) * q * v[1] + q ** 2 * p_out[1]
        pts.append((x, y))
    return pts


def gradient_fill(tile: Image.Image, box, radius, grad: Image.Image, sx) -> None:
    """Paste a full-ramp vertical gradient into a rounded box."""
    x0, y0, x1, y1 = (int(sx(v)) for v in box)
    w, h = x1 - x0, y1 - y0
    piece = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    piece.paste(grad.crop((0, 0, 1, grad.size[1])).resize((w, h)), (0, 0))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=int(sx(radius)), fill=255)
    piece.putalpha(mask)
    tile.paste(piece, (x0, y0), mask)


def build() -> Image.Image:
    def sx(v: float) -> float:
        return v * S / 128.0

    # --- Background tile -------------------------------------------------
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bg_grad = make_diagonal_gradient(S, BG_TOP, BG_BOTTOM).convert("RGBA")
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [sx(TILE_BOX[0]), sx(TILE_BOX[1]), sx(TILE_BOX[2]), sx(TILE_BOX[3])],
        radius=int(sx(TILE_R)),
        fill=255,
    )
    tile.paste(bg_grad, (0, 0), mask)
    tile.alpha_composite(make_sheen(S, mask))

    # --- The Stack: two back layers, then the front tile ------------------
    layers = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layers)
    ld.rounded_rectangle([sx(v) for v in TOP_BOX], radius=int(sx(TOP_R)), fill=LAYER_TOP + (255,))
    ld.rounded_rectangle([sx(v) for v in MID_BOX], radius=int(sx(MID_R)), fill=LAYER_MID + (255,))
    tile.alpha_composite(layers)

    front_grad = make_vertical_gradient(S, FRONT_TOP, FRONT_BOTTOM).convert("RGBA")
    gradient_fill(tile, FRONT_BOX, FRONT_R, front_grad, sx)
    line = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(line).rounded_rectangle(
        [sx(v) for v in FRONT_BOX], radius=int(sx(FRONT_R)),
        outline=FRONT_LINE + (255,), width=max(1, int(sx(FRONT_LINE_W))),
    )
    tile.alpha_composite(line)

    # --- Play triangle: soft bloom + tight halo, then gradient fill -------
    tri = [(sx(x), sx(y)) for x, y in rounded_triangle_points(TRI_A, TRI_B, TRI_C, TRI_ROUND)]

    def glow(std: float, opacity: float) -> Image.Image:
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(layer).polygon(tri, fill=PLAY_TOP + (255,))
        layer = layer.filter(ImageFilter.GaussianBlur(std))
        a = np.array(layer)
        a[:, :, 3] = (a[:, :, 3] * opacity).astype(np.uint8)
        return Image.fromarray(a, "RGBA")

    tile.alpha_composite(glow(sx(4), 0.5))
    tile.alpha_composite(glow(sx(1.2), 0.85))

    play_grad = make_vertical_gradient(S, PLAY_TOP, PLAY_BOTTOM).convert("RGBA")
    x0 = int(min(p[0] for p in tri))
    y0 = int(min(p[1] for p in tri))
    x1 = int(max(p[0] for p in tri)) + 1
    y1 = int(max(p[1] for p in tri)) + 1
    w, h = x1 - x0, y1 - y0
    piece = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    piece.paste(play_grad.crop((0, 0, 1, S)).resize((w, h)), (0, 0))
    tri_mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(tri_mask).polygon([(x - x0, y - y0) for x, y in tri], fill=255)
    piece.putalpha(tri_mask)
    tile.paste(piece, (x0, y0), tri_mask)

    # --- Gradient border -------------------------------------------------
    ring = Image.new("L", (S, S), 0)
    ImageDraw.Draw(ring).rounded_rectangle(
        [sx(TILE_BOX[0]), sx(TILE_BOX[1]), sx(TILE_BOX[2]), sx(TILE_BOX[3])],
        radius=int(sx(TILE_R)),
        outline=255,
        width=max(1, int(sx(2.5))),
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
    d.rounded_rectangle([sx(v) for v in TRAY_BACK_BOX], radius=int(sx(TRAY_BACK_R)), fill=colors["back"] + (255,))

    tri = [(sx(x), sx(y)) for x, y in rounded_triangle_points(TRAY_TRI_A, TRAY_TRI_B, TRAY_TRI_C, TRAY_TRI_ROUND)]
    front_mask = Image.new("L", (t, t), 0)
    fd = ImageDraw.Draw(front_mask)
    fd.rounded_rectangle([sx(v) for v in TRAY_FRONT_BOX], radius=int(sx(TRAY_FRONT_R)), fill=255)
    fd.polygon(tri, fill=0)  # knock the play triangle out

    grad = make_vertical_gradient(t, colors["front_top"], colors["front_bottom"]).convert("RGBA")
    x0, y0, x1, y1 = (int(sx(v)) for v in TRAY_FRONT_BOX)
    w, h = x1 - x0, y1 - y0
    piece = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    piece.paste(grad.crop((0, 0, 1, t)).resize((w, h)), (0, 0))
    img.paste(piece, (x0, y0), front_mask.crop((x0, y0, x1, y1)))
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