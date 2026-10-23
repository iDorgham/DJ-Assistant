# Slice 3A — manual running-window QA (T2.1.7 · T2.1.13)

**Status:** **NOT EXECUTED** — implementation ready, checklist pending (2026-10-22)
**Scope:** the Definition-of-Done gate for **T2.1.7** (the tags UI) and
**T2.1.13** (comment editing). Both task boxes stay **unticked** until this
checklist runs and every item has a recorded PASS.
**Implementation under test:** the working tree — migration 007
(`track_tags` + `tracks.label`), the generalised `update_track_metadata` /
`undo_track_metadata` write path, the `tag` filter, the `tags` column,
`TagChips`, `RowContextMenu` and `MetadataEditor`.

---

## 1. How to run it (read this first)

The QA must happen in the **Tauri shell**, not in a browser tab:

- `pnpm dev:desktop` starts **only the Vite dev server**. Opened in a plain
  browser, the front-end finds no `__TAURI_INTERNALS__` and
  `apps/desktop/src/services/api.ts` falls back to its **mock** API — the table
  then shows mock rows and every write is a no-op. A browser session proves
  nothing about the real library.
- Start the desktop app with `tauri dev` (from `apps/desktop`). The first run
  cold-compiles the Rust stack (minutes); afterwards the rebuild is short.
- **Open the app once before anything else.** Migration 007 (`track_tags`,
  `tracks.label`) is applied on startup, and every tag query needs it.

Every expectation below is written against the shipped code — the strings are
the real ones, not paraphrase (`apps/desktop/src/App.tsx`,
`components/RowContextMenu.tsx`, `components/MetadataEditor.tsx`,
`lib/library.ts`).

## 2. Baseline (verified 2026-10-22, before the app was restarted on the new build)

- The library: **94 tracks**, 24 analysed (24 complete / 2 failed / 68
  needs_review), 2 missing BPM, 2 missing key.
- **Values written so far:** 0 tracks rated, 0 tracks with energy — a pristine
  baseline.
- **Tags:** the `track_tags` table does not exist yet in the live database
  (migration 007 has not run), and no track carries a tag or a label. The
  first app start creates the table.
- Cross-check the DB at any time with the read-only CLI (`dj-query`, built from
  `crates/core/src/bin/query.rs` behind the `cli` feature):

  ```bash
  dj-query --stats
  dj-query --tag peak --json          # tracks carrying a tag
  dj-query --query "closing set"      # the free-text search (tags + comment)
  ```

  It refuses to open a database whose WAL still holds content, so keep the app
  running while querying. Against a library that predates migration 007 it
  refuses a tag search with a clear message instead of failing inside SQLite.

---

## 3. Section A — The row context menu (T2.1.7)

| # | Action | Expected result |
| --- | --- | --- |
| A1 | Right-click a library row | A menu opens **at the cursor** with `Edit tags…` and a disabled `Fix tags` |
| A2 | The menu is open, press **Escape** | The menu closes; the focus returns to the row it came from |
| A3 | The menu is open, click **outside** it | The menu closes; the focus returns to the row |
| A4 | The menu is open, press **ArrowDown** / **ArrowUp** | The focus moves between the menu items and stays inside the menu |
| A5 | Right-click near the **right edge** of the window | The menu opens **towards** the cursor and stays inside the viewport |
| A6 | Right-click a row, then choose **Edit tags…** | The metadata editor opens for that row |
| A7 | Right-click a row that is **not** selected | The editor opens for that row; the selection is untouched |

## 4. Section B — The metadata editor (T2.1.7 · T2.1.13)

| # | Action | Expected result |
| --- | --- | --- |
| B1 | Open the editor on a row | Title, artist, album, genre, label, year, the custom tags and the comment are seeded with the row's values |
| B2 | The row has no label | The **Label** field is empty — the column has no import source, so the user types it |
| B3 | Change the **title**, press **Save** | Status `Metadata saved for 1 track`; the toast reads `Edited “<title>”` |
| B4 | Open the editor and save **without changing anything** | Status `Metadata unchanged — nothing to save`; **no** Undo toast |
| B5 | Add a tag `Peak Time`, save | The tag is stored **lower-cased** (`peak time`); the `tags` column shows it as a chip |
| B6 | Add the same tag twice | The second one is ignored — a tag is a set member |
| B7 | Remove every tag and save | The track carries no tag; the cell shows the empty-cell dash (`—`) |
| B8 | Clear the **album** field and save | The album column is cleared (NULL) |
| B9 | Write a **comment** and save | The comment persists; it is the file's original comment that gets replaced |
| B10 | Empty the **title** (or the artist) and save | The save is refused with the validation message; the dialog stays open |
| B11 | Type `26` (or `abcd`) in the **year** field and save | The save is refused: the year must be four digits |
| B12 | Select 3 tracks, open the editor on one of them, change the genre | The header says it applies to 3 tracks; all 3 get the new genre; the toast reads `Edited 3 tracks` |
| B13 | Close the editor with **Escape** | The dialog closes and **nothing** is written |

