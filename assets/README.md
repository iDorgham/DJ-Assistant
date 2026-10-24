# `assets/` — Brand assets

Source SVG artwork for DJ Assistant. Files here are **sources**: rasterise or
inline them as needed; do not hand-edit exported PNGs.

The visual language is defined in [`docs/ui/01-DESIGN-SYSTEM.md`](../docs/ui/01-DESIGN-SYSTEM.md).
When you change a colour or shape here, check that document so the code, docs,
and artwork do not drift. The values below are the fixed colours baked into these
SVG sources; the app's semantic UI tokens (and their light-theme variants) live in
the design system and `apps/desktop/src/index.css`.

## Palette

| Token | Hex | Used for |
|-------|-----|----------|
| Ink top / bottom | `#171B25` → `#0A0C11` | Logo tile background |
| Tile border | `#2E344A` → `#1A1F2B` | Tile outline (top→bottom gradient) |
| Tile sheen | `#FFFFFF` @ 8% | Top-edge highlight for depth |
| EQ top / bottom | `#5CE1FF` → `#0090FF` | Equaliser bars (signature mark) |
| Brand gradient | `#2563EB` → `#22D3EE` | In-app tile (blue-600 → cyan-400) |
| Banner / social background | `#0B0D12` → `#161A24` | Header banner and OG card gradient |
| Light wordmark ink | `#0F1117` | Wordmark on light backgrounds (`wordmark-light.svg`) |
| Text primary | `#F1F5F9` | Wordmark on dark |
| Text muted | `#94A3B8` | Taglines, secondary copy |
| Text dim | `#64748B` | Captions, footer copy |

## Inventory

| File | Size | Purpose |
|------|------|---------|
| `logo.svg` | 128×128 | Primary app icon — dark rounded tile, soft top sheen, glowing EQ bars, gradient border. Mirrored by `scripts/make_icon.py`. |
| `logo-light.svg` | 128×128 | Light-background tile variant of the app icon. |
| `logo-mark.svg` | 128×128 | Tile-free mark (EQ bars + glow) for dark surfaces. |
| `logo-mark-mono.svg` | 128×128 | Monochrome mark using `currentColor`; for inline `currentColor` use. |
| `brand-disc.svg` | 128×128 | In-app brand mark — gradient tile + white record; matches the header lockup in `apps/desktop/src/App.tsx`. |
| `favicon.svg` | 32×32 | Simplified mark (five bars, no glow) for 16–32px rendering. Copied to `apps/desktop/public/favicon.svg`. |
| `wordmark.svg` | 364×80 | Horizontal lockup on dark (mark + wordmark). |
| `wordmark-light.svg` | 364×80 | Horizontal lockup for light backgrounds. |
| `wordmark-mono.svg` | 320×80 | Monochrome lockup using `currentColor`. |
| `banner.svg` | 1280×320 | README header banner; wired into the top of `README.md`. |
| `social-preview.svg` | 1280×640 | Social share card (Open Graph). Source for `social-preview.png`. |
| `social-preview.png` | 1280×640 | Rasterised OG card. Referenced by the `og:image` / `twitter:image` tags in `apps/desktop/index.html`; upload it as the GitHub repository social preview too. |

## Usage notes

- **Wordmarks use `<text>`**, not outlined paths. They use a system font stack and
  `textLength`/`lengthAdjust` so the wordmark occupies a predictable width across
  fonts. If you need a fully font-independent lockup, convert the text to paths.
- **`currentColor` variants** (`logo-mark-mono.svg`, `wordmark-mono.svg`) inherit the
  surrounding text colour when inlined. In a standalone `<img>`, `currentColor`
  resolves to black — set an explicit `fill` on the root `<svg>` if you need another
  colour.
- **Iconography inside the product** comes from
  [`lucide-react`](../docs/ui/01-DESIGN-SYSTEM.md) (design system §7, with the
  per-component assignments in [`docs/ui/09-COMPONENTS.md`](../docs/ui/09-COMPONENTS.md)),
  not from this folder. Only brand artwork lives here.
- **Rasterising:** `scripts/make_icon.py` generates `app-icon.png`, which
  `tauri icon` expands into the platform icon set. It mirrors `logo.svg`; when you
  change that icon, update the script and re-run `python scripts/make_icon.py`
  followed by `tauri icon`. `social-preview.png` is the rasterised `social-preview.svg`.

## Wiring

| Asset | Consumed by |
|-------|-------------|
| `banner.svg` | Top of [`README.md`](../README.md) |
| `favicon.svg` | `apps/desktop/public/favicon.svg` → `<link rel="icon">` in `apps/desktop/index.html` |
| `social-preview.png` | `og:image` / `twitter:image` in `apps/desktop/index.html`, and the repository social preview (GitHub → Settings → Social preview) |
| `logo.svg` | `scripts/make_icon.py` → `app-icon.png` → Tauri icon set |

`apps/desktop/public/favicon.svg` is a copy of `favicon.svg` — update both when the
favicon changes.

## Previews

Open any file directly in a browser, or open [`docs/ui/`](../docs/ui/) for the
current screen specs these assets sit alongside. The wireframes live in
[`docs/ui/wireframes/`](../docs/ui/wireframes/), with the current wireframe spec in
[`docs/ui/12-WIREFRAMES-AND-FLEXIBILITY.md`](../docs/ui/12-WIREFRAMES-AND-FLEXIBILITY.md).
