# Wireframe — App Shell (00)

**Phase:** 0 · ✅ Implemented
**Applies to:** every screen
**See also:** [Screens & Flows §1](../SCREENS_AND_FLOWS.md) · [Design System §4](../DESIGN_SYSTEM.md)

Every screen renders inside this shell. Only the **CONTENT** region changes between
screens; the header, toolbar, and status bar are constant.

---

## Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◉ DJ Assistant   [ Phase 0 Foundation ]        [ Scan Music Folder ]  [ ⟳ ]                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {1} progress strip — visible only while a job is running                                        │
│  ⟳ Scanning  D:\Music\deep\track.flac            128 / 402 files                                 │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {2} [ search title, artist, album, path… ]          94 tracks  ·  Local-first · Non-destructive │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│                                     SCREEN CONTENT                                               │
│                      (library · cue editor · set builder · …)                                    │
│                                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {3} ● Ready             BLAKE3 Fingerprint · SQLite Core · Offline                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Region heights:** header `56px` · toolbar `48px` · status bar `28px` · progress strip `auto`.

---

## Annotations

| # | Region | Contents | Behaviour |
|---|--------|----------|-----------|
| {1} | **Progress strip** | Job label, current item, counts, fill bar | Shown only during scan/analysis/export; determinate when a total is known, otherwise shows `?` and pulses. Disappears on completion. |
| {2} | **Toolbar** | Search input, library count, local-first badge | Search filters client-side; count reflects the current filter; badge reinforces the non-destructive promise. |
| {3} | **Status bar** | State dot + message, tech tagline | The single ambient state readout (idle / scanning / analyzing / exporting / error). |

---

## Header actions

| Action | Phase | Notes |
|--------|-------|-------|
| Brand + phase badge | 0 | Static; badge reflects the current build phase |
| `Scan Music Folder` | 0 | Primary action; disabled + relabelled while scanning |
| `⟳` refresh | 0 | Reloads the current screen's data |
| `Gig Ready` | 4 | One-click pre-gig workflow |
| `Export` | 3 | Open the export dialog for the active set |
| `Skills` | 3–4 | Toggle the Skills drawer |
| `⋯` overflow | 3+ | Settings, Preferences, About |

> **One primary action per screen.** In Phase 0 the header's primary action is `Scan Music
> Folder`. When the set builder is active, `Export` becomes primary and scan is secondary.

---

## States

| State | What the shell shows |
|-------|----------------------|
| **Idle** | Status bar "Ready"; no progress strip |
| **Busy** | Progress strip visible; primary action disabled |
| **Error** | Status bar shows the error in place; no modal |
| **Offline** | Nothing changes — the core is offline-capable by design; only cloud features grey out |

---

## Accessibility obligations

- Map the shell to landmarks: `header`, `main` (CONTENT), and a `footer`/status region.
- The progress strip is a live region (`aria-live="polite"`), announced but not focus-stealing.
- The status bar is a `status` region so changes are announced.
- Header actions are reachable by `Tab` in visual order and are individually labelled.

---

## Notes

- The shell is the only place global chrome exists; screens must not draw their own headers.
- Toolbar contents are screen-aware but always include search on list-style screens.
