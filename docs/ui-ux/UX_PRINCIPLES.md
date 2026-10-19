# DJ Assistant — UX Principles

**Status:** Living — 2026-10-14
**Companions:** [Design System](./DESIGN_SYSTEM.md) · [Screens & Flows](./SCREENS_AND_FLOWS.md) · [Accessibility](./ACCESSIBILITY.md)
**Source of truth:** [Canonical Documentation](../product/CANONICAL_DOCUMENTATION.md) §2, §7, §8

> **Superseded (2026-10-19):** current UI/UX specs live in [`docs/ui/`](../ui/README.md).
> This document is kept as a historical reference for the Phase 0 UI.

This document explains **who we design for, what job the interface does, and the rules
every screen must follow.** It is the "why" behind the visual system in
[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

---

## 1. Who we design for

| Persona | Context | What they feel | What the UI must do |
|---------|---------|----------------|---------------------|
| **Club / festival DJ** | Preps several sets a week, large library | "I don't have three hours for this." | Be fast, batch-friendly, and trustworthy at volume |
| **Mobile / wedding DJ** | Prepare anywhere, often on battery | "It has to just work." | Work offline, no surprises, resilient to messy files |
| **Rising DJ** | Wants pro prep without years of tagging | "I don't know the theory." | Explain choices and offer sane defaults |
| **B2B pair** | Two libraries, one shared set | "Sending a USB is painful." | Share structure without moving audio; keep both in sync |

**Jobs to be done:** *"Given my messy library, give me a clean, analyzed, cued, ordered,
exportable set for tomorrow's gig — in minutes, without risking my files."*

---

## 2. The prep loop

Every design decision serves one loop. The UI is organized around it, not around features.

```
  Import ──► Analyze ──► Cue ──► Clean ──► Build ──► Export
     │           │         │        │        │         │
  scan &      BPM/key/   hot &    tag      energy    rekordbox
  dedup       structure  memory   fixes    + key     / Serato
                         cues     (undo)   order
                             ▲
                             └── Collaborate (B2B) overlays the whole loop
```

**Target:** a 40+ track library travels the whole loop in **about 15 minutes**. Any screen
that adds friction to this path is suspect; any screen that removes friction is welcome.

---

## 3. Design principles

These are constraints, not slogans. A design that violates one is expected to change.

1. **Speed is a feature.** Default to fewer clicks and background work. Long operations run
   in the background and report progress via events — never block the UI on a spinner.
2. **The DJ is in control.** Every bulk or AI mutation is previewable and reversible.
   Nothing destructive happens silently. "Undo" is a first-class affordance, not a hidden one.
3. **Local-first is visible.** The interface states that analysis is local, offline works,
   and source files are never modified — because trust is part of the product.
4. **Show provenance.** AI-generated cues and automated changes are visibly marked as such.
   Confidence is surfaced, not hidden.
5. **Density with clarity.** Professional tools are information-dense. We earn the density
   with strong hierarchy, restrained colour, and consistent alignment — not decoration.
6. **Progressive disclosure.** Defaults are sensible for the newcomer; depth exists for the
   expert but stays out of the way until asked for.
7. **No dead ends.** Every empty, loading, and error state tells the user what is happening
   and what they can do next.

---

## 4. Information architecture

The mental model is the prep loop. Navigation mirrors it, not a database schema.

- **Library** — the home base: scan, browse, search, inspect a track.
- **Analysis** — a background capability surfaced *in* the library (status, progress,
  per-track confidence), not a separate destination the user must visit.
- **Cues** — per-track editing, opened from a track.
- **Cleanup** — bulk tag operations over a selection, preview-first.
- **Set Builder** — the workstation: energy curve, sequence, transitions.
- **Export** — the exit: rekordbox XML, Serato crate, USB pack; plus a **post-MVP**
  metadata-only Spotify playlist export.
- **Skills / Gig Ready** — cross-cutting controls, reachable from the top bar.
- **Collaboration** — an overlay on shared sets, not a separate product area.

See [SCREENS_AND_FLOWS.md](./SCREENS_AND_FLOWS.md) §6 for the navigation map.

---

## 5. Interaction patterns

Rules that recur across screens. Follow them unless a screen documents an explicit exception.

### 5.1 Scan-first onboarding

The first meaningful action is choosing a folder. Until there is a library, the primary
call to action is unambiguous ("Scan Music Folder"), and the empty state explains exactly
what will happen (supported formats, nothing modified).

### 5.2 Background jobs with live progress

Scanning and analysis run off the UI thread. The UI subscribes to progress events and shows:

- a determinate bar when a total is known, indeterminate when it is not;
- the current item (path / track) so slow folders feel alive;
- counts (`scanned / total`) as monospace text for at-a-glance reading;
- a completion summary (imported / duplicates / errors) that does not require a modal.

### 5.3 Preview → apply → undo

Any operation that changes library data in bulk (tag cleanup, batch cue generation,
automation) follows the same three-step shape:

```
Preview (what will change, as a diff)  ──►  Apply (explicit confirm)  ──►  Undo (logged)
```

Folder imports are an explicit exception; user-directed bulk edits of existing data require a preview. High-impact actions require
explicit confirmation; low-impact ones still leave an undo trail.

### 5.4 Surface confidence, never fake certainty

BPM and beat grid are trustworthy. Key is usually right. Energy/mood are *not* auto-scored.
Where confidence is low, mark the track `needs_review` and let the DJ correct it; a manual
correction permanently overrides the AI value (and is recorded).

### 5.5 Deterministic sequencing, explained

Set building is deterministic (Beam Search). Natural language is used only to *understand
intent*. The UI must therefore always be able to answer "why is this track here?" with a
plain-language transition explanation and a risk score.

### 5.6 Keyboard-first for power users

Dense professional tools reward muscle memory. Core navigation (search focus, list
navigation, jump to track, run action) is keyboard-accessible. See
[ACCESSIBILITY.md](./ACCESSIBILITY.md) §3.

### 5.7 Event-driven feedback

The backend emits commands/events (see
[API Contracts](../architecture/API_CONTRACTS.md)); the UI reflects them. Status is always
visible in the status bar: idle, scanning, analyzing, exporting, or error.

---

## 6. State taxonomy

Every data-bearing view must define four states. Undefined states become bugs.

| State | Rule |
|-------|------|
| **Empty** | Explain the value and the next action; never a blank panel. |
| **Loading** | Show structure (skeletons or a spinner with context), not a blank flash. |
| **Error** | Say what failed, whether anything was changed (usually nothing), and how to recover. |
| **Populated** | Optimize for scan-ability: alignment, monospace numerics, restrained colour. |

---

## 7. Voice and tone

The interface speaks like a competent assistant engineer, not a hype-driven app.

- **Concise and specific.** "Imported: 94 · Duplicates: 0 · Errors: 0" beats "Success!".
- **DJ-native vocabulary.** Use the terms in the [Glossary](../product/GLOSSARY.md):
  cue, phrase, Camelot, LUFS, BPM ramp, mix-out window — not invented synonyms.
- **Honest about limits.** "Energy is not auto-scored — tag it yourself" is better than a
  confident but meaningless number.
- **Calm about failure.** Unsupported or corrupt files are "skipped", listed, and never
  framed as a catastrophe.

---

## 8. Non-negotiables translated to UI

| Product contract | UI consequence |
|------------------|----------------|
| Local-first | State offline capability in the UI; never imply upload. |
| Non-destructive | Show "Source files are never modified"; reflect it in copy and tooltips. |
| DJ in control | Preview + confirm + undo for every mutation; visible kill-switch for Skills. |
| Hybrid intelligence | Sequencing is deterministic; LLM output is presented as *suggestion/explanation*. |
| Reversibility | Every bulk action writes an undo record surfaced in history. |

---

## 9. UX success measures

| Measure | Direction |
|---------|-----------|
| Time from launch to a populated library | Short — scan starts in one click |
| Time to complete the prep loop for 40 tracks | Toward ≤ 15 minutes |
| Cue acceptance without manual edit | > 90% in beta |
| Bulk actions with a working undo | 100% |
| Destructive surprises | Zero |
| Correlation between low confidence and actual corrections | Tracked, improves over time |

---

*UX principles are stable; implementations evolve. If a principle needs to change, change it
here first and record why — then update the screens that depend on it.*
