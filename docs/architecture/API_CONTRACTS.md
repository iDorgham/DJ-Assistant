# DJ Assistant — API Contracts

**Status:** Living (Phase 0 baseline)  
**Source of Truth:** Canonical Documentation §6 + this document  
**Last Updated:** 2026-10-14

This document defines the **Tauri IPC** (desktop) and **Cloud HTTP** contracts. Types should be mirrored in `packages/shared` and kept in sync with Rust command handlers.

---

## 1. Design Rules

1. Commands are coarse-grained user operations, not internal micro-RPCs.
2. All mutating operations that affect library state must be logged (and reversible where applicable).
3. Progress is delivered via **events**, not long-polling inside a single invoke.
4. Paths are always validated and canonicalized on the Rust side; never trust raw UI paths for filesystem access.
5. Cloud endpoints never accept raw audio. Only metadata, features, set structures, and collaboration state.

---

## 2. Tauri IPC — Commands (UI → Rust)

### 2.1 Library & Scan

#### `scan_folder`
```ts
interface ScanFolderRequest {
  path: string;
  recursive?: boolean; // default true
}

interface ScanFolderResponse {
  jobId: string;
  estimatedFiles?: number;
}
```
Progress via event `scan:progress`. Completion via `scan:completed`.

#### `list_tracks`
```ts
interface ListTracksRequest {
  workspaceId?: string;
  query?: string;
  filters?: {
    bpmMin?: number;              // inclusive
    bpmMax?: number;              // inclusive
    keyCamelot?: string[];        // Camelot codes, matched case-insensitively
    analysisStatus?: Array<'pending' | 'complete' | 'failed' | 'needs_review'>;
    genre?: string[];             // matched case-insensitively
    ratingMin?: number;           // inclusive 0-5 star floor
  };
  limit?: number;                 // default 200, clamped to 0..=1000
  offset?: number;
  sortBy?: 'title' | 'artist' | 'bpm' | 'key' | 'duration' | 'imported_at';
  sortDir?: 'asc' | 'desc';
}

interface ListTracksResponse {
  tracks: TrackSummary[];
  total: number;
}
```

Filters and sorting are applied **server-side in SQL** (T2.1.2), so `total` is the
count of rows that actually match — it stays correct for libraries larger than one
page. Semantics:

- Filter groups combine with `AND`; list values are `IN` lists compared
  case-insensitively (`key_camelot` upper-cased, `genre`/`analysis_status` lower-cased).
- Blank strings/empty lists are ignored, so `{ filters: {} }` is the same as omitting
  `filters`. `bpmMin > bpmMax`, negative/non-finite BPM bounds and `ratingMin` outside
  `0..=5` are rejected with a descriptive error instead of silently returning nothing.
- Every user value is a **bound parameter**; only allow-listed column names and sort
  directions are interpolated (see `crates/core/src/library_query.rs`).
- Unknown `sortBy`/`sortDir` values fall back to the default (`imported_at` desc);
  nullable columns sort NULLs last, and `id` is the stable pagination tiebreaker.

#### `list_genres` (shipped — T2.1.2)
Distinct non-empty genre tags with track counts, used to populate the library filter
panel. Local read only.
```ts
interface GenreCount {
  genre: string;
  count: number;
}
interface ListGenresResponse {
  genres: GenreCount[];
}
```
Case variants collapse into one entry (the filter itself is case-insensitive), ordered
by count descending then name.

#### `get_track`
```ts
interface GetTrackRequest {
  trackId: string;
}

interface GetTrackResponse {
  track: TrackDetail; // full metadata + analysis + cues
}
```

#### `get_artwork`
Serves a track's cached cover art as a `data:` URL. Resolves to `null` when the track has no
embedded artwork (or the cache file is gone), so a missing thumbnail is never an error.
```ts
interface GetArtworkRequest {
  trackId: string;
}

type GetArtworkResponse = string | null; // e.g. "data:image/jpeg;base64,..."
```

`TrackSummary` also carries the tag-sourced fields read at import time (no analysis): `bpm?`,
`keyCamelot?`, `keyClassical?`, `userRating?`, `comments?` and `artworkHash?` — the latter is the
BLAKE3 content hash the `get_artwork` cache file is named after. Rows imported before migration 002
return `null` for `comments` / `artworkHash` until rescanned.

### 2.2 Analysis

