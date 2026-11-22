# T2.4.3 — Beat-grid confidence display, running-window QA (2026-11-17)

Executed automatically via Computer Use against the live branch build
(`pnpm --filter @dj-assistant/desktop tauri dev`, `dj-assistant-desktop.exe`,
window "DJ Assistant").
No source audio files were modified; the re-analysis ran through the app's
own `analyze_library` IPC with `force: true` on a single track.

Target track: "All This Love (Original Mix)" —
`ad260572-f185-417c-b53f-18278305b402` (analysis complete, BPM 126.1).

## Steps and results

| # | Step | Expected | Result |
| - | ---- | -------- | ------ |
| 1 | Load target track into the player dock (search → hover-play) | No GRID chip (`beatgrid_confidence` is NULL for rows analysed before migration 009 — there is no backfill) | PASS — chips showed `BPM 126.1` and `KEY 7B` only |
| 2 | DevTools console: `__TAURI_INTERNALS__.invoke('analyze_library', {request:{trackIds:[target],force:true}})` | Single-track force re-analysis succeeds | PASS — toast: "Analysis complete! 1 succeeded, 0 failed in 90.4s" |
| 3 | Read-only DB poll (`node:sqlite`, WAL-safe) | `beatgrid_confidence` becomes non-null | PASS — `0.9378530979156494`, `analysis_status` complete |
| 4 | Swap to a NULL-confidence track ("Up to You feat. SAÍGO") | Chip hidden, no stale 94% carried over | PASS — only `BPM 126.1` / `KEY 10B` chips |
| 5 | Swap back to the target track | Detail refetch shows the chip | PASS — `GRID 94%` chip rendered between BPM and KEY (0.938 → "94%", high tier — neutral styling, not the warning variant) |

## Notes

- The chip appears only after a track swap because the confidence is fetched
  with the track detail when the player loads a track; a live re-analysis of
  the currently loaded track does not push a detail update (F-3 event hookup
  remains open, as documented in `docs/sdd/04-TASKS.md`).
- DevTools was opened with F12 (WebView2) purely as the IPC invocation channel;
  no data was written to the DB outside the app's own pipeline.
- Low-tier (warning-styled) rendering is **not** covered here: the unit tests
  (`apps/desktop/src/lib/grid-confidence.test.ts`) assert the tier helper and
  the formatter only, and no component test renders `PlayerTrackLine`, so the
  warning classes and title are unverified visually. A real low-confidence grid
  was not reproducible on demand in this window.
- **Gap found in review:** rows already `complete` at the current
  `analysis_version` are ineligible for the ordinary work list
  (`crates/core/src/library_reads.rs`), so migration 009's column stays NULL for
  them until a **force** re-analysis. No backfill ships with this slice; it
  needs its own task because both candidate fixes (bumping the bpm pipeline
  version, or widening the predicate to `beatgrid_confidence IS NULL`) trigger a
  library-wide re-analysis.
- Post-review change: the chip no longer costs a second `get_track` per track
  switch — `App` keys the detail row it already fetches and passes
  `beatgridConfidence` to the player, so the stale-value behaviour in step 4 now
  comes from that id keying.
- Post-review change (CodeRabbit): when that keyed detail refresh **fails**, the
  confidence is dropped rather than retained (`App.tsx`, the `getTrack` catch),
  so a cleared analysis cannot leave a stale `GRID nn%` on screen. Not exercised
  in this pass — forcing a `get_track` failure mid-session needs the IPC channel
  itself to break, which this window cannot do honestly.

Verdict: the T2.4.3 confidence-display slice passes running-window QA.
