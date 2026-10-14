# Wireframe — Set Builder (06)

**Phase:** 3 · 📋 Planned
**See also:** [Screens & Flows §4.5](../SCREENS_AND_FLOWS.md) · [Canonical §7](../../product/CANONICAL_DOCUMENTATION.md)

The workstation: a constraint profile, an editable energy curve, the ordered sequence with
a dual-waveform transition inspector, and alternative swaps. Sequencing is **deterministic**
(Beam Search) and always explainable.

---

## Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◉ DJ Assistant  [ Phase 3 · Set Builder ]        [ Gig Ready ]  [ Export ]  [ Skills ]      │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  {1} SET PROFILE  "Arena Club — Peak Hour"       Target 120m · Key ramp · Energy high        │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  {2} ENERGY CURVE CANVAS                          ⟨ drag nodes to re-optimise ⟩              │
│  10 ┤                                              ╭───────╮                                 │
│   8 ┤                                       ╭──────╯       ╰──────╮                          │
│   6 ┤                     ╭─────────────────╯                     ╰───                       │
│   4 ┤   ╭─────────────────╯                                                                  │
│   2 ┤ ──╯                                                                                    │
│   0 ┴──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬────                         │
│      00:00  00:15  00:30  00:45  01:00  01:15  01:30  01:45  02:00                           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  {3} SET SEQUENCE & DUAL-WAVEFORM TRANSITION OVERLAY                                         │
│                                                                                              │
│  [04]  Deep Horizon       124 BPM · 8A                                                       │
│  OUT ► |||||||||||||||||||||||||||||||||·····················  [32 bars out]                 │
│  IN  ► ·················||||||||||||||||||||||||||||||||||||  [32 bars in]                   │
│                                                                                              │
│  [05]  Solar Wind         125 BPM · 8B         Score 98% · Risk Low                          │
│  {4}    Alternatives:  [ Starlight  98% ]  [ Eclipse  94% ]  [ Swap manually ]               │
│                                                                                              │
│  [06]  …                                                                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  {5} [ Lock & Fill ]  [ Make safer ]  [ More adventurous ]  [ Save template ]       [ Build ]│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — constraint panel (collapsed state)

```
┌ Set constraints ────────────────────────────────────────────────────┐
│  {6} Duration  [ 120m ]     Start BPM  [ 123 ]   Peak BPM  [ 128 ]  │
│      Energy    (•) high      ( ) medium   ( ) journey               │
│      Genre     [ melodic techno × ]   Mood  [ dark × ]              │
│      Exclude   [ track, artist, tag… ]                              │
│      Lock      [ Deep Horizon ] [ Midnight Drive ]  {7}             │
├─────────────────────────────────────────────────────────────────────┤
│  {8} Prompt:  "2h dark melodic techno, start 123, peak ~80 min" ⏎   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Set profile | Active set name + summary of the target (duration, key, energy) |
| {2} | Energy curve canvas | Multi-point editing; dragging a node triggers re-optimisation |
| {3} | Sequence + transition overlay | Ordered positions with outgoing/incoming waveform alignment |
| {4} | Alternatives | Top-3 swaps per slot that respect global constraints |
| {5} | Controls | Lock & Fill, safer/adventurous re-optimisation, template save, Build |
| {6} | Constraint fields | Duration, BPM ramp, energy shape, genre, mood, excludes |
| {7} | Locked tracks | Hero tracks pinned in place; the system fills the rest |
| {8} | Natural-language prompt | LLM parses **intent only** → structured constraints (never the order) |

### Transition readout

| Item | Meaning |
|------|---------|
| `Score 98%` | Weighted transition score `S(A,B)` (key + BPM + energy + semantic) |
| `Risk Low` | Low/Medium/High flag from key jump, BPM jump, and phrase alignment |
| `[32 bars out]` / `[32 bars in]` | Overlap windows rendered on the dual waveform |
| `Why?` _(expand)_ | Plain-language explanation of the transition |

---

## States

| State | Behaviour |
|-------|-----------|
| **Empty** | No set yet; constraint panel + **Build** are the focus |
| **Building** | Deterministic optimisation runs; a progress indicator, UI stays responsive |
| **Built** | Energy canvas + sequence populated; transitions scored |
| **Editing** | Dragging a node / swapping a track re-optimises; undo available |
| **Infeasible** | "No valid set for these constraints" with the conflicting constraint named |

---

## Interactions

- **Build** → Beam Search over the candidate graph respecting locks, excludes, duration, curve.
- **Drag energy node** → live re-calculation of the order.
- **Swap** (alternative or manual) → replaces a slot without breaking global constraints.
- **Lock & Fill** → pin hero tracks, fill the remainder optimally.
- **Why?** → expand a transition explanation generated from the deterministic scores.
- **Save template** → stores energy curve + BPM ramp + genre bias for reuse.

---

## Accessibility obligations

- The energy canvas has a table-based text alternative (time → target energy) and keyboard
  node editing.
- Sequence rows are focusable; swap actions are reachable by keyboard.
- Risk (`Low/Medium/High`) is text, not colour alone; scores are numeric too.
- Re-optimisation announces completion without stealing focus.

---

## Notes

- **The LLM never chooses the order.** It only extracts constraints and writes explanations;
  the sequence is always produced by deterministic optimisation.
- Every automated choice is explainable and reversible; nothing is hidden.
