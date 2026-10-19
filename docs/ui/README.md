# DJ Assistant — UI/UX Documentation

**Version:** 1.0  
**Status:** Approved for design & implementation  
**Date:** 2026-10-19  
**Source of truth:** This folder. Earlier UI docs live in [`../ui-ux/`](../ui-ux/); where they overlap, this folder is newer.

---

## What this is

Complete interface documentation for **DJ Assistant**: a desktop preparation tool for professional DJs.

**Product is:**
- Music library management
- Playlist creation
- Set mix preparation (cues, grid, harmonic/energy sequencing, export)

**Product is not:**
- Live DJ performance software
- A replacement for rekordbox / Serato / Traktor / CDJs

**Design language:** Adobe-class precision panels + Ableton-style flexible docks + 2026 professional desktop trends.

---

## Document map

| Doc | Contents |
|-----|----------|
| [00-OVERVIEW.md](00-OVERVIEW.md) | Vision, principles, information architecture, user journeys |
| [01-DESIGN-SYSTEM.md](01-DESIGN-SYSTEM.md) | Tokens: color, type, space, radius, elevation, icons, motion |
| [02-SHELL-AND-NAVIGATION.md](02-SHELL-AND-NAVIGATION.md) | Window chrome, header, menus, left nav, options bar, workspaces |
| [03-LIBRARY-VIEW.md](03-LIBRARY-VIEW.md) | Library screen: table, search, filters, columns, harmonic keys |
| [04-PREPARATION-VIEW.md](04-PREPARATION-VIEW.md) | Preparation screen: sets, Skills, sequencing, export |
| [05-AUTO-PERFORMANCE-VIEW.md](05-AUTO-PERFORMANCE-VIEW.md) | Auto Performance: queue, auto-advance, insights |
| [06-PLAYER.md](06-PLAYER.md) | Mini/Full player, waveform, playhead, hot cues, grid, beat jump |
| [07-SETTINGS.md](07-SETTINGS.md) | Settings window categories and controls |
| [08-DIALOGS-AND-PATTERNS.md](08-DIALOGS-AND-PATTERNS.md) | Modals, toasts, command palette, context menus, empty/error states |
| [09-COMPONENTS.md](09-COMPONENTS.md) | Component inventory and behaviors |
| [10-ACCESSIBILITY-AND-KEYBOARD.md](10-ACCESSIBILITY-AND-KEYBOARD.md) | A11y, shortcuts, focus |
| [11-IMPLEMENTATION-CHECKLIST.md](11-IMPLEMENTATION-CHECKLIST.md) | Build order and acceptance checks |

---

## Quick principles

1. **Prep, not performance** — preview player only; no dual-deck mixer UI  
2. **Density ~85%** — professional desktop, not consumer streaming  
3. **Flexible layout** — resizable/collapsible docks like Ableton; workspaces like Adobe  
4. **Reversible actions** — Undo on bulk tags, cues, Skills  
5. **Local-first** — UI never implies cloud analysis of audio  

---

## Related product docs

- Canonical product: [`../product/CANONICAL_DOCUMENTATION.md`](../product/CANONICAL_DOCUMENTATION.md)  
- Architecture: [`../architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md)  
- Skills: [`../architecture/SKILLS_SYSTEM.md`](../architecture/SKILLS_SYSTEM.md)  
- Consolidated context: [`../context/PROJECT_CONTEXT.md`](../context/PROJECT_CONTEXT.md)  
