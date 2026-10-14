# Wireframe — Discovery & Enrichment (12)

**Phase:** 0 foundations ✅ Shipped (local, no network) · Enrichment review ✅ Shipped (opt-in MusicBrainz / iTunes / Deezer / Discogs / Last.fm) · Charts ✅ Shipped (snapshots + taste) · Radar/fingerprinting 📋 Planned
**See also:** [Screens & Flows §4.2 / §4.11 / §4.12 / §5.9 / §5.10](../SCREENS_AND_FLOWS.md) · [Track Detail](./03-track-detail.md) · [Spotify Export](./11-spotify-export.md) · [Discovery diagram](../../diagrams/17-discovery-enrichment-providers.md) · [ADR-0007](../../ADR/0007-similar-tracks-enrichment-multiprovider.md)

Three shipped surfaces share one promise: **nothing here touches the network
except through the explicit lookup buttons**. Online sources fire only from the
review UI, one provider per run, and never automatically.

---

## 12A. Inspector drawer (shipped)

Opened by clicking a library row. Overlays the right side; the table stays visible.

```
┌────────────────────────────────────────────────┐
│  {1} ▣ Glue                    [ ✕ ]           │
│  Bicep · 128 · 8A · 6:00                       │
│  [missing: Album] [missing: ISRC]              │
├────────────────────────────────────────────────┤
│  {2} ✦ SIMILAR TRACKS (local mix-compatibility) │
│  ┌──────────────────────────────────────────┐  │
│  │ Atlas              93%                   │  │
│  │ Bicep · 128 · 8A                         │  │
│  │ same key 8A · same BPM · same genre      │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ Apricots           81%                   │  │
│  │ Bicep · 130 · 9A                         │  │
│  │ compatible key 9A · +1.6% BPM apart      │  │
│  └──────────────────────────────────────────┘  │
├────────────────────────────────────────────────┤
│  {3} ⎋ FIND TO BUY (metadata links only)       │
│  Beatport                          [Copy link] │
│  {3b} MATCH ON DEEZER — Glue · Bicep · 95% matched  │
│      [Copy Deezer link]  export needs app ID  │
│  Traxsource                        [Copy link] │
│  Juno Download                     [Copy link] │
│  Bandcamp                          [Copy link] │
│  Discogs                           [Copy link] │
│  Links open the store's own search. No audio.  │
└────────────────────────────────────────────────┘
```

---

## 12B. Tag Health modal (shipped read half)

Opened from the toolbar **[Tag Health]** button.

```
┌────────────────── Tag Health ──────────────────┐
│  {4} ✚ Tag Health — missing tags & artwork [✕] │
│  12 of 94 tracks have gaps. Online lookup is   │
│  explicit and opt-in per source — only         │
│  metadata and search queries leave the device. │
│  Source [MusicBrainz ▾]  [Look up online]      │
│  3 / 10 · proposed (high)  {progress}          │
│  Album      ▓▓▓▓▓▓▓░░░░░░░  34                │
│  ISRC       ▓▓▓▓▓▓▓▓▓▓░░░░  41                │
│  Artwork    ▓▓▓░░░░░░░░░░░  12                │
│  {5} PROPOSALS FROM MUSICBRAINZ (2 tracks)     │
│  ☑ X — Unknown Artist  [high · 92%]            │
│    artist: Unknown Artist → Bicep              │
│    album: — → Bicep                            │
│  ☐ Y — Unknown Artist  [review · 65%] …        │
│  [Apply checked (1)]  [Undo run]               │
│  Applied 2 fields. Undo is available.          │
└────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Drawer header | Artwork, identity, BPM/key/duration; gap chips (`missing: …`) with a planned-lookup tooltip; `✕` / `Esc` closes, focus returns to the row |
| {2} | Similar list | Score % (mono) + reason chips; empty state names what to import ("tracks with BPM and key tags"); click a result to re-target the drawer; post-MVP adds `source` badges (Local / Last.fm / Deezer), explanations, add-to-set |
| {3} | Buy-links | One row per store; **Copy link** (clipboard + "Copied" confirmation) — never auto-open, never audio; charts link to the Charts modal |
| {3b} | Deezer match | Explicit **Match this track** button (ISRC-exact → fuzzy, read-only); result shows title/artist/release + tier + copyable catalog link; export note names the missing app ID |
| {4} | Modal header + lookup controls | Title + close; the opt-in sentence is always visible, not a tooltip; source picker + explicit lookup button (max 25 tracks per run); live per-track progress |
| {5} | Proposal list | Tier badge + confidence per track; before → after rows (artwork shows "cover art"); checkboxes default all-checked; apply writes DB fields only; undo restores the run snapshot |
| {6} | Post-lookup states | Empty proposals ("no new proposals + skipped count"); apply/undo confirmations inline; re-apply of a finished run surfaces the backend error instead of double-writing |

---

## States

| State | Behaviour |
|-------|-----------|
| **Populated** | Drawer/modal as drawn |
| **Loading** | "Scoring library…" / "Scanning library gaps…" inline text (no spinner modal) |
| **Empty similar** | Guidance text, not a blank panel |
| **Error** | Inline message in the panel; the library underneath keeps working |
| **Offline** | No change — these surfaces never needed the network |

---

## Interactions

- **Row click** toggles the drawer; **result click** re-targets it; **`Esc`** closes drawer and modal.
- **Copy link** → clipboard + transient "Copied" state; the full URL is the button's tooltip.
- **Tag Health** → modal; bars are sorted by missing count desc, then field name.
- **Look up online** → one provider per run, proposals recorded server-side; **Apply
  checked** writes DB fields (never source files); **Undo run** restores exact values.
- **Match on Deezer** → live read-only catalog match in the drawer (ISRC-exact first);
  export controls stay disabled with the app-ID reason until TX.2b.
- Post-MVP: native fingerprinting, Tag Health Score surfacing in Prep Auditor, chart
  snapshot feeds, release radar.

---

## Accessibility obligations

- The drawer is a complementary landmark tied to the selected row (`aria-expanded` on rows).
- The modal is a dialog: focus trap while open, `Esc` dismisses, focus returns to the Tag Health button.
- Scores have text equivalents ("93%"); gap chips and source badges are text, not colour only.
- Copy buttons announce "Copied" via a live region or text swap (text swap is implemented).

---

## Notes

- Copy-link (not auto-open) is deliberate: opening store pages inside the app webview
  would risk navigating away from the library; the DJ pastes the link where they want it.
- The drawer reuses the flattened `SimilarTrackResult` contract (track fields inline
  with `score` + `reasons`) — see `packages/shared` and the contract tests.
- Nothing here modifies audio files; enrichment (planned) writes DB fields only.
