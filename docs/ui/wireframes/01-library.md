# Wireframe — Library (01)

**Phase:** 0 · ✅ Implemented
**See also:** [Screens & Flows §3](../12-SCREENS-AND-FLOWS.md) · [Design System §7.7](../01-DESIGN-SYSTEM.md)

The home base: one dense, searchable table of the imported library. This is the only fully
shipped screen so far.

---

## Wireframe — populated

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◉ DJ Assistant   [ Phase 0 Foundation ]                          [ Scan Music Folder ]  [ ⟳ ]                 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {1} [ search title, artist, album, path… ]  [Filters 2] [✚ Tag Health] [Charts]  94 tracks · ⚡ 6 streaming · 5 stores · 0 connected │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {8} ⌗ Tempo 120–130 BPM   ⌗ Key 8A, 8B   clear all                                                             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {2} #   ART   TITLE              ARTIST         ALBUM      BPM   KEY   RATING  TIME   FMT    STATUS           │
│────────────────────────────────────────────────────────────────────────────────────────────────────────────────│
│  =   1   ▣     Deep Horizon       Kael           Drift      124   8A    ★★★     6:12   FLAC   ● Indexed        │
│      2   ▣     Solar Wind         Nova           Orbit      125   8B    ★★      5:48   MP3    ● Indexed        │
│      3   ▣     Untitled           Unknown Artist  —         —     —     ☆       4:02   WAV    ● Indexed        │
│      4   ▣     Midnight Drive     Vela           Coast      122   7A    ★★★★    6:33   AIFF   ● Indexed        │
│      …                                                                                                         │
│                                    ┌───────────── {7} inspector drawer (overlay, right) ─────────────┐          │
│                                    │ ▣ Glue · Bicep · 128 · 8A · 6:00                  [ ✕ ]          │          │
│                                    │ [missing: Album] [missing: ISRC]                               │          │
│                                    │ ✦ SIMILAR — Atlas 93% · Apricots 81% …                        │          │
│                                    │ ⎋ FIND TO BUY — Beatport/Traxsource/Juno… [Copy link]          │          │
│                                    └────────────────────────────────────────────────────────────────┘          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {3} ● Library loaded: 94 tracks      0 connected · 6 streaming · 5 stores   BLAKE3 · SQLite · Offline          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

> Columns shown: `# · Art · Title · Artist · Album · BPM · Key · Rating · Duration · Format ·
> Comments · Fingerprint · Status` (Comments and Fingerprint omitted here for width; they
> sit between Format and Status in the real table).

---

## Wireframe — scanning (progress strip active)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◉ DJ Assistant   [ Phase 0 Foundation ]                           [ Scanning… ]  [ ⟳ ]                        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {4} ⟳ Scanning: D:\Music\deep\track.flac                           128 / 402 files                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ search… ]                          41 tracks so far  ·  Local-first · Non-destructive                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {2} #   ART   TITLE              ARTIST         ALBUM      BPM   KEY   RATING  TIME   FMT    STATUS           │
│      1   ▣     Deep Horizon       Kael           Drift      124   8A    ★★★     6:12   FLAC   ● Indexed        │
│      2   ▣     Solar Wind         Nova           Orbit      —     —     ☆       5:48   MP3    ● Indexed        │
│      …   (rows appear live as tracks import)                                                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — empty

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◉ DJ Assistant   [ Phase 0 Foundation ]       [ Scan Music Folder ]  [ ⟳ ]                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ search… ]      0 tracks  ·  Local-first · Non-destructive                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│                              ┌──────────────┐                                               │
│                              │      ♪       │   {5}                                         │
│                              └──────────────┘                                               │
│                                                                                             │
│                              No tracks in library                                           │
│                Click "Scan Music Folder" to import your local audio files.                  │
│                          Supported: .mp3 .flac .wav .aiff .m4a                              │
│                                                                                             │
│                       [ current folder: D:\Music ]  {6}                                     │
│                                                                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  ● Ready        BLAKE3 Fingerprint · SQLite Core · Offline                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Search input + Filters + Tag Health + Charts | Search filters the table live across title, artist, album, and path; no refetch. **Filters** opens the structured filter dropdown (tempo range, Camelot keys, analysis status, genre, minimum rating — applied server-side in SQL on Apply, with a count badge and summary chips); **Tag Health** opens the gap/enrichment modal and **Charts** the snapshot modal (see [wireframe 12](./12-discovery-enrichment.md)); provider summary shows registry counts with a full-list tooltip |
| {2} | Track table | Dense, sticky header, hover highlight; mono numerics; one row per track; **row click opens the inspector drawer** (selected row tinted and marked `=`; click again or `Esc` closes) |
| {3} | Status message | Reports the last action result (loaded / scan summary / error); middle shows provider status |
| {4} | Scan progress | Current path + `scanned / total`; bar is determinate when total is known |
| {5} | Empty-state icon | Decorative; the headline carries the meaning |
| {6} | Current-folder chip | Shown only after a folder has been chosen this session |
| {7} | Inspector drawer | Overlay panel (see [wireframe 12](./12-discovery-enrichment.md)): identity + gap chips + similar tracks + buy-links; never replaces the table |
| {8} | Active filter chips | One chip per active filter group (`Tempo 120–130 BPM`, `Key 8A, 8B`, …) with a `clear all` action; the `Filters` button shows the active-group count badge |

