# UI simplification plan — 2026-11

**Status:** Proposed (2026-11-22) · **Owner:** desktop UI
**Source:** [UI/UX audit 2026-11-22](../audits/2026-11-22-ui-ux-audit.md) (findings U-01 – U-29)
**Tasks:** TU.1–TU.16 in [`sdd/04-TASKS.md`](../sdd/04-TASKS.md) · **UI gate:** Phase S in
[`ui-ux/11-IMPLEMENTATION-CHECKLIST.md`](../ui-ux/11-IMPLEMENTATION-CHECKLIST.md)
**Fits the v1 plan as:** part of Stage 2 (Library and Track panel) and Stage 12 (Polish) in
[`plans/v1/implementation-slices.md`](v1/implementation-slices.md). It does not move any
primary tab (the IA is locked).

---

## 1. Goal

Make the Library faster to read and the app honest about what exists, mostly by
**removing** controls:

- every feature has **one** entry point;
- no disabled placeholders in toolbars or menus;
- suggestions are visibly marked, computed facts are not;
- the layout adapts from 1024 px to 2560 px without wrapping, clipping or
  sideways scrolling for the default columns.

**Exit:** all TU tasks ticked, Phase S of the UI checklist ticked, and a
running-window QA pass (§6) recorded under [`qa/evidence/`](../qa/evidence/).

## 2. Principles (apply to every slice)

1. One home per feature. Adding a second entry point needs a written reason.
2. Toolbars collapse into an overflow menu; they never wrap or clip.
3. Unbuilt features are absent, not disabled.
4. Colour carries state only (warning, error, success, active).
5. `Sparkles` + "Suggested" + confidence marks machine suggestions. Nothing else uses it.
6. No stage numbers, task IDs, file paths or token names in product copy.

## 3. Slices

Each slice is one PR, small enough to review in one sitting. Order = value ÷ risk.

### Slice S1 — Honesty fixes (P0) · TU.1, TU.2, TU.3

| Task | Change | Files (expected) | Done when |
|------|--------|------------------|-----------|
| TU.1 | Player shows `–:–` with no track; Energy cell shows `—` when null; Energy column off by default until TA.3 gives energy a source | `preview-player/*`, `EnergyBars.tsx`, column defaults | No number on screen is a placeholder (spot-check every view) |
| TU.2 | Inbox › Needs Attention lists tracks the Status column flags; header Inbox badge shows the count; Status icon tooltip + "N need review" filter chip | `App.tsx` inbox + status cell, filters | Inbox count = number of warning rows in the table |
| TU.3 | Header **Import** runs the working folder scan (the placeholder page is removed until Stage 3); toolbar import button removed; empty state says "Import"; accessible name on the button | `App.tsx` header + toolbar + empty state | One import verb in the UI; a11y tree names it |

### Slice S2 — One place for suggestions (P1) · TU.4, TU.5

| Task | Change | Done when |
|------|--------|-----------|
| TU.4 | Track panel gets a **Mix** tab (results + "add to selection"/"replace seed" actions from the dock). Toolbar `Mix` button and `MixSuggestionsDock` removed. Row menu keeps one enabled "Show mix suggestions" that opens the panel on Mix. The Overview "Similar tracks" block is removed. | `findSimilarTracks` has one caller in the UI |
| TU.5 | Icon map: Analyze → `AudioWaveform`; `Wand2` removed; `Sparkles` only on the Mix tab and its results, with "Suggested" + % confidence. Toolbar/header icons use `text.secondary`, accent when active. Update [09-COMPONENTS](../ui-ux/09-COMPONENTS.md) icon table. | `grep Sparkles` hits only suggestion components; no hard-coded icon colours outside status |

### Slice S3 — Library toolbar and header (P1) · TU.6, TU.7, TU.13

Target (from the audit §4):

```text
Header : [logo] [Search library…]                 Import   Inbox (N)   Backup ●
Toolbar: [Search in view] [Filters ▾] [View ▾]                    [⋯]
Footer : 94 tracks · N need review · N analysed
⋯      : Analyse library · Refresh · Removed tracks · Tag health (until Maintain)
```

| Task | Change | Done when |
|------|--------|-----------|
| TU.6 | Toolbar reduced as above; `Columns` becomes `View` (columns, density, row style); analysis becomes a status chip when work is pending; counts move to a table footer; overflow measures available width and moves items into `⋯` instead of wrapping. Add the toolbar-overflow rule to [03-LIBRARY-VIEW](../ui-ux/03-LIBRARY-VIEW.md). | No wrap or clip at 1024, 1280, 1440 with and without the Track panel |
| TU.7 | Remove header mute and hide-player (they live in the player); theme toggle moves to Settings + command palette. | Each global control exists once |
| TU.13 | Header buttons get text labels ≥ 1280 px and a visible active state; nav rail icons = `library`, `list-music`, `compass`, `bar-chart-3`, `hard-drive-upload`, `settings`, active = accent pill + 2 px bar; "Coming later" tooltip on tabs that are still placeholders. | A screenshot of any page shows where you are |

