# 13 — UI/UX Remediation Status

**Date:** 2026-10-19
**Sources:** [`../UI_UX_PLAYER_AND_LAYOUT_SPEC.md`](../UI_UX_PLAYER_AND_LAYOUT_SPEC.md) v1.9 (master) · this doc set · shipped code in `apps/desktop/src/`
**Baseline:** Impeccable critique `2026-10-19T12-15-18Z__src-app-tsx.md` — 24/40, 3× P1
**Method:** doc-vs-code delta analysis, then phased remediation (clarify → distill → harden → typeset → adapt → layout → polish → document).

Scope split agreed up front: **Bucket 1** = fixes and alignment on existing surfaces (applied, recorded below); **Bucket 2** = feature work (recorded as remaining — honestly scaffolded, never faked).

---

## 1. Applied (Bucket 1)

### Clarify / honesty
- **Estimated waveform badge** — `WaveformData.isEstimated` flag in `lib/waveform-generator.ts`; `DetailedWaveform` renders an "Estimated waveform" pill while peaks are PRNG-synthesized (docs/ui/06: no fabricated analysis data presented as real).
- **Synth-audio disclosure** — "Synth preview audio" pill in the player identity row + honest Play tooltip: the engine is a synthesized timing beat until real audio decode ships. LUFS chip removed entirely until real loudness analysis exists.
- **Error vs. empty** — `findSimilarTracks` / `storeLinksForTrack` failures now show a distinct error state with **Retry** instead of masquerading as "no results" (`similarError`, `storeLinksError`, `drawerRetry`).
- **Status honesty** — header status dot bound to a real tone (`ok` / `busy` / `error` via `pushStatus`); error copy sanitized (no raw `${err}` dumps) with a recovery hint; status region is `role="status" aria-live="polite"`.
- **Analysis chip** — hardcoded green "Indexed" replaced by `ANALYSIS_STATUS_CHIP` keyed on real `track.analysisStatus` (Analyzed / Pending / Failed / Needs review).
- **Copy** — `index.html` description no longer claims "performance-ready DJ set" (spec §0 non-goals); player drag hint and tooltips reworded.

