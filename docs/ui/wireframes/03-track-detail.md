# Wireframe — Track Detail / Inspector (03)

**Phase:** 2 · 📋 Planned (full inspector) · ✅ discovery slice shipped — see [12-discovery-enrichment](./12-discovery-enrichment.md)
**See also:** [Screens & Flows §4.2](../12-SCREENS-AND-FLOWS.md) · [Design System §7.10](../01-DESIGN-SYSTEM.md)

A right-hand drawer opened from a library row. Separates **what the file's tags say** from
**what local analysis found**, and marks the provenance of every value.

---

## Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  {1} Deep Horizon         [ Edit tags ]   [ Add to set ]   [ ✕ ]                             │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│   ▣  {2}     124 BPM · 8A (C min) · 6:12 · FLAC · 320 kbps                                   │
│   Artwork     Melodic Techno · 2024 · rated ★★★★☆                                            │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  {3} TAGS (as stored)          {4} ANALYSIS (local)                                          │
│  Title    Deep Horizon         BPM          124    ▇▇▇                                       │
│  Artist   Kael                 Key          8A     ▇▇▁                                       │
│  Album    Drift                Beat grid    120 bars                                         │
│  Genre    Melodic Techno       Phrases      intro · build · drop · outro                     │
│  Year     2024                 Vocals       ● present   ▇▇▁                                  │
│  Comment  "peak-time"          Loudness     -7.2 LUFS · TP -0.4 dB                           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  {5} CUES   A · B · C · D · E · F · G · H  (+2 memory)   [ Open in editor ]                  │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  {6} ● Indexed · analysis v1.1.8         BLAKE3 Fingerprint · Source untouched               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Drawer header | Title + primary actions + close (`✕`, also `Esc`) |
| {2} | Identity block | Artwork, key facts at a glance; numbers in mono |
| {3} | Tags column | Values read from the file; editable via **Edit tags** |
| {4} | Analysis column | Local analysis results with confidence meters; read-only except overrides |
| {5} | Cue summary | Count and slots; deep-links to the [Cue Editor](./04-cue-editor.md) |
| {6} | Provenance footer | Analysis version + the non-destructive reminder |

### Provenance markers

| Marker | Meaning |
|--------|---------|
| `AI` | Value produced by local analysis |
| `User` | Value corrected/set by the DJ (permanent override) |
| `Imported` | Value read from the file's existing tags |
| no marker | Plain stored field |

---

## States

| State | Behaviour |
|-------|-----------|
| **Unanalyzed** | Analysis column shows `○ Pending` + an "Analyze" button |
| **Analyzed** | Values + confidence meters; low-confidence values flagged `▲` |
| **Corrected** | User value shown with a `User` marker and an "Revert to AI" affordance |
| **Error** | Decode-failure note; tags still shown |

---

## Interactions

- **Edit tags** → inline editing of tag fields; writes to the local database, never the file.
- **Add to set** → appends to the active set (or opens the set builder if none).
- **Open in editor** → the [Cue Editor](./04-cue-editor.md) for this track.
- **✕ / Esc** → closes the drawer and returns focus to the originating row.

---

## Accessibility obligations

- The drawer is a dialog: trap focus while open, restore focus on close, `Esc` dismisses.
- The two columns are labelled regions (`aria-labelledby`) so screen readers know
  "Tags" from "Analysis".
- Confidence meters expose a text equivalent; provenance markers are text, not colour only.

---

## Notes

- "Tags" vs "Analysis" is a deliberate separation: it teaches the DJ which values are facts
  from the file and which are machine estimates.
- Nothing here modifies the audio file.
- The discovery slice (similar tracks, gap chips, buy-links) shipped early in the library
  drawer — the full tags-vs-analysis inspector in this file remains the Phase 2 target.