#### `analyze_library` (shipped — T1.2.1/T1.2.2/T1.2.3/T1.2.5)
```ts
interface AnalyzeLibraryRequest {
  trackIds?: string[];   // omit to analyze everything needing analysis
  force?: boolean;       // re-analyze even if analysis_version matches
}

interface AnalyzeLibraryResponse {
  jobId: string;
  total: number;
}
```
Runs the deterministic suite (BPM/key/phrase/vocals/loudness) per track on a
background thread, persists results + `analysis_version`, and selects
version-aware rows unless `force:true`. Progress arrives via `analysis:progress`
(per track) and `analysis:completed` (once the queue drains). When no tracks need analysis, the response has `total: 0` and no `analysis:completed` is emitted. An empty `trackIds` array is rejected with an error; omit the field instead.

Only `analyze_library` is currently implemented; `analyze_track` and `analyze_batch` are not registered IPC commands.

### 2.3 Skills

#### `run_skill`
```ts
interface RunSkillRequest {
  skillName: string; // cue_master | tag_surgeon | set_architect | ...
  params: Record<string, unknown>;
  dryRun?: boolean;
}

interface RunSkillResponse {
  success: boolean;
  runId: string;
  summary: string;
  reversible: boolean;
  details: unknown;
}
```

#### `undo_skill_run`
```ts
interface UndoSkillRunRequest {
  runId: string;
}

interface UndoSkillRunResponse {
  success: boolean;
  summary: string;
}
```

### 2.4 Sets & Export

#### `build_set` (local Beam Search path)
```ts
interface BuildSetRequest {
  constraints: {
    targetDurationMinutes: number;
    startBpm?: number;
    peakBpm?: number;
    endBpm?: number;
    peakPositionMinutes?: number;
    keyStrategy?: 'strict_harmonic' | 'energy_boost' | 'free_form';
    energyProfile?: 'warmup_to_peak' | 'constant_peak' | 'wave' | 'custom';
    customEnergyCurve?: Array<{ timePercentage: number; targetEnergy: number }>;
    genres?: string[];
    mood?: string;
    excludedTrackIds?: string[];
    lockedTrackIds?: string[]; // Lock & Fill
  };
  candidateTrackIds?: string[]; // if omitted, use filtered library
  options?: {
    includeAlternatives?: boolean;
    explainTransitions?: boolean;
  };
}

interface BuildSetResponse {
  setId: string;
  totalDurationSeconds: number;
  tracks: Array<{
    position: number;
    trackId: string;
    title: string;
    artist: string;
    bpm: number;
    keyCamelot: string;
    transitionScore: number;
    transitionRisk: 'low' | 'medium' | 'high';
    transitionRationale?: string;
  }>;
}
```

#### `export_set`
```ts
interface ExportSetRequest {
  setId: string;
  format: 'rekordbox_xml' | 'serato_crate' | 'csv' | 'preset_all';
  exportPath: string;
}

interface ExportSetResponse {
  success: boolean;
  exportedFiles: string[];
  trackCount: number;
}
```

#### `usb_list_drives`
Enumerates **removable** drives only. System/boot/internal drives are never listed.
```ts
interface UsbListDrivesRequest {} // no params

interface UsbListDrivesResponse {
  drives: Array<{
    deviceId: string;   // opaque OS device identifier (never a raw path from the UI)
    label?: string;
    sizeBytes: number;
    model?: string;
    filesystem?: string;
    partitionScheme?: string; // e.g. 'MBR' | 'GPT' | 'unknown'
    removable: true;
  }>;
}
```

#### `usb_format_drive`
Destructive and irreversible — requires explicit `deviceId` from `usb_list_drives` plus
acknowledgement. Never accepts a system drive. Pioneer-tuned defaults apply.
```ts
interface UsbFormatDriveRequest {
  deviceId: string;
  filesystem: 'fat32' | 'exfat'; // default 'fat32' (universal); 'exfat' requires confirmExfatRisk
  volumeLabel?: string;          // ASCII uppercase, ≤ 11 chars; sanitized in Rust
  fullFormat?: boolean;          // default false (quick); true for suspect drives
  acknowledgeDataLoss: true;     // explicit double-confirm from the UI
  confirmExfatRisk?: boolean;    // required when filesystem === 'exfat': booth must be exFAT-capable
}

interface UsbFormatDriveResponse {
  jobId: string; // progress via usb-format:progress, completion via usb-format:completed
}

// usb-format:completed payload:
// { jobId, deviceId, filesystem, partitionScheme: 'MBR',
//   compat: 'universal' | 'exfat-limited',
//   compatNote: string } — 'universal' = FAT32+MBR (all CDJ/XDJ);
// 'exfat-limited' = CDJ-3000 / 3000X / XDJ-RX3 / XDJ-XZ / OPUS-QUAD / XDJ-AZ and newer only.
```

