# UI implementation review — 2026-10-19

Screenshot-based approval pass over every implemented screen/flow in the DJ Assistant
desktop app. Captured from the **running application** against the **real backend and
real SQLite library** (94 tracks at `D:\Music\My Sets\Music`), not from mocks or the
wireframes.

- **Build under test:** `main` @ `c3f39e99` (all 8 merged PRs included)
- **Rust backend:** optimized `--release` build (`dj-assistant-desktop.exe`, feature work
  from T1.x analysis + T2.1.2 library filters)
- **Frontend:** same React source served by Vite (`http://localhost:1420`) — a plain
  `cargo build --release` binary still points at `devUrl`; the visible code is identical to
  `apps/desktop/dist`, but a `pnpm tauri build` bundle should be used for release-candidate
  sign-off.
- **Automation:** Playwright attached to the Tauri WebView2 over CDP; every screen was
  reached by real clicks/typing, with the state coming from real IPC commands.
- **App data after the pass:** the real library was analysed end-to-end (one sample chart
  snapshot was imported to exercise the Charts flow).

## Verdict summary

| # | Implementation | Evidence | Verdict |
|---|---|---|---|
| 1 | Library table (dense rows, sticky header, artwork placeholder, fingerprint, indexed badge, provider counts) | `01`, `27` | **Blocked by F1** (status column); layout approved |
| 2 | Filter panel (tempo, 24 Camelot keys, 4 analysis states, genre counts, min rating) | `02`, `16` | **Approved** |
| 3 | Server-side filtering + active-filter chips + count badge | `03` (genre → 42), `17` (BPM 120–130 + needs review → 22) | **Approved** |
| 4 | Column sorting (BPM asc, NULLs last, `id` tiebreaker) | `15`, `27` | **Approved** |
| 5 | Client-side instant search + filtered-empty state | `24` (2 of 94), `08` | **Approved** |
| 6 | Inspector drawer: identity, gap chips, similar tracks, buy links, Esc close | `04`, `18`, `25` | **Approved** |
| 7 | Tag Health modal: library score, gap totals, per-track gaps, explicit opt-in lookup | `06`, `21` | **Approved** |
| 8 | Online enrichment preview (MusicBrainz) | `20` | **Partially exercised** — lookup/progress verified; proposal review → apply → undo not exercised (F4) |
| 9 | Charts: empty state, sample-snapshot import, versioned list w/ taste filter | `07`, `23` | **Approved** |
| 10 | Analyse queue: per-track progress, device rows, persistent results | `10`, `26`, `27`, `28` | **Approved with follow-up** (see F1–F3) |
| 11 | Scan flow (re-scan of the 94-file folder) | `11` | **Approved** (progress strip too fast to catch) |
| 12 | Empty-library state | not exercised (library is populated); filtered-empty state verified in `08` | Not exercised |

Real analysis outcome after the full run — 94 tracks, `--release`:

| Result | Count |
|---|---|
| `complete` | 24 |
| `needs_review` | 68 |
| `failed` | 2 |
| BPM + key resolved | 92 / 94 |
| Loudness resolved | 92 / 94 |
| Vocal presence flagged | 24 / 94 |

## Findings (ranked)

### F1 — Analysis status is invisible in the library table · P1 (blocker for the needs-review workflow)
The `STATUS` column is hard-coded to the `Indexed` pill for every row
(`apps/desktop/src/App.tsx`, status cell). `complete`, `pending`, `needs_review` and
`failed` tracks are therefore visually identical. Evidence: `28` filters to the 68
needs-review tracks, `29` filters to the 2 failed tracks — and both render "Indexed".
The whole low-confidence workflow (T1.2.4) is only reachable through the filter panel.
**Recommendation:** render `analysis_status` in that column (or as a secondary badge):
`Indexed` is an import fact, analysis state is a product fact. At minimum show
`needs_review`/`failed` with distinct styling and the failure reason on hover.

### F2 — 72 % of real tracks end up `needs_review` · P1 (quality calibration)
Phrase-confidence distribution across the 92 analysed tracks:
`<0.15` → 13, `0.15–0.30` → 55, `0.30–0.50` → 22, `≥0.50` → 2. With the 0.30 threshold,
68/94 tracks are flagged for review. A review queue that contains almost everything has
no triage value, and it will train users to ignore the flag.
**Recommendation:** review the phrase-confidence estimator/threshold against real
full-length tracks before treating the flag as shipped; consider a two-tier signal
(e.g. `low` vs `uncertain`) and calibrate on the golden corpus plus this real library.

### F3 — Two real MP3s fail analysis with no user-visible error · P2
`DENEEM - Unbroken`, `DJ Zombi, Guy Davido - Disco Boy (Bonafique Remix)`:
`audio decode failed: … unsupported feature: core (codec): unsupported audio codec`
(Symphonia). The failure is persisted (visible only via the Failed filter, see `29`) and
logged to the dev console (`App.tsx` analysis-progress handler); the table still says
"Indexed" and no error is surfaced in the UI.
**Recommendation:** surface failed tracks with the stored reason, and check codec coverage
(Symphonia feature flags / MP2 handling) for real-world MP3s.

