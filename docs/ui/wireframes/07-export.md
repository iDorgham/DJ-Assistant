# Wireframe — Export (07)

**Phase:** 3 · 📋 Planned
**See also:** [Screens & Flows §4.6](../12-SCREENS-AND-FLOWS.md) · [API Contracts §2.4 / §2.5](../../architecture/API_CONTRACTS.md) · [Spotify export](./11-spotify-export.md)

The exit point: turn a set into files the DJ's software can load. Deterministic file
generation; the app never writes to a DJ app's live database. A **post-MVP** *Streaming*
section can additionally publish the set to the DJ's own Spotify account as a real playlist
(metadata only — see below).

---

## Wireframe — export dialog

```
┌ Export set ───────────────────────────────────────────────────────────────────────────────────────────────┐
│  {1} "Arena Club — Peak Hour"  ·  28 tracks  ·  01:58:00                       [ ✕ ]                      │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {2} Format                                                                                               │
│      [x] Rekordbox XML            collection + cues + playlists                                           │
│      [x] Serato crate             _Serato_/Subcrates/                                                     │
│      [x] CSV                      tracks + metadata                                                       │
│      [ ] USB pack                 folder + playlists for performance media   {3}                          │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {4} Destination   [ D:\Exports\PeakHour        ]   [ Browse… ]                                           │
│      Options       [x] Include cues   [x] Include playlists   [ ] Include ratings                         │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {5} Preset:  (•) Rekordbox + Serato + CSV   ( ) Rekordbox only   ( ) Custom                              │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {6} [ Cancel ]                        [ Export ]                                                         │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — export complete

```
┌ Export set ─────────────────────────────────────────────────────────────────────────────────┐
│  {7} ✓ Exported 28 tracks                                                                   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│   ✓ rekordbox.xml          D:\Exports\PeakHour\rekordbox.xml                                │
│   ✓ PeakHour.crate         D:\Exports\PeakHour\_Serato_\Subcrates\PeakHour.crate            │
│   ✓ PeakHour.csv           D:\Exports\PeakHour\PeakHour.csv                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  {8} Source audio files were not modified.                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Open folder ]   [ Close ]                                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — USB media format (Phase 3)

Professional flash-memory formatting with Pioneer-tuned defaults. Formatting **erases the
drive permanently** — this panel enforces removable-only selection + double-confirm.

```
┌ Export set — format USB media ──────────────────────────────────────────────────────────┐
│  {12} Drive   [ SanDisk Ultra Fit 64 GB (E:) ▾ ]   removable only · no default          │
│           Detected: FAT32 + MBR · 58.2 GB free                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  {13} Filesystem                                                                        │
│      (•) FAT32 + MBR   ✅ plays everywhere (CDJ-2000 → CDJ-3000X, all XDJ)  [default]   │
│      ( ) exFAT + MBR   ⚠️ new booths only (CDJ-3000/XDJ-RX3/XDJ-XZ/OPUS-QUAD/XDJ-AZ+)    │
│                        NXS2 and older can NOT read exFAT                                │
│      32 KB clusters (FAT32) · 128 KB (exFAT) · single partition · label [GIG_01____]    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  {14} [x] I understand this erases ALL data on E:   [ Format drive ]                   │
│       After format: verify FS + MBR → compat report → offer USB-pack copy              │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — streaming section (post-MVP)

The Export dialog gains a **Streaming** section. It is **post-MVP** and independent of the file
formats above: the file path never needs the network.

```
┌ Export set — streaming section (post-MVP) ────────────────────────────────────────────────────────────────┐
│  {9} Spotify Playlist Export   [ Connect Spotify ]   not connected                                        │
│      Publishes a real Spotify playlist from metadata only — no audio is uploaded.                         │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {10} Scopes   (•) playlist-modify-private   ( ) playlist-modify-public (opt-in)                          │
│       Matches each track by ISRC first, then fuzzy title/artist/album + ±3 s duration.                    │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {11} [ Publish to Spotify ]  metadata only · reversible: delete the playlist any time                    │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Header | Set name, track count, total duration |
| {2} | Format list | Multi-select; each format states where it lands |
| {3} | USB pack | Builds a clean per-DJ folder + playlists for performance media |
| {4} | Destination + options | Output folder and what to include |
| {5} | Presets | One-click common combinations |
| {6} | Actions | Cancel / Export |
| {7} | Result list | Each written file with its full path |
| {8} | Guarantee | Restates that source audio is untouched |
| {9} | Streaming section | Post-MVP Spotify publish; shows connection state |
| {10} | Scopes + matching | Minimum scopes; ISRC-first then fuzzy title/artist/album with ±3 s tolerance |
| {11} | Publish | Metadata only and reversible: the created playlist can be deleted any time |
| {12} | Drive picker | Removable drives only; system drives never listed; no pre-selected default |
| {13} | Filesystem selector | FAT32 + MBR default with "plays everywhere" badge; exFAT behind an explicit new-booths-only warning; label sanitized (ASCII uppercase ≤ 11) |
| {14} | Double-confirm + verify | Checkbox acknowledge + Format action; post-format FS/MBR re-verify and compat report gate the USB-pack copy |

