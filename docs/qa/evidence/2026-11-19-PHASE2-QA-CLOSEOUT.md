# Phase 2 QA close-out — targeted running-window passes (2026-11-19)

Executed against the live Tauri build (`pnpm --filter @dj-assistant/desktop tauri dev`,
`dj-assistant-desktop.exe`, window "DJ Assistant") on the real 94-track library.
Three channels, all read-mostly: Computer Use for the UI, the WebView2 DevTools window
(F12) purely as an IPC channel (`__TAURI_INTERNALS__.invoke`), and `node:sqlite` in
`readOnly` mode against `%APPDATA%\com.djassistant.desktop\dj_assistant.db` (WAL-safe while
the app holds the database).

No source audio file was written (§Integrity below). The only source edit in this pass — the
Stage 1 C3 probe — was reverted with `git restore` and re-verified through the dev server
(`curl http://localhost:1420/src/App.tsx` → 0 matches for the probe token).

Scope decision from the user: **targeted passes over the risk rows, no new checklist prose**.
This file is that record. **No box in `docs/sdd/04-TASKS.md` is ticked here** — ticking happens
on `main` by the human.

## 1 The three re-runs the progress audit flagged

| Ref | Row | Result | Evidence |
| --- | --- | ------ | -------- |
| B4 | `SLICE3A_MANUAL_QA_CHECKLIST.md` §B — Save with nothing changed | **PASS** (was FAIL on 2026-11-10, fixed by PR #78) | The editor reported the designed status `Metadata unchanged — nothing to save` with no Undo toast and no console error (read from the accessibility tree). DB cross-check on "All This Love (Original Mix)" `ad260572-f185-417c-b53f-18278305b402`: `updated_at` still `2026-11-17 12:38:59` and `track_tags` still 0 rows — the save wrote nothing. |
| Stage 1 C3 | `2026-11-09-RUNNING-WINDOW-QA.md` §1 — error boundary recovery controls | **PASS** (was PARTIAL/BLOCKED) | A dev-only throw keyed to two exact search tokens (`__qa_probe_a__` / `__qa_probe_b__`) survives the reload path, so HMR no longer masks the test. Boundary rendered: `role=alert` + heading `app-error-title` "DJ Assistant hit an unexpected error", the redaction note, and both buttons, with the whole app (search box included) replaced. **Try again** re-rendered the app with `Library loaded: 94 tracks`; the boundary was re-tripped and **Reload app** reloaded the window cleanly. C2 redaction re-verified on the same throw: the seeded `access_token=…`, e-mail and `C:\Users\…` path are masked in the console line. |
| T2.1.10 | the menu's **View columns** group (the last code-only group) | **PASS** | Right-click → the full column-toggle group renders live; toggling **LUFS** off and on from the menu changed the table header set; the identity guard behaved as specified — with only Title + Artist visible, the remaining identity row is `aria-disabled` with the title "The last identity column cannot be hidden." and refuses the hide. The column layout was restored exactly: 16 headers in the original order. |

## 2 Slice 4–8 risk rows

| Task | Row driven | Result |
| ---- | ---------- | ------ |
| T2.4.1 | content-addressed per-track peaks cache, dual resolutions | **PASS** — a track with no cache entry ("Loosing My Mind feat. Drori (Original Mix)") was loaded through the UI; the app decoded it and wrote `%APPDATA%\…\peaks\v3-<file_hash>.json` (mtime 2026-11-19T01:52:51Z) containing `peaks` 4000, `overviewPeaks` 1000, `isReal: true`, `durationMs` 345000, `sampleRate` 44100. The cache dir now holds 10 v3 entries + 4 legacy un-versioned files (see §4). |
| T2.4.2 | two distinct layers, each with its own peaks, both seek | **PASS** — the detail viewport and the overview strip render different buffers (4000 vs 1000 bins) and clicking each moved the playhead; the scrubber value drops "estimated preview waveform" once the real peaks arrive. |
| T2.4.4 | transport, seek budget, engine cursor | **PASS with a stated limit** — `audio_seek` to 10 000 / 60 000 / 120 000 / 180 000 / 240 000 ms completed in **3, 2, 2, 4, 8 ms**; `audio_state` afterwards returned `{"playing":false,"positionMs":240000,"durationMs":336876,"volume":1}`, so the native cursor really moved to the target. The number measures **command completion, not audible latency**; gain/limiter and the temp loop are still unimplemented. |
| T2.4.4 | source-file hash unchanged | **PASS** — see §Integrity. |
| T2.1.9 | missing-art placeholder, hover-play overlay | **PASS (placeholder + overlay)** — every ART cell renders the music-note placeholder, and parking the pointer over a cell fades in the play overlay (with the energy meter) without changing the selection; clicking the overlay loads **that** track into the deck (row 2 → deck title "Loosing My Mind feat. Droti (Original Mix) — Yojiman"). |
| T2.1.9 / T2.4.5 | with-art thumbnail, high-res upgrade, no cross-track bleed | **BLOCKED** — see §3. |
| T2.1.12 | the five source tabs driving `list_tracks` `source`/`sourceId` | **PASS** — All Library → `Library loaded: 94 tracks` (= SQL 94, `removed_at IS NULL` 0). Categories → 6 chips `Indie Dance (42) · Melodic House & Techno (42) · Melodic House (6) · Deep House (1) · Music (1) · Progressive House (1)`, which is exactly `GENRE_COUNTS_SQL`; selecting **Melodic House (6)** filtered the table to 6 rows, all genre `Melodic House`, header `6 tracks`. Browser → one folder chip `Music (94)`, matching the `folder_counts_from_paths` fold (all 94 paths share one parent); selecting it kept 94. Playlists → `0 tracks` + empty state; Flash/Storage → `0 tracks` + empty state. The collapsed left rail still carries only `NAV_ITEMS` — no library-source icons or tooltips, so that half of the task remains open. |

## 3 Blocked pending an artwork backfill

`SELECT COUNT(*), SUM(artwork_path IS NOT NULL), SUM(artwork_hash IS NOT NULL) FROM tracks`
→ **94, 0, 0**, while the MP3s themselves carry APIC frames. The library predates the Slice 4
artwork-caching scanner (merged 2026-11-16), and nothing backfills `artwork_*` for rows already
imported. Consequences:

- **T2.1.9** cannot show a with-art thumbnail, and the *no cross-track art bleed on fast scroll*
  clause cannot be tested at all — with 0 cached artwork there is nothing to bleed.
- **T2.4.5** cannot exercise the large-format `get_artwork` display or the high-res upgrade path;
  only the placeholder is verifiable (and is, §2).

Unblocking needs a re-scan/re-import pass that runs `cache_artwork` over the existing rows. That
mutates the real library (94 artwork rows + cache files), so it was **not** run as part of a QA
pass — it belongs to a deliberate backfill task. No open issue covers it (issue #89 is the
`beatgrid_confidence` backfill, a different column).

## 4 Observations recorded, not failures

- **First-load deck transient.** During a cold decode the deck shows the *previous* track's
  duration (5:06.87) and the synthesized fallback waveform for ~2–3 s before the real duration and
  peaks arrive; it self-corrects. Cosmetic, but it is the window where a user could mis-read length.
- **Hot cues are deck state, not per-track state.** Cues B 1:31.39 / C 2:32.32 / D 3:02 survived a
  track switch. Confirm against `docs/ui/06-PLAYER.md` intent before treating it as a bug.
- **Duration rounding differs by surface.** DB `duration_ms` 345051 → deck `5:45.00` (floor) and
  table `5:46` (ceil).
- **Categories intentionally covers 93 of 94** — the one genre-less track is excluded by
  `GENRE_COUNTS_SQL` (`genre IS NOT NULL AND TRIM(genre) <> ''`), so the chip list is not a census.
- **Switching source tab drops the previous source selection** (a Categories chip is cleared when
  Browser is opened) — consistent, but worth stating in the UI spec.
- **The empty state says "No tracks in library"** for Playlists/Flash-Storage while the library
  holds 94; the copy is source-scoped, not library-scoped.
- **4 legacy peaks files** (69-char names, 2026-11-15, pre-v3) remain in the cache dir and are
  never served; harmless but dead weight.

## Integrity — the source files were not touched

`tracks.file_hash` is **BLAKE3(file_size LE bytes + the first 1 MiB)**
(`crates/core/src/fingerprint.rs`, `FINGERPRINT_WINDOW = 1024*1024`), *not* a whole-file SHA-256.
An initial check that compared whole-file SHA-256 against the column reported 5/5 "changed" — that
was the wrong measure, not a real change, and the result was discarded.

The correct evidence, three ways:

1. **Size** — `file_size` on disk equals `tracks.file_size` for all 5 sampled rows.
2. **mtime** — every sampled file's mtime is 2025-12-09…2025-12-21, i.e. months before this pass;
   no app write touched them.
3. **The cache key is a live re-fingerprint** — `audio_load` derives the peaks key from
   `compute_file_fingerprint(file_path)` re-read from disk (`apps/desktop/src-tauri/src/commands.rs:433-441`).
   The entry written today for "Loosing My Mind" is named with that track's stored `file_hash`, and
   the decode succeeded (`isReal: true`, 44.1 kHz), so today's on-disk BLAKE3(length + 1 MiB) still
   equals the imported value. Same for the earlier loads whose v3 keys match their DB hashes.

## What this pass does not close

- T2.1.9 with-art + bleed, T2.4.5 with-art + high-res upgrade — §3.
- T2.4.2 `<16 ms/frame` budget — never measured here.
- T2.4.4 gain/limiter, temp loop, grid-quantized beat jump off the native cursor, audible seek latency.
- T2.4.3 low-tier warning styling and the F-3 editor hookup (unchanged from 2026-11-17).
- T2.1.12 collapsed-rail source icons/tooltips.
- T2.1.1/T2.1.2/T2.1.3/T2.1.4/T2.1.6/T2.1.7/T2.1.8/T2.1.13 — their own open rows (multi-select,
  select-all, the filter dimensions never combined, the single-undo-token cases) are untouched by
  this pass; B4's row is now PASS, which is the only gate change here.
