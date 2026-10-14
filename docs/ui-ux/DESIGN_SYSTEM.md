# DJ Assistant — Design System

**Status:** Living — 2026-10-14
**Companions:** [UX Principles](./UX_PRINCIPLES.md) · [Screens & Flows](./SCREENS_AND_FLOWS.md) · [Accessibility](./ACCESSIBILITY.md)
**Implemented in:** `apps/desktop/src/App.tsx` (Phase 0), `apps/desktop/src/lib/library.ts`

This document is the single reference for the app's visual language and reusable
components. The palette, sizes, and component states below are extracted from the
**shipped Phase 0 UI**; entries marked _planned_ describe how the system extends for
later phases.

---

## 1. Principles

1. **Dark-first.** The app is used in dim rooms next to performance gear; a dark canvas is
   the default. A light theme is planned but not required for MVP.
2. **Restrained colour.** Neutrals carry the layout; colour is reserved for meaning
   (primary action, success, warning, focus, active state).
3. **Monospace for machines.** BPM, key codes, durations, hashes, and counts use a mono
   face so columns align and digits scan quickly.
4. **Low radius, low ornament.** Small corner radii and thin borders; no shadows except a
   subtle lift on the primary action.
5. **Tokenise before scaling.** The Phase 0 UI uses inline arbitrary Tailwind values; these
   should be promoted into theme tokens (see §8) before the set builder is built.

---

## 2. Colour

### 2.1 Surfaces

| Token | Hex | Used for |
|-------|-----|----------|
| `canvas` | `#0f1117` | App background |
| `surface` | `#141721` | Header |
| `surface-2` | `#11131c` | Footer / status bar |
| `surface-raised` | `#12151e` | Toolbar |
| `surface-info` | `#181d2c` | Scan progress strip |
| `surface-input` | `#1a1e2b` | Inputs, empty-state artwork tile |
| `surface-control` | `#1e2230` | Icon buttons |
| `surface-control-hover` | `#252b3d` | Icon button hover |
| `row-hover` | `#181c28` | Table row hover |

### 2.2 Borders

| Token | Hex | Used for |
|-------|-----|----------|
| `border-subtle` | `#222738` | Section dividers (toolbar, table header, footer) |
| `border-default` | `#2a2f42` | Panel, input, and control borders |
| `border-strong` | `#2e344a` | Pills and emphasised chips |

### 2.3 Accents

| Token | Value | Used for |
|-------|-------|----------|
| `primary` | blue-600 `#2563eb` | Primary button rest |
| `primary-hover` | blue-500 `#3b82f6` | Primary button hover, focus border |
| `primary-disabled` | blue-800 `#1e40af` | Primary button disabled |
| `primary-text` | blue-400 `#60a5fa` | Active/info text, active badge text |
| `brand-gradient` | blue-600 → cyan-400 `#2563eb → #22d3ee` | Logo tile |
| `success` | emerald-500 `#10b981` | Online/ready indicator dot |
| `success-text` | emerald-400 `#34d399` | "Indexed" badge, local-first shield |
| `warning` | amber-400 `#fbbf24` | Star ratings |

### 2.4 Text

| Token | Value | Used for |
|-------|-------|----------|
| `text-primary` | slate-100 `#f1f5f9` | Track titles, primary content |
| `text-secondary` | slate-300 `#cbd5e1` | Artist, secondary labels |
| `text-muted` | slate-400 `#94a3b8` | Album, counts, captions |
| `text-dim` | slate-500 `#64748b` | Row index, placeholders, hints |
| `text-disabled` | slate-600 `#475569` | Disabled icons, decorative glyphs |

> Contrast ratios for these tokens against the `canvas` are measured in
> [ACCESSIBILITY.md](./ACCESSIBILITY.md) §2. `text-muted` and `text-dim` have caveats there.

### 2.5 Semantic tints

Status is shown with a **tint + border + icon + label**, never colour alone:

```
success badge:  bg emerald-500/10 · border emerald-500/20 · text emerald-400 · icon CheckCircle2
phase badge:    bg blue-500/10    · border blue-500/20    · text blue-400
format pill:    bg #212637        · border #2e344a        · text slate-300 (mono, uppercase)
```

