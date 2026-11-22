# DJ Assistant — UI/UX Documentation

**Version:** 1.5  
**Status:** Canonical for design & implementation  
**Date:** 2026-11-22 (folder consolidated: `docs/ui/` + `docs/ui-ux/` + v1 design rules + v1.9 narrative)  
**Design language:** Adobe precision × Ableton flexibility × 2026 pro desktop  

**Related:** Reference narrative [`reference/APP_VIEWS_PLAYER_LAYOUT_SPEC_v1.9.md`](reference/APP_VIEWS_PLAYER_LAYOUT_SPEC_v1.9.md) (v1.9; background, not authority — see precedence below) — Library tabs, Mix Suggestions, per-view menus, Traktor-style dual waveform, 5-star rating, key 1A–12B / 1m·1d

---

## Product positioning (UI must reflect)

| Is | Is not |
|----|--------|
| Music library management | Live DJ performance software |
| Playlist creation | Dual-deck mixer / EQ / FX |
| Set mix preparation + export | Replacement for rekordbox / Serato / CDJs |
| Preview player for analysis & validation | Cloud analysis of raw audio |

---

## Document map

| Doc | Contents |
|-----|----------|
| [00-OVERVIEW.md](00-OVERVIEW.md) | Principles, IA, journeys, personas |
| [01-DESIGN-SYSTEM.md](01-DESIGN-SYSTEM.md) | Tokens: color, type, space, icons, motion |
| [02-SHELL-AND-NAVIGATION.md](02-SHELL-AND-NAVIGATION.md) | Menus, header, options bar, nav, workspaces |
| [03-LIBRARY-VIEW.md](03-LIBRARY-VIEW.md) | Table, search, filters, columns, harmonic keys |
| [04-PREPARATION-VIEW.md](04-PREPARATION-VIEW.md) | Superseded legacy Preparation-view spec; not v1 navigation |
| [05-AUTO-PERFORMANCE-VIEW.md](05-AUTO-PERFORMANCE-VIEW.md) | Superseded legacy Auto Performance spec; not a v1 view |
| [06-PLAYER.md](06-PLAYER.md) | Functional player reference: transport, waveform, cues, grid |
| [06A-PLAYER-PRESENTATIONS.md](06A-PLAYER-PRESENTATIONS.md) | **Three presentations, full-player Player view, EQ8 drawer, playlist, bar counter** |
| [07-SETTINGS.md](07-SETTINGS.md) | Settings categories |
| [08-DIALOGS-AND-PATTERNS.md](08-DIALOGS-AND-PATTERNS.md) | Modals, toasts, palette, empty/error |
| [09-COMPONENTS.md](09-COMPONENTS.md) | Component inventory + icons |
| [10-ACCESSIBILITY-AND-KEYBOARD.md](10-ACCESSIBILITY-AND-KEYBOARD.md) | A11y + shortcuts |
| [11-IMPLEMENTATION-CHECKLIST.md](11-IMPLEMENTATION-CHECKLIST.md) | Build phases + acceptance |
| [12-WIREFRAMES-AND-FLEXIBILITY.md](12-WIREFRAMES-AND-FLEXIBILITY.md) | **Screen wireframes + resizable docks** |
| ~~13~~ | Moved to [audits/2026-10-19-ui-remediation-status.md](../audits/2026-10-19-ui-remediation-status.md) (a dated record, not spec) |
| [14-LIBRARY-TABLE-UPGRADES.md](14-LIBRARY-TABLE-UPGRADES.md) | **Proposal** - density, waveform column, track color, column filters, Table/List/Grid views, Tag Manager |

---

## Folder layout and precedence

| Folder | Contents | Authority |
|---|---|---|
| [`guidelines/`](guidelines/) | v1 UI/UX rules and copy/microcopy (locked with the v1 plan) | **1 — rules.** Nothing below may contradict them. |
| `00`–`14` (this folder) | Design tokens, shell, views, player, settings, dialogs, components, a11y, checklist | **2 — the spec.** `01-DESIGN-SYSTEM.md` owns tokens and components. |
| [`wireframes/`](wireframes/) | Per-screen wireframes | 2 (illustrates the spec) |
| [`reference/`](reference/) | v1.9 narrative spec; candidate icon images | **3 — background.** Use for intent; the numbered spec wins on conflict. |
| [`archive/`](archive/) | Superseded Phase 0 set and the v1.7 player proposal | **4 — history only.** |

Open UI work from the 2026-11-22 audit: [UI simplification plan](../plans/ui-simplification-2026-11.md)
(tasks TU.1–TU.16 in [`sdd/04-TASKS.md`](../sdd/04-TASKS.md)).

---

## Approved v1 navigation

The locked six-tab navigation is documented in the
[product information architecture](../product/information-architecture.md).
Preparation and Auto Performance are legacy design specs, not separate v1 views.
Set Score lives inside Playlists and uses suggestion cards with Why and Confidence.

Shared shell: menus · header · options bar · left nav · **flexible docks** · player Mini/Full + Player view.

---

## Flexibility (Ableton-style)

- Resizable left nav, right inspector/Skills/insights, player height  
- Collapse to icon rail or hide  
- Named workspaces (Library · Prepare · Validate · Custom save) and the custom menu
  bar are **post-v1** (audit U-28, TU.12)  
- Details: [12-WIREFRAMES-AND-FLEXIBILITY.md](12-WIREFRAMES-AND-FLEXIBILITY.md)

---

## Implementation entry points

1. Tokens + shell → [01](01-DESIGN-SYSTEM.md) + [02](02-SHELL-AND-NAVIGATION.md)  
2. Wireframes → [12](12-WIREFRAMES-AND-FLEXIBILITY.md)  
3. Checklist → [11](11-IMPLEMENTATION-CHECKLIST.md)  
