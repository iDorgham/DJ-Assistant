# 05 — Auto Performance View

**Version:** 1.2 · **Date:** 2026-10-19  
**Full wireframes:** [12-WIREFRAMES-AND-FLEXIBILITY.md](12-WIREFRAMES-AND-FLEXIBILITY.md)

Primary job: **automated set validation** — play a prepared set in order to check flow before export.

**Not** live DJ software: no dual decks, EQ, filters, or mixer.

---

## 1. Layout

Default workspace: **Validate**. Queue vs insights split is resizable; insights collapsible.

```
┌─ Menu ──────────────────────────────────────────────────────────────┐
├─ Header: Library  Preparation [Auto Performance]                    │
├─ Options: Set ▾ | AUTO ON/OFF | Skip | Flag issue                   │
├─ Now playing + overview waveform + transport ───────────────────────┤
├─ Queue (set order) ──────────────┬─ Insights (energy · key · warns) ┤
│ ▶ current · upcoming · past      │ ←resize / collapse→              │
├──────────────────────────────────┴──────────────────────────────────┤
│ Compact / Mini player                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Behavior

- Load one prepared set from selector  
- **AUTO ON:** advance on track end (or user outro cue if defined)  
- Optional short crossfade *preview* (aesthetic only — not a mixer)  
- Pause / skip / click queue row to jump; resume AUTO from there  
- Flag issue → note + deep link back to Preparation on that track  
- Playback must use **each track’s real audio** (not a shared sample/beat)

---

## 3. Queue

- Full set order  
- Current row highlighted  
- Past tracks slightly muted  
- Same key coloring optional (Camelot / 1m·1d)  
- Compact columns: #, Title, Artist, BPM, Key, Time  

### 3.1 Auto Performance right-click context menu (queue row)

**Different from Library and Preparation.** Focused on validation flow:

```
┌─────────────────────────────────────┐
│ Play from here                      │
│ Skip to next                        │
│ ───────────────────────────────     │
│ Flag issue…                         │
│ Fix in Preparation                  │
│ ───────────────────────────────     │
│ Show in set (Preparation)           │
│ Reveal in library                   │
│ ───────────────────────────────     │
│ Copy track info                     │
└─────────────────────────────────────┘
```

- No library delete / tag bulk tools here  
- “Fix in Preparation” deep-links with the track selected  

---

## 4. Insights

- Energy curve sparkline for the set  
- Key path (sequence of keys with clash marks)  
- Warning list: missing analysis, missing cues, sharp energy drops, key clashes  
- Each warning: **Fix in Preparation** action  

---

## 5. Copy & positioning

- UI subtitle/tooltip: *“Preview your set in order — validate flow before export.”*  
- Avoid words like “live,” “deck,” “mix in real time” in this view’s chrome  

---

## 6. Acceptance

- AUTO advances correctly and can be paused/resumed  
- Queue jump works  
- Insights surface real prep problems  
- User can return to Preparation with context on a flagged track  
- Layout does not resemble a performance mixer  
