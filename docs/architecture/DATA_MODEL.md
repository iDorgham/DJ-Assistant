# DJ Assistant — Data Model

**Status:** Derived from Canonical Documentation v1.1  
**Last Updated:** 2026-10-12

This document summarizes the local and cloud data models. Authoritative SQL lives in the Canonical Documentation (§5) and will be implemented as migrations.

---

## 1. Design Principles

- **Local SQLite** is the source of truth for the user’s library and analysis results.
- **Cloud PostgreSQL** stores only user-consented, derived data (metadata, features, sets, collaboration state).
- Raw audio and high-resolution waveforms never leave the device.
- All bulk mutations (tag cleanup, cue generation, etc.) write history/undo records.

---

## 2. Local Database (SQLite)

### Core Tables (Conceptual)

#### `tracks`
Primary library table.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (UUID) | Primary key |
| path | TEXT | Absolute or relative path |
| blake3_hash | TEXT | Deduplication key |
| file_size | INTEGER | |
| duration_ms | INTEGER | |
| sample_rate | INTEGER | |
| channels | INTEGER | |
| bit_depth | INTEGER | |
| format | TEXT | flac, mp3, aiff, wav, etc. |
| title | TEXT | |
| artist | TEXT | Canonical after cleanup |
| album | TEXT | |
| genre | TEXT | |
| year | INTEGER | |
| bpm | REAL | From tags; overwritten by analysis when available |
| key_camelot | TEXT | e.g. "8A" (from tags or analysis) |
| key_classical | TEXT | e.g. "A minor" (from tags or analysis) |
| energy | REAL | Optional / user or derived |
| loudness_lufs | REAL | EBU R128 |
| vocal_presence | REAL | 0–1 |
| analysis_status | TEXT | pending / complete / failed / needs_review |
| analysis_version | TEXT | Model + pipeline version |
| created_at | TEXT (ISO) | |
| updated_at | TEXT (ISO) | |
| user_rating | INTEGER | 0–5, from `POPM` / `RATING` tags or user |
| play_count | INTEGER | Optional |
| last_played_at | TEXT | Optional |
| notes | TEXT | User notes |
| comments | TEXT | Free-text comment tag, read at import (migration 002) |
| artwork_hash | TEXT | BLAKE3 of embedded image bytes; cache filename stem (migration 002) |
| artwork_path | TEXT | Absolute path to the cached image (migration 002) |
| artwork_mime | TEXT | MIME type carried from the tag, e.g. `image/jpeg` (migration 002) |

Embedded cover art is cached on disk under the app data dir (`artwork/{hash}.{ext}`) and served to
the UI by the `get_artwork` command; only the reference is stored in SQLite, never the image bytes.

#### `cue_points`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | |
| track_id | TEXT | FK → tracks |
| slot | INTEGER | Hot cue slot 1–8 (A–H); NULL for memory cues / loops |
| label | TEXT | Hot Cue A, Memory 1, etc. |
| cue_type | TEXT | hot_cue / memory_cue / loop |
| position_ms | INTEGER | |
| color_hex | TEXT | Hex, e.g. `#3b82f6` |
| source | TEXT | ai_generated / user_custom / imported |
| created_at | TEXT | |

#### `phrase_markers` / structural segments
Store intro, build, drop, breakdown, outro boundaries with confidence.

#### `aliases`
Artist / title alias mapping for Smart Tag Cleanup.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | |
| canonical_name | TEXT | |
| alias | TEXT | |
| entity_type | TEXT | artist / title / label |
| created_at | TEXT | |

#### `skill_runs` / `action_history`
Every Skill execution and bulk mutation.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | |
| skill_id | TEXT | cue_master, tag_surgeon, etc. |
| status | TEXT | started / success / failed / undone |
| input_summary | TEXT / JSON | |
| before_state | JSON | Snapshot for undo |
| after_state | JSON | |
| started_at | TEXT | |
| finished_at | TEXT | |
| error | TEXT | Nullable |

#### `sets`
Local set definitions (track order, constraints, energy curve, etc.).

#### `set_tracks`
Ordered membership + transition metadata.

#### `preferences` / `settings`
Key-value or structured user and workspace settings (including which Skills are enabled).

#### `watch_folders`
Paths being monitored by the file watcher.

---

## 3. Cloud Database (PostgreSQL 16 + pgvector)

Only data the user has explicitly opted to sync or that is required for collaboration.

### Key Concepts

- **Users** & authentication
- **Workspaces** / collaboration spaces
- **Synced track features** (not full audio)
- **Sets** and shared set state
- **Embeddings** (pgvector) for similarity search
- **Skill / automation history** (optional sync)
- **Presence & conflict resolution** data for B2B

### Example Tables (High Level)

- `users`
- `workspaces`
- `workspace_members`
- `tracks` (feature subset + owner_id / workspace_id)
- `track_embeddings` (vector column)
- `sets`
- `set_tracks`
- `collaboration_events` / operational transform or CRDT-style records
- `skill_definitions` (if cloud-managed templates)
- `audit_log`

Exact column definitions and indexes will be maintained in migration files and mirrored from Canonical Documentation §5.

---

## 4. Important Derived / Computed Fields

| Field | Computation | Storage |
|-------|-------------|---------|
| Blake3 hash | First 1MB + duration | Local (required) |
| BPM / Beat grid | ONNX | Local |
| Key | ONNX | Local |
| Phrase boundaries | ONNX + heuristics | Local |
| Transition score S(Tᵢ, Tᵢ₊₁) | Weighted function of key, BPM, energy, phrase alignment, etc. | Computed on demand or cached |
| Library Health Score | Aggregate of unanalyzed tracks, tag inconsistency, orphans, etc. | Computed + cached |

---

## 5. Migration Strategy

- **Local**: Versioned migrations applied on app startup (or via explicit command).
- **Cloud**: Standard migration tool (e.g. node-pg-migrate, Drizzle, Prisma, or sqlx).
- Schema changes that affect analysis results must bump `analysis_version` and provide a re-analysis path.

---

## 6. Related Documents

- [Canonical Documentation §5](../product/CANONICAL_DOCUMENTATION.md) — Full schema reference
- [Architecture](./ARCHITECTURE.md)
- [Skills System](./SKILLS_SYSTEM.md)
