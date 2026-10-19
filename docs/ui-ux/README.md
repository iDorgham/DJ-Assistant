# DJ Assistant — UI/UX

**Status:** Living — snapshot as of 2026-10-14
**Audience:** Frontend engineers, product, design, and AI agents building the desktop UI
**Scope:** The visual language, interaction model, screens, and accessibility rules for the Tauri desktop app

> **Superseded (2026-10-19):** Current UI/UX specs live in [`docs/ui/`](../ui/README.md) —
> [design system](../ui/01-DESIGN-SYSTEM.md), [shell & navigation](../ui/02-SHELL-AND-NAVIGATION.md),
> and the per-view screen specs. This folder is kept as a historical reference for the
> Phase 0 UI; where it conflicts with `docs/ui/`, `docs/ui/` wins.

---

## Documents

| Document | Purpose |
|----------|---------|
| [UX_PRINCIPLES.md](./UX_PRINCIPLES.md) | Who we design for, the prep loop, design principles, IA, interaction patterns, voice |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Colour, type, spacing, motion, and the component inventory with states |
| [SCREENS_AND_FLOWS.md](./SCREENS_AND_FLOWS.md) | Screen inventory, wireframes, and end-to-end user flows per phase |
| [wireframes/](./wireframes/README.md) | Low-fidelity structural wireframes for every screen (00–12) |
| [ACCESSIBILITY.md](./ACCESSIBILITY.md) | WCAG targets, contrast findings, keyboard model, motion, and test checklist |

---

## Where the UI was (2026-10-14 snapshot)

> Historical: this table predates the T2.1.0 app shell. See
> [`docs/ui/`](../ui/README.md) for the current shell, screens, and player.

The desktop app is a **dark-first Tauri v2 shell**. The only screen shipped so far is the
**Phase 0 Library** view: scan a folder, watch live progress, and browse a dense track
table. Analysis, cue editing, tag cleanup, the set builder, and the skills panel are
designed here but **not yet built** — their specs are marked with the phase they belong to.

| Surface | Status |
|---------|--------|
| App shell (header / toolbar / content / status bar) | ✅ Phase 0 |
| Library table (artwork, BPM, key, rating, duration, format, status) | ✅ Phase 0 |
| Scan progress bar + status events | ✅ Phase 0 |
| Empty / loading / error states | ✅ Phase 0 (basic) |
| Analysis progress + per-track confidence | ⏳ Phase 1 |
| Cue / waveform editor | 📋 Phase 2–3 |
| Energy Canvas + Set Builder | 📋 Phase 3 |
| Skills Panel, Gig Ready, Export | 📋 Phase 3–4 |
| Tag Cleanup, Collaboration | 📋 Phase 2 / 4 |
| Spotify Playlist Export (metadata-only streaming) | 📋 Post-MVP |

---

## The five things to remember

1. **Speed is a feature.** The UI exists to make prep feel like minutes, not hours.
2. **The DJ is in control.** Every bulk or AI action is previewable and reversible.
3. **Local-first is visible.** Offline and non-destructive are stated, not implied.
4. **Show provenance.** AI-generated data is always marked; nothing changes silently.
5. **Density with clarity.** Professionals want information on screen — but scannable.

Details and rationale are in [UX_PRINCIPLES.md](./UX_PRINCIPLES.md); the tokens and
components that implement them are in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

---

*Interface docs are living. Update the relevant file in the same PR that changes a token,
component, screen, or interaction — do not let code and design drift.*