### F4 — Online enrichment preview produced no reviewable proposals · P2 (needs retest)
MusicBrainz lookup started correctly and reported honest progress
("3 / 25 · skipped: no catalog match", `20`), gap counters updated, and the copy about
opt-in/never-upload-audio is clear. In this run every sampled query was skipped as
"no catalog match", and no proposals section appeared, so the diff-review → Apply → Undo
half of the flow could not be approved live. The modal also returned to the library
without keeping the result visible, which may be an automation artefact or a state bug —
needs one manual retest.
**Recommendation:** verify the MusicBrainz query construction (artist/title normalisation,
remix suffixes) and rate-limit handling; add a captured proposal to the review evidence
for TE.3 sign-off.

### F5 — Header badge is stale · P3
The app header still shows **"Phase 0 Foundation"** while the project is in Phase 2
(T2.1.2 shipped). Cosmetic but user-visible.

### F6 — Dev-only React warning for table rows · P3
Console error on every render: `In HTML, whitespace text nodes cannot be a child of <tr>`
(the row map emits whitespace between `<tr>` children). Production bundles do not warn,
and nothing breaks, but it is real DOM-hygiene debt in `App.tsx`.

### F7 — Analysis run has no cancel / kill-switch · P2 (UX)
The queue is fire-and-forget: once started, there is no cancel, pause, or per-track skip.
On a debug build a 94-track library takes hours (we used the release build for this pass).
A visible "stop" control is expected for a long local job.

### F8 — Artwork and empty-library states not exercised · P3 (coverage gap)
No artwork cache entries exist and the scanned MP3s expose no embedded art, so every row
shows the placeholder ("No embedded artwork"). The placeholder path is verified; real
`get_artwork` rendering is not. The library is populated, so the true empty-library state
was not captured — only the "no tracks match" filtered-empty state (`08`).

## Screenshot index

| File | Shows |
|---|---|
| `01-library-populated-pending.png` | Library loaded (94 tracks), pre-analysis: BPM/key columns empty |
| `02-filters-panel.png` | Filter panel: tempo, Camelot keys, analysis states, genre counts, rating |
| `03-filters-applied-genre.png` | Genre filter applied → 42 tracks, `Filters (1)` badge + active chip |
| `04-inspector-drawer.png` | Inspector: missing-field chips, similar tracks (99–94 %), buy links |
| `06-tag-health-modal.png` | Tag Health: 94/94 with gaps, library score 72/100, per-gap bars + track list |
| `07-charts-modal.png` | Charts empty state ("import one first") + import-format hint |
| `08-no-match-search.png` | "No tracks match" empty state with "Clear search & filters" |
| `10-analysis-progress-strip.png` | Analysis progress strip: current file, `3 / 94 tracks`, determinate bar |
| `11-scan-completed.png` | Scan completed: library reloaded (94 tracks) |
| `15-library-sorted-by-bpm.png` | BPM sort asc, analysed values populated, NULLs last |
| `16-filters-bpm-panel.png` | Filter panel with BPM 120–130 + "Needs review" selected |
| `17-library-filtered-bpm-needs-review.png` | Two chips, `Filters (2)`, 22 matching tracks |
| `18-inspector-analyzed.png` | Inspector for analysed track: BPM 121.6 · 7B · 6:03 in header |
| `20-enrichment-lookup-progress.png` | MusicBrainz lookup in progress: `3 / 25 · skipped: no catalog match` |
| `21-enrichment-preview.png` | Tag Health after analysis: score 75/100, BPM/Key gaps down to 60 |
| `23-charts-sample-imported.png` | Sample Beatport Top-100 imported: 3 entries, date, BPM/key per entry |
| `24-search-results.png` | Instant search "house" → 2 of 94 tracks |
| `25-inspector-similar-analyzed.png` | Similar-track ranking with % scores and rationale |
| `26-full-analysis-progress.png` | Analyze run over the library (release build) |
| `27-library-fully-analyzed.png` | Final state: 94 tracks, BPM + key populated across the page |
| `28-filter-needs-review.png` | "Status Needs review" → 68 tracks |
| `29-filter-failed.png` | "Status Failed" → the 2 undecodable MP3s |

## How this was captured

1. `pnpm build:desktop` and `cargo build --release -p dj-assistant-desktop`.
2. Launch the app with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`;
   serve the frontend with `pnpm dev:desktop`.
3. Attach Playwright (`playwright-cli attach --cdp=http://127.0.0.1:9222`) and drive the
   real UI (clicks, typing, sorting, filters), capturing 1280×800 / 1920×1009 viewport
   screenshots.
4. Analysis was run through the app's real queue: first a 30-track IPC batch, then the
   whole remaining library via the Analyze button; figures in this report come from the
   resulting SQLite rows.