## 5. Section C — The tags column and the chips (T2.1.7)

| # | Action | Expected result |
| --- | --- | --- |
| C1 | Open the column picker | The **`tags`** column is **off** by default (docs/ui/03 §3.2) |
| C2 | Turn the `tags` column on | The table shows the column; the layout survives it (no overlap, no squeezed columns) |
| C3 | A track with **no** tags | The cell shows the empty-cell dash (`—`) |
| C4 | A track with **3+** tags | Two chips plus a `+N` chip; its tooltip names the hidden tags |
| C5 | Click a chip in the cell | The library filters by that tag; the chip in the toolbar reads `Tag peak` |
| C6 | Remove the `Tag peak` chip in the toolbar | The filter is dropped and every row is back |
| C7 | Click a chip while the row is selected | The chip filters; the row selection does **not** toggle |
| C8 | Click the same chip twice | The filter is not duplicated — one filter group, one chip |

## 6. Section D — The tag filter and the search (T2.1.7 · T2.1.13)

| # | Action | Expected result |
| --- | --- | --- |
| D1 | Filter by **two** tags | Every track carrying **either** tag is listed (an `EXISTS`, not a join) |
| D2 | A track carries **both** filtered tags | It appears **once**, not twice |
| D3 | Type a **tag** in the search box | The track is found |
| D4 | Type a **comment** in the search box | The track is found |
| D5 | Search for a literal `%` and `_` | The wildcards match literally — no wildcard injection |
| D6 | Combine the tag filter with BPM + key + genre | The row count matches the DB for the same combination |
| D7 | Cross-check the filtered list | `dj-query --tag peak --json` lists exactly the same tracks |

## 7. Section E — Undo (T2.1.7 · T2.1.13)

| # | Action | Expected result |
| --- | --- | --- |
| E1 | Change the tag set, then click **Undo** in the toast | The previous tag set comes back; status `Undone — 1 track restored` |
| E2 | Change the comment, then **Undo** | The previous comment comes back |
| E3 | Change a track, change it **again**, then **Undo** the first write | Status `Undone — 1 track restored, 1 skipped (changed since)`; the newer edit survives |
| E4 | Change a track's **tags**, then change them again, then **Undo** | The newer tag set survives — the undo restores a set only while it still matches |
| E5 | Click **Undo** twice on the same toast | The second undo is refused — the snapshot is marked `undone` |
| E6 | Focus the Undo toast | Its timer pauses; the dismiss button closes it |
| E7 | Multi-select 3 tracks, change a field on all 3, **Undo** | All 3 revert; status `Undone — 3 tracks restored` |

## 8. Section F — Shared / regression (T2.1.4 · T2.1.6 · T2.1.2)

| # | Action | Expected result |
| --- | --- | --- |
| F1 | Restart the app | The tags, the label and the comment persist |
| F2 | Rate a track and set its energy | The rating and the energy still work; their Undo toast is unchanged |
| F3 | Click the **Rating** / **Energy** headers | The sort is unchanged; unrated tracks stay last |
| F4 | The tag column is on, the table is sorted and filtered | The row count matches the DB for the same sort + filter |
| F5 | Watch the console during edits, undos, filters and sorts | No errors or warnings |
| F6 | Right-click a row, then press **Escape** twice | The menu closes on the first Escape; the app-level Escape does not close the inspector behind it |

---

## 9. Recording the result

For every item write **Result** (PASS / FAIL / BLOCKED / PARTIAL), **Observed**
(exact toast or status text) and **Notes** (deviation, console output, edge
case). A PASS needs **both** the human observation and the `dj-query`
cross-check; neither alone is enough. Only then tick T2.1.7 / T2.1.13 in
[`docs/sdd/04-TASKS.md`](../sdd/04-TASKS.md) — and in the same edit record
what was observed.