### 2.5 Streaming Export (Spotify) — Post-MVP

Metadata-only publishing of a set (or any playlist) to the DJ's own Spotify account. All provider calls are
made by the desktop app; see §7 for the external endpoints. Tokens live in the OS keychain.

#### `spotify_connect`
```ts
interface SpotifyConnectRequest {
  // Opens the system browser to Spotify's authorization endpoint.
  // OAuth 2.0 Authorization Code + PKCE (RFC 7636); loopback redirect
  // http://127.0.0.1:<port>/callback (custom URI scheme fallback).
  // Public client ID is embedded at build time (no client secret).
  visibility?: 'private' | 'public'; // requested default; default 'private'
}

interface SpotifyConnectResponse {
  status: 'pending'; // completion delivered via event spotify:auth_completed
}
```

#### `spotify_disconnect`
```ts
interface SpotifyDisconnectRequest {
  accountId?: string; // omit to disconnect the active account
}

interface SpotifyDisconnectResponse {
  success: boolean;
  tokensRevoked: boolean; // tokens removed from the OS keychain
}
```

#### `spotify_status`
```ts
interface SpotifyStatusRequest {} // no params

interface SpotifyStatusResponse {
  connected: boolean;
  accountLabel?: string;
  expiresAt?: string; // ISO; access token refreshed locally
  scopes: string[];   // e.g. ['playlist-modify-private']
  exports?: Array<{   // recent exports (used to offer undo)
    exportId: string;
    setId: string;
    providerPlaylistId: string;
    playlistName: string;
    visibility: 'private' | 'public';
    status: 'created' | 'updated' | 'partial' | 'deleted' | 'failed';
    matchedCount: number;
    unmatchedCount: number;
    createdAt: string;
  }>;
}
```

#### `spotify_match_set`
```ts
interface SpotifyMatchSetRequest {
  setId: string;
  trackIds?: string[];               // optional explicit subset; else all set tracks
  fuzzyDurationToleranceMs?: number; // default 3000 (±3 s)
}

interface SpotifyMatchSetResponse {
  matchRunId: string;
  matched: number;   // high confidence (auto-add)
  review: number;    // medium / low confidence (review queue)
  unmatched: number;
  matches: Array<{
    trackId: string;
    providerTrackUri?: string;
    method: 'isrc' | 'fuzzy' | 'manual';
    confidence: number; // 0–1
    status: 'matched' | 'review' | 'unmatched' | 'skipped';
  }>;
}
```
Progress via event `spotify:match_progress`.

#### `spotify_export_playlist`
```ts
interface SpotifyExportPlaylistRequest {
  setId: string;
  matchRunId?: string;                // reuse a prior match run; else match first
  playlistName: string;
  visibility?: 'private' | 'public';  // 'public' requires opt-in + playlist-modify-public scope
  providerPlaylistId?: string;        // set to update an existing playlist (needs playlist-read-private)
  includeReviewMatches?: boolean;     // default false; only high-confidence unless overridden
}

interface SpotifyExportPlaylistResponse {
  exportId: string;
  providerPlaylistId: string;
  playlistUrl: string;
  addedCount: number;
  skippedCount: number;
  status: 'created' | 'updated' | 'partial';
}
```
Progress via event `spotify:export_progress`; completion via `spotify:export_completed`. Track URIs are
chunked at ≤ 100 per request.

#### `spotify_delete_playlist`
```ts
interface SpotifyDeletePlaylistRequest {
  exportId: string; // created playlist recorded locally in streaming_exports (undo)
}

interface SpotifyDeletePlaylistResponse {
  success: boolean; // playlist deleted / unfollowed on Spotify
}
```

### 2.6 Discovery & Enrichment (IPC — Implemented, Local Only)

