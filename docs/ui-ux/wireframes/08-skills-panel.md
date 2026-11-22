# Wireframe — Skills Panel (08)

**Phase:** 3–4 · 📋 Planned
**See also:** [Skills System](../../architecture/SKILLS_SYSTEM.md) · [Screens & Flows §4.7](../12-SCREENS-AND-FLOWS.md)

A drawer listing the scoped automation Skills with per-Skill control, last-run results, and
a global kill-switch. Every mutating run is previewable and reversible.

---

## Wireframe

```
┌ Skills ────────────────────────────────────────────────────────────────────   [ ⏻ Kill switch ] ┐
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {1} Enable / disable                                                       {2} Global: ON      │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {3} Skill             What it does                        Last run        State                │
│─────────────────────────────────────────────────────────────────────────────────────────────────│
│  [x] Cue Master        Generate / refine 8 hot + memory cues  2h ago        ● success           │
│  [x] Tag Surgeon       Normalise messy artist/producer tags   1d ago        ● success           │
│  [x] Set Architect     Constraint-driven set building         3h ago        ● success           │
│  [ ] Energy Cartographer  Map energy curves on demand          never        ○ disabled          │
│  [x] Harmonic Scout    Find compatible next tracks             never        ○ idle              │
│  [x] Prep Auditor      Pre-gig readiness checklist             1h ago        ▲ warnings (2)     │
│  [x] Library Doctor    Detect duplicates / missing art         never        ○ idle              │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {4} Selected: Prep Auditor        [ Run ]  [ View last run ]  [ Undo last ]                    │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {5} Every run is logged and reversible. High-impact actions ask before applying.               │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — run result (inline)

```
┌ Cue Master — last run ─────────────────────────────────────────────────────────────────────┐
│  {6} 31 tracks cued · 0 conflicts · 2 existing user cues preserved                         │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  {7} Changes:  A–H hot cues added on 31 tracks  (+62 memory cues)                          │
│      Preview:  [ Show diff ]        Applied by: you · 2h ago                               │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Undo this run ]   [ Close ]                                                             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Enable/disable list | Per-Skill state; disabling stops it from being triggered |
| {2} | Global kill-switch | Immediately stops running Skills and disables new runs; single click, always visible |
| {3} | Skill table | Name, description, last-run time, and current state |
| {4} | Selected actions | Run / view / undo the selected Skill |
| {5} | Safety note | Restates the reversibility contract |
| {6} | Run summary | What the run did, in one line, including preserved user data |
| {7} | Change details | Diff + who applied it and when; **Undo** reverts the whole run |

### States

| State | Meaning |
|-------|---------|
| `○ idle` | Enabled, not running |
| `◐ running` | Currently executing |
| `● success` | Last run completed cleanly |
| `▲ warnings (n)` | Completed with items needing attention |
| `✕ failed` | Last run failed; error details available |
| `○ disabled` | Turned off by the user |

---

## States

| State | Behaviour |
|-------|-----------|
| **All disabled** | Kill-switch on; list greys; run actions disabled |
| **Idle** | Skills enabled, awaiting trigger |
| **Running** | Selected Skill shows `◐ running`; results stream in |
| **Complete** | Summary + diff + Undo available |
| **Failed** | Error surfaced with a retry; the library is left consistent |

---

## Interactions

- **Toggle a Skill** → enable/disable that Skill only.
- **Kill switch** → enable/disable every Skill at once.
- **Run** → execute the selected Skill; preview-first for mutating Skills.
- **View last run** → open the run result panel with the diff.
- **Undo last** → revert the most recent run via its stored undo record.

---

## Accessibility obligations

- Skill toggles are labelled switches with clear on/off text.
- The kill-switch has an unmistakable label and confirmation on re-enable.
- Run results and errors are announced; the diff is keyboard-navigable.
- State chips pair icon + label, never colour alone.

---

## Notes

- Skills are **scoped, transparent, reversible, controllable, composable, non-autonomous**.
- No Skill performs an irreversible action without explicit confirmation when risk is high.
