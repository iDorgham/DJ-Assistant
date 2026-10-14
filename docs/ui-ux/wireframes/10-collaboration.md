# Wireframe — Collaboration / B2B (10)

**Phase:** 4 · 📋 Planned
**See also:** [Screens & Flows §4.9](../SCREENS_AND_FLOWS.md) · [Canonical §3.9](../../product/CANONICAL_DOCUMENTATION.md)

An overlay on shared sets: who's here, whose tracks are whose, the change log, and the
pre-gig sync check. **No audio is ever transferred** — the UI must make that explicit.

---

## Wireframe — shared set

```
┌ Shared set — "B2B: Warehouse" ─────────────────────────────────────────────────────────────────────────────┐
│  {1} ● You (Owner)   ● Nina (Co-DJ)   ○ Kai (Viewer)                       {2} [ Invite ]  [ Sync check ]  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {3} Tracks:  [ All ]  [ Mine ]  [ Nina's ]        {4} Owned-by column is on                               │
│────────────────────────────────────────────────────────────────────────────────────────────────────────────│
│  #    Track                Owner     Added by   Changed        Notes                                       │
│  01   Deep Horizon         You       You        2m ago         ▶ intro should be longer                    │
│  02   Solar Wind           Nina      Nina       8m ago         —                                           │
│  03   Midnight Drive       You       Nina       12m ago        ● moved by Nina                             │
│  …                                                                                                         │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {5} Change log:  Nina moved "Midnight Drive" to #03 · 12m ago  [ View diff ]                              │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {6} Only set structure and metadata are shared. Audio never leaves either device.                         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — pre-gig sync check

```
┌ Sync check ──────────────────────────────────────────────────────────────────────────────────┐
│  {7} Comparing your set with Nina's         [ Re-check ]                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  Setup                                                                                       │
│   ✓ Same set order                   28 / 28 positions match                                 │
│   ✕ 2 tracks missing on Nina's machine  Solar Wind, Afterglow                                │
│   ✓ Same cue structure                cues present on all tracks                             │
│   ✓ Same key/BPM metadata             0 conflicts                                            │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  {8} 2 tracks Nina needs to bring.  [ Generate USB pack for Nina ]                           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Close ]  {9} ● Synced                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Presence | Who is connected (online/offline) and their role |
| {2} | Set actions | Invite by email/link; run the pre-gig sync check |
| {3} | Track filters | All / Mine / partner's — quick isolation during co-prep |
| {4} | Owner column | Marks the contributing DJ and who last changed each row |
| {5} | Change log | Who moved/added what and when, with a diff view |
| {6} | Privacy note | States plainly that audio is never transferred |
| {7} | Sync result | Per-check comparison of both DJs' copies |
| {8} | USB pack | Generates a folder of only the tracks the partner must bring |
| {9} | Sync badge | Overall synced / out-of-sync state |

### Roles

| Role | Can |
|------|-----|
| **Owner** | Everything: invite, edit, remove, export |
| **Co-DJ** | Edit the set and contribute tracks |
| **Viewer** | View only |

---

## States

| State | Behaviour |
|-------|-----------|
| **Solo** | No partner connected; editing works offline, changes queue for sync |
| **Connected** | Presence + live edits; conflict-free co-editing when online |
| **Offline** | Edits applied locally; explicit conflict resolution on reconnect |
| **Conflicted** | Conflicting edit surfaced with a clear "keep mine / keep theirs" choice |
| **Synced / Out-of-sync** | Sync badge reflects the last pre-gig check |

---

## Interactions

- **Invite** → email or shareable link; role chosen at invite time.
- **Filter** → All / Mine / partner's to manage contribution.
- **View diff** → shows exactly what changed between versions.
- **Sync check** → compares order, missing tracks, cues, and metadata.
- **Generate USB pack** → produces the folder + playlist of tracks a partner must bring.

---

## Accessibility obligations

- Presence uses icon **and** text (`● online`, `○ offline`), not colour alone.
- The change log and sync results are real lists/tables, keyboard-navigable.
- Invite and sync flows are dialogs with focus trapping and `Esc` to close.
- Role labels are text; permission implications are explained, not implied by colour.

---

## Notes

- **No audio transfer, ever.** Collaboration shares set structure and metadata only.
- Offline-first: both DJs keep working; sync is explicit and reconcilable.
- The **Pre-gig Sync Check** is the B2B analogue of [Gig Ready](./09-gig-ready.md).