These commands run entirely on-device with no network access. They are the
shipped foundations (`TF`) for the post-MVP discovery / enrichment scope
(ADR-0007); online adapters and the generic provider match/export contracts
(§2.7) extend them without changing these shapes.

#### `find_similar_tracks`
```ts
interface FindSimilarTracksRequest {
  trackId: string;
  limit?: number; // max results; clamped to 1–50 server-side; default 10
}

interface SimilarTrackResult extends TrackSummary {
  score: number;    // blended similarity 0–1 (BPM 45% / key 35% / genre 10% / duration 10%)
  reasons: string[]; // UI chips, e.g. "same key 8A", "+1.2% BPM apart"
}

interface FindSimilarTracksResponse {
  seedTrackId: string;
  results: SimilarTrackResult[];
}
```

#### `track_tag_health`
```ts
interface TagHealthRequest {
  trackIds?: string[]; // restrict; omit to scan the whole library
  limit?: number;      // max gap rows; default 200
}

interface TrackGaps {
  trackId: string;
  title: string;
  artist: string;
  missing: string[]; // e.g. "album", "bpm", "artwork", "isrc"; "artist" means "Unknown Artist"
}

interface TagHealthResponse {
  checked: number;
  withGaps: number;
  gaps: TrackGaps[];
  totals: Array<{ field: string; missingCount: number }>; // sorted desc
}
```

#### `store_links_for_track`
```ts
interface StoreLinksRequest {
  trackId: string;
}

// Tier 0 store integration: pure search-URL construction (no API, no audio).
// Beatport has no public catalog API; charts/radar arrive as data (ADR-0007).
interface StoreLink {
  provider: string; // "beatport" | "traxsource" | "juno_download" | "bandcamp" | "discogs"
  label: string;
  url: string;      // outbound https search URL
}

interface StoreLinksResponse {
  trackId: string;
  artist: string;
  title: string;
  links: StoreLink[];
}
```

#### `provider_status`
```ts
interface ProviderAccount {
  id: string;
  provider: string;
  accountLabel: string;
  scopes: string[];
  expiresAt?: string | null;
  revokedAt?: string | null;
}

interface ProviderStatusResponse {
  connected: ProviderAccount[]; // non-revoked rows from streaming_accounts
  supportedStreaming: string[]; // ["spotify","deezer","apple_music","youtube_music","soundcloud","tidal"]
  supportedStores: string[];    // ["beatport","traxsource","juno_download","bandcamp","discogs"]
  capabilities: Array<{ provider: string; liveMatch: boolean; isrcSearch: boolean; playlistWrite: boolean; needsAppId: boolean }>;
}
```

### 2.7 Provider Match / Export & Enrichment Runs (Partially Implemented)

Generic contracts generalizing the `spotify_*` commands in §2.5. Spotify is the
reference implementation; Deezer matching is live. **Shipped:** `enrichment_preview`
/ `enrichment_apply` / `enrichment_undo` (+ `enrichment:progress` event),
`provider_match_tracks`, `provider_match_set` (trackIds today; `set_id` waits on
Phase 3 sets), `provider_export_playlist` (returns `not_configured` naming the
missing credential), `chart_import_snapshot` / `chart_list`, and per-provider
`capabilities` in `provider_status`. **Planned:** set-scoped matching (Phase 3),
`provider_connect` + writes (need application IDs / OAuth).

```ts
interface ProviderMatchSetRequest {
  provider: 'deezer';             // only supported provider today
  setId: string;
  trackIds?: string[];
  fuzzyDurationToleranceMs?: number; // default 3000 (±3 s)
}

interface ProviderExportPlaylistRequest {
  provider: string;
  setId: string;
  matchRunId?: string;
  playlistName: string;
  visibility?: 'private' | 'public';
  providerPlaylistId?: string;
  includeReviewMatches?: boolean; // default false
}

interface EnrichmentPreviewRequest {
  provider: string;             // e.g. "musicbrainz" | "itunes" | "deezer" | "discogs"
  trackIds?: string[];          // omit = all tracks with gaps
}

interface EnrichmentApplyRequest {
  runId: string;                // from the preview run
  trackIds?: string[];          // subset; else all proposed
}
// Undo = restore the run's before_state (recorded in enrichment_runs).
```

---

## 3. Tauri IPC — Events (Rust → UI)

