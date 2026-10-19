# 04 — Preparation View

**Version:** 1.0 · **Date:** 2026-10-19

Primary job: **playlist creation and set mix preparation** — order tracks, cues, grid, Skills, sequence, export.

---

## 1. Layout

```
Header · Library [Preparation] Auto Performance
Options: Set name | Template | Skills | Export | Gig Ready
┌─ Sources ─┬─ Set track list ─────────────┬─ Inspector / Skills ─┐
│ Library   │ Reorderable rows             │ Cue / Tag / Energy   │
│ Playlists │ Harmonic / energy helpers    │ Skill cards          │
│ Sets      │                              │ Constraints          │
├───────────┴──────────────────────────────┴──────────────────────┤
│ Player Full (preferred) — waveform + overview map + cues        │
└─────────────────────────────────────────────────────────────────┘
```

Default workspace: **Prepare** · player **Full** · Skills dock open.

---

## 2. Set workspace

- Inline editable set name; dirty indicator if export state outdated  
- Rows: #, Title, Artist, BPM, Key (colored), Time, cue status  
- Drag reorder with drop gap highlight  
- Drag in from left sources (Library / Playlists)  
- Remove from set does not delete from library  
- Optional energy/key path summary above or beside list  

Same column-picker component as Library with tighter defaults.

---

## 3. Skills dock

Each Skill as a compact card:

- Name + one-line description  
- **Run** (selection or whole set)  
- Last result summary  
- **Undo** when applicable  

Skills (product): Cue Master, Tag Surgeon, Set Architect, Energy Cartographer, Harmonic Scout, Missing Track Hunter, Prep Auditor, Library Doctor — enable/disable in Settings / Tools.

Bulk Skill results: review when needed; always reversible.

---

## 4. Constraints & sequencing

- Chips for BPM range, key rules, energy curve, duration targets  
- Set Architect / Beam Search results editable in the list  
- User remains final editor — no silent irreversible reorders without Undo  

---

## 5. Player integration

- Full player default for cue and grid work  
- Dual waveform + playhead (see Player doc)  
- Hot cues A–H, grid nudge, beat jump  
- “Up Next” follows set order  

---

## 6. Export & Gig Ready

**Options bar / header primary actions:**

- **Export…** — format (rekordbox XML, Serato crate, USB pack), destination, preview tree  
- **Gig Ready** — checklist: unanalyzed, missing cues, key clashes, warnings → jump to issue  

Never modify source audio; export is non-destructive.

---

## 7. Templates

Starting structures (examples):

- Warm-up 60m  
- Peak 45m  
- B2B alternate  

Applied as initial order/energy guidance; user editable.

---

## 8. Acceptance

- Drag-reorder and cross-pane drag from Library work  
- Skills run with Undo  
- Full player usable for cue placement without losing set context  
- Export and Gig Ready reachable in one click from a valid set  
