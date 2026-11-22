# T2.2.1 Tag Surgeon — read-only fuzzy clustering: native running-window QA

Date: 2026-11-19 · Branch: `feat/tag-surgeon-fuzzy-clustering` ·
Spec: `docs/specs/features/2026-11-19-tag-surgeon-fuzzy-clustering-design.md`
App: Tauri shell (`dj-assistant-desktop.exe`), Vite on :1420, library 94 tracks.
Result: **PASS** for the read-only slice. Seeds reverted; no source audio touched.

## Method

- Computer Use host MCP driven by session-local stdio JSON-RPC drivers: each
  sequence runs `get_window_state` → clicks/keypresses in one server process so
  coordinate clicks chain a fresh snapshot revision.
- IPC channel: F12 WebView2 DevTools (undocked window), console paste via
  PowerShell `Set-Clipboard` + Ctrl+V. Scripts call
  `__TAURI_INTERNALS__.invoke` directly — the same commands the UI uses.
- DB cross-check: `node:sqlite` in `readOnly` mode against
  `%APPDATA%/com.djassistant.desktop/dj_assistant.db` while the app holds the WAL.
- UI evidence is screenshots: modal portals do not appear in the UIA tree, and
  `copy()` is undefined in this WebView2 build, so console read-back is
  `console.log` captured from the DevTools window.

## Seeds (through the app write path, `update_track_metadata`)

| Track | id prefix | Tags written | Stored spellings |
| --- | --- | --- | --- |
| Agony (Kinky Sound Extended Remix) | `fb4fd044` | Hi-NRG, Café, !!! | `hi-nrg`, `café`, `!!!` |
| All Night (Original Mix) | `4391cfcc` | Hi NRG, Cafe | `hi nrg`, `cafe` |
| All This Love (Original Mix) | `ad260572` | Hi NRG Techno | `hi nrg techno` |

`SEED_OK [1,1,1]`; `track_tags` held 6 rows.

**Deviation from spec §12:** the metadata editor's `normalizeTags` trims and
ASCII-lowercases, so case/space variants cannot be seeded through the write
path. The live pairs therefore exercise punctuation (`hi-nrg` vs `hi nrg`),
accents (`café` vs `cafe`), a punctuation-only tag (`!!!`) and a whole-word
prefix (`hi nrg` ⊂ `hi nrg techno`). Case folding is covered by engine unit
tests only.

## IPC reports (`tag_cluster`)

Selection `[A,B,C]` and whole-library `{}` returned identical reports:

- `scannedTags: 6`, `ignoredTags: 1`
- clusters, ordered distinctTrackCount desc then key asc: `cafe` → members
  `cafe ×1`, `café ×1`, distinctTrackCount 2; `hi nrg` → `hi nrg ×1`,
  `hi-nrg ×1`, distinctTrackCount 2
- prefixEdges: `hi nrg ⊂ hi nrg techno`, narrowerTracks 1, broaderTracks 1,
  sharedPrefix `hi nrg`

Single track `[A]`: `scannedTags: 3`, `ignoredTags: 1`, clusters `[]`,
prefixEdges `[]`.

Edge track counts are the representative spelling's counts (1·1), not the
fold-bucket union — spec §5 confirmed live.

## Dialog (Fix tags from the row context menu)

- Fix tags is live (stub tooltip gone) and applies to the whole selection.
- 3-track scan: cluster cards titled by the representative raw spelling, member
  lines `raw ×count`, "2 tracks affected"; a "Possibly related" section with the
  advisory sentence and `hi nrg ⊂ hi nrg techno (1 track · 1 track)`;
  "1 tag is punctuation-only and was left alone"; footer is Close only — no
  apply-shaped control anywhere.
- 1-track scan (Agony): "No duplicate spellings in this track." plus
  "1 tag is punctuation-only and was left alone".
- The first 1-track attempt showed the empty message **without** the note:
  operator error, not a defect. The selection toolbar collapses when the
  selection drops to one, shifting table rows 26px (screenshot space) between
  the plain click and the right-click, so the scan ran on All Night
  (ignoredTags 0). `TagSurgeonDialog` renders the note unconditionally and
  `lib/tag-surgeon` supplies the singular form; a redo with toolbar-aware
  coordinates produced the expected note.

## Revert and cross-check

`update_track_metadata` with `tags: []` per seeded track → `REVERT_OK [1,1,1]`.
`track_tags` back to 0 rows (the pre-seed baseline); tracks still 94; the three
titles/ids unchanged; the requests carried tags only, so no other field was
written.

The renderer kept the seeded chips until a window reload — raw IPC bypasses the
renderer's refresh path. After `location.reload()` the library shows no tag
chips. Recorded so a future pass does not mistake stale chips for a failed
revert.

No source audio file was modified: both writes went through the app's DB-only
metadata path.

## Gates (same commit)

287 desktop `node --test` tests; portable Rust suite (core 253 including the 20
`tag_clustering` unit tests and the tag-vocabulary SQL execution tests,
analysis 98, schema 11); `pnpm lint` 0 errors; `pnpm typecheck`; `cargo fmt`;
`clippy -D warnings`. The desktop crate's own test binary still dies
`STATUS_ENTRYPOINT_NOT_FOUND` on this box (pre-existing toolchain issue), so the
Tauri command layer is verified by the SQL execution tests plus this live pass.

## Automation gotchas recorded for future passes

- CUA snapshot state is per server process: start every sequence with
  `get_window_state`; any click or keypress invalidates the screenshot
  revision, so refetch before the next coordinate click.
- Table body rows are absent from the UIA tree (header row only): rows need
  coordinate clicks; headers and buttons can use element clicks.
- The selection toolbar appears at ≥2 selected tracks and shifts rows +26px in
  screenshot space; recompute row coordinates whenever the selection count
  crosses that boundary.
- Screenshot space is 1428×768 against a 1920×1032 client (×1.344538 for
  OS-synthesised input).
- Modal dialog text is missing from AX captures; screenshots are the only UI
  evidence.
