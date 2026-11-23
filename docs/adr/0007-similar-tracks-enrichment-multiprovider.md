# ADR-0007: Similar Tracks, Tag/Artwork Enrichment & Multi-Provider Strategy

**Status:** Proposed
**Date:** 2026-10-14
**Deciders:** Product + Engineering

## Context

Three related requests arrived together: find similar tracks, fill missing
tags/artwork from online sources, and support music services beyond Spotify —
including Beatport Top 100 / Hype charts and the DJ's followed artists/labels.
Each touches the same seam: matching a local track against an outside catalog
by something stronger than a filename.

Constraints carried over from ADR-0006 and the canonical spec:

- Local-first, non-destructive (source files never touched), preview →
  apply → undo for every bulk or external mutation.
- Metadata only. No audio download, streaming playback, ripping, or storage —
  for any provider, not just Spotify.
- The cloud control plane stays optional; everything here runs on the desktop.

## Decision

Split the work into three provider kinds and ship the offline half first.

### A. Similar tracks — local scoring now, external signals later

`crates/core/src/similarity.rs` scores candidates on BPM (45%), Camelot key
(35%), genre (10%) and duration (10%), renormalised over the signals both
tracks share. Camelot distance follows the wheel: 0 same, 1 adjacent or
relative major/minor, 2 diagonal energy-boost, capped at 6. Exposed via
`find_similar_tracks`; the same `ScoredTrack` shape will carry external
recommendations (Last.fm, Deezer/Spotify seeds) once those are opt-in.

### B. Missing tags & artwork — gap detection now, online lookup gated

`track_tag_health` reports missing/placeholder fields (`album`, `genre`,
`year`, `bpm`, `key`, `artwork`, `isrc`, …) plus per-field totals — no
network. Online enrichment (MusicBrainz + Cover Art Archive, iTunes Search,
Deezer, Discogs, AcoustID/Chromaprint for untagged files) comes next as an
opt-in pipeline: ISRC-first matching → confidence tiers → preview → apply →
undo, caching provider IDs in `external_ids` and runs in `enrichment_runs`
(migration 003). `isrc` is added to `tracks` as the universal join key.
Enrichment writes DB canonical fields, never source files.

### C. Multi-provider — one registry, Spotify stays the reference

`crates/core/src/providers.rs` defines the closed enums: streaming-export
targets (`spotify`, `deezer`, `apple_music`, `youtube_music`, `soundcloud`,
`tidal`) and buy-link stores (`beatport`, `traxsource`, `juno_download`,
`bandcamp`, `discogs`). Migration 003 creates the desktop-local
`streaming_accounts` / `streaming_exports` / `streaming_matches` tables with a
free-text `provider` column, so new targets add rows, not schema. Spotify
matching/export (ADR-0006) becomes the first implementation of the generic
`provider_match_set` / `provider_export_playlist` contract; Deezer is the
planned second target (open API, ISRC search, no auth for reads).

### Beatport position

Beatport offers **no public catalog API** (retired; only Beatport LINK exists
for approved streaming partners), so Top 100 / Hype / My Beatport cannot be
fetched through an official API. Tiers:

- **Tier 0 (shipped here):** per-track buy-link search URLs for Beatport,
  Traxsource, Juno Download, Bandcamp and Discogs (`store_links_for_track`) —
  pure URL construction, no API, no ToS exposure.
- **Tier 1 (next):** chart snapshots (Top 100 per genre, Hype Top 100)
  ingested as versioned data and filtered by library taste (BPM ±3%, Camelot,
  owned-vs-missing via ISRC).
- **Tier 2 (later):** My Beatport-style release radar over followed
  artists/labels — opt-in, cached, rate-limited, marked unofficial.
- **Tier 3 (long-term):** official Beatport LINK / affiliate partnership.

Scraping Beatport with user credentials is explicitly **not** the default path
(ToS grey area, fragile selectors, account risk).

## Consequences

**Positive**

- Each slice ships independently: similar-tracks and tag-health work fully
  offline today; store links work with zero credentials.
- Provider additions never change the IPC shape or the schema — only the
  `provider` enum and matcher implementations.
- ISRC + `external_ids` turn every future integration into a cache hit
  instead of a re-query.

**Negative**

- Real online enrichment and the second export target still require API keys,
  rate-limit handling and review UI — sized as follow-ups, not in this change.
- Beatport charts/radar remain data integrations, not live API integrations,
  until a partnership exists.

**Neutral**

- `provider_status` advertises connected accounts plus both enums, so the UI
  binds to one contract from day one.
