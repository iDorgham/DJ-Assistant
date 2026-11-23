# Statistics

Last updated: 2026-10-23  
Status: Locked whole-library scope; chart details proposed

## 1. Purpose

Statistics explains the library and makes problems actionable.

v1 scope: **whole library only**. Playlist-scoped statistics are later.

Statistics is not a dashboard full of vanity metrics. Every chart must help the user decide something or jump to the affected tracks.

## 2. Views

```text
Statistics
  Overview
  Genres
  Artists
  BPM & Key
  Play History
  Library Health
```

## 3. Overview

KPI cards:

- Tracks
- Artists
- Albums / releases
- Labels
- Playlists
- Total duration
- Average BPM
- Analyzed %
- Tag coverage %
- Missing files
- Duplicates
- Quarantined
- Last backup

Charts:

- Tracks added over time.
- Genre distribution.
- BPM distribution.
- Key distribution.
- Energy distribution.
- Rating distribution (stored 0–10; displayed 0–5 half-stars).
- Play count distribution.
- Library Health trend.

Rules:

- Click a chart segment to open Library with the matching filter.
- Do not show a chart if the underlying data is too incomplete.
- Show “Not enough data” instead of a misleading chart.

## 4. Genres

- Genre tree distribution.
- Subgenre coverage.
- Unmapped genres.
- Genre over time.
- Genre vs energy.
- Genre vs BPM.

Actions:

- Open filtered Library.
- Open Maintain → Genres.
- Review unmapped genres.
- Export CSV.

## 5. Artists

- Top artists by track count.
- Top artists by play count.
- Artists with missing metadata.
- Artists with aliases.
- Artists with duplicates.
- Labels.
- Collaborations.

Actions:

- Open filtered Library.
- Open Maintain → Artists.
- Merge aliases.
- Review duplicates.

## 6. BPM and Key

- BPM histogram.
- Key distribution.
- Camelot wheel.
- BPM vs energy.
- Key vs energy.
- Tempo range coverage.

Rules:

- Do not imply harmonic compatibility without a key.
- Distinguish analyzed from missing.
- Show the number of tracks behind each chart.

## 7. Play History

- Plays over time.
- Most played.
- Least played.
- Never played.
- Last played.
- Play count by genre/artist.
- Play duration.
- Source of history.

Rules:

- Internal player history is authoritative for DJ Assistant plays.
- Imported DJ app history is displayed separately until reconciled.
- Third-party history import is an explicit user action.
- Each imported entry stores source, source file and import timestamp.
- Do not merge sources silently.
- Show the source and date range.
- A track with no plays is “Never played”, not “Unwanted”.

Play history sources are locked: internal and imported, labeled separately with provenance.
- Date ranges are locked: all-time default; date range only for Play History and Additions; no playlist scope.

## 8. Library Health

- Health score over time.
- Metadata completeness.
- Tag coverage.
- Analysis coverage.
- Duplicate count.
- Missing files.
- Quarantine count.
- Sync conflicts.
- Backup verification.

Actions:

- Open Maintain.
- Open affected tracks.
- Start a Smart Fix.
- Run a backup.

## 9. Chart rules

- Use one color system across all charts.
- Do not use 3D charts.
- Do not use pie charts for more than five categories.
- Label axes.
- Show units.
- Show counts, not just percentages.
- Provide a table alternative.
- Keyboard-focusable data points.
- Respect reduced motion.
- Export CSV and PNG.

## 10. Filters and date ranges

v1:

- Whole library.
- Optional date range for play history and additions.
- No playlist scope.

Later:

- Playlist scope.
- Compare periods.
- Compare playlists.
- Saved views.

## 11. Data quality

Statistics must label:

- Missing BPM.
- Missing key.
- Missing genre.
- Missing energy.
- Missing rating.
- Missing play history.
- Unanalyzed tracks.
- Imported vs internal history.

Do not fill gaps with zeros. Zeros change the shape of the data.

## 12. Exports

- CSV per chart.
- PNG per chart.
- Full library summary CSV.
- Do not export personal data without a clear action.

## 13. Empty states

| State | Message |
|---|---|
| No tracks | “Import music to see statistics.” |
| No analysis | “Analyze tracks to unlock BPM and key charts.” |
| No plays | “Play history will appear after you listen.” |
| No tags | “Add genre and style tags to see distributions.” |
| No backup | “Configure backup to see backup health.” |

## 14. Anti-patterns

- A dashboard as the home screen.
- A score with no drill-down.
- Pie charts with 20 slices.
- Hiding missing data.
- Treating play count as taste.
- Playlist statistics in v1.
- Charts that do not link to the Library.
- Fake trends from too little data.