### Distill / structure
- **Sidebar** — nav narrowed to the three real views (Library · Preparation · Auto; matches spec §1 and the header view switcher); the four planned surfaces (Playlists, Browser, Flash/USB, Skills) moved to a read-only **Roadmap** strip — no more disabled "Soon" buttons pretending to be controls.
- **Placeholder views** — dead disabled option buttons in `ViewPlaceholder` are now non-interactive dashed tags; each placeholder view carries a "Planned view" badge and states what ships when.
- **Brand leaks removed** — "Ableton" aria-labels and design-rationale comments stripped from `PreviewPlayer`, `TransportSection`, `DetailedWaveform` (kinship remains structural, per spec §16).
- **Active nav style** — colored `border-l-2` side accent replaced by background + weight (the detector's side-tab tell).

### Harden / keyboard & a11y
- **Cue safety** — clearing a hot cue now offers a visible **Undo** toast (6 s, keyboard-reachable) inside the player; plus a visible hover/focus **×** clear affordance on set cue pads (opacity-based, stays in tab order).
- **Shortcut scoping** — global Space/1–8/C-key handlers ignore events originating from inputs, buttons, links, sliders, toolbars (docs/ui/10); `Ctrl/Cmd+1–3` view shortcuts suppressed while typing.
- **Slider keyboard** — `DetailedWaveform` and `CompactWaveform`: arrows ±2 s (Shift ±10 s, beat-snapped on detailed), Home/End jump bounds, `aria-valuetext` with timecode (+ bar/beat).
- **Modal a11y** — new `components/ModalShell.tsx`: `role="dialog"`, `aria-modal`, focus moves in on open, Tab/Shift+Tab trapped, Escape closes, focus returns to opener. Tag Health + Charts dialogs use it (browser-verified end-to-end).
- **Splitter** — player height handle is `role="separator"` with `aria-valuenow`, arrow-key resize, Enter/double-click reset.
- **Transport** — mute toggle `aria-pressed`; muted volume slider shows the real value (`aria-valuetext`) instead of snapping to 0.
- **Theme** — live `prefers-color-scheme` listener already present and verified.

### Typeset / color
- **Carbon palette migration (2026-10-19, later same day)** — the bespoke charcoal + teal palette described in the bullets below was superseded wholesale by **IBM Carbon Design System** tokens (g100 dark / g10 light) in `apps/desktop/src/index.css`; semantic `--dj-*` Tailwind names now alias `--cds-*`. The AA fixes below are folded into the Carbon values (see [01 §2–3](01-DESIGN-SYSTEM.md)); they remain accurate as the history of the pre-Carbon palette.
- **`--text-muted` AA fix** — dark `#8F97A5` (≈5.8:1), light `#5B626E` (≈5.4:1); see errata in [01](01-DESIGN-SYSTEM.md).
- **`--cue` token** — CUE orange promoted to a semantic token (dark `#F97316` / light `#EA580C`); hardcoded `#F97316` in `TransportSection` now uses `dj-cue`.
- **Light accent deepened** — `#0D9488` → `#0F766E` (the table value fails AA as text and under white button text at 3.7:1).
- **11 px floor** — every `text-[9px]` / `text-[10px]` occurrence raised to 11 px; canvas micro-labels (phrase tags, bar numbers, CUE badge, cue letters) bumped from 9–10 px to 11 px.

### Adapt / layout
- **No silent hiding** — mini-mode cue strip hidden below `sm` → always visible with horizontal scroll; BPM fine calibration hidden below `lg` → always visible; bar/beat counter hidden below `md` → always visible.
- **Table** — title/artist cells truncate with full-value `title` tooltips; pagination added (`visibleLimit` + "Load more — showing X of Y" past the first 200).
- **Filter reset** — `resetFilters` no longer wipes sort order; its tooltip says so.
- **OverviewMap** — stale render-time `containerWidth` replaced by `ResizeObserver` state (guarded drag math); duplicate double-click handler removed (mousedown already centers + seeks).
- **Wheel** — vertical wheel on the detailed waveform zooms (Shift/horizontal pans), per docs/ui/06; wired through `onWheelZoom`.
- Stray `{" "}` text node inside `<tr>` removed.

## 2. Verification (this session)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | pass |
| `pnpm lint` (prettier) | pass |
| `impeccable detect` on changed files | **0 findings** (side-tab resolved) |
| In-page contrast scan (both themes) | **0 failures** at AA thresholds |
| In-page text-size scan | 0 visible nodes < 11 px |
| DOM: nav/roadmap/status/live-region markup | as specified |
| Modal behavior (open → focus in → Esc → focus return) | browser-verified |
| Console errors | none |

## 3. Remaining (Bucket 2 — feature work, not faked)

- Real audio decode → replaces the synth-audio disclosure and, with it, `isEstimated` waveform pills (flip flag at the decode site).
- Analysis backend → status chips already render real `analysisStatus`; only data arrives.
- Preparation / Auto Performance views behind their "Planned view" scaffolds; Settings window; command palette; visualizer.
- Cue-pad roving tabindex within the toolbar (currently each pad + clear × is its own tab stop).
- Waveform canvas palette → read from CSS custom properties instead of literals (colors are currently theme-correct via `isDarkTheme`, values token-matched).
- ~~Remote fonts (Inter) intentionally not loaded~~ — superseded: IBM Plex Sans + IBM Plex Mono now load in `index.html` (Google Fonts) with a full system-stack fallback, so offline-first degradation is preserved.

## 4. Post-critique follow-up (same day)

Re-score recorded at `apps/desktop/.impeccable/critique/2026-10-19T14-03-27Z__src-app-tsx.md`: **29/40** (baseline 24/40), P1 findings 3 → 1. The findings below were closed immediately after that re-score:

- **P1 — the inspector drawer was pointer-only.** Library rows are now focusable (`tabIndex={0}`, `aria-label`, `aria-selected`) and toggle the drawer with Enter/Space, with a `focus-visible` ring.
- **P2 — the honest synth-audio disclosure was missing in mini player mode** (the default mode). A compact `Synth` pill now sits in the mini identity strip; full mode keeps the "Synth preview audio" pill.
- **P3 — shortcut scoping was over-broad.** Only typing fields swallow all keys now; a focused button/control keeps just Space/Enter (native activation), so `C` and `1–8` work regardless of focus.
- **P3 — `Ctrl+1–3` could unmount an open dialog.** View shortcuts are suppressed while a dialog is open.
- **P3 — modal dismissal & scroll.** Scrim click dismisses (`docs/ui/08`), background scroll is locked while open and restored on close — both browser-verified, along with Escape and focus return.
- **Bug caught by verification, not the critique:** the player's key handler threw (`target.getAttribute is not a function`) when the event target was `document`. Both global key handlers now guard with `instanceof HTMLElement`.

Still open from the re-score (tracked, not yet applied): the shortcut legend disappears once a track is selected; Scan / Analyze have no Cancel affordance; full-mode bottom row control density; phrase-band labels and pre-placed A–D cue pads are still synthesized (covered by the peaks badge, not individually labelled).

## 5. Deviations from docs

See **Errata (superseded)** in [01-DESIGN-SYSTEM.md §3](01-DESIGN-SYSTEM.md): three pre-Carbon token values shipped differed from the table where the table value failed AA (docs/ui/10 outranks the hex). The Carbon migration since replaced the palette, so the tables in 01 now record shipped values directly. Everything else in this doc set was treated as authoritative over code.
