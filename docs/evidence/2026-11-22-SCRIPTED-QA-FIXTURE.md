# Scripted QA run on a fixture copy — 2026-11-22

**Build:** `docs/state-audit-correction` at `38019b18`. Its code matches `main` at
`8f5d2253` (only `docs/` differs), which contains PR #91 (Tag Surgeon apply/undo,
aliases) and the library table pass.
**Database:** a synthetic 300-track fixture (`scripts/make-library-fixture.mjs`),
seeded with tag spelling variants, read through `DJ_ASSISTANT_DB_PATH`. The live
library (`%APPDATA%\com.djassistant.desktop\dj_assistant.db`, mtime 2026-11-19)
was not opened or written.
**Driver:** Node scripts talking Chrome DevTools Protocol to WebView2 on port 9222
(`scripts/qa/fixture-run/`; `seed.mjs` builds the fixture seeds and baseline, and
`cdp.mjs` is the client). Run it with `DJ_ASSISTANT_DB_PATH` pointing at a copy of
the fixture. Not a desktop computer-use session: no native-window clicks.
Mouse and keyboard were simulated through DOM events and `Input.insertText`.

## Fixture setup

- Seeded only case, spacing and accent variants, because the scan skips any group
  whose spellings differ in punctuation (`tag_clustering::cluster_tags`).
- Seeded tag `Dark Groove` variants on tracks 00001–00004: `Dark Groove`,
  `dark groove`, `DARK  GROOVE`, `Dárk Groove`.
- Baseline `track_tags` = 207 rows, `skill_runs` = 0, `tracks` = 300.

## Results

| # | Area | Check | Result | Evidence |
| --- | --- | --- | --- | --- |
| L1 | Library | Headers Title, Artist, BPM, Key, Energy, Rating, Time render | PASS | DOM check, all seven present |
| L2 | Library | Table is virtualised: DOM holds a window of rows, not 300 | PASS | 9–20 `Play …` rows in DOM for 300 tracks |
| L3 | Library | Search narrows to one exact title after the full list is loaded | PASS | `Synthetic Track 00042` → 1 row |
| L4 | Library | Search with no match shows the empty state | PASS | "No tracks match" shown |
| L5 | Library | Clear search and filters restores rows | PASS | 20 rows rendered after clear |
| L6 | Library | Header shows `Library loaded: 300 tracks` | PASS | status text |
| TS1 | Tag Surgeon | Context menu "Fix tags" opens the scan for a 4-track selection | PASS | dialog "4 tracks" |
| TS2 | Tag Surgeon | Scan finds one cluster, canonical `dark groove`, 3 tracks to change | PASS | dialog text matches `tag_cluster` IPC |
| TS3 | Tag Surgeon | Apply asks for confirmation, then rewrites exactly the 3 tracks | PASS | DB: tracks 00001, 00003, 00004 → `dark groove`; 00002 unchanged; 207 rows |
| TS4 | Tag Surgeon | "Changed 3 tracks. Undo is available…" shown | PASS | dialog text |
| TS5 | Tag Surgeon | Undo restores every tag row | PASS | "Restored 3 tracks."; all 207 `track_tags` rows match the baseline row by row (track id and tag, ordered compare) |
| M1 | Mix dock | Mix button opens the dock with ranked candidates and reason chips | PASS | candidates listed with "same key", "energy-boost", BPM deltas |
| M2 | Mix dock | Preview loads the candidate in the player | PASS | player shows `Synthetic Track 00121`, 3:30 = 210 s (DB) |
| M3 | Mix dock | Add adds the candidate to the selection and writes nothing | PASS | selection 1 → "2 tracks selected"; `track_tags` unchanged |
| M4 | Mix dock | Resize handle exposes its width | PASS (read only) | `aria-valuenow` = 320 |
| M5 | Mix dock | Close removes the dock | PASS | dock gone after click |

**Net-zero:** after TS5 and the mix dock checks, every `track_tags` row matched the
baseline (a full row-by-row compare, not only the count). `skill_runs` = 1, the Tag Surgeon undo snapshot from TS3. Nothing else
was written to the fixture. The live database was not touched.

## Observations (not failures)

1. **Library search only covers loaded rows.** A title beyond the first page shows
   "No tracks match" until you press Load more. This matches the code comment
   ("Search stays client-side over the loaded pages"), but the empty state does not
   say so. Worth a line of copy or a server-side search.
2. **Tag Surgeon may be silent about punctuation-only variants (code reading, not
   tested in the UI).** `cluster_tags` drops a bucket whose spellings differ in
   punctuation, such as `Peak-Time` and `Peak Time`, and emits nothing for it. This
   is intended (`C#` vs `C`). The fixture seeds exclude such variants, so this run
   did not observe the UI for them.

## Not verified

- Visual layout, colours, and the toast text for Add. Those need a human look.
- Dock resize by drag, and keyboard resize.
- Rust test suite on this run. The desktop test binary still does not start on
  this box (AGENTS.local.md); the core and schema suites were not run here.
- The live library. It was deliberately left alone.
- Ticks in `docs/sdd/04-TASKS.md`. Those stay with the human, per F-012.
