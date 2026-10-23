# Slice 2 — manual running-window QA (T2.1.2 · T2.1.4 · T2.1.6)

**Status:** **NOT EXECUTED** — baseline only (2026-10-22)  
**Scope:** the Definition-of-Done "manual running-window QA" that gates
[T2.1.2](../sdd/04-TASKS.md) (multi-filter), **T2.1.4** (rating) and **T2.1.6**
(energy). All three task boxes stay **unticked** until this checklist runs and
every item has a recorded PASS.  
**Implementation under test:** PR #51 (merged 2026-10-21) — `StarRating` /
`EnergyBars`, the reversible write path (`set_track_rating`,
`update_track_metadata`, `undo_track_metadata`), the `energyMin`/`energyMax`
filter and the `rating` / `energy` sort keys.

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
- If a Vite dev server is already listening on the port the Tauri config
  expects, let the Tauri CLI reuse it instead of starting a second one.

Every expectation below is written against the shipped code — the strings are
the real ones, not paraphrase (`apps/desktop/src/lib/library.ts`,
`App.tsx`, `components/EnergyBars.tsx`).

## 2. Baseline (verified 2026-10-22)

- The real app builds and launches and opens the **real** database
  (`%APPDATA%\com.djassistant.desktop\dj_assistant.db`).
- The library: **94 tracks**, 24 analysed (24 complete / 2 failed / 68
  needs_review), 2 missing BPM, 2 missing key.
- **Values written so far:** 0 tracks rated, 0 tracks with energy — a pristine
  baseline. A stray exploratory write landed during the 2026-10-22 session
  (*Just Just (Extended Mix)*, id `756d2d12…`, energy 8) and was **cleared
  again** (the column back to `NULL`), so it is a database fact but **not a
  recorded QA result** — no human observation of it exists and no checklist
  item is marked. Re-verify before starting:
  `dj-query --energy-min 1 --json` → `matching : 0`.
- Cross-check the DB at any time with the read-only CLI (`dj-query`, built from
  `crates/core/src/bin/query.rs` behind the `cli` feature):

  ```bash
  dj-query --stats
  dj-query --rating-min 1                 # rows with a rating
  dj-query --rating-min 5 --sort rating --dir desc
  dj-query --energy-min 6 --energy-max 8 --sort energy
  ```

  It refuses to open a database whose WAL still holds content, so keep the app
  running while querying.

---

## 3. Section A — Rating (T2.1.4)

| # | Action | Expected result |
| --- | --- | --- |
| A1 | Click **star 3** on one row | 3 filled stars; status `Rating saved for 1 track`; toast `Rated “<title>”` |
| A2 | Click the **same star 3** again | Rating clears to 0; status `Rating saved for 1 track` (it changed) |
| A3 | Focus a star cell, press **4**, then **0** | 4 stars, then cleared |
| A4 | With a star focused, press **1**–**5** and **0** | The preview player does **not** react (no hot-cue jumps) — the widget owns the keys |
| A5 | Ctrl/Cmd-click 3 tracks (Shift extends a range), click **star 5** | All 3 show 5 stars; status `Rating saved for 3 tracks`; toast `Rated 3 tracks` |
| A6 | Click **Undo** in the toast | All 3 revert; status `Undone — 3 tracks restored` |
| A7 | Rate a track, change it again, then **Undo** | Status `Undone — 1 track restored, 1 skipped (changed since)` |
| A8 | Set the rating a track already has | Status `Rating unchanged — nothing to save`; **no** Undo toast |
| A9 | Click the **Rating** header twice | Descending then ascending; unrated tracks stay **last in both directions** |
| A10 | Filters → minimum rating **3** → Apply, then Reset | Only rated ≥ 3 remain; Reset restores all 94 rows |

## 4. Section B — Energy (T2.1.6)

| # | Action | Expected result |
| --- | --- | --- |
| B1 | Look at a track with no energy | Empty but **clickable** 10-segment meter; tooltip `No energy set` |
| B2 | Click **segment 7** | 7 segments filled; tooltip `Energy 7 / 10`; status `Energy saved for 1 track`; toast `Set energy on “<title>”` |
| B3 | Click the **same segment 7** again | Clears back to the empty meter (`No energy set`) |
| B4 | Focus a segment, press **Enter** / **Space** | Sets, and clears on the second activation |
| B5 | Select 3 tracks, set energy **5** | All 3 update; status `Energy saved for 3 tracks`; toast `Set energy on 3 tracks`; Undo → `Undone — 3 tracks restored` |
| B6 | Filters → **Energy 6–8** → Apply, then Reset | Only tracks with energy in that range remain; Reset restores all rows |
| B7 | Enter energy **12**, or min **8** / max **6** | Both rejected with a validation message; the filter is not applied |
| B8 | Click the **Energy** header twice | Descending then ascending; tracks without energy stay **last in both directions** |
| B9 | Cross-check one edited track | `dj-query --energy-min 1` shows the same level the UI shows |

## 5. Section C — Shared / regression (T2.1.2)

| # | Action | Expected result |
| --- | --- | --- |
| C1 | Restart the app | Ratings and energy values persist |
| C2 | Combine BPM + Camelot + genre + `ratingMin` + energy range | Row count matches the DB for the same filter combination |
| C3 | Search for a literal `%` and `_` | Free-text search escapes them (no wildcard injection) |
| C4 | Watch the console during writes, undos, filters, sorts | No errors or warnings |
| C5 | Focus the Undo toast | Its timer pauses; the dismiss button closes it |
| C6 | Edit a track that is **not** selected | Only that one track changes |
| C7 | Select 3 tracks, set a value 1 of them already has | Status reports the **changed** count, not the selection size |

---

## 6. Recording the result

For every item write **Result** (PASS / FAIL / BLOCKED / PARTIAL), **Observed**
(exact toast or status text) and **Notes** (deviation, console output, edge
case). A PASS needs **both** the human observation and the `dj-query`
cross-check; neither alone is enough. Only then tick T2.1.2 / T2.1.4 / T2.1.6 in
[`docs/sdd/04-TASKS.md`](../sdd/04-TASKS.md) — and in the same edit record what
was observed.