New statuses (e.g. `needs_review` in Phase 1) must define a tint, a border, text colour,
an icon, **and** a text label.

---

## 3. Typography

**Family:** system sans (`font-sans`) for all prose and labels; `font-mono` for machine
values (BPM, key, duration, counts, hash, format pill).

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Brand wordmark | 16px (`text-base`) | 700, tight tracking | Header only |
| Body / table primary | 12px (`text-xs`) | 400–500 | The workhorse size |
| Secondary row text | 12px (`text-xs`) | 400 | Artist, album |
| Column headers | 10px (`text-[10px]`) | 600, uppercase, `tracking-wider` | Table `<th>` |
| Micro / monospace | 10–11px (`text-[10px]`/`text-[11px]`) | 400, mono | Counts, hash, footer |
| Badge / pill | 10px | 500–600, uppercase | Status chips |

**Rules**

- Uppercase is reserved for column headers and short pills.
- Numerics in tables always use `font-mono` and right/centre alignment for column rhythm.
- Never go below 10px; that floor is for non-essential metadata only.

---

## 4. Spacing, layout, and radius

**Spacing scale:** 4px base (`4, 8, 12, 16, 20`, …). Tailwind default steps map directly.

**Fixed chrome heights:**

| Region | Height | Note |
|--------|--------|------|
| Header (global bar) | 56px (`h-14`) | Brand, primary actions |
| Toolbar | 48px (`h-12`) | Search, counts, filters |
| Status bar (footer) | 28px (`h-7`) | Status + tech tagline |
| Track row | ~36–40px | `py-2.5` + content; keeps density high |

**Radius:** `rounded-sm` (2–4px) for tiles/pills, `rounded-md` (6px) for inputs/buttons,
`rounded-lg` (8px) for the logo tile, `rounded-2xl` (16px) for the empty-state icon tile.

**Borders:** 1px, using the border tokens above. No double borders, no heavy dividers.

**Elevation:** flat by default. The primary action may carry a soft colour shadow
(`shadow-blue-600/30`); nothing else elevates.

---

## 5. Iconography

- **Library:** `lucide-react`, 2px stroke, inheriting `currentColor`.
- **Sizes:** 14px (`w-3.5`) for inline/status, 16px (`w-4`) for controls, 20px (`w-5`) for
  brand, 32px (`w-8`) for empty states.
- **Meaning:** `Disc3` (brand), `FolderOpen` (scan), `Search`, `RefreshCw` (refresh /
  progress), `Music` (no artwork), `Clock` (duration), `HardDrive` (count), `ShieldCheck`
  (local-first), `CheckCircle2` (indexed).
- **Rule:** an icon that conveys status or an action must have an accessible name
  (`aria-label` or adjacent text). Decorative icons are marked `aria-hidden`.

---

## 6. Motion

| Use | Spec |
|-----|------|
| Control hover / colour transitions | 150ms ease (`transition`) |
| Progress bar fill | 200ms (`transition-all duration-200`) |
| Refresh icon while loading | continuous spin (`animate-spin`) |
| Brand logo idle | slow spin (`animate-spin-slow`) |

**Rules:** motion communicates state (loading, progress), not decoration. All motion must
be suppressed under `prefers-reduced-motion` — see [ACCESSIBILITY.md](./ACCESSIBILITY.md) §5.

---

## 7. Component inventory

Each entry lists purpose, anatomy, states, and where it lives in code today.

### 7.1 Primary button — "Scan Music Folder"
- **Anatomy:** `FolderOpen` icon + label, `rounded-md`, `text-xs`, `font-medium`.
- **States:** rest (`primary`), hover (`primary-hover`), disabled (`primary-disabled`,
  label switches to "Scanning…"), focus (visible ring/border).
- **Rule:** one primary action per view. Phase 0's is scan.

### 7.2 Icon button — refresh
- **Anatomy:** single 16px icon, `rounded-md`, bordered control surface, tooltip via `title`.
- **States:** rest, hover (`surface-control-hover`), disabled, loading (icon spins).
- **Rule:** icon-only buttons always carry a `title` and `aria-label`.

### 7.3 Search input
- **Anatomy:** leading `Search` icon, `pl-9`, placeholder, `rounded-md`, bordered.
- **States:** rest, focus (`focus:border-blue-500`), populated.
- **Behaviour:** filters client-side across title, artist, album, path (Phase 0).

