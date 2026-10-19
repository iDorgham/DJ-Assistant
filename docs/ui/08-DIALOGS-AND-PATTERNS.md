# 08 — Dialogs & UI Patterns

**Version:** 1.0 · **Date:** 2026-10-19

---

## 1. Overlay types

| Type | Use | Behavior |
|------|-----|----------|
| Modal dialog | Confirm destroy, export options, review lists | Center, backdrop, focus trap, Esc cancels |
| Sheet / drawer | Optional filters, Skill detail, batch log | Edge slide; prefer non-blocking |
| Popover | Columns, layout, volume, small menus | Anchor to control; click-outside closes |
| Toast | Success, Undo, soft errors | Auto-dismiss; action button |
| Command palette | Jump / run / search | `Ctrl/Cmd+K`, fuzzy, keyboard |
| Context menu | Right-click track, column, cue | Icons + shortcuts |

---

## 2. Modal pattern

```
Title (verb)
Body text (one short paragraph or list)
[ Secondary ]              [ Primary ]
```

- Primary right (or OS convention)  
- Destructive primary uses `danger` color  
- Labels always, not icon-only OK/Cancel  
- Progress modals: determinate bar + count + Cancel  

---

## 3. Toast pattern

- Bottom or top stack  
- Message + optional **Undo**  
- Auto-dismiss 4–6s; pause on hover  
- Used after: bulk tag, cue generate, reorder, Skill apply  

---

## 4. Command palette

- Placeholder: “Search tracks, sets, Skills, settings…”  
- Groups: Views · Sets · Skills · Settings · Recent  
- Enter runs; Esc closes  
- Show shortcut hints on the right  

---

## 5. Empty states

| Context | Content |
|---------|---------|
| Empty library | Icon + “Add music folder” CTA |
| No search results | “No tracks match” + Clear filters |
| Empty set | “Drag tracks from Library” |
| Player empty | “Select a track to preview” |

One sentence + one primary action. No long tutorials.

---

## 6. Error states

- What failed  
- What the user can do (Retry / Skip / Open folder / Settings)  
- Prefer inline or toast; modal only if blocking  

---

## 7. Onboarding (first run)

Max 2–3 steps:

1. Add music folder  
2. See analysis start  
3. Open Preparation (optional)  

Skip always available. Optional demo set for evaluation.

---

## 8. Export preview

Before writing files:

- Destination path  
- Format  
- File/tree list of what will be written  
- Confirm / Cancel  

Non-destructive to source audio.

---

## 9. Visual polish

- Padding 16–20px in dialogs  
- Radius 8px overlays  
- L3 surface + soft shadow  
- One modal at a time; toasts above  
- Desktop-first (no mobile-only sheets as primary)  
