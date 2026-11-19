# `assets/` — Brand assets

Source SVG artwork for DJ Assistant. Files here are **sources**: rasterise or
inline them as needed; do not hand-edit exported PNGs. The one exception is
[`screenshots/`](./screenshots/), which holds raster captures of the running app
for the README — see below.

The visual language is defined in [`docs/ui/01-DESIGN-SYSTEM.md`](../docs/ui/01-DESIGN-SYSTEM.md).
When you change a colour or shape here, check that document so the code, docs,
and artwork do not drift. The values below are the fixed colours baked into these
SVG sources; the app's semantic UI tokens (and their light-theme variants) live in
the design system and `apps/desktop/src/index.css`.

## The Groove Meter mark

The signature mark is a **Groove Meter**: seven level-meter bars with detached
peak-hold caps rising out of a vinyl disc — three groove rings, a sheen arc and a
spindle. It ships in four cuts: the full app tile (`logo.svg`, `logo-light.svg`),
the tile-free mark (`logo-mark.svg`, `logo-mark-mono.svg`), a five-bar favicon cut
(`favicon.svg`), and a five-bar tray cut (`tray-on-dark.svg`, `tray-on-light.svg`).
The geometry is shared between the SVG sources and `scripts/make_icon.py` —
change one, change the other.

## Palette

| Token | Hex | Used for |
|-------|-----|----------|
| Ink top / bottom | `#171B25` → `#0A0C11` | Logo tile background |
| Tile border | `#2E344A` → `#1A1F2B` | Tile outline (top→bottom gradient) |
| Tile sheen | `#FFFFFF` @ 8% | Top-edge highlight for depth |
| EQ top / bottom | `#5CE1FF` → `#0090FF` | Equaliser bars of the Groove Meter (dark) |
| Light tile top / bottom | `#FFFFFF` → `#E9EEF6` | Light app-icon tile background |
| Light border / grooves | `#DCE3EE` → `#C4CFE0` | Light tile outline and groove rings |
| Light EQ top / bottom | `#06B6D4` → `#2563EB` | Equaliser bars of the Groove Meter (light) |
| Tray peak caps | `#D9F6FF` dark / `#06B6D4` light | Detached peak-hold caps on the tray glyphs |
| Brand gradient | `#2563EB` → `#22D3EE` | In-app tile (blue-600 → cyan-400) |
| Banner / social background | `#0B0D12` → `#161A24` | Header banner and OG card gradient |
| Light wordmark ink | `#0F1117` | Wordmark on light backgrounds (`wordmark-light.svg`) |
| Text primary | `#F1F5F9` | Wordmark on dark |
| Text muted | `#94A3B8` | Taglines, secondary copy |
| Text dim | `#64748B` | Captions, footer copy |

## Inventory

| File | Size | Purpose |
|------|------|---------|
| `logo.svg` | 128×128 | Primary app icon — dark Groove Meter tile: soft top sheen, glowing EQ bars with peak-hold caps over vinyl grooves, gradient border. Mirrored by `scripts/make_icon.py`. |
| `logo-light.svg` | 128×128 | Light-background Groove Meter tile (light palette, softer glow, no sheen). |
| `logo-mark.svg` | 128×128 | Tile-free Groove Meter mark (grooves + EQ bars + glow) for dark surfaces. |
| `logo-mark-mono.svg` | 128×128 | Monochrome mark using `currentColor`; for inline `currentColor` use. |
| `brand-disc.svg` | 128×128 | In-app brand mark — gradient tile (`#2563EB` → `#22D3EE`) with the white Groove Meter cut. The app header itself uses lucide `Disc3` per the design system; this file is the brand-source lockup. |
| `favicon.svg` | 32×32 | Simplified five-bar Groove Meter (no glow) for 16–32px rendering. Copied to `apps/desktop/public/favicon.svg`. |
| `tray-on-dark.svg` | 32×32 | Tray glyph for dark OS taskbars — transparent, tile-free five-bar cut with peak caps, groove arc and spindle. |
| `tray-on-light.svg` | 32×32 | Tray glyph for light OS taskbars — same cut in `#2563EB`/`#06B6D4`. |
| `wordmark.svg` | 364×80 | Horizontal lockup on dark (mark + wordmark). |
| `wordmark-light.svg` | 364×80 | Horizontal lockup for light backgrounds. |
| `wordmark-mono.svg` | 320×80 | Monochrome lockup using `currentColor`. |
| `brand-lineup.svg` | 1280×280 | Dark/light specimen sheet (app icon, tray glyph, mark) used by the README's "Brand and icons" section. |
| `banner.svg` | 1280×320 | README header banner — Groove Meter lockup left, faint vinyl-and-meter motif right; wired into the top of `README.md`. |
| `social-preview.svg` | 1280×640 | Social share card (Open Graph) — centered Groove Meter tile flanked by groove-meter motifs. Source for `social-preview.png`. |
| `social-preview.png` | 1280×640 | Rasterised OG card. Referenced by the `og:image` / `twitter:image` tags in `apps/desktop/index.html`; upload it as the GitHub repository social preview too. |