| Event | Payload (conceptual) | Purpose |
|-------|----------------------|---------|
| `scan:progress` | `{ jobId, processed, total, currentPath? }` | Folder scan progress |
| `scan:completed` | `{ jobId, added, skipped, duplicates }` | Scan finished |
| `analysis:progress` | `{ jobId, processed, total, trackId, filePath, analysisStatus, error? }` | Per-track analysis progress (shipped shape) |
| `analysis:completed` | `{ jobId, total, succeeded, failed, durationMs }` | Analysis queue drained (shipped shape) |
| `skill:progress` | `{ runId, skillName, message?, progress01? }` | Long-running skill |
| `skill:completed` | `{ runId, skillName, success }` | Skill finished |
| `watcher:file_changed` | `{ path, kind }` | Watch-folder notifications |
| `spotify:auth_progress` | `{ status, accountLabel? }` | OAuth PKCE flow started/completed |
| `spotify:auth_completed` | `{ connected, accountLabel?, scopes }` | PKCE flow finished; tokens stored in keychain |
| `spotify:match_progress` | `{ matchRunId, processed, total, matched, review, unmatched }` | ISRC/fuzzy match progress |
| `spotify:export_progress` | `{ exportId, added, total, playlistUrl? }` | Chunked playlist-add progress |
| `spotify:export_completed` | `{ exportId, providerPlaylistId, addedCount, skippedCount }` | Export finished |
| `usb-format:progress` | `{ jobId, deviceId, stage, progress01? }` | USB format stages (verify → format → re-verify) |
| `usb-format:completed` | `{ jobId, deviceId, filesystem, partitionScheme, compat }` | Format done + CDJ-compat certification |
| `error` | `{ code, message, context? }` | Surfaceable errors |

Exact payload shapes will be finalized in `packages/shared` during Phase 0–1.

---

## 4. Cloud HTTP API (Control Plane)

Base path: `/api/v1`  
Auth: Bearer token (workspace-scoped).  
**Never accepts raw audio bodies.**

### Major Endpoints (from Canonical §5–6)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/library/scan` | Trigger cloud-side index refresh (metadata only) |
| POST | `/ai/parse-query` | NL → structured search / set constraints |
| POST | `/sets/generate` | Constraint-based set generation assist |
| POST | `/sets/build` | Build set with constraints + options |
| POST | `/tags/cleanup/preview` | Preview tag cleanup |
| POST | `/tags/cleanup/apply` | Apply tag cleanup |
| POST | `/sets/:id/invite` | Invite collaborator |
| POST | `/sets/:id/collaborate` | Collaboration session ops |
| POST | `/skills/:name/run` | Run skill (cloud-orchestrated where needed) |
| POST | `/automation/rules` | Create/update automation rules |
| GET  | `/library/health` | Library health score |
| POST | `/sets/:id/usb-pack` | Package export for USB |
| POST | `/sets/:id/sync-check` | Cross-device sync status |

### Example: Generate / Build Set

```ts
// POST /api/v1/sets/generate  (or /sets/build)
interface GenerateSetRequest {
  workspaceId: string;
  constraints: {
    targetDurationMinutes: number;
    startBpm: number;
    endBpm: number;
    keyStrategy: 'strict_harmonic' | 'energy_boost' | 'free_form';
    energyProfile: 'warmup_to_peak' | 'constant_peak' | 'wave' | 'custom';
    customEnergyCurve?: Array<{ timePercentage: number; targetEnergy: number }>;
    excludedTrackIds?: string[];
    lockedTrackIds?: string[];
  };
}

interface GenerateSetResponse {
  setId: string;
  totalDurationSeconds: number;
  tracks: Array<{
    position: number;
    trackId: string;
    title: string;
    artist: string;
    bpm: number;
    keyCamelot: string;
    transitionScore: number;
    transitionRisk: 'low' | 'medium' | 'high';
    transitionRationale: string;
  }>;
}
```

```json
POST /api/v1/sets/build
{
  "constraints": {
    "duration_minutes": 120,
    "start_bpm": 123,
    "peak_bpm": 128,
    "peak_position_minutes": 80,
    "genres": ["melodic techno"],
    "mood": "dark"
  },
  "options": {
    "include_alternatives": true,
    "explain_transitions": true,
    "lock_track_ids": ["uuid-1", "uuid-2"]
  }
}
```

---

## 5. Shared Types (Conceptual)

Core types that must live in `packages/shared` (names illustrative):

