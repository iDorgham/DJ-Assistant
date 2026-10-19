# 10 — Accessibility & Keyboard

**Version:** 1.0 · **Date:** 2026-10-19

---

## 1. Accessibility baseline

- WCAG AA contrast for text and essential controls  
- Visible focus rings on all interactive elements  
- `prefers-reduced-motion` honored (instant/fade only)  
- Icon-only controls have an accessible name (`aria-label`, `aria-labelledby`, or a visible label); tooltips are supplemental, never the only name  
- Transport and hot cues announced reasonably for screen readers  
- High-contrast playhead option in Appearance  
- Do not rely on color alone for key compatibility (pill shape + text)  

---

## 2. Global shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+1` | Library view |
| `Ctrl/Cmd+2` | Preparation view |
| `Ctrl/Cmd+3` | Auto Performance view |
| `Ctrl/Cmd+K` | Command palette |
| `Ctrl/Cmd+F` or `/` | Focus search |
| `Ctrl/Cmd+,` | Settings |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` | Redo |
| `Space` | Play/Pause (player focused) |
| `Esc` | Close overlay / clear search |

---

## 3. Player-focused shortcuts

| Shortcut | Action |
|----------|--------|
| `1`–`8` | Hot cues A–H |
| `←` `→` | Nudge playhead (beat/bar per snap) |
| `Home` / `End` | Start / end of track |
| `C` | Cue (temporary) |

---

## 4. Library shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+A` | Select all (in table) |
| `Delete` / `Backspace` | Remove from playlist/set (not delete file) per context |
| `Enter` | Load selected into player |

Exact bindings editable in Settings → Keyboard; conflicts detected.

---

## 5. Focus order

1. Header / view switcher  
2. Options bar  
3. Left nav  
4. Main canvas (table or set list)  
5. Player controls  
6. Overlays trap focus until closed  

---

## 6. Acceptance

- All primary flows operable by keyboard  
- Focus never lost when closing modals  
- Reduced motion disables non-essential animation  
- Screen reader can identify play/pause and cue buttons  
