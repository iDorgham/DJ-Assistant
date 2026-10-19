# 05 — Auto Performance View

**Version:** 1.0 · **Date:** 2026-10-19

Primary job: **automated set validation** — play a prepared set in order to check flow before export.

**Not** live DJ software: no dual decks, EQ, filters, or mixer.

---

## 1. Layout

```
Header · Library  Preparation [Auto Performance]
Options: Set selector | AUTO on/off | Skip | Flag issue
┌─ Now playing (identity + transport + overview waveform) ───────────────┐
├─ Queue (set order) ────────────────────┬─ Set insights ────────────────┤
│ ▶ current                              │ Energy curve                  │
│   upcoming…                            │ Key path                      │
│   past muted                           │ Warnings → Fix in Preparation │
├────────────────────────────────────────┴───────────────────────────────┤
│ Compact player controls                                                │
└────────────────────────────────────────────────────────────────────────┘
```

Default workspace: **Validate**.

---

## 2. Behavior

- Load one prepared set from selector  
- **AUTO ON:** advance on track end (or user outro cue if defined)  
- Optional short crossfade *preview* (aesthetic only — not a mixer)  
- Pause / skip / click queue row to jump; resume AUTO from there  
- Flag issue → note + deep link back to Preparation on that track  

---

## 3. Queue

- Full set order  
- Current row highlighted  
- Past tracks slightly muted  
- Same key coloring optional  
- Compact columns: #, Title, Artist, BPM, Key, Time  

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