### 7.4 Progress bar (scan / analysis)
- **Anatomy:** label line (current item + counts) above a track with a fill bar.
- **Determinate:** fill width = `scanned / total`; **indeterminate:** total unknown → show
  `?` and animate/pulse.
- **States:** running, complete (strips away, status bar summarises).
- **Planned (Phase 1):** reuse for analysis with per-track confidence.

### 7.5 Status badge
- **Anatomy:** tinted pill = background tint + 1px border + icon + uppercase label.
- **Examples:** "Indexed" (success), "Phase 0 Foundation" (info).
- **Rule:** colour is redundant with the label; never colour-only.

### 7.6 Artwork thumbnail
- **Anatomy:** 36px tile, `object-cover`, `rounded-sm`, 1px border.
- **Fallback:** muted tile with centered `Music` icon; `title` distinguishes "Loading
  artwork…" from "No embedded artwork".
- **Behaviour:** lazy-loaded per track via the `get_artwork` command; failures degrade to
  the placeholder, never a broken image.

### 7.7 Data table (library list)
- **Anatomy:** sticky uppercase header, zebra-free rows with hover highlight, mono numerics,
  status pills. Minimum width 1200px; horizontal scroll on narrow windows.
- **Columns (Phase 0):** #, Art, Title, Artist, Album, BPM, Key, Rating, Duration, Format,
  Comments, Fingerprint, Status.
- **States:** each column defines an empty value (`—`, "Untitled", "Unknown Artist").
- **Rules:** titles use `text-primary` and brighten to `primary-text` on row hover; comments
  truncate with the full text exposed via `title`.

### 7.8 Empty state
- **Anatomy:** rounded icon tile + headline + one-line guidance + optional current-folder
  chip.
- **Example:** "No tracks in library → Click 'Scan Music Folder' to import .mp3/.flac/.wav/.aiff".
- **Rule:** always names the next action.

### 7.9 Status bar (footer)
- **Anatomy:** left = state dot + human status message; right = mono tech tagline
  ("BLAKE3 Fingerprint · SQLite Core · Offline").
- **Rule:** the single source of ambient truth for idle/scanning/analyzing/exporting/error.

### 7.10 Panels / cards _(planned)_
Used by the set builder, skills panel, and detail drawers. Same surface + border tokens,
`rounded-lg`, generous internal padding, a clear title row, and a scrollable body.

### 7.11 Tooltip
- **Phase 0:** the native `title` attribute.
- **Planned:** a styled tooltip for richer content; keep the native `title` as fallback.

---

## 8. Recommended tokenisation

Phase 0 uses inline arbitrary values (e.g. `bg-[#1a1e2b]`). Before building the set builder,
promote these into named tokens so themes and future light mode are possible:

```css
/* Design tokens (proposed) */
--color-canvas:            #0f1117;
--color-surface:           #141721;
--color-surface-2:         #11131c;
--color-surface-raised:    #12151e;
--color-surface-input:     #1a1e2b;
--color-surface-control:   #1e2230;
--color-border-subtle:     #222738;
--color-border-default:    #2a2f42;
--color-primary:           #2563eb;
--color-primary-hover:     #3b82f6;
--color-text-primary:      #f1f5f9;
--color-text-muted:        #94a3b8;
--radius-sm: 4px;  --radius-md: 6px;  --radius-lg: 8px;
```

Expose them through the Tailwind theme (Tailwind v4 `@theme`) so components reference
`bg-surface`, `text-muted`, etc. This is the prerequisite for a consistent light theme.

---

## 9. Do / Don't

| Do | Don't |
|----|-------|
| Use colour to reinforce a label | Encode meaning in colour alone |
| Keep numerics in `font-mono`, aligned | Mix proportional digits in tables |
| Use `text-muted` for secondary text only | Use `text-dim` for body copy |
| One primary action per view | Competing blue buttons |
| State "source files are never modified" | Imply upload or modification |
| Mark AI-generated output | Present AI values as certain |
| Suppress motion under reduced-motion | Rely on animation to convey state |

---

*When you add a component, add it here with its states. When you add a token, add it to §8 so
it is themeable. Code and this document must not drift.*