- `TrackSummary`, `TrackDetail`
- `CuePoint`
- `PhraseMarker` / structural segment
- `SetSummary`, `SetTrack`
- `SkillRunSummary`
- `AnalysisStatus`
- `UsbDrive`, `UsbFormatJob`, `UsbCompatReport` (USB media format)
- `SpotifyAccount`, `SpotifyMatch`, `SpotifyExport` (streaming export)
- `SimilarTrackResult`, `TrackGaps`, `TagHealthResponse` (discovery & enrichment — implemented)
- `StoreLink`, `ProviderAccount`, `ProviderStatusResponse`, `ProviderCapability` (provider registry — implemented)
- `TrackProposal`, `EnrichmentPreviewResponse`, `EnrichmentApplyResponse`, `EnrichmentUndoResponse` (enrichment runs — implemented)
- `ProviderTrackMatch`, `ChartEntry`, `ChartListResponse` (matching + charts — implemented)
- Constraint and filter types used by both IPC and HTTP

---

## 6. Evolution Rules

1. Additive fields are preferred; breaking changes require a version bump discussion and ADR if cross-cutting.
2. New commands/events must be documented here before merge of the implementing PR.
3. Cloud OpenAPI (or equivalent) will be generated from the Fastify routes once the API scaffold exists; this markdown remains the human-readable contract.

---

## 7. External Third-Party APIs (Desktop-Called)

These endpoints are called **directly by the desktop app**, never by the cloud control plane. Only track
metadata and search queries leave the device; audio is never uploaded, downloaded, streamed, or stored.

### Spotify Web API (Streaming Export — Post-MVP)

Base URL: `https://api.spotify.com/v1`  
Auth: OAuth 2.0 Authorization Code + PKCE (RFC 7636), public client ID embedded at build time (no client
secret); tokens stored in the OS keychain and refreshed locally.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/search` | Match a local track by ISRC / normalized title + artist + album (±3 s duration) |
| GET | `/me` | Resolve the DJ's `user_id` for playlist creation |
| POST | `/users/{user_id}/playlists` | Create a new playlist |
| POST | `/playlists/{playlist_id}/tracks` | Add tracks (≤ 100 URIs per request, chunked) |
| DELETE | `/playlists/{playlist_id}/followers` | Unfollow (delete) the created playlist — undo |

Scopes (minimal): `playlist-modify-private` (default); `playlist-modify-public` only when the DJ opts into a
public playlist; `playlist-read-private` only when updating an existing playlist. No library or email scopes.

Error handling: `429` → honor `Retry-After` with exponential backoff; `401` → refresh token, then retry;
`403` / `404` → surfaced to the UI.

### Planned Provider APIs (Post-MVP — TD / TE / TX)

Same metadata-only posture: only track metadata, fingerprints and search
queries leave the device; audio is never uploaded, downloaded, streamed, or
stored. Every source is opt-in with caching and rate limiting.

| Source | Use | Auth |
|--------|-----|------|
| MusicBrainz + Cover Art Archive | title/artist/label, ISRC, release date, high-res cover | none (1 req/s limit) |
| iTunes Search API | 600px artwork, genre, release date | none |
| Deezer public API | ISRC search, 1000px artwork, genre; live catalog matching | none for reads; OAuth + app ID for writes |
| Discogs API | label, cat#, versions, electronic-catalog depth | `DISCOGS_TOKEN` (personal token, strict limits) |
| AcoustID | identify untagged files via locally-computed Chromaprint (native lib pending — query/parse ready) | `ACOUSTID_API_KEY` |
| Last.fm API | genre correction, `track.search` (similar graph is TD.1) | `LASTFM_API_KEY` |

Beatport / Traxsource / Juno Download expose **no stable public catalog API**
for a desktop client: charts and release radar enter as versioned snapshot
data plus per-track buy-links (Tier 0–2, ADR-0007); an official Beatport
partnership is Tier 3. Credential-based scraping is not the default path.

---

## Related Documents

- [Architecture](./ARCHITECTURE.md)
- [Data Model](./DATA_MODEL.md)
- [Skills System](./SKILLS_SYSTEM.md)
- [ADR-0005: Tauri IPC Style](../ADR/0005-tauri-ipc-style.md)
- [Canonical Documentation §6](../product/CANONICAL_DOCUMENTATION.md)
