# Wireframe — Tag Cleanup (05)

**Phase:** 2 · 📋 Planned
**See also:** [Screens & Flows §4.4](../12-SCREENS-AND-FLOWS.md) · [UX Principles §5.3](../00-OVERVIEW.md)

Bulk, **preview-first** normalisation of messy metadata. Nothing is modified until the DJ
presses Apply, and every apply writes an undo record.

---

## Wireframe — preview

```
┌ Tag Cleanup ─────────────────────────────────────────────────────────────────────────────┐
│  {1} 23 changes across 94 tracks         [ Select all ]   [ Select none ]                │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  {2}    Before                      →    After                     Count    Conf.        │
│──────────────────────────────────────────────────────────────────────────────────────────│
│  [x]   "DAFT PUNK"                  →    "Daft Punk"               14       ▇▇▇          │
│  [x]   "Daft Punks"                 →    "Daft Punk"               3        ▇▇▁          │
│  [x]   "daft punk "                 →    "Daft Punk"               6        ▇▇▇          │
│  [ ]   "The Weeknd" / "Weeknd"      →    (leave as-is)             —        ▇▁▁  {3}     │
│  [x]   "Martin Garrix" / "M.Garrix" →    "Martin Garrix"          2        ▇▇▁           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  {4} [x] Save as alias so future imports normalise automatically                         │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  {5} [ Cancel ]         [ Apply 20 changes ]                                             │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — applied (confirmation + undo)

```
┌ Tag Cleanup ─────────────────────────────────────────────────────────────────────────────┐
│  {6} ✓ Applied 20 changes across 31 tracks                                               │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  Aliases saved: 2  ·  Undo record written  ·  Source files untouched                     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  {7} [ Undo ]   [ Close ]                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Summary bar | Count of proposed changes + bulk selection helpers |
| {2} | Diff rows | `Before → After` with per-row checkbox, occurrence count, confidence meter |
| {3} | Low-confidence row | Left unchecked by default; the DJ opts in |
| {4} | Alias toggle | Persists the mapping so future imports normalise automatically |
| {5} | Actions | **Cancel** (no change) and **Apply N changes** (explicit, counted) |
| {6} | Result summary | Confirms what changed and how many tracks were affected |
| {7} | Undo | Reverts the whole batch via the recorded undo entry |

### Confidence meter

`▇▇▇` high (safe default-on) · `▇▇▁` medium · `▇▁▁` low (default-off, needs a human). The
meter is always paired with the checkbox state.

---

## States

| State | Behaviour |
|-------|-----------|
| **No issues** | "Nothing to clean" empty state; no diff rows |
| **Preview** | Diff rows with default selections; nothing written yet |
| **Applying** | Brief progress; controls disabled |
| **Applied** | Result summary + Undo available |
| **Undone** | Reverted state; the undo entry is marked used |

---

## Interactions

- **Select all / none** toggles every diff row.
- **Toggle a row** includes/excludes that change from the batch.
- **Save as alias** teaches future imports; aliases live in the local `aliases` store.
- **Apply** writes the batch inside a transaction and records the undo entry.
- **Undo** reverts the batch; the action is itself logged.

---

## Accessibility obligations

- Each diff row is a labelled checkbox; the "before → after" is read as one unit.
- The confidence meter has a text equivalent; low-confidence rows are not merely colour-coded.
- Focus returns to the triggering selection after apply/undo.
- Apply/Cancel are reachable by keyboard; `Esc` cancels without applying.

---

## Notes

- This is the canonical **preview → apply → undo** pattern; keep it identical for batch cue
  generation and automation.
- Tag cleanup touches the **local database only** — never the source files.