### Slice S4 — Track panel and context menu (P1) · TU.8, TU.9

| Task | Change | Done when |
|------|--------|-----------|
| TU.8 | One **Edit** button in the panel footer; the Overview link and the Tags-tab button go; "Add to playlist" hidden until Playlists ships. | One edit entry point per panel |
| TU.9 | Row menu shows only working actions (Play, Edit tags, Fix tags, Rate, Show mix suggestions, Reveal, Remove); the column picker moves to header right-click and View. | Menu fits a 720 px window without scrolling |

### Slice S5 — Density and flexible layout (P1) · TU.10, TU.11, TU.12

| Task | Change | Done when |
|------|--------|-----------|
| TU.10 | Density in View: Compact 32 px (default, 28 px art) · Comfortable 40 · Artwork 48; persisted in `UiState`. Implements [14-LIBRARY-TABLE-UPGRADES §2](../ui-ux/14-LIBRARY-TABLE-UPGRADES.md). | ≥ 22 rows visible at 1440×900 in Compact |
| TU.11 | Title/Artist share flexible width (min 160/120); Label, Year, Tags, Energy auto-hide below set widths (View shows them as "hidden — narrow window"); #, Status, Title sticky on horizontal scroll. Add the column policy to 03-LIBRARY-VIEW. | Rating and Time visible at 1024 px with defaults |
| TU.12 | Splitters for rail, Track panel (min 320 / max 560) and player height; sizes persisted; double-click resets. Named workspaces and the custom menu bar are **descoped from v1** (audit U-28) — record as a plan decision in [open-questions](v1/open-questions.md). | Sizes survive restart |

### Slice S6 — Copy and placement (P1/P2) · TU.14, TU.15

| Task | Change | Done when |
|------|--------|-----------|
| TU.14 | Rewrite Settings intro, placeholder pages, Tags-tab notice and tooltips per [copy-and-microcopy](../ui-ux/guidelines/copy-and-microcopy.md); placeholder sub-tabs removed until their stage; sub-tab names follow [information-architecture](../product/information-architecture.md). | `rg --glob '*.tsx' 'Stage [0-9]|T[0-9]\.[0-9]|docs/' apps/desktop/src` finds no user-visible string |
| TU.15 | Tag Health becomes the first view of Library › Maintain (ISRC excluded from the default score); Charts moves to Discover. | Neither appears in the Library toolbar |

### Slice S7 — Polish (P2) · TU.16

Player pre-roll shading, artwork capped to waveform height, empty hot-cue pads
collapsed to "+ Cue"; live filters with removable chips and one home for
"compatible only"; highlight states (loaded = play glyph in #, selected = fill,
focus = outline); key-pill tooltip and legend.

## 4. Sequencing and effort

| Slice | Depends on | Size | Notes |
|-------|-----------|------|-------|
| S1 | — | S | Ship first; fixes misleading output |
| S2 | — | M | Removes a component; update its tests (`mix-dock-actions`) |
| S3 | S2 (Mix button gone) | M | Overflow needs a width observer; keep it generic |
| S4 | S2 | S | |
| S5 | S3 | L | Density touches virtualization row height (`rowHeightForColumns`) |
| S6 | S1, S3 | S | Copy only, plus moving two entry points |
| S7 | S5 | M | |

S1, S2 and S4 can run in parallel branches; S3 → S5 → S7 are sequential.

## 5. Risks

| Risk | Mitigation |
|------|-----------|
| Removing the Mix dock loses the "add to selection" workflow | Port its actions into the Mix tab before deleting the dock (TU.4 done-when) |
| Density change breaks virtualization maths | Row height comes from one function; add a test per density |
| Overflow menu hides frequently used actions | Overflow order = usage order; Analyse moves out only when nothing is pending |
| Users relied on header mute | Keyboard shortcut `M` stays global |

## 6. Verification

- Unit/component tests per slice (`pnpm --filter @dj-assistant/desktop test`).
- Running-window QA on the 300-track fixture (`scripts/make-library-fixture.mjs`,
  `DJ_ASSISTANT_DB_PATH`) at 1024×720, 1440×900 and 2560×1440, dark and light;
  screenshots into `qa/evidence/` next to the 2026-11-22 audit set for
  before/after comparison.
- Re-run the audit's §2 table and mark each finding fixed or open.