### Column semantics

| Column | Source | Empty value | Notes |
|--------|--------|-------------|-------|
| `#` | row index | — | Display only, not a track ID |
| `Art` | cached embedded art | `♪` placeholder | Lazy-loaded per row; never a broken image |
| `Title` | tags | "Untitled" | Hover highlights the row |
| `Artist` | tags | "Unknown Artist" | — |
| `Album` | tags | `—` | — |
| `BPM` | tags / analysis | `—` | Mono |
| `Key` | tags / analysis | `—` | Camelot, mono; tooltip shows classical key |
| `Rating` | user | `☆` | 0–5 stars |
| `Time` | header parser | `0:00` | Mono |
| `Format` | container | "AUDIO" | Uppercase pill |
| `Comments` | tags | `—` | Truncated; full text in tooltip |
| `Fingerprint` | BLAKE3 | — | Short hash; full hash in tooltip |
| `Status` | analysis | — | Tinted pill (icon + label), never colour-only |

---

## States

| State | Behaviour |
|-------|-----------|
| **Empty** | Icon tile + "No tracks in library" + scan guidance; no columns drawn |
| **Loading** | Rows append live during a scan; no blocking spinner |
| **Populated** | Table with all columns; status bar reports the count |
| **Filtered-to-nothing** | Empty-state renders within the table region with the active query echoed |
| **Error** | Status bar shows "Error loading tracks" / "Scan failed: …"; existing rows stay |

---

## Interactions

- **Scan Music Folder** → native picker → recursive scan → live rows → completion summary.
- **Search** → instant client-side filter as you type.
- **Filters** → dropdown for tempo range, Camelot keys, analysis status, genre and minimum
  rating; **Apply filters** refetches from SQLite (draft state ⇒ one query for many filters),
  **Reset all** clears filters and restores newest-first order; active filters render as
  chips under the toolbar with a one-click clear.
- **Sortable headers** (Title/Artist/BPM/Key/Time/`#`) → toggle asc/desc and refetch; unknown
  BPM/key values stay last.
- **Refresh (⟳)** → reload the list (icon spins while loading).
- **Row click** → opens the inspector drawer ([wireframe 12](./12-discovery-enrichment.md)):
  similar tracks, gap chips, buy-links. Click again / `✕` / `Esc` closes.
- **Tag Health** → gap modal (per-field bars + gap list; online lookup is explicit and opt-in per provider).
- **Multi-select** _(Phase 2)_ → enables [Tag Cleanup](./05-tag-cleanup.md) and batch actions.

---

## Accessibility obligations

- The list is tabular data: use `<table>` with `<th scope="col">` and a caption/label.
- Artwork images are decorative (`alt=""`); the title conveys the meaning.
- Icon-only controls (refresh) need an `aria-label` and `title`.
- Announce the scan completion summary via the status region, not a modal.
- Rows become focusable/arrow-navigable in Phase 2 (see [Accessibility](../10-ACCESSIBILITY-AND-KEYBOARD.md)).

---

## Notes

- Source files are **never modified**; every value here is read from tags/analysis and
  stored locally.
- Numeric columns use monospace so digits and columns line up.
- The drawer and Tag Health modal are overlays: the table stays mounted underneath, and
  `Esc` always returns focus to the invoking row/button.
