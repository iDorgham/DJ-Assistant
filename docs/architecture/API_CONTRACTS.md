# DJ Assistant — API Contracts

**Status:** Living (Phase 0 baseline)  
**Source of Truth:** Canonical Documentation §6 + this document  
**Last Updated:** 2026-10-12

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
    bpmMin?: number;
    bpmMax?: number;
    keyCamelot?: string[];
    analysisStatus?: Array<'pending' | 'complete' | 'failed' | 'needs_review'>;
    genre?: string[];
  };
  limit?: number;
  offset?: number;
  sortBy?: 'title' | 'artist' | 'bpm' | 'key' | 'duration' | 'imported_at';
  sortDir?: 'asc' | 'desc';
}

interface ListTracksResponse {
  tracks: TrackSummary[];
  total: number;
}
```

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

#### `analyze_track`
```ts
interface AnalyzeTrackRequest {
  filePath?: string;   // one of filePath or trackId
  trackId?: string;
  genreContext?: string;
  force?: boolean;     // re-analyze even if current analysis_version matches
}

interface AnalyzeTrackResponse {
  trackId: string;
  fileHash: string;
  bpm: number;
  keyCamelot: string;
  keyClassical?: string;
  durationMs: number;
  phraseConfidence: number;
  analysisVersion: string;
  cues: Array<{
    slot: number;
    positionMs: number;
    label: string;
    cueType: 'hot_cue' | 'memory_cue' | 'loop';
    colorHex: string;
    source: 'skill:cue_master' | 'user' | 'import';
  }>;
  lowConfidenceFields?: string[];
}
```

#### `analyze_batch` (optional convenience)
```ts
interface AnalyzeBatchRequest {
  trackIds: string[];
  force?: boolean;
}

interface AnalyzeBatchResponse {
  jobId: string;
  queued: number;
}
```
Progress via `analysis:progress`.

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

---

## 3. Tauri IPC — Events (Rust → UI)

| Event | Payload (conceptual) | Purpose |
|-------|----------------------|---------|
| `scan:progress` | `{ jobId, processed, total, currentPath? }` | Folder scan progress |
| `scan:completed` | `{ jobId, added, skipped, duplicates }` | Scan finished |
| `analysis:progress` | `{ jobId?, trackId, status, progress01 }` | Per-track / batch analysis |
| `analysis:completed` | `{ trackId, analysisVersion }` | Single track done |
| `skill:progress` | `{ runId, skillName, message?, progress01? }` | Long-running skill |
| `skill:completed` | `{ runId, skillName, success }` | Skill finished |
| `watcher:file_changed` | `{ path, kind }` | Watch-folder notifications |
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
- Constraint and filter types used by both IPC and HTTP

---

## 6. Evolution Rules

1. Additive fields are preferred; breaking changes require a version bump discussion and ADR if cross-cutting.
2. New commands/events must be documented here before merge of the implementing PR.
3. Cloud OpenAPI (or equivalent) will be generated from the Fastify routes once the API scaffold exists; this markdown remains the human-readable contract.

---

## Related Documents

- [Architecture](./ARCHITECTURE.md)
- [Data Model](./DATA_MODEL.md)
- [Skills System](./SKILLS_SYSTEM.md)
- [ADR-0005: Tauri IPC Style](../ADR/0005-tauri-ipc-style.md)
- [Canonical Documentation §6](../product/CANONICAL_DOCUMENTATION.md)
