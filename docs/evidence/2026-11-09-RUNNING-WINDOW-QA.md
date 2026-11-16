# Running-window QA — 2026-11-09

**Build under test:** `main` at `b8acce5a` (PR #71) plus the local
`RowContextMenu` pure-test change (uncommitted at the time of the run).
**Database:** the live library, `%APPDATA%\com.djassistant.desktop\dj_assistant.db`.
**Backup before the run:**
`C:\Users\User\AppData\Local\Temp\opencode\dj-assistant-backups\2026-11-09-pre-qa`
(DB + WAL + SHM copied together).
**Launched with:** `pnpm --filter @dj-assistant/desktop tauri dev`.

> The header above describes the Pass 1 run. Passes 3–5 ran on `main` at
> `be6adbe2` with the same uncommitted working tree, driven through the
> WebView2 DevTools port (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=
> --remote-debugging-port=9222`); Pass 5 pointed the app at a 30,000-track
> fixture through `DJ_ASSISTANT_DB_PATH`. Each pass’s own note records its build
> and reach.

## Pre-run baseline (read-only `dj-query`, 2026-11-09)

| Fact | Value |
| --- | --- |
| Tracks | 94 |
| Analysed | 24 complete / 2 failed / 68 needs_review |
| Missing BPM / key | 2 / 2 |
| Rated tracks | **1** — *Loosing My Mind feat. Drori (Original Mix)* (Yojiman), rating 5 |
| Energy set | 0 |
| Tags | 0 |
| Keys present | 3B, 4B, 6B (14), 7B (28), 8B (15), 9B (19), 10B (8), 11B (6), none (2) |

> The one rated track is pre-existing, not a QA result. It is the only
> non-pristine value at the start; leave it in place so the Undo/skip checks
> still have a "changed since" case to exercise.

> **Re-checked during Pass 2 (same day):** the baseline drifted — the DB now
> holds **10** rated tracks (8 × 3★, 1 × 4★, 1 × 5★), written 11:56–12:03 UTC
> by another session, and `energy` is NULL for all 94 live rows. The Pass 2
> cross-checks below use those live values, not the 1-rated figure above.

## How results are recorded

Each row gets **PASS / FAIL / BLOCKED / PARTIAL**, the exact toast or status
text observed, and any deviation. A PASS needs the human observation *and* a
`dj-query` cross-check where the item writes data. The source checklists are:

- [`../engineering/STAGE1_MANUAL_QA_CHECKLIST.md`](../engineering/STAGE1_MANUAL_QA_CHECKLIST.md)
- [`../engineering/SLICE2_MANUAL_QA_CHECKLIST.md`](../engineering/SLICE2_MANUAL_QA_CHECKLIST.md)
- [`../engineering/SLICE3A_MANUAL_QA_CHECKLIST.md`](../engineering/SLICE3A_MANUAL_QA_CHECKLIST.md)
- T2.1.8 DoD in [`../PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md`](../PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md) §Slice 3B

---

## Pass 1 — Stage 1 shell and navigation

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| A1 | Launch the app | Opens on the last saved primary view, or Library on first run | **PASS** — launched on Library; no deviation reported |
| A2 | Click Library, Playlists, Discover, Statistics, Publish, Settings | Each opens; the unbuilt tabs show an honest planned view, not blank/fake | **PASS** — Library has the full table + player; Discover / Statistics / Publish show an honest “Planned view” with Go to Library; Settings fully functional (Appearance, Library & Import, Key Display, DJ Applications) |
| A3 | Inspect the top bar | Search library, Import Center, Inbox, backup status; no old six-view switcher | **PASS** — Search library, Import Center, Inbox, Backup status; no old switcher |
| A4 | Click Import Center | Import Center route opens with a visible active state | **PASS** — “Planned view” + active state |
| A5 | Click Inbox | “Inbox is clear” empty state; Go to Library works | **PASS** — “Inbox is clear”; Go to Library returns to Library |
| A6 | Click backup status | Backup route opens; status stays “not set up” | **PASS** — Backup route, “Planned view”, status “not set up” |
| A7 | Open Settings | Appearance, Library and import, DJ applications, Backup, About | **PASS** — all five sections visible |
| A8 | Use the Settings links | Import, Analysis, Player workspace, Sync, Backup each open a real route | **PASS** — all open real routes, no dead clicks |
| A9 | Press `Ctrl+1`..`Ctrl+6` | The six primary tabs switch in order | **PASS** — Library → Playlists → Discover → Statistics → Publish → Settings |
| A10 | Press `Ctrl+I`, `Ctrl+,` | Import Center and Settings open | **PASS** |
| A11 | Press `Tab` from the top | Focus is visible; skip-to-main-content is reachable | **PASS** |
| A12 | Visit every route in the primary + utility registries | No “View not found” | **PASS** — none during the route sweep |
| B1 | Player in Mini, switch tabs | Dock stays visible, keeps track and position | **PASS** |
| B2 | Expand to Full, switch tabs | Presentation stays Full | **PASS** |
| B3 | Hide the player, switch tabs, show it | Last visible presentation restored | **PASS** — Full returns, not Mini |
| B4 | Change view, close, relaunch | Last primary view restored | **PASS** — restored after close + relaunch |
| B5 | Collapse/expand the left nav, relaunch | Collapse choice persists | **PASS** — collapsed rail persisted |
| C1 | Agent adds a temporary dev-only renderer throw | Generic recovery screen; rest of window not half-rendered | **PASS** — generic “DJ Assistant hit an unexpected error” screen with Try again / Reload app |
| C2 | Inspect the console entry | Redacted error — no raw token, email or home path | **PASS** — `[ui.render] Error: QA boundary probe – access_token=[redacted] [email] C:\Users\[user]\secret.txt` |
| C3 | Use Try again / Reload app | Recovery works or the window reloads cleanly | **PARTIAL / BLOCKED** — removing the probe was picked up by Vite HMR, which reloaded and rendered the app normally (Settings + player dock), but neither **Try again** nor **Reload app** was ever activated, so the recovery controls themselves are unverified. Exercising them needs a probe that survives the reload (or a native reload without HMR). |

Section D (30,000-track fixture) moved to **Pass 5**.

---

## Pass 2 — Slice 2: rating and energy (T2.1.4 · T2.1.6 · T2.1.2)

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| A1 | Click star 3 on a row | 3 stars; `Rating saved for 1 track`; `Rated “<title>”` | **PASS (hand)** — with the window left in its **restored** geometry (native 1183×768, so screenshot pixels map 1:1) a coordinate click on star 3 of “Steps” gave `Rating saved for 1 track` and the toast `Rated “Steps”`; the DB copy read back `user_rating = 3`. The earlier block was the maximized window: a 1428×768 capture against a 1183-wide window mis-mapped every click, and the first one only restored the window. |
| A2 | Click the same star 3 again | Clears to 0; `Rating saved for 1 track` | **PASS (hand)** — the same star again cleared it: status `Rating saved for 1 track`, the cell rendered empty and the DB copy read `user_rating IS NULL`. |
| A3 | Focus a star cell, press `4`, then `0` | 4 stars, then cleared | **PASS (hand)** — the rating cell is a real tab stop (`role="group"` `Rating for <title>` carrying the `Press 1 through 5 to set the rating, 0 to clear it` description); `4` → 4 stars, `0` → cleared, each with its own status line. The UIA block was only WebView2 not exposing the star `<button>`s, not a missing tab stop. |
| A4 | With a star focused, press `1`–`5` and `0` | Player does not react (no hot-cue jumps) | **PASS (hand)** — with a track loaded in the preview player, `1`–`5` wrote the rating (5★) and `0` cleared it while the hot-cue pads kept their “empty” labels (E–H never changed) and the playhead stayed at 0:00 / 6:36 — no cue jump, no transport move. The digits reached the rating cell and stopped there. |
| A5 | Ctrl/Cmd-click 3 tracks (Shift extends), click star 5 | All 3 at 5; `Rating saved for 3 tracks`; `Rated 3 tracks` | **PASS (hand, CDP)** — Ctrl+click is not injectable through Computer Use (`click` has no modifier field, F-012) nor does a latched `Control_L` survive to the click, so the modifier clicks went through the WebView2 DevTools socket (`Input.dispatchMouseEvent`, `modifiers: 2`). Three unrated rows (Move, Frenetica, Gridlock Groove) → `3 tracks selected` → star 5 → `Rating saved for 3 tracks` + toast `Rated 3 tracks`, all three cells at 5. |
| A6 | Undo in the toast | All 3 revert; `Undone — 3 tracks restored` | **PASS (hand)** — same selection then re-rated to 4 (`Rating saved for 3 tracks`), the toast’s `Undo` gave `Undone — 3 tracks restored` and all three cells read `Clear rating (currently 5)` again. Single-track variant earlier in the pass: `Undone — 1 track restored` with the DB back on its pre-write value. |
| A7 | Rate, change again, Undo the first | `Undone — 1 track restored, 1 skipped (changed since)` | **BLOCKED (app design, not tooling)** — the toast keeps exactly one undo offer — `pendingUndo` is a single slot (App.tsx:1227) and `offerUndo` (App.tsx:1970) overwrites it, so the second write deletes the first undo before a “changed since” state can exist. The DOM confirmed it: after a second write there was one `role="status"` toast with one `Undo` button, and it restored the second write. The wording itself is proven at the unit level (`apps/desktop/src/lib/library.test.ts:385`, `:390`, `:394`); reaching it from the running UI needs a second undo slot or an out-of-band write. |
| A8 | Set a rating a track already has | `Rating unchanged — nothing to save`; no Undo toast | **PASS (hand)** — status `Rating unchanged — nothing to save`, no DB change and, with the previous toast already retired, no `Undo` button appeared. |
| A9 | Click the Rating header twice | Desc then asc; unrated tracks last in both directions | **PASS (hand)** — coordinate clicks on the RATING header (the UIA header exposes only “Drag to resize · double-click to fit”, `aria-sort` moves though) gave ↓ 5★,4★,3★,… and ↑ 3★,4★,5★, with the unrated block last in both directions. |
| A10 | Filters → min rating 3 → Apply, then Reset | Only ≥ 3 remain; Reset restores all 94 | **PASS** — Minimum rating set to `3★ and up` (select focused via UIA, then `ArrowDown` x3), Apply → `Library loaded: 10 tracks` with chip `Remove the rating filter`; DB `user_rating >= 3` (not removed) = 10. `Reset all` → `Library loaded: 94 tracks`. |
| B1 | Look at a track with no energy | Empty but clickable 10-segment meter; `No energy set` | **PARTIAL** — the empty meter does render for every `energy IS NULL` row and it is clickable (B2 writes through it). The Do’s `No energy set` string is the **read-only** variant’s label (`components/EnergyBars.tsx`): a DOM query for that text over the library table returns 0 nodes, the ten segments of an unrated row read `Set energy 1 / 10` … `Set energy 10 / 10`. Wording to reconcile with `docs/ui/03-LIBRARY-VIEW.md` §3.6, not a functional gap. |
| B2 | Click segment 7 | 7 filled; `Energy 7 / 10`; `Energy saved for 1 track`; `Set energy on “<title>”` | **PASS (hand)** — segment 7 on “I'll Find You”: status `Energy saved for 1 track`, toast `Set energy on “I'll Find You (Original Mix)”`, DB `energy = 7`, and the pressed segment read `Clear energy (currently 7)`. As in B1, `Energy 7 / 10` is the read-only form’s title, not the table cell’s. |
| B3 | Click the same segment 7 | Clears to the empty meter | **PASS (hand)** — the same segment again cleared it to the empty meter; DB `energy IS NULL`. |
| B4 | Focus a segment, press Enter / Space | Sets, and clears on the second activation | **PASS (hand)** — with segment 4 focused, `Enter` cleared the value and `Space` set it again; neither key reached the row underneath (no selection swap, no inspector open), which is the `stopPropagation` contract on the group. |
| B5 | Select 3 tracks, set energy 5 | All 3 update; `Energy saved for 3 tracks`; Undo → `Undone — 3 tracks restored` | **PASS (hand, CDP)** — the same Ctrl+click route as A5: 3 rows selected → segment 5 → `Energy saved for 3 tracks` + toast `Set energy on 3 tracks` → `Undo` → `Undone — 3 tracks restored`. |
| B6 | Filters → Energy 6–8 → Apply, then Reset | Only 6–8 remain; Reset restores all | **PASS** — Energy Min 6 / Max 8 → toolbar chip `Energy 6–8`, `Library loaded: 0 tracks` + `No tracks match`; DB has 0 rows with `energy` set, so 0 is the expected count. `Remove the energy filter` → `Library loaded: 94 tracks`. |
| B7 | Enter energy 12, or min 8 / max 6 | Rejected with a validation message; filter not applied | **PASS** — Max `12` → `Energy bounds must be whole numbers between 1 and 10, and minimum must not exceed maximum.`; Min `8` / Max `6` → same message, `Library loaded: 94 tracks` (filter not applied). Incidental: the same path on the BPM bounds gives `BPM bounds must be non-negative and minimum must not exceed maximum.` with the filter not applied. |
| B8 | Click the Energy header twice | Desc then asc; no-energy tracks last in both | **PASS (hand)** — with energy 1 and 4 set on two tracks: ↓ 4 then 1, ↑ 1 then 4, and the no-energy rows last in both directions. |
| B9 | Cross-check one edited track | `dj-query --energy-min 1` shows the same level | **PASS (hand)** — `dj-query --energy-min 1` against a copy of the live DB (`dj_assistant.db` + `-wal` + `-shm`, which is how the WAL refusal was worked around) listed exactly the two edited tracks at 1 and 4 — the same levels the meters showed. |
| C1 | Restart the app | Ratings and energy persist | **PASS (hand)** — the app was closed and relaunched for the CDP pass; after the restart the “I'll Find You” meter still showed 4/10 and the DB copy read the same `user_rating` / `energy` set as before the restart. |
| C2 | Combine BPM + Camelot + genre + ratingMin + energy range | Row count matches the DB for the combination | **PARTIAL (3 of 5 dimensions)** — BPM 121–125 + Camelot `8B` → `Library loaded: 8 tracks` (DB: `bpm between 121 and 125 and key_camelot = '8B'` = 8), chips `Remove the bpm filter` / `Remove the key filter`; + Energy Min 1 → `0 tracks` / `No tracks match` (DB = 0, `energy` NULL everywhere). Genre checkboxes expose only `Focus` (no Toggle/Invoke — a click applied no genre chip), and `ratingMin` was exercised separately in A10 rather than combined, so the five-filter row was **not** exercised as written. |
| C3 | Search a literal `%` and `_` | Escaped — no wildcard injection | **PASS** — library search `%` → `No tracks match`; `_` → `No tracks match`; DB has 0 live rows containing either character in title/artist, so an unescaped `LIKE` would have returned 94 and ~93 rows. Clearing the box → `Library loaded: 94 tracks`. |
| C4 | Watch the console during writes, undos, filters, sorts | No errors or warnings | **PASS (hand)** — a Chrome DevTools Protocol listener was attached to the WebView2 page (`--remote-debugging-port=9222`; `Runtime.enable` + `Log.enable`, collecting `Runtime.consoleAPICalled`, `Log.entryAdded` and `Runtime.exceptionThrown`) and the pass then ran through it: rating/energy writes, undos, the TITLE/BPM/ENERGY/RATING header sorts and the filter apply → reset. **Zero new entries** across all of them; the only buffered messages were the three from page load (`[vite] connecting...`, `[vite] connected.`, the React DevTools info line). No error- or warning-level output. |
| C5 | Focus the Undo toast | Timer pauses; dismiss button closes it | **PASS (hand)** — UIA `Focus` on the toast’s `Undo` button held it open for 13 s, past the 10 s `UNDO_TOAST_IDLE_MS` (App.tsx:200); `Dismiss the undo notification` closed it at once; a second toast that never took focus retired on its own. |
| C6 | Edit a track that is not selected | Only that track changes | **PASS (hand)** — with row 2 selected, the star edit on row 3 changed only that track: `editTargets` (App.tsx:1989) falls back to the edited track when it is outside the selection, and the DB copy showed the change on that row alone. |
| C7 | Select 3, set a value 1 already has | Status reports the changed count, not 3 | **PASS (hand, CDP)** — 3 rows selected, “Loosing My Mind” already at 5★, star 5 → `Rating saved for 2 tracks` + toast `Rated 2 tracks`. The status counted what changed, not the selection. |

> **Pass 2 reach — automation run, then closed by hand (both 2026-11-09).**
> The first run was Computer Use UIA only. Reachable there: the Filters dialog
> (BPM/Energy spins via the value pattern, Camelot chips and Apply/Reset via
> Invoke, the minimum-rating `<select>` by focus + `ArrowDown`), the toolbar
> filter chips, and the library search box (`edit` + `type_text`). Not
> reachable there: the star buttons and the energy segments — WebView2 renders
> the `role="group"` widgets as opaque `item Rating for <title>` /
> `item Energy for <title>` leaves with no element index, so every mouse row
> needed a different input path, and the window kept reverting to an off-screen
> origin (−166, 995).
>
> The hand pass closed those rows on two paths. (1) **Coordinate and keyboard
> input** with the window in restored geometry, where the native capture is
> 1183×768 and screenshot pixels map 1:1 to `click` / `press_key` targets — this
> is what made A1–A4, A8–A9, B2–B4, B8–B9 and C5–C6 executable. (2) **Chrome
> DevTools Protocol** over the WebView2 debugging port, which is the only route
> here that can carry a mouse modifier: `Input.dispatchMouseEvent` with
> `modifiers: 2` built the multi-track selections for A5/B5/C7 (Computer Use
> `click` has no modifier field and F-012 forbids the chord), and
> `Runtime.consoleAPICalled` / `Log.entryAdded` gave C4 the console reader it
> said did not exist (in C4 the minimum-rating `<select>` was set through its
> native value setter + `change`, and Apply / Reset and the header sorts were
> dispatched as CDP input events). The CDP path sends trusted browser-input events, not OS
> SendInput ones; UIA-only reach stays as recorded above.
>
> **A7 is the one row this pass could not execute**, and not because of the
> tools: the UI holds a single undo token, so “undo the first” does not exist
> once a second write has reported. Its wording is covered by unit tests.
>
> The pass wrote real data (ratings on Up to You, Naturophobia, Loosing My Mind,
> Move, Frenetica, Gridlock Groove, Steps, Eat You, I'll Find You; energy on
> Chasing Ashes and I'll Find You). Everything was then reverted through the
> same UI, and the final DB copy diffed **0 changes** against the 20:50 UTC
> pre-run backup over all 94 rows of `user_rating` / `energy`.

---

## Pass 3 — Slice 3A: tags, editor, menu (T2.1.7 · T2.1.13)

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| A1 | Right-click a row | Menu at the cursor with `Edit tags…` and disabled `Fix tags` | **PASS (hand, CDP)** — right-click at (168, 128) opened the menu with its left edge on the cursor x. Its items, in order: `Play`, `Analyze` (disabled — the row is already analysed), `Edit tags…`, `Fix tags` (**disabled**), `Add to playlist…` / `Add to set…` / `Find in playlists…` / `Mix suggestions…` / `Find smaller / similar tracks online…` / `Find new tracks online…` (all disabled — the unbuilt views), `Reveal in Finder / Explorer`, `Copy path`, `Remove from library…`. Re-confirmed after the F1 restart. |
| A2 | Press Escape | Closes; focus returns to the row | **PASS** — Escape closed the menu and `document.activeElement` was the row `<tr>` again. |
| A3 | Click outside | Closes; focus returns to the row | **PASS** — an outside left-click dismissed it; focus returned to the row. |
| A4 | ArrowDown / ArrowUp | Focus moves inside the menu and stays there | **PASS** — arrows walked the items, never activated a row and never left the menu. |
| A5 | Right-click near the right edge | Opens towards the cursor; stays inside the viewport | **PASS** — clamped inside the viewport and opened towards the cursor; the same `clampMenuPosition` the unit tests in `lib/library-menu.test.ts` pin. |
| A6 | Choose `Edit tags…` | Metadata editor opens for that row | **PASS** — the editor opened seeded from the right-clicked row. |
| A7 | Right-click a row that is not selected | Editor opens for that row; selection untouched | **DEVIATION (FAIL vs the checklist)** — the editor does open for that row, but the selection is **not** untouched: `handleRowContextMenu` (App.tsx:2101-2109) replaces the selection with the right-clicked row when it is outside the current selection. The expectation is stale against the shipped behaviour, not a defect in the menu. |
| B1 | Open the editor | Title, artist, album, genre, label, year, tags, comment seeded from the row | **PASS** — re-read after the restart on *Up to You feat. SAÍGO (Extended Mix)*: `Up to You feat. SAÍGO (Extended Mix)` / `Yulia Niko, Saígo` / `Up to You (feat. SAÍGO) [Extended Mix]` / `Melodic House & Techno` / label empty, `2025` / tag input empty, comment `hi`. |
| B2 | Row with no label | Label is empty (no import source) | **PASS** — label was empty on every row opened; the import never populates `tracks.label`, so it stays empty until edited. |
| B3 | Change the title, Save | `Metadata saved for 1 track`; `Edited “<title>”` | **PASS** — both lines appeared as written, with the Undo toast beside them. |
| B4 | Open and Save with no change | `Metadata unchanged — nothing to save`; no Undo toast | **FAIL at time of pass (pre-fix)** — the expected status never appears. A no-op Save sends an empty field set to the backend, `library_writes.rs:182-201` returns `nothing to update`, and the UI takes its **error** path: `console.error` plus a “Couldn't save…” line, and the dialog **closes**. `describeMetadataWrite`’s `updated <= 0` branch (lib/library.ts:465-496) is unreachable from the editor because the command errors instead of reporting 0 rows updated. The “no Undo toast” half held. These are the 8 console errors counted in F5. |
| B5 | Add tag `Peak Time`, save | Stored lower-case (`peak time`); chip in the tags column | **PASS** — `track_tags` received `peak time` and the cell rendered the chip. |
| B6 | Add the same tag twice | Second ignored | **PASS** — no duplicate; `(track_id, tag)` is the table PK and the second add was dropped. |
| B7 | Remove every tag, save | No tags; cell shows `—` | **PASS** — cell `—`, and the final `track_tags` re-read for the whole library was 0 rows. |
| B8 | Clear the album, save | Album column cleared (NULL) | **PASS** — the live DB read `album=null` for the edited row during the pass (restored at the end). |
| B9 | Write a comment, save | Persists; it replaces the file's original comment | **PASS with a wording caveat** — the comment persisted and Undo recovered the previous value. What the app overwrites is `tracks.comments`, **not the file**: the import never seeds that column (`crates/core/src/bin/scan.rs:208-211` lists no comments column in its INSERT), and no audio file was touched — 0 of the 94 mp3s carry an mtime inside the pass window (*Bodypa*’s is still 2025-12-09). |
| B10 | Empty the title/artist, save | Refused with validation; dialog stays open | **PASS** — “Title cannot be empty.”, dialog stayed open; Cancel left the DB untouched (title, year and comment re-read unchanged). |
| B11 | Type `26` (or `abcd`) as the year, save | Refused: four digits required | **PASS** — “Year must be four digits.”, dialog stayed open. |
| B12 | Select 3, open the editor on one, change genre | Header says 3 tracks; all 3 change; `Edited 3 tracks` | **PASS** — the header reported the 3-track target, all 3 genres changed, status `Edited 3 tracks`; that is the write E7 undoes. |
| B13 | Close with Escape | Closes; nothing written | **PASS** — re-run after the restart: Escape closed the editor, focus was back on the row `<tr>`, and the DB row was unchanged. |
| C1 | Open the column picker | `tags` is off by default | **PASS (code) with a live caveat** — `defaultVisible: false` at lib/library-columns.ts:184-191, and `library-columns.test.ts:45-83` pins the default-visible set without `tags`. On **this** box the saved layout already had the tags column ON before the pass, so the picker showed it checked — “off by default” is the spec default for a fresh layout, not this user’s state. |
| C2 | Turn `tags` on | Column appears; layout survives | **PASS** — the column and its 180 px width appeared and persisted to `dj-assistant.columns.v1.library`. |
| C3 | Track with no tags | Cell shows `—` | **PASS**. |
| C4 | Track with 3+ tags | Two chips + `+N`; tooltip names the hidden tags | **PASS** — a 3-tag row rendered two chips plus the `+N` overflow, and the overflow tooltip named the hidden tag(s). |
| C5 | Click a chip in the cell | Filters by that tag; toolbar chip reads `Tag peak` | **PASS** — the filter bar read exactly `Tag peak` with `clear all` beside it; with two tags it aggregates to `Tag peak, deep`. |
| C6 | Remove the `Tag peak` chip | Filter dropped; all rows return | **PASS** — status bar back to `94 tracks`. |
| C7 | Click a chip while the row is selected | Filters; selection does not toggle | **PASS** — the selection survived the chip click. |
| C8 | Click the same chip twice | No duplicate filter group or chip | **PASS** — one tag group and one chip after the second click. |
| D1 | Filter by two tags | Every track with either tag (EXISTS, not a join) | **PASS** — tags `peak` + `deep` → `2 tracks`; SQL `count(distinct track_id) … tag in ('peak','deep')` = 2. |
| D2 | A track with both filtered tags | Appears once | **PASS** — *Bodypa*, which carries both, appeared once. |
| D3 | Type a tag in search | Track found | **PASS** — search `peak` → `2 of 94 tracks`, the same two rows the tag filter returned. |
| D4 | Type a comment in search | Track found | **PASS** — search `Pass3` (the B9 comment text) → `1 of 94 tracks`. |
| D5 | Search literal `%` and `_` | Literal match | **PASS** — `%` → `0 of 94 tracks`; `_` → 2 rows whose `file_path` really does contain an underscore. SQL with `LIKE … ESCAPE` gives the same 2 and 0; read as wildcards both would have returned 94. |
| D6 | Tag + BPM + key + genre | Row count matches the DB | **PASS** — tag(peak,deep) + genre(Indie Dance, Melodic House & Techno) + BPM 120–127 + key `8B` with *Compatible only* off → toolbar `Filters (4)`, status bar `1 tracks`, SQL = 1 (*Conversations (Original Mix)*, 8B). Same set without the key group: `2 tracks` = SQL 2; genre + BPM alone: `71 tracks` = SQL 71. |
| D7 | Cross-check | `dj-query --tag peak --json` lists the same tracks | **PASS** — the CLI returned `returned: 2, total: 2` (Conversations, Bodypa) — exactly the two rows the UI listed under the `Tag peak` filter. |
| E1 | Change tags, Undo | Previous set returns; `Undone — 1 track restored` | **PASS** — the previous tag set came back with that status line. |
| E2 | Change the comment, Undo | Previous comment returns | **PASS** — the previous `tracks.comments` value was restored. |
| E3 | Change, change again, Undo the first | `1 track restored, 1 skipped (changed since)`; newer edit survives | **BLOCKED** — not executable in this UI: there is one undo token (`pendingUndo` is a single state object at App.tsx:1227 and `offerUndo` at :1970 replaces it), so once the second write has reported there is no “first” left to undo. The same limit is recorded for Pass 2 A7 (lines 130-132). The wording itself is covered by the `describeMetadataUndo` tests. |
| E4 | Change tags twice, Undo | Newer tag set survives | **PASS** — Undo restored the snapshot the live toast held (the newer set), not the original. |
| E5 | Undo twice on one toast | Second undo refused | **PASS** — the token was consumed by the first call; the second was refused. |
| E6 | Focus the Undo toast | Timer pauses; dismiss works | **PASS** — focus (reached with 13 Tabs; the toast is the `absolute bottom-4 left-5 z-30` container) held it open past the 10 s `UNDO_TOAST_IDLE_MS` (App.tsx:196-200); `Dismiss` closed it at once. |
| E7 | Multi-select 3, change a field, Undo | All 3 revert; `Undone — 3 tracks restored` | **PASS** — all 3 rows reverted with that status line (this is the B12 write undone). |
| F1 | Restart | Tags, label and comment persist | **PARTIAL** — the process really was restarted for this row: PID 9104 killed, relaunched with the WebView2 debugging port, new PID 29600. Afterwards 94 tracks loaded, `dj-assistant.columns.v1.library` matched the pre-pass snapshot exactly, the tags cell of the row that had carried three tags read `—` with its title and album restored, and the metadata editor for *Up to You* showed comment `hi`. DB re-read after the restart: 0 diffs against the pre-run copy. What the restart then observed was **pre-existing** data, not the edits: the tags cell read `—` and the comment read `hi` — the values the pass had already reverted to — so persistence of an edited tag / label / comment across a restart is **unverified**. |
| F2 | Rate and set energy | Still work; Undo toast unchanged | **PASS** — rating and energy writes still worked and the toast behaved as in Pass 2. |
| F3 | Click Rating / Energy headers | Sort unchanged; unrated last | **PASS** — sorts unchanged, NULLs last. |
| F4 | Tags column on, sorted and filtered | Row count matches the DB | **PASS** — tags column on + Title ascending (`aria-sort="ascending"`) + genre(2)/BPM 120–127 → status bar `71 tracks` = SQL 71, and the first five rows matched SQL’s ordered first five (Agony, All Night, All This Love, Alone, Baziman). |
| F5 | Watch the console during edits/undos/filters/sorts | No errors or warnings | **PASS except the B4 signature** — the CDP `Runtime.consoleAPICalled` / `Log.entryAdded` listener saw nothing across the writes, undos, filter applies and header sorts **but** 8 repeats of the B4 no-op Save error (`nothing to update` → “Couldn't save…”). That output is a symptom of the B4 FAIL, not noise. |
| F6 | Right-click, press Escape twice | Menu closes on the first; app Escape does not close the inspector | **DEVIATION (FAIL vs the checklist)** — the first Escape closed the menu as expected; the second closed the track inspector as well. The window-level handler runs `closeTrackPanel()` on every Escape together with the menus and modals (App.tsx:1878-1896), so this is coded behaviour and the expectation is stale. |
> **Counting instrument, found while re-checking D6.** The library table is
> virtualized — the DOM holds only ~25 rows whatever the filter — so a
> `tbody tr` count is **not** the filtered count. The status-bar label
> (`71 tracks`, or `2 of 94 tracks` while the search box is active) is, and
> every count above was read from it and cross-checked against SQL. The row `#`
> column and `aria-rowcount` (always 95 here) are neither.
>
> One automation artifact, named so the record is not misread: clicking a
> filter-panel control and **Apply filters** inside the same CDP tick applies
> the stale draft (React batches the two events), which first looked like the
> key group silently not applying. Separated by a tick it applies normally and
> `Filters (4)` then agrees with SQL. A human cannot hit this; the tool can.

> **Pass 3 reach and revert (run 2026-11-09 23:05 UTC → 2026-11-10).**
> All 48 rows were executed against the running Tauri app on the live 94-track
> library. Input went over Chrome DevTools Protocol — `Input.dispatchMouseEvent`
> for the right-clicks and chip clicks, `Input.dispatchKeyEvent` for Escape and
> the toast focus, `Runtime.evaluate` for reads — counts came from the status
> bar and `dj-query`, and the DB was read from a copy of the live
> `dj_assistant.db{,-wal,-shm}` so the app was never blocked.
>
> **43 rows PASS, 1 PARTIAL (F1), 1 FAIL (B4), 2 DEVIATION against the checklist (A7, F6),
> 1 BLOCKED (E3)** — and the two deviations are stale expectations rather than
> new defects: both behaviours are coded deliberately (App.tsx:2101-2109 and
> App.tsx:1878-1896), so Slice 3A’s checklist text needs the correction. B4 was
> the one real finding at the time of the pass: an unchanged Save is reported as an error and closes the
> dialog instead of saying `Metadata unchanged — nothing to save`. F1 is **PARTIAL**: the restart read the values the pass had already reverted, so edited-tag persistence was not proven.
>
> Writes the pass made and then reverted through the same UI: *Bodypa (Audio
> Junkies Remix)* title, album, comment and the tags `deep`, `peak`, `warmup`;
> *Conversations* tag `peak`; *Loosing My Mind* tag `warmup`; *Up to You*
> comment. Final diff against the 23:05 UTC pre-run copy: `tracks` **0 diffs
> over all 94 rows** across title, artist, album, genre, year, label, comments,
> `user_rating`, `energy`, bpm, key, analysis_status, duration, file_path,
> file_hash and file_size; `track_tags` 0 rows on both sides; every other
> table’s row count identical. The only growth is `skill_runs` (73 → 99 rows) —
> the undo snapshots this pass wrote. That table is the app’s own write history,
> so it was left alone rather than edited behind the app.
>
> Source audio untouched throughout: 0 of the 94 mp3s have an mtime inside the
> pass window. The column layout was restored from the pre-pass
> `localStorage` snapshot before the F1 restart, and the restart proved it came
> back identical.

---

## Pass 4 — T2.1.8 key pills (live library, 7B reference)

The live library has no 5A/4A/6A/5B rows, so the relation matrix is exercised
on the nearest real reference, **7B**: 6B/8B are adjacent, 5B/9B are wide, and
10B/11B/3B/4B are incompatible. The literal 5A matrix runs in Pass 5 on the
synthetic fixture, which cycles every Camelot code.

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| K1 | Turn the Key column on; no playing track, nothing selected | Pills render in the chosen notation; no relation tint | **PASS** — Key column on, nothing playing and nothing selected: every keyed row renders a Camelot pill in the saved notation (default `camelot`) in the plain wheel colour only — fill alpha 0.08, border alpha 0.4 — no relation tint, and the tooltip carries no relation name (`10B · D major`). DB cross-check: 3B(1) 4B(1) 6B(14) 7B(28) 8B(15) 9B(19) 10B(8) 11B(6) + 2 NULL = 94. |
| K2 | Select a **7B** row | 7B pill = strongest (same); 6B/8B = adjacent fill; others muted | **PASS** — one 7B row selected: 7B = `Same key` fill alpha 0.28, 6B/8B = `±1 adjacent` alpha 0.20, 3B/9B/10B/11B = `Incompatible` transparent fill + muted text — exactly `RELATION_TONE`. 5B and 7A have no rows in this library, so the ±2 and relative tints cannot mount here (see K5 caveat, K11). |
| K3 | Play a 7B track, then click elsewhere | The playing track stays the reference, not the selection | **PASS** — while a 7B track was playing, selecting *Up to You* (10B) kept 7B `Same key` and 10B `Incompatible`; after pausing the deck, selecting *Loosing My Mind* (8B) still read `±1 adjacent`, not `Same key` — the playing track holds the reference over the selection even while paused. Honest note: the row menu Play **loads** the deck (dock read `Spaces In Between … 7B 0:00/5:07`, clock stopped); the position only advanced after pressing the dock Play transport, which was paused again a couple of seconds later. |
| K4 | Settings → Key display: Camelot → `1m`/`1d` → both | Column updates live, no reload | **PASS** — no reload needed: `1m/1d` rendered 10B→`3d`, 8B→`1d`, 7B→`12d`, 6B→`11d`, 11B→`4d` (each matches `((n+4)%12)+1`, `d` for B), `Both` rendered `7B · F major`, and Camelot restored `7B`. The tint kept following the Camelot code, not the display string. Sub-note (real finding): the Notation row was **not clickable where it sat** — the open track panel and the player dock covered it at the default scroll position; the panel had to be closed and the row scrolled into view first. |
| K5 | Settings → Strict → Wide | 9B/5B gain the soft ±2 tint; Strict removes it again | **PASS (one code unreachable)** — Wide against the 7B reference read `6B → ±1 adjacent rgba(31, 31, 107, 0.2)`, `7B → Same key rgba(69, 31, 107, 0.28)`, `8B → ±1 adjacent rgba(107, 31, 107, 0.2)`, `9B → ±2 wide rgba(107, 31, 69, 0.1)`, `10B → Incompatible rgba(0, 0, 0, 0)`, 5B not mounted. Strict again dropped 9B back to `Incompatible` + transparent. The library holds **0 rows with 5B**, so only 9B proves the ±2 tint here; the fixture covers it (K11). |
| K6 | Key pill tooltip | Both notations plus the relation name | **PASS** — observed `7B · F major — Same key` while the column itself showed Camelot alone; with no reference the relation suffix is absent (`10B · D major`). The classical half is the stored `key_classical`, not the open-key formula — 10B reads `D major` where open key would be `3d`. |
| K7 | Filters → Compatible only (Strict, 7B reference) | Rows reduce to 7B + 6B + 8B (+7A if present); toolbar shows the Key chip | **PASS** — status bar `57 tracks` = SQL `count(*)` over `key_camelot IN (6B, 7A, 7B, 8B)` → 57; toolbar `Filters (1)` with the chip `Key 6B, 7A, 7B, 8B`. The derived list carries 7A although no live row has it, and the mounted keys were only 6B/7B/8B. |
| K8 | Click the Key chip's × | Intent drops with the chip; rows return; no re-derived keys | **PASS** — the × removed the intent: 94 tracks again, toolbar back to plain `Filters` (no count), chip gone, and re-opening the panel showed the checkbox unchecked — no re-derived key list left behind as an ordinary key filter. |
| K9 | Compatible only with **no reference** | Box stays enabled and removable; nothing is applied | **DEVIATION (case a) / PASS (case b)** — with no reference and the intent **off**, the box is disabled and dimmed with help `Play or select a track with a key to use this filter`, not the checklist's "stays enabled"; that is deliberate (`canToggleCompatibleOnly`, unit-tested at `apps/desktop/src/lib/library.test.ts:427`). With the intent applied and the reference then lost (a key-less row selected — reachable by scrolling one into view under the derived filter), the box stayed **checked, enabled and removable**; Apply wrote nothing (94 tracks, no chip) and uncheck + Apply also returned to 94. |
| K10 | Check contrast in dark and light | Pill text legible on every tint (4.5:1 target) | **FAIL → FIXED, re-run PASS 2026-11-10** (see the re-run note below the ratio table) — composited text-on-background ratios against the 7B reference, both themes, in the table under this pass. Three combos miss 4.5:1: muted text on a **selected** row (light 2.94, dark 2.59) and the **same-key** tint on a selected row in dark (4.46). The relative tint never mounts on this library (no 7A row), so it was measured on the fixture in Pass 5. |
| K11 | 5A matrix on the fixture (Pass 5) | 5A same, 4A/6A adjacent, 5B relative, others muted | **PASS** — measured on the re-keyed 30,000-track fixture; recorded under Pass 5. |

K10 was measured by compositing each pill's own `rgba` fill over the row's
background, that result over the table and page background, then taking the
computed text colour — i.e. the colour a human actually sees. Ratios are WCAG
relative-luminance contrasts, 7B reference unless stated:

| Case | Light | Dark |
| --- | --- | --- |
| No reference — plain wheel tint (α 0.08 light / 0.12 dark) | 14.15–14.71 | 12.19–12.75 |
| Same key, normal row | 9.56 | 8.08 |
| Same key, **selected** row | 6.53 | **4.46** |
| ±1 adjacent, normal row | 11.10–11.48 | 10.04–10.31 |
| ±1 adjacent, selected row | 7.41 | 5.27 |
| ±2 wide, normal row | 13.79 | 13.26 |
| ±2 wide, selected row | 9.05 | 6.40 |
| Incompatible (muted text), normal row | 4.57 | 5.45 |
| Incompatible (muted text), **selected** row | **2.94** | **2.59** |
| Same key on a hovered row (`dj-hover`) | not measured | 5.70 |

The selected row paints `bg-dj-active` (#c6c6c6 light / #4c4c4c dark) and the
incompatible pill keeps `text-dj-text-muted` (#6f6f6f / #8d8d8d), so an
incompatible pill on a selected row is the worst case the UI really produces —
play a 7B track and select a 10B row. The 2026-11-08 review round moved the
pill text onto the theme primary text token to clear 4.5:1 (`797e1823`), which
holds for every *tinted* relation but not for the muted text, which stays on the
muted token. The relative tint and the light-theme hover were not reachable on
this library (no 7A row; the hover state needs a pointer held over the row) and
were completed on the fixture in Pass 5.

**K10 re-run after the fix (2026-11-10, same build channel, live library).** The pill now
owns its ground (`lib/key-pill-surface.ts`: opaque `bg.base` plus the relation tint as a
background layer) and the unfilled treatment moved to `text.secondary`. Measured with the
same compositing method, holding the relation constant by selecting a row whose key another
mounted row shares (both then render the same tint while only one is selected):

| Case (7B reference unless noted) | Light | Dark |
| --- | --- | --- |
| Same key, normal row | 9.56 | 8.08 |
| Same key, **hovered** row | 9.56 | 8.08 |
| Same key, **selected** row | 9.56 | 8.08 |
| Incompatible (secondary text), normal row (worst of the mounted codes) | 7.10 | 10.59 |
| Incompatible (secondary text), **hovered** row (6B) | 6.38 | 7.18 |

The tinted pill's computed ground is identical in all three row states (dark `#4D4853`,
light `#C3B8CE` for 7B; `#534848` / `#CEB8B8` for the 10B control), while the row behind it
does move (`rgba(0,0,0,0)` → `#353535` → `#4C4C4C` dark), which is the regression this fix
exists to prevent. Incompatible-on-a-selected-row is not reachable in the running UI — the
selected row is the reference, so its own pill reads `Same key` — and is covered by the unit
gate instead, which asserts all three row grounds. Worst case across the gate is 4.57 light /
5.03 dark for the quiet treatment. Screenshots of both themes in all three states show the
chip reading as a chip, with no seam against the normal row. `key-pill-contrast.test.ts`
is the standing gate (9 tests, 251 desktop tests pass).

> **Reach & revert (Pass 4, run 22:55–23:27 UTC, build `main` at `be6adbe2` plus
> the same uncommitted working tree as Pass 3, launched with the snippet above
> and `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`).**
> The pass touched only view state: row selection, the deck (context-menu Play
> loads it, the transport ran for a couple of seconds before being paused),
> Settings → Notation (Camelot → `1m/1d` → Both → Camelot), Settings → mode
> (Strict → Wide → Strict), Settings → theme (system → dark → light → system) and
> the Filters panel (Compatible only applied and cleared; Reset all used once).
> No library write was issued, and the after-the-fact checks agree: `tracks`
> 94 rows with 0 changed rows, `skill_runs` still 99 rows (Pass 4 added no undo
> snapshots), the live `.db` and `.wal` sizes and mtimes unchanged, and
> `localStorage` byte-identical to the pre-Pass-4 snapshot — `theme` back to
> `system`, `keyNotation` `camelot`, `compatibilityMode` `strict`, `playerMode`
> `mini`. Two environment findings that shaped the run and belong to the app, not
> the harness: at 1280×800 the open inspector aside occupies x∈[860, 1280] and
> covers the Key column (x∈[845, 1005]) at its centre, so clicks land on the
> panel rather than the pill — the same overlay plus the bottom player bar covered
> the Notation and Strict/Wide rows in Settings until they were scrolled into
> view (K4 note); and filters are **not** persisted across a reload, which is why
> K9 case (b) had to be reached without restarting.

---

## Pass 5 — Stage 1 §D: 30,000-track fixture

Run separately so the live library is never the performance target.

`make-library-fixture.mjs` uses `node:sqlite`, which requires Node 22.5+; the repo's
general Node 22 baseline still covers this because CI and local runs sit on 22 LTS builds
newer than 22.5 (verify with `node --version` before Pass 5).

```powershell
node scripts/make-library-fixture.mjs --out "$env:TEMP\dj-qa\dj_assistant.db" --tracks 30000
$env:DJ_ASSISTANT_DB_PATH = "$env:TEMP\dj-qa\dj_assistant.db"
pnpm --filter @dj-assistant/desktop tauri dev
```

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| D1 | Create the fixture DB and launch with `DJ_ASSISTANT_DB_PATH` | Opens without touching the live library | **PASS** — the generator produced 30,000 tracks / 20,286 `track_tags` rows over 8 migrations (21,622,784 bytes, 23:31:30 UTC) and the app launched against it opened Library directly on `200 of 30000 tracks`. The live library was never opened: the 23:29:33 UTC pre-run copy recorded `.db` 258,048 bytes (mtime 2026-10-19T02:43:53Z) and `.wal` 2,257,792 bytes (mtime 2026-11-09T21:56:59Z), and after the whole fixture session both files still carry exactly those sizes and mtimes. Fixture-only caveat in the note below: the DB had to be re-keyed for K11 to be reachable. |
| D2 | Load Library, switch primary tabs | No multi-second freeze, no unresponsive window | **PASS** — measured with a `PerformanceObserver` installed before a `Page.reload`, so the numbers are from a cold load: the `30000 tracks` status line was up at **833 ms** (849 ms wall), DOMContentLoaded 259 ms, load event 260 ms, TTFB 10 ms, boot long tasks 62 / 99 / 87 ms. Playlists, Discover, Statistics, Publish and Settings each switched in 0–1 ms with **zero** long tasks — honest qualifier: those four are the planned-view stubs, so that half of the row proves shell navigation is free, not that unbuilt views are fast. Back into Library remounts the grid: 44 ms signal, one 196–197 ms long task, one 200 ms frame gap. No multi-second freeze and no unresponsive window anywhere in the pass. |
| D3 | Scroll, use the first 200-row page | Shell stays responsive | **PASS** — 12 wheel steps of 500 px tracked `scrollTop` exactly (500 → 6,000) with 25 mounted rows; each CDP round trip 132–149 ms, in-page evaluation 0–1 ms, largest long task during scrolling 102 ms, largest rAF gap 83 ms. Crossing the first page boundary extended the fetched window (200 → 700 rows, `scrollHeight` 8,235 → 28,735 px) and at `scrollTop` 13,660 the mounted rows were `aria-rowindex` 331–353 (23 rows) — still only the visible window plus overscan, as PR #56 claims, and the shell answered throughout. |
| D4 | Record machine, build and timings | Result is attributable and repeatable | **PASS** — machine, build and every timing used above is recorded in the table under this pass; the fixture plus the override make the run repeatable from the two commands at the top of the section. |
| K11 | Select a 5A row (fixture) | 5A same, 4A/6A adjacent, 5B relative, others muted | **PASS** — with the 5A row *Synthetic Track 29985* selected (`aria-rowindex` 17) and nothing playing, all five relation classes mount at once: 5A `Same key` fill alpha 0.28 / border alpha 0.9; 4A `±1 adjacent rgba(34, 119, 119, 0.2)` and 6A `±1 adjacent rgba(34, 34, 119, 0.2)` with border alpha 0.7; **5B `Relative major/minor rgba(31, 69, 107, 0.16)` border alpha 0.5** — the first time that tint has ever mounted in the running window; ±2 wide (3A/7A) under Wide mode; the other 19 codes `Incompatible` transparent + muted. This closes the two K10 gaps (relative, hover) — numbers below. |

### Pass 5 record (D4)

| Item | Value |
| --- | --- |
| Machine | Windows 11 Pro build 26300, Intel Core i7-10700K @ 3.80 GHz (16 logical), 31.9 GB visible RAM, NVIDIA GeForce GTX 1070, desktop 1920×1080, app window 1280×800 |
| Build | `main` at `be6adbe2` + the same uncommitted working tree as Passes 3–4; cargo dev profile → `D:/cargo-target/debug/dj-assistant-desktop.exe`, rustc 1.99.0, Node 26.13.0, Vite dev server on :1420 |
| Launched with | `pnpm --filter @dj-assistant/desktop tauri dev`, with `DJ_ASSISTANT_DB_PATH` on the fixture and `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` |
| Fixture | `C:/Users/User/AppData/Local/Temp/dj-qa/dj_assistant.db`, 30,000 tracks / 20,286 tag rows / 8 migrations, 21,622,784 bytes |
| Cold load | status line 833 ms · DOMContentLoaded 259 ms · load 260 ms · TTFB 10 ms · boot long tasks 62/99/87 ms |
| Tab switches | Playlists/Discover/Statistics/Publish/Settings 0–1 ms, 0 long tasks · Library remount 44 ms signal, 196–197 ms long task, 200 ms frame gap |
| Scroll | 12 × 500 px steps, round trips 132–149 ms, eval 0–1 ms, max long task 102 ms, max rAF gap 83 ms |

The contrast cases Pass 4 could not reach, measured on the fixture with the
same compositing method as the K10 table (5A reference):

- Relative tint — 12.59 light and 11.13 dark on a normal row, 7.43 dark while
  hovered. This library has no 7A row, so that relation had never been seen in
  the running window before.
- Hover (`dj-hover`) — the row Pass 4 left open: muted text on a hovered row is
  **4.10 light / 3.70 dark**, two further misses beyond the three already
  failed; same-key on a hovered row is 9.43 light / 6.15 dark.
- ±1 adjacent 11.19–12.64 light and 9.96–11.54 dark; ±2 wide on a selected row
  6.76 dark; incompatible-muted on a normal row 4.57 light / 5.45 dark and on a
  selected row 2.94 light / 2.59 dark — the selected-row figure reproduced
  exactly from Pass 4.

One discrepancy, recorded rather than smoothed over: same-key text on a
*selected* row measures 6.53 light / **4.46 dark** on the live 7B reference but
7.14 light / **4.79 dark** on the fixture 5A reference. The fills differ by hue
(7B is `rgba(69, 31, 107, 0.28)`, 5A is `rgba(160, 194, 227, 0.28)`), so the
4.5:1 verdict for that one combination is hue-dependent: the dark FAIL stands
on the live measurement, the darker wheel colour, while the fixture clears it.
The muted-text failures are not hue-dependent at all — that fill is
transparent, so only the row background and the muted token decide.

> **Fixture-only deviation, and reach & revert (Pass 5, run 23:31 → 00:30 UTC).**
> The shipped generator emits one Camelot letter per number
> (`scripts/make-library-fixture.mjs:205`), so a fixture built straight from it
> has no 5A/4A/6A/5B mix and K11 is unreachable. `rekey-fixture.mjs` rewrote
> `key_camelot` to cycle all 24 codes in `created_at, id` order and set
> `key_classical = NULL` — **on the throwaway fixture DB only**; the live library
> was never opened, which D1 proves from the `.db`/`.wal` sizes and mtimes.
> Nothing in this pass wrote to the live library either: the closing diff of the
> live `.db` against the pre-Pass-4 copy shows every table identical (`tracks`
> 94/94 with 0 changed rows, `skill_runs` 99/99, `track_tags` 0 rows,
> `workspaces` 1, `schema_migrations` 8, `chart_snapshots` 3,
> `enrichment`/`external_ids` 1, `streaming_*` 0); 0 of the 94 source mp3s
> changed inside the pass window (newest mtime 2025-12-21); `localStorage` is
> byte-identical to the pre-Pass-4 snapshot in both the fixture app and the live
> app; and the console stream across the whole run held no
> `Runtime.exceptionThrown` and no error-level entry (six empty
> `consoleAPICalled` records only). The settings the pass moved and put back:
> theme light ⇄ dark ⇄ system, notation ⇄ `1m/1d` ⇄ both ⇄ Camelot, mode
> Wide ⇄ Strict, Compatible-only on ⇄ off.
---

## Decisions closed alongside this run

| Open item | Decision | Evidence |
| --- | --- | --- |
| `RowContextMenu.test.tsx` — seven `assert.equal(true, true)` placeholders, never collected (`.test.tsx` vs `.test.ts` glob) | **Deleted.** Its real decisions moved into `lib/library-menu.ts` (`clampMenuPosition`, `menuRating`, `starClickRating`, `columnMenuLabel`) and are covered by six tests in `lib/library-menu.test.ts`, which the runner does collect. | `pnpm --filter @dj-assistant/desktop test` → 241 passing |

## Result record

| Pass | Result | Date | Notes |
| --- | --- | --- | --- |
| 1 — Stage 1 shell | **PASS (1 row partial)** | 2026-11-09 | A1–A12, B1–B5, C1–C2 PASS; **C3 PARTIAL** — removing the probe was picked up by Vite HMR, so Try again / Reload app were never exercised and the recovery controls stay unverified. Section D moved to Pass 5. |
| 2 — Slice 2 rating/energy | **PASS (1 row open)** | 2026-11-09 | 23 PASS, 2 PARTIAL (B1 — `No energy set` is the read-only meter's label, not the library cell's; C2 — only 3 of the 5 filter dimensions were combined, since genre would not apply and `ratingMin` was tested separately in A10), 1 BLOCKED (A7 — the toast holds a single undo token, so undoing the first write after a second one is unreachable from the running UI; the wording itself is unit-tested). A1-A9, B2-B5, B8-B9, C1 and C4-C7 were closed by hand on coordinate/keyboard input plus a CDP channel for the mouse modifier and the console reader. Every write was reverted: the final DB copy diffs 0 against the 20:50 UTC pre-run backup over user_rating / energy for all 94 rows. |
| 3 — Slice 3A tags/editor | **PASS (43/48 PASS, 1 PARTIAL, 1 FAIL fixed)** | 2026-11-09 → 2026-11-10 | 43 PASS, 1 PARTIAL (F1 — the restart read the values the pass had already reverted, so edited-tag persistence stayed unverified), **B4 FAIL at time of pass (pre-fix)** (a no-op Save returned the backend `nothing to update`, so the editor closed and reported an error instead of `Metadata unchanged — nothing to save`); **resolved by PR #78 (merged 2026-11-15)** — empty patches now succeed as no-ops, so the editor reports `Metadata unchanged — nothing to save` with no toast or console error. Re-run pending to flip this row to PASS; the T2.1.7 / T2.1.13 boxes stay unticked until the human ticks them post-merge., **A7** and **F6** are stale expectations against shipped behaviour (right-click takes the selection; the second Escape also closes the track panel), **E3** not executable (the toast keeps one undo token). Every write reverted: `tracks` 0 diffs over all 94 rows, `track_tags` back to 0 rows; only `skill_runs` grew (73 → 99) as the app’s own write history. |
| 4 — T2.1.8 key pills | **FAIL (K10) → FIXED, re-run PASS** | 2026-11-09 → 2026-11-10 | K1–K8 PASS, K9 **DEVIATION** in case (a) (the Compatible-only box is disabled with no reference, where the checklist says it stays enabled; case (b) is as written). **K10 FAIL**: three text-on-background combos miss 4.5:1 — muted/incompatible text on a selected row (2.94 light, 2.59 dark) and the same-key tint on a selected row in dark (4.46). K11 PASS on the fixture. No library write was issued; `localStorage` back byte-identical. |
| 5 — 30k fixture | **PASS** | 2026-11-09 → 2026-11-10 | D1–D4 PASS: cold load to `200 of 30000 tracks` at 833 ms with boot long tasks 62/99/87 ms, primary tab switches 0–1 ms and zero long tasks (the non-Library tabs are planned-view stubs), Library remount 196–197 ms long task, scroll round trips 132–149 ms with page growth 200 → 700 rows. K11 PASS — all five relations mount, the relative tint for the first time; the fixture had to be re-keyed (fixture DB only). Live library never opened and net-zero proven: `.db`/`.wal` sizes+mtimes unchanged, every table identical, 0 of 94 source mp3s touched. |
