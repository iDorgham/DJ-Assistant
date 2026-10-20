# 01 — Design System

**Version:** 1.4 · **Date:** 2026-10-19  
**Foundation:** [IBM Carbon Design System](https://carbondesignsystem.com/) (g100 dark / g10 light)  
**Ableton DNA:** Modular resizable regions · high density · accent-sparingly philosophy preserved

Tokens and rules for a consistent, calm, highly flexible professional music tool.  
All color values are drawn from the IBM Carbon palette. CSS custom properties (`--cds-*`) are the source of truth; semantic `--dj-*` tokens alias them via Tailwind v4 `@theme {}`.

---

## 1. Design intent (Ableton Live 12 reference)

DJ Assistant’s visual language is deliberately close to **Ableton Live 12’s dark appearance**:

- Neutral Carbon grayscale surfaces (gray-100/90/80 — not warm brown, not pure black)
- Subtle stepped hierarchy rather than strong elevation
- High information density without visual noise
- Extremely flexible layout: every major region is resizable, collapsible, and restorable
- Accent color used sparingly and purposefully (Carbon Cyan for music data, Blue 60 for actions — never decoration)

The goal is that a DJ who lives in Ableton feels immediately at home, while the tool remains clearly a **prep / library / set tool**, not a performance deck.

---

## 2. Color — surfaces (Carbon g100 dark / g10 light)

| Semantic token | CSS variable | Dark (g100) | Light (g10) | Use |
|----------------|--------------|-------------|-------------|-----|
| `bg.app` (L0) | `--cds-background` | `#161616` (gray-100) | `#F4F4F4` (gray-10) | Main window / “desktop” background |
| `bg.panel` (L1) | `--cds-layer-01` | `#262626` (gray-90) | `#FFFFFF` | Left nav, player chrome, docks, table headers |
| `bg.elevated` (L2) | `--cds-layer-02` | `#393939` (gray-80) | `#F4F4F4` (gray-10) | Selected rows, active header segments, cards |
| `bg.overlay` (L3) | `--cds-layer-03` | `#525252` (gray-70) | `#E0E0E0` (gray-20) | Menus, dialogs, popovers, command palette |
| `bg.hover` | `--cds-layer-hover` | `#353535` | `#E8E8E8` | Row / button hover |
| `bg.active` | `--cds-layer-active` | `#4C4C4C` | `#C6C6C6` (gray-30) | Pressed / selected fill |
| `border.subtle` | `--cds-border-subtle` | `#393939` (gray-80) | `#E0E0E0` (gray-20) | Hairlines, splitters, table grid |
| `border.strong` | `--cds-border-strong` | `#6F6F6F` (gray-60) | `#8D8D8D` (gray-50) | Inputs at rest, stronger dividers |
| `border.focus` | `--cds-focus` | `#FFFFFF` (2px) | `#0F62FE` (blue-60, 2px) | Focus ring — Carbon signature 2px indicator |

**Notes**
- Every value is a canonical Carbon theme token defined in `apps/desktop/src/index.css`; no bespoke charcoal mixes.
- Hierarchy steps by surface contrast, not by shadow; docked chrome stays flush with its container.
- Avoid pure `#000000` and pure white slabs (Carbon’s own rule — g100 tops out at `#161616`).
- Splitters and hairlines should remain low-contrast so the eye stays on content.

---

## 3. Color — text & semantic

| Token | CSS variable | Dark (g100) | Light (g10) |
|-------|--------------|-------------|-------------|
| `text.primary` | `--cds-text-primary` | `#F4F4F4` (gray-10) · 15.5:1 AAA | `#161616` (gray-100) · 14.6:1 AAA |
| `text.secondary` | `--cds-text-secondary` | `#C6C6C6` (gray-30) · 9.5:1 AAA | `#525252` (gray-70) · 6.4:1 AAA |
| `text.muted` | `--cds-text-muted` | `#8D8D8D` (gray-50) · 4.8:1 AA | `#6F6F6F` (gray-60) · 4.6:1 AA |
| `text.inverse` | `--cds-text-inverse` | `#161616` | `#FFFFFF` |
| `text.on-color` | `--cds-text-on-color` | `#FFFFFF` | `#FFFFFF` |
| `accent` (music data) | `--cds-accent` | `#33B1FF` (cyan-40) | `#0072C3` (cyan-60) · 4.7:1 AA |
| `accent.strong` (actions) | `--cds-interactive` | `#0F62FE` (blue-60) | `#0F62FE` (blue-60) |
| `accent.muted` | — | `#33B1FF33` | `#0072C333` |
| `success` | `--cds-support-success` | `#42BE65` (green-40) | `#198038` (green-60) · 5.4:1 |
| `warning` | `--cds-support-warning` | `#F1C21B` (yellow-30) | `#B28600` (yellow-50) · 4.5:1 |
| `danger` | `--cds-support-error` | `#FA4D56` (red-50) | `#DA1E28` (red-60) · 5.4:1 |
| `cue` | `--cds-cue` | `#FF832B` (orange-40) | `#EB6200` (orange-50) · 4.8:1 |

**Contrast**  
Every shipped value is ≥4.5:1 (WCAG 2.2 AA) for small text on its intended surface; dark/light pairs are the canonical Carbon theme pairings. [10-ACCESSIBILITY](10-ACCESSIBILITY-AND-KEYBOARD.md) outranks the literal hex if a future Carbon bump ever regresses one.

**Errata (superseded — pre-Carbon palette, see [13](13-REMEDIATION-STATUS.md))**  
The app shipped a bespoke charcoal + teal palette (`#1A1C22` surfaces, `#2DD4BF` accent) until 2026-10-19, whose AA adjustments (darker `text.muted`, light accent deepened to `#0F766E`) are recorded in [13 §1](13-REMEDIATION-STATUS.md). The IBM Carbon migration replaced the palette wholesale, folding those fixes into the Carbon values above — the tables in this section are now the shipped values, not aspirational ones.

`cue` is a sanctioned semantic token (CDJ-authentic CUE orange), separate from `accent` — used by the CUE button, cue badges, and temp-cue playhead.

**Waveform**  
Accent family fill — Carbon Cyan (`#33B1FF` dark / `#0072C3` light), softer variants for unplayed peaks. Grid lines at ~18–22% opacity of `text.muted`; playhead in white (dark) / Blue 60 (light).

**Cue colors A–H**  
Carbon support/data-viz hues (`lib/waveform-generator.ts`), one per pad: A `#FA4D56` red-50 · B `#FF832B` orange-40 · C `#F1C21B` yellow-30 · D `#42BE65` green-40 · E `#33B1FF` cyan-40 · F `#4589FF` blue-50 · G `#BE95FF` purple-40 · H `#FF7EB6` magenta-40. Must remain readable on both the detailed waveform and the overview map; configurable in Appearance.

**Energy bars (1–10 charging meter)**  
- 10 equal segments in a fixed-width strip (~48–56px)  
- Filled: `accent` (`#33B1FF` dark / `#0072C3` light) or soft green→accent gradient  
- Empty: `border.subtle` / low-opacity muted fill  
- Gap between segments 1px; outer radius `radius.sm`  
- Tooltip / accessible name: “Energy N / 10”  
- Unanalyzed: empty or single muted “—”

**Tag chips**  
- `bg.elevated`, `text.secondary`, `radius.sm`, hairline border  
- Compact padding (4–6px horizontal); truncate long labels  
- Hover: subtle accent border; click filters or opens editor

**Star rating (1–5)**  
- Five star icons (Lucide `star`); filled = accent or warning gold; empty = `text.muted` outline  
- Hit target per star ≥ 16px; hover preview fills up to cursor  
- Accessible name: “Rating N of 5”

**Artwork hover play**  
- Overlay at 40–50% dim; centered play icon (accent or inverse)  
- Show on hover only; keyboard focus also reveals control  

---

## 4. Harmonic key colors

Relative to the **currently playing track**. Support **Camelot 1A–12A / 1B–12B** and classical-style **1m / 1d** (and full classical if preferred):

| Relation | Treatment |
|----------|-----------|
| Same key | Strongest pill fill |
| ±1 adjacent | Clear compatible fill |
| Relative major/minor (xA ↔ xB) | Family shade |
| Optional ±2 (Wide mode) | Soft tint |
| Incompatible | Muted text, no fill |
| Unknown | Dim “—” |

Pills use fixed min-width and stay legible in both themes. Optional left row border for “mixable with playing track”.

---

## 5. Typography

| Role | Family | Stack |
|------|--------|-------|
| UI | IBM Plex Sans | `"IBM Plex Sans", "Inter", -apple-system, "Segoe UI", system-ui, sans-serif` |
| Numeric | IBM Plex Mono (tabular) | `"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace` |

Plex Sans/ Plex Mono are loaded in `apps/desktop/index.html`; the system stack keeps the app fully usable offline if the fonts are unavailable.

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `text.xs` | 11px | 400/500 | Meta, column headers, cue times |
| `text.sm` | 12px | 400/500 | Table cells, secondary |
| `text.md` | 13px | 500/600 | Primary UI, list titles |
| `text.lg` | 15–16px | 600 | Player title, section titles |
| `text.xl` | 18–20px | 600 | Empty states only |

Line-height 1.25–1.4 (tighter in tables). Title case for headers — never all-caps.

---

## 6. Spacing & sizing

| Token | Value |
|-------|-------|
| `space.1` | 4px |
| `space.2` | 8px |
| `space.3` | 12px |
| `space.4` | 16px |
| `space.5` | 24px |
| Control height | 28px (default), 32px (primary transport) |
| Table row | 28–32px (Compact) |
| Header | 36–40px |
| Options bar | ~32px |
| Left nav expanded | ~220px |
| Left nav rail | ~48px |
| Icon UI | 16px |
| Icon nav | 18px |
| Icon transport | 20px |

---

## 7. Radius & elevation

| Token | Value | Use |
|-------|-------|-----|
| `radius.sm` | 2px | Carbon micro-radius: chips, tags, badges |
| `radius.md` | 0px | Carbon component standard: buttons, inputs, key pills |
| `radius.lg` | 0px | Carbon container standard: menus, dialogs, popovers |
| `radius.full` | 9999px | Status indicator dots only |
| `radius.panel` | 0 | Docked panels flush with edges |

**Elevation philosophy (Ableton-like, Carbon-flat)**  
Prefer surface-step + 1px border; reserve a very soft shadow only for floating overlays (L3). Docked panels sit flush. No heavy drop shadows, no “floating card” look on primary chrome — Carbon components are crisp and rectangular.

---

## 8. Icons

**Library:** Lucide (preferred) · alternates Phosphor / Tabler  

- One pack only app-wide  
- Stroke style, 1.5–2px optical  
- Default color `text.secondary`; active `accent` or `text.primary`  
- Icon-only controls require tooltips  

See [02-SHELL-AND-NAVIGATION.md](02-SHELL-AND-NAVIGATION.md) and [09-COMPONENTS.md](09-COMPONENTS.md) for icon assignments.

---

## 9. Motion

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Hover background | ≤80ms | linear |
| Button press | 80ms | ease-out |
| Panel resize / collapse | 150–200ms | ease-out |
| Modal / toast | 150ms | ease-out |
| Player Mini ↔ Full | 200–280ms | ease-out |
| View / workspace switch | 120–200ms | ease-out |
| Playhead | RAF locked to audio | none |

- Max UI motion ~300ms  
- `prefers-reduced-motion`: instant or fade only  
- No elastic bounce, parallax, or decorative loops  

---

## 10. Density modes

| Mode | Row | UI text | Default |
|------|-----|---------|---------|
| Compact | 28px | 12px | **Yes** |
| Comfortable | 32–36px | 13px | Optional |

Persisted in Appearance / View menu.

---

## 11. Theme

- **Dark** is the default (DJ environments, long sessions)
- Full Light token set provided
- Optional “Follow system”
- Accent can be overridden in Appearance (advanced)

Contrast rules: WCAG AA for text. Playhead and cue markers must remain clearly visible on the waveform in both themes.

---

## 12. Flexibility rules (Ableton DNA)

These are non-negotiable implementation rules:

1. **Every major region is resizable** by dragging splitters (left nav, right dock, player height).
2. **Every major region is collapsible** (left nav → icon rail or hidden, right dock → hidden, player → Mini / Full / Hidden).
3. **Double-click a splitter** resets that pane to its default size for the current workspace.
4. **Workspaces** remember exact sizes + collapsed state per view (Library / Preparation / Auto Performance + user Custom).
5. Layout changes animate ≤200ms; content must never jump after the animation.
6. The main canvas always absorbs remaining space — it is the primary work surface.

This matches the spirit of Ableton Live’s modular, user-configurable interface while remaining a focused preparation tool.
