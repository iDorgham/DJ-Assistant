# 00 — UI/UX Overview

**Version:** 1.2 · **Date:** 2026-10-19  
**Wireframes:** [12-WIREFRAMES-AND-FLEXIBILITY.md](12-WIREFRAMES-AND-FLEXIBILITY.md)  
**Design system:** [01-DESIGN-SYSTEM.md](01-DESIGN-SYSTEM.md) (Ableton Live 12–inspired dark palette)

---

## 1. Product UI statement

> DJ Assistant looks and feels like a 2026 professional studio tool: cool Ableton Live 12–inspired dark surfaces, Adobe-class precision, and the same modular flexibility producers expect from Live — while staying ruthlessly focused on library management, playlist creation, and set preparation.

---

## 2. Design principles

| # | Principle | Implication |
|---|-----------|-------------|
| 1 | Prep tool, not performance deck | No dual decks, EQ racks, or live mixer chrome |
| 2 | Ableton Live 12 dark palette | Cool neutral charcoal surfaces, subtle hierarchy, calm long-session readability |
| 3 | Professional density (~85%) | 12–13px UI, 28–32px rows, tight gaps |
| 4 | Maximize track workspace | Mini player by default in Library; collapsible chrome |
| 5 | Adobe precision | Workspaces, options bar, docked panels, numeric scrub |
| 6 | Ableton flexibility | Every major region resizable + collapsible; workspaces remember exact layout |
| 7 | Reversibility | Every bulk Skill/tag/cue action offers Undo |
| 8 | Keyboard-first | Shortcuts for views, transport, cues, search, palette |
| 9 | Calm confidence | Status visible but quiet; no gamification or social |

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
│   └── Player dock (Mini / Full / Hidden) + Player view
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
