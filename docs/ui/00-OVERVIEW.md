# 00 — UI/UX Overview

**Version:** 1.0 · **Date:** 2026-10-19

---

## 1. Product UI statement

> DJ Assistant looks like a 2026 Adobe-class studio tool, flexes like Ableton, and stays ruthlessly focused on library management, playlist creation, and set preparation for professional DJs.

---

## 2. Design principles

| # | Principle | Implication |
|---|-----------|-------------|
| 1 | Prep tool, not performance deck | No dual decks, EQ racks, or live mixer chrome |
| 2 | Professional density (~85%) | 12–13px UI, 28–32px rows, tight gaps |
| 3 | Maximize track workspace | Mini player by default in Library; collapsible chrome |
| 4 | Adobe precision | Workspaces, options bar, docked panels, numeric scrub |
| 5 | Ableton flexibility | Resizable splits, collapse to icon strip, save layout |
| 6 | Reversibility | Every bulk Skill/tag/cue action offers Undo |
| 7 | Keyboard-first | Shortcuts for views, transport, cues, search, palette |
| 8 | Calm confidence | Status visible but quiet; no gamification or social |

---

## 3. Information architecture

```
DJ Assistant
├── Views (header switcher)
│   ├── Library          → manage collection
│   ├── Preparation      → build sets / playlists / cues
│   └── Auto Performance → validate set in order
├── Shell
│   ├── App menu bar
│   ├── Header + options bar
│   ├── Left nav (sources)
│   ├── Main canvas (view-specific)
│   └── Player dock (Mini / Full / Hidden)
├── Global overlays
│   ├── Settings window
│   ├── Command palette (⌘/Ctrl+K)
│   ├── Dialogs / sheets / toasts
│   └── Context menus
└── Data contexts
    ├── Library tracks
    ├── Playlists & sets
    ├── Browser folders
    └── Flash / USB
```

---

## 4. Primary user journeys

### 4.1 First-time setup

1. Launch → short onboarding (skippable)  
2. Add music folder  
3. Analysis starts locally  
4. Land on Library with Mini player  

### 4.2 Weekly gig prep (~15 min target)

1. **Library** — import new tracks, run analyze, Smart Tag Cleanup  
2. **Preparation** — create set, drag tracks, run Cue Master / Set Architect  
3. Fix grid/cues on Full player waveform  
4. **Auto Performance** — listen through, flag issues  
5. Return to Preparation if needed → **Export / Gig Ready**  

### 4.3 Quick tag fix

1. Library → search / filter  
2. Multi-select → Tag Surgeon or inline edit  
3. Undo toast if needed  

### 4.4 USB export

1. Preparation or Library selection  
2. Export… → format + destination  
3. Export preview tree → confirm write  

---

## 5. Personas (UI implications)

| Persona | UI emphasis |
|---------|-------------|
| Club / festival DJ | Fast set build, harmonic colors, Gig Ready checklist |
| Mobile / wedding DJ | Clear library filters, USB export, templates |
| Rising DJ | Onboarding, Skills explanations, calm defaults |
| B2B pair | Set sharing entry points (cloud optional); no audio upload required for core |

---

## 6. Platform

- **Desktop-first:** Tauri v2 (Windows + macOS; Linux best-effort)  
- Native window controls; OS menu roles on macOS  
- No mobile layout requirement for MVP  

---

## 7. Success metrics (UI)

- Library shows ≥12–15 track rows at 1440×900 with Mini player  
- Preparation supports real cue/grid work with Full player still showing set list  
- Auto Performance understood as “validate set,” not “perform live”  
- New user reaches first analyzed track without docs in &lt;5 minutes  
- Professional DJs rate UI as “serious tool,” not “consumer app”  
