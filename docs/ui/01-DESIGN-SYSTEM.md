# 01 — Design System

**Version:** 1.0 · **Date:** 2026-10-19

**Supersedes:** [`../ui-ux/DESIGN_SYSTEM.md`](../ui-ux/DESIGN_SYSTEM.md) for design tokens, surfaces, typography, and component styling.

Tokens and rules for a consistent Adobe × Ableton × 2026 professional look.

---

## 1. Color — surfaces

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `bg.app` (L0) | `#0E0F12` | `#F0F1F3` | Window background |
| `bg.panel` (L1) | `#16181D` | `#FFFFFF` | Nav, player chrome, docks |
| `bg.elevated` (L2) | `#1C1F26` | `#FFFFFF` | Header active, cards, selected |
| `bg.overlay` (L3) | `#22262F` | `#FFFFFF` | Menus, dialogs, popovers |
| `bg.hover` | `#242A36` | `#EEF0F4` | Row/button hover |
| `bg.active` | `#2A3140` | `#E8EBF0` | Pressed / selected fill |
| `border.subtle` | `#2A2F3A` | `#E4E6EB` | Hairlines, splitters |
| `border.strong` | `#3A4356` | `#C5CAD3` | Inputs at rest |
| `border.focus` | Accent | Accent | Focus ring |

---

## 2. Color — text & semantic

| Token | Dark | Light |
|-------|------|-------|
| `text.primary` | `#E8EAED` | `#111827` |
| `text.secondary` | `#9AA3B2` | `#4B5563` |
| `text.muted` | `#8A92A0` | `#5F6672` |
| `text.inverse` | `#0E0F12` | `#FFFFFF` |
| `accent` | `#2DD4BF` (teal-cyan) | `#0F766E` |
| `accent.strong` | `#14B8A6` | `#115E59` |
| `accent.muted` | `#2DD4BF33` | `#0F766E33` |
| `success` | `#22C55E` | `#16A34A` |
| `warning` | `#F59E0B` | `#D97706` |
| `danger` | `#EF4444` | `#DC2626` |

**Waveform:** accent family fill; grid lines at ~20% opacity of `text.muted`.  
**Cue colors A–H:** distinct saturated hues; configurable in Appearance.

**Contrast:** light-theme `accent` is `#0F766E` (not the brighter `#0D9488`) so
accent text on white clears WCAG AA 4.5:1; use `accent.strong` for hover/pressed.
On-accent foreground is `#0E0F12` in dark and `#FFFFFF` in light (`text.on-accent`).

---

## 3. Harmonic key colors

Relative to **playing track** (Camelot):

| Relation | Treatment |
|----------|-----------|
| Same key | Strongest pill fill |
| ±1 adjacent | Clear compatible fill |
| Relative major/minor (xA ↔ xB) | Family shade |
| Optional ±2 (Wide mode) | Soft tint |
| Incompatible | Muted text, no fill |
| Unknown | Dim “—” |

Pills: fixed min-width, readable in both themes. Optional row left border for “mixable.”

---

## 4. Typography

| Role | Family | Stack |
|------|--------|-------|
| UI | Inter | `Inter, "Segoe UI", system-ui, sans-serif` |
| Numeric | Inter tabular / IBM Plex Mono / JetBrains Mono | `ui-monospace, monospace` |

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `text.xs` | 11px | 400/500 | Meta, column headers, cue times |
| `text.sm` | 12px | 400/500 | Table cells, secondary |
| `text.md` | 13px | 500/600 | Primary UI, list titles |
| `text.lg` | 15–16px | 600 | Player title, section titles |
| `text.xl` | 18–20px | 600 | Empty states only |

Line-height 1.25–1.4; tighter in tables. Title case for headers (not all-caps).

---

## 5. Spacing & sizing

| Token | Value |
|-------|-------|
| `space.1` | 4px |
| `space.2` | 8px |
| `space.3` | 12px |
| `space.4` | 16px |
| `space.5` | 24px |
| Control height | 28px (default), 32px (primary transport) |
| Table row | 28–32px |
| Header | 36–40px |
| Options bar | ~32px |
| Left nav expanded | ~220px |
| Left nav rail | ~48px |
| Icon UI | 16px |
| Icon nav | 18px |
| Icon transport | 20px |

---

## 6. Radius & elevation

| Token | Value | Use |
|-------|-------|-----|
| `radius.sm` | 4px | Chips, small pills |
| `radius.md` | 6px | Buttons, inputs, key pills |
| `radius.lg` | 8px | Menus, dialogs, popovers |
| `radius.panel` | 0 | Docked panels flush |

Elevation: prefer border + 1 soft shadow on L3 overlays. No heavy drop shadows on docks.

---

## 7. Icons

**Library:** Lucide (preferred) · alternates Phosphor / Tabler  

- One pack only app-wide  
- Stroke style, 1.5–2px optical  
- Default color `text.secondary`; active `accent` or `text.primary`  
- Icon-only controls require tooltips  

See [02-SHELL-AND-NAVIGATION.md](02-SHELL-AND-NAVIGATION.md) and [09-COMPONENTS.md](09-COMPONENTS.md) for icon assignments.

---

## 8. Motion

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

## 9. Density modes

| Mode | Row | UI text | Default |
|------|-----|---------|---------|
| Compact | 28px | 12px | **Yes** |
| Comfortable | 32–36px | 13px | Optional |

Persisted in Appearance / View menu.

---

## 10. Theme

- Dark default (DJ environments)  
- Light full token set  
- System follow optional  
- Accent override in Appearance (optional)  

Contrast: WCAG AA for text (≥4.5:1; `text.muted` verified on L0–L3 surfaces in both themes); playhead and cues must remain visible on waveform in both themes.