## Product screenshots

[`screenshots/`](./screenshots/) holds PNG captures of the running desktop app,
consumed by the README's Screenshots section. They are evidence-style rasters, not
brand sources: retake them from a real `tauri dev` / installed build rather than
editing the pixels, and keep the library state honest (no seeded ratings or energy
left over from a QA pass).

| File | Shows |
|------|-------|
| `screenshots/library-hero.png` | Library + shared Track panel (Overview) + full player dock: phrase-marked dual waveform, hot cues, grid-confidence chip |
| `screenshots/track-analysis.png` | Track panel Analysis tab: status, pipeline version, BPM, key, loudness, vocal presence, phrase confidence |
| `screenshots/track-tags.png` | Track panel Tags tab over the library: metadata fields and the rating/energy editor with its undo note |

Historical acceptance captures stay in [`docs/evidence/`](../docs/evidence/) — the
README points here, not at the phase archives.

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
- **Rasterising:** `scripts/make_icon.py` generates `app-icon.png` **and the four
  tray PNGs** (`icons/tray-on-{dark,light}{,@2x}.png`); `tauri icon` expands
  `app-icon.png` into the platform icon set. It mirrors `logo.svg` and the tray
  SVGs; when you change those, update the script and re-run
  `python scripts/make_icon.py` followed by `tauri icon`.
  `social-preview.png` is the rasterised `social-preview.svg`.
- **Tray glyphs are PNG, not ICO.** Windows/macOS tray icons cannot theme-switch
  from a single `.ico`/`.icns`, so `apps/desktop/src-tauri/src/tray.rs` embeds both
  tray PNGs and swaps them on `WindowEvent::ThemeChanged`. Keep the glyphs
  tile-free and high-contrast: they render at 16–32px on an unknown taskbar colour.

## Wiring

| Asset | Consumed by |
|-------|-------------|
| `banner.svg` | Top of [`README.md`](../README.md) |
| `brand-lineup.svg` | "Brand and icons" section of [`README.md`](../README.md) |
| `favicon.svg` | `apps/desktop/public/favicon.svg` → `<link rel="icon">` in `apps/desktop/index.html` |
| `social-preview.png` | `og:image` / `twitter:image` in `apps/desktop/index.html`, and the repository social preview (GitHub → Settings → Social preview) |
| `logo.svg` | `scripts/make_icon.py` → `app-icon.png` → Tauri icon set |
| `tray-on-dark.svg` / `tray-on-light.svg` | `scripts/make_icon.py` → `src-tauri/icons/tray-on-{dark,light}{,@2x}.png` → embedded by `apps/desktop/src-tauri/src/tray.rs` |

`apps/desktop/public/favicon.svg` is a copy of `favicon.svg` — update both when the
favicon changes.

## Previews

Open any file directly in a browser, or open [`docs/ui/`](../docs/ui/) for the
current screen specs these assets sit alongside. The wireframes live in
[`docs/ui/wireframes/`](../docs/ui/wireframes/), with the current wireframe spec in
[`docs/ui/12-WIREFRAMES-AND-FLEXIBILITY.md`](../docs/ui/12-WIREFRAMES-AND-FLEXIBILITY.md).
