# Wireframe — Analysis (02)

**Phase:** 1 · ⏳ In progress
**See also:** [Screens & Flows §4.1](../SCREENS_AND_FLOWS.md) · [UX Principles §5.4](../UX_PRINCIPLES.md)

Analysis is a **background capability surfaced inside the library**, not a separate
destination. It reuses the [App Shell](./00-app-shell.md) progress strip and adds per-track
status plus a confidence review path.

---

## Wireframe — analysis running

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◉ DJ Assistant   [ Phase 1 · Analysis ]            [ Gig Ready ]  [ Export ]  [ Skills ]       │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {1} ⟳ Analyzing 37 / 94 · Deep Horizon — BPM, key, phrases…           ~1.8s / track            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {2} [ search… ]            94 tracks  ·  {3} [ Analyze all ]  [ Analyze selected ]  [ ⚙ ]      │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  #   ART   TITLE              ARTIST      BPM    KEY   CONF     STATUS                          │
│─────────────────────────────────────────────────────────────────────────────────────────────────│
│   1   ▣     Deep Horizon       Kael        124    8A    ▇▇▇      ● Complete                     │
│   2   ▣     Solar Wind         Nova        125    8B    ▇▇▇      ● Complete                     │
│   3   ▣     Untitled           Unknown     —      —     ▇▁▁      ▲ Needs review                 │
│   4   ▣     Midnight Drive     Vela        —      —     ▁▁▁      ◐ Analyzing…                   │
│   …                                                                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {4} ● Analyzing 37 / 94           BLAKE3 Fingerprint · SQLite Core · Offline                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — confidence review

When a track's analysis is low-confidence, the DJ is asked to confirm rather than being
shown a number that may be wrong.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  {5} Review queue         3 tracks need review                                                │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│  Untitled — Unknown Artist                                                                    │
│    Detected key:  6A  (conf. ▇▁▁)   {6} [ Accept ]  [ Correct… ]  [ Skip ]                    │
│    Detected BPM:  128 (conf. ▇▇▁)        [ Accept ]  [ Correct… ]  [ Skip ]                   │
│                                                                                               │
│  Afterglow — Sable                                                                            │
│    Vocal presence: uncertain (conf. ▇▁▁)  [ Tag vocal ]  [ Tag instrumental ]  [ Skip ]       │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│  {7} Manual corrections permanently override the AI value and are logged.                     │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Analysis progress | Reuses the shell progress strip: current track, phase, counts, time per track |
| {2} | Toolbar | Search + selection-aware scan controls |
| {3} | Analyze buttons | "Analyze all" or the current selection; respects `analysis_version` (skips fresh) |
| {4} | Status bar | Mirrors overall progress and the final summary |
| {5} | Review queue | Groups low-confidence attributes so the DJ resolves them in one pass |
| {6} | Accept / Correct | Accept keeps the AI value; Correct records a permanent user override |
| {7} | Override notice | States that overrides are permanent and logged (provenance) |

### Status states

| Pill | Meaning | Colour token |
|------|---------|--------------|
| `● Complete` | Analysis finished, high confidence | success |
| `◐ Analyzing…` | In the queue / running | info |
| `▲ Needs review` | Finished but low confidence | warning |
| `○ Pending` | Not yet analyzed | muted |
| `✕ Failed` | Decode/analysis failed; file skipped | danger |

### Confidence meter

The `CONF` column uses a 3-bar meter (`▇▇▇` high, `▇▇▁` medium, `▇▁▁` low). The bar is
**always paired** with the textual status, never used alone.

---

## States

| State | Behaviour |
|-------|-----------|
| **Idle** | No progress strip; `Status` column shows `○ Pending` or `● Complete` |
| **Running** | Progress strip + per-row `◐ Analyzing…`; UI stays fully responsive |
| **Paused/queued** | Rows wait at `○ Pending`; queue resumes automatically |
| **Complete** | Strip disappears; status bar shows totals; review queue surfaces low-confidence |
| **Failed items** | Marked `✕ Failed`, listed, and skippable — never a crash |

---

## Interactions

- **Analyze all / selected** → enqueue on a background thread; UI never blocks.
- **Re-analyze** → offered when `analysis_version` changes or forced via `⚙`.
- **Review** → Accept, Correct…, or Skip each flagged attribute.
- **Correct…** → opens an inline editor; the correction is stored as a user override.

---

## Accessibility obligations

- The progress strip is a polite live region; do not announce every track (throttle).
- The confidence meter must expose a text equivalent (`aria-label` on the status pill).
- Status is conveyed by icon **and** label, so it survives colour-blindness.
- Review-queue actions are reachable by keyboard and in a logical reading order.

---

## Notes

- BPM and beat grid are treated as reliable; **key is "reasonably reliable"**, and
  energy/mood are deliberately **not** auto-scored — hence the review path rather than a
  false certainty.
- Analysis never modifies source audio; results are written to the local database only.
