# Wireframe — Gig Ready / Prep Auditor (09)

**Phase:** 4 · 📋 Planned
**See also:** [Screens & Flows §4.8](../SCREENS_AND_FLOWS.md) · [Glossary](../../product/GLOSSARY.md)

One-click pre-gig workflow: health check → analyze → optional cleanup → cues → Prep Auditor
→ export/USB pack. Presented as a checklist with clear next actions for anything that fails.

---

## Wireframe — running

```
┌ Gig Ready ─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  {1} Preparing "Arena Club — Peak Hour"                       Step 3 of 6 · generating cues…               │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {2} ✓ Health check          library readable · 0 corrupt files                                            │
│      ✓ Analyze              94 / 94 tracks analyzed                                                        │
│      ◐ Generate cues        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░   31 / 40 tracks                              │
│      ○ Tag cleanup          (optional, skipped)                                                            │
│      ○ Prep Auditor         pending                                                                        │
│      ○ Export / USB pack    pending                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {3} [ Run tag cleanup too ]                        [ Cancel ]                                             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — ready (with a fix list)

```
┌ Gig Ready ─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  {4} ▲ Almost ready                        1 blocker · 2 warnings                                          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {5}  4 tracks unanalyzed                    [ Analyze now ]                                               │
│       ! 2 tracks missing cues                [ Generate cues ]                                             │
│       ! Energy curve has a dip at 00:45      [ Smooth curve ]                                              │
│       ✓ All referenced tracks exist locally                                                                │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {6} [ Export / USB pack ]                       [ Fix all ]   [ Close ]                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — ready (clean)

```
┌ Gig Ready ───────────────────────────────────────────────────────────────────────────────────┐
│  {7} ✓ You're ready                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│      ✓ 94 tracks analyzed   ✓ cues on all tracks   ✓ tags clean   ✓ exports produced         │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Open export folder ]   [ Close ]                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Step header | Current step + count; the sequence is fixed and visible |
| {2} | Checklist | Each step shows state (done / running / pending) and a one-line result |
| {3} | Optional step | Tag cleanup offered but skippable |
| {4} | Readiness verdict | `✓ ready`, `▲ almost ready`, or `✕ not ready` with counts |
| {5} | Actionable items | Each issue names the fix and deep-links to it |
| {6} | Exit actions | Export/USB pack, or fix everything, or close |
| {7} | Success state | Confirms readiness with a one-line checklist |

### Workflow steps

1. **Health check** — library readable, no corrupt files.
2. **Analyze** — all tracks analyzed (skips fresh via `analysis_version`).
3. **Tag cleanup** — optional bulk normalisation.
4. **Generate cues** — 8 hot + memory cues (optional if already cued).
5. **Prep Auditor** — readiness checklist (unanalyzed, missing cues, tag issues, energy gaps).
6. **Export / USB pack** — produce performance files.

---

## States

| State | Behaviour |
|-------|-----------|
| **Idle** | Not started; the primary action is **Gig Ready** |
| **Running** | Steps advance with inline progress; UI stays responsive |
| **Almost ready** | Fix list with deep links; nothing is blocking silently |
| **Ready** | Clean confirmation + reveal export folder |
| **Failed** | Names the failing step and why; earlier completed steps are retained |

---

## Interactions

- **Run tag cleanup too** → opts the optional step in before continuing.
- **Analyze now / Generate cues / Smooth curve** → jump to the fix for that item.
- **Fix all** → runs the remaining fixes in sequence.
- **Export / USB pack** → opens the [Export](./07-export.md) dialog with the set preloaded.

---

## Accessibility obligations

- Checklist states pair an icon **and** a label (`✓`, `!`, `◐`, `○` + text).
- Progress for the running step is announced politely.
- Each fix action is a real button in reading order, reachable by keyboard.
- The verdict ("ready / not ready") is text, never colour alone.

---

## Notes

- Gig Ready is a **convenience wrapper** over existing Skills, not a new automation engine.
- It never skips a step silently: skipped steps are shown as `skipped`, with the reason.
