# DJ Assistant — Wireframes

**Status:** Historical — low-fidelity structural reference (Phase 0 shell, 2026-10-14 snapshot)
**Companions:** [00 — Overview](../00-OVERVIEW.md) · [01 — Design System](../01-DESIGN-SYSTEM.md) · [12 — Screens & Flows](../12-SCREENS-AND-FLOWS.md)

> **Historical:** current screen specs live in [docs/ui/](../README.md). These wireframes
> are kept as a structural reference for the Phase 0 UI; where they conflict with the
> numbered `docs/ui/` specs, the numbered specs win.

Low-fidelity structural wireframes for every screen. They show **layout, hierarchy,
states, and interaction affordances** — not final pixels. Visual tokens live in
[01 — Design System](../01-DESIGN-SYSTEM.md); behaviour and flows live in
[12 — Screens & Flows](../12-SCREENS-AND-FLOWS.md).

> These are deliberately low-fidelity. Do not lift colours or sizes from the ASCII art;
> use the design-system tokens. Treat the art as a **structure contract**: regions,
> ordering, and states are the parts that must match the implementation.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `┌ ┐ └ ┘ │ ├ ┤ ─` | Region / box boundaries |
| `[ Label ]` | Button |
| `[icon]` | Icon-only button |
| `[ search… ]` | Text input (placeholder shown) |
| `( )` / `(•)` | Radio — unselected / selected |
| `[ ]` / `[x]` | Checkbox — unchecked / checked |
| `▓▓▓░░░` | Progress bar — filled / remaining |
| `▣` | Artwork / cover thumbnail |
| `▸` | Disclosure / expandable row |
| `⋯` | Overflow ("more") menu |
| `★` / `☆` | Rating — filled / empty |
| `●` / `○` | Presence / status — online / offline |
| `~≈~` | Waveform |
| `▁▂▃▅▇` | Energy / intensity level |
| `{1}` | Callout — see the annotation table below the wireframe |
| `text` | Static label or computed value |

---

## Index

| # | Screen | Phase | Status |
|---|--------|-------|--------|
| 00 | [App Shell](./00-app-shell.md) | 0 | ✅ Implemented |
| 01 | [Library](./01-library.md) | 0 | ✅ Implemented |
| 02 | [Analysis](./02-analysis.md) | 1 | ⏳ In progress |
| 03 | [Track Detail / Inspector](./03-track-detail.md) | 2 | 📋 Planned |
| 04 | [Cue / Waveform Editor](./04-cue-editor.md) | 2–3 | 📋 Planned |
| 05 | [Tag Cleanup](./05-tag-cleanup.md) | 2 | 📋 Planned |
| 06 | [Set Builder](./06-set-builder.md) | 3 | 📋 Planned |
| 07 | [Export](./07-export.md) | 3 | 📋 Planned |
| 08 | [Skills Panel](./08-skills-panel.md) | 3–4 | 📋 Planned |
| 09 | [Gig Ready / Prep Auditor](./09-gig-ready.md) | 4 | 📋 Planned |
| 10 | [Collaboration (B2B)](./10-collaboration.md) | 4 | 📋 Planned |
| 11 | [Spotify Playlist Export](./11-spotify-export.md) | Post-MVP | 📋 Planned |
| 12 | [Discovery & Enrichment](./12-discovery-enrichment.md) | 0 (foundations + review + charts) / Post-MVP (radar, more adapters) | ✅ Shipped (local + review + charts) · 📋 Planned (radar, fingerprinting) |

---

## Conventions

- **Callouts** (`{1}`, `{2}`, …) are explained in an annotation table below each wireframe.
- **Widths** vary per screen; wide screens assume a window ≥ 1366px (see
  [Screens & Flows](../12-SCREENS-AND-FLOWS.md) §7).
- **States** — every data screen documents empty, loading, error, and populated.
- **Provenance** — AI-generated content is marked in the art (`AI`); user content is not.
- Each screen file also lists its **accessibility obligations** for that specific view.

---

*Add a wireframe before implementing a screen. When a screen's structure changes, update
its wireframe in the same PR.*