### Format notes

| Format | Writes | Validated by |
|--------|--------|--------------|
| Rekordbox XML | `DJ_PLAYLISTS` collection + `POSITION_MARK` cues + playlists | XML schema + rekordbox 6.0+ |
| Serato crate | binary `vrsn`/`otrk`/`ptrk` → `_Serato_/Subcrates/` | Serato |
| CSV | tracks + metadata | spreadsheet/text |
| USB pack | folder structure + per-DJ playlist | manual, pre-gig |
| Spotify playlist (post-MVP) | playlist in the DJ's own Spotify account (metadata only) | Spotify — playlist exists; never any audio |

---

## States

| State | Behaviour |
|-------|-----------|
| **No set** | Export disabled with a hint to build/select a set |
| **Ready** | Formats + destination chosen |
| **Exporting** | Progress for multi-file/pack exports; UI stays responsive |
| **Complete** | Per-file result list + "Open folder" |
| **Error** | Names the failed format and reason; successful files are still listed |
| **Spotify: not connected** | Streaming section offers **Connect Spotify**; file formats still export without it |
| **Spotify: publishing** | Match progress (matched / total); UI stays responsive; cancellable |
| **Spotify: review** | Medium/low and unmatched tracks need a decision before anything is created |
| **Spotify: published / failed** | Result with an open-in-Spotify link + **Delete playlist** (undo); rate limits surfaced with retry |
| **USB: no drive** | Format section disabled with a hint to insert a removable drive |
| **USB: formatting** | Staged progress (verify → format → re-verify); cancellable only before the destructive step starts |
| **USB: verified** | Compat report (universal vs exFAT-limited) + offer to copy the USB pack |

---

## Interactions

- **Format checkbox** → adds/removes the format from the batch.
- **Browse…** → native folder picker for the destination.
- **Preset** → fills the format checkboxes.
- **Export** → writes files; on success, offers to reveal the folder.
- **USB pack** → generates the performance folder (deeper options in a sub-panel).
- **Connect Spotify** → opens the browser for OAuth 2.0 + PKCE; the app receives the callback and
  stores tokens in the OS keychain.
- **Publish to Spotify** → runs metadata matching, then opens the [match review](./11-spotify-export.md)
  before creating the playlist.

---

## Accessibility obligations

- The dialog traps focus and is dismissible with `Esc`.
- Format and option controls are proper checkboxes/radios with labels.
- Results are announced; errors name the specific file/format.
- File paths are selectable text (so they can be copied).

---

## Notes

- The file formats are **purely deterministic and offline** — no AI, no network.
- Hardware validation on real CDJs is a **phase gate**, not a dialog concern; the dialog only
  produces the files.
- **Post-MVP exception:** the **Spotify Playlist Export** is the one export path that touches the
  network. It is **metadata only** — audio is never downloaded, streamed, stored, or uploaded —
  and it is **reversible** (the created playlist can be deleted). See
  [wireframe 11](./11-spotify-export.md).
