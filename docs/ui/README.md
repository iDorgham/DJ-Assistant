# DJ Assistant — UI/UX Documentation

**Version:** 1.3  
**Status:** Canonical for design & implementation  
**Date:** 2026-10-19  
**Design language:** Adobe precision × Ableton flexibility × 2026 pro desktop  

**Related:** Master narrative [`../UI_UX_PLAYER_AND_LAYOUT_SPEC.md`](../UI_UX_PLAYER_AND_LAYOUT_SPEC.md) (v1.9+) — Library tabs, Mix Suggestions, per-view menus, Traktor-style dual waveform, 5-star rating, key 1A–12B / 1m·1d

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
| [04-PREPARATION-VIEW.md](04-PREPARATION-VIEW.md) | Sets, Skills, sequencing, export, Gig Ready |
| [05-AUTO-PERFORMANCE-VIEW.md](05-AUTO-PERFORMANCE-VIEW.md) | Auto queue, insights (validation only) |
| [06-PLAYER.md](06-PLAYER.md) | Mini/Full, waveform, playhead, cues, grid |
| [07-SETTINGS.md](07-SETTINGS.md) | Settings categories |
| [08-DIALOGS-AND-PATTERNS.md](08-DIALOGS-AND-PATTERNS.md) | Modals, toasts, palette, empty/error |
| [09-COMPONENTS.md](09-COMPONENTS.md) | Component inventory + icons |
| [10-ACCESSIBILITY-AND-KEYBOARD.md](10-ACCESSIBILITY-AND-KEYBOARD.md) | A11y + shortcuts |
| [11-IMPLEMENTATION-CHECKLIST.md](11-IMPLEMENTATION-CHECKLIST.md) | Build phases + acceptance |
| [12-WIREFRAMES-AND-FLEXIBILITY.md](12-WIREFRAMES-AND-FLEXIBILITY.md) | **Screen wireframes + resizable docks** |
| [13-REMEDIATION-STATUS.md](13-REMEDIATION-STATUS.md) | 2026-10-19 doc-vs-code remediation: applied vs. remaining |

---

## Three application views

```
[ Library ]           → manage collection, tags, analysis
[ Preparation ]       → playlists, sets, cues, Skills, export
[ Auto Performance ]  → auto-play set in order to validate flow
```

Shared shell: menus · header · options bar · left nav · **flexible docks** · player Mini/Full.

---

## Flexibility (Ableton-style)

- Resizable left nav, right inspector/Skills/insights, player height  
- Collapse to icon rail or hide  
- Named workspaces: Library · Prepare · Validate · Custom save  
- Details: [12-WIREFRAMES-AND-FLEXIBILITY.md](12-WIREFRAMES-AND-FLEXIBILITY.md)

---

## Implementation entry points

1. Tokens + shell → [01](01-DESIGN-SYSTEM.md) + [02](02-SHELL-AND-NAVIGATION.md)  
2. Wireframes → [12](12-WIREFRAMES-AND-FLEXIBILITY.md)  
3. Checklist → [11](11-IMPLEMENTATION-CHECKLIST.md)  
