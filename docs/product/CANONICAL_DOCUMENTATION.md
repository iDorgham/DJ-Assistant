# DJ Assistant — Master Product Specification & Canonical Documentation

**Document Status:** Approved for Engineering & Architecture  
**Version:** 1.1 (Full Feature Expansion)  
**Product Type:** Desktop-First Preparation Accelerator for Professional DJs  
**Target Architecture:** Tauri v2 (Rust + React/TypeScript) + Cloud Control Plane (Fastify + PostgreSQL + pgvector)

*This documentation set is the single source of truth. It merges the focused commercial product definition with the detailed technical engineering specification and all approved expansions (Smart Tag Cleanup, Collaborative/B2B, Automation Layer, Skills system, and advanced library/set intelligence). It is written for product, engineering, marketing, and investor use.*

---

## 1. Executive Summary & Vision

### 1.1 Vision Statement
DJ Assistant is the fastest path from an unorganized music library to a performance-ready DJ set. It automates high-frequency prep tasks—structural track analysis, genre-aware cue point generation, harmonic transition sequencing, energy curve mapping, intelligent tag cleanup, and collaborative B2B preparation—exporting directly into standard performance software in minutes.

### 1.2 Core Value Proposition
- **15-Minute Gig Prep:** Processes 40+ raw audio tracks, calculates precise beat grids/keys, generates 8 hot cues, sequences an energy-mapped set, and exports to rekordbox/Serato in under 15 minutes.
- **Non-Destructive Workflows:** Zero modification of source audio files. All metadata, cue markers, and set arrangements are exported via standard interchange formats (XML, .crate, CSV).
- **Local-First Processing:** Audio decoding, beat tracking, and structural analysis execute locally via Rust and ONNX Runtime—eliminating cloud upload bandwidth costs and protecting user libraries.
- **Intelligent Automation:** Rule-based workflows and scoped Skills that reduce repetitive work while keeping the DJ in full control.
- **True Collaboration:** DJs can prepare B2B sets together without transferring audio files.

### 1.3 Positioning
> The fastest way to turn a music library into a performance-ready DJ set.

**Core Promise:**  
> Analyze your music locally. Generate cue points. Clean your tags. Build harmonic, energy-aware sets. Collaborate with other DJs. Export to rekordbox or Serato. Prepare in minutes, not hours.

**What It Is:**  
A desktop-first preparation accelerator for DJs. It scans your local music library, extracts BPM, key, beat grid, phrase boundaries, and vocal presence, generates intelligent cue points, cleans messy metadata, builds sets from constraints, supports collaborative B2B preparation, and exports directly to your existing DJ software.

**What It Is Not / Out-of-Scope (Explicit Product Boundaries):**
- Not a live performance tool / Audio Playback/Mixing Engine (does not replace rekordbox, Serato, Traktor, or CDJs).
- Not a social network or social media & marketing tools (no social posting, AI post drafting, or campaign schedulers).
- Not a career operating system, label/demo management, or automatic emailing/demo submission tracking.
- Not a Spotify audio downloader / No audio piracy or streaming downloads from Spotify, Apple Music, YouTube, or Soundcloud.
- Not a content calendar, marketing platform, or open-ended “chat with your music” gimmick.
- Not an autonomous agent that takes irreversible actions without explicit confirmation.

**Target Users:**
- Working club and festival DJs who prepare multiple sets per week.
- Mobile and wedding DJs who need fast, reliable preparation.
- Rising DJs who want pro-level preparation without years of manual tagging.
- Content creators who need clean, exportable set structures.
- DJs who regularly perform B2B and need a clean way to prepare together.

**Killer Use Case:**  
> “I just downloaded 40 new tracks. I have a gig tomorrow (and a B2B the day after). I need to clean the messy artist names, know which tracks work together, where the drops are, what key they’re in, set cue points, build a set with my partner, and export everything so we can just load and play. I don’t have three hours to do this manually.”

---

## 2. App Store / Website Descriptions

### Short Description (80–120 characters)
> Analyze locally, clean tags, generate cues, build harmonic sets, collaborate on B2B, export to rekordbox/Serato.

### Medium Description
> DJ Assistant is the fastest way to prepare a professional DJ set. It scans your local music library, detects BPM, key, beat grid, phrases, and vocal presence, cleans messy artist tags, generates intelligent cue points, builds energy-aware harmonic setlists, and lets multiple DJs collaborate on B2B sets. Export directly to rekordbox XML or Serato crate files and start playing.

### Long Description
> **Prepare faster. Play better. Collaborate cleaner.**
>
> DJ Assistant is a desktop-first preparation tool built for working DJs. It runs advanced audio analysis locally on your machine — no uploading your entire library, no waiting for cloud processing. It detects BPM, key, beat grid, phrase boundaries, and vocal presence, then turns that data into action.
>
> **Generate cue points automatically.**  
> Stop placing cue points by hand. DJ Assistant creates musically meaningful cue points for intros, drops, breakdowns, and outros — then lets you review and adjust them in seconds.
>
> **Clean your library in one pass.**  
> Messy artist names, inconsistent capitalization, extra spaces, and accent variants are automatically detected and normalized with full preview and undo.
>
> **Build sets from constraints.**  
> Tell it: “Build me a 2-hour dark melodic techno set starting at 123 BPM, peaking at 128 BPM around 80 minutes.” DJ Assistant assembles a candidate pool, scores transitions, optimizes the sequence, and explains every choice.
>
> **Prepare B2B sets together.**  
> Invite another DJ, contribute tracks from your own libraries, co-edit the sequence and energy curve, then export individual crates plus a master set — without ever transferring audio files.
>
> **Automate the repetitive work.**  
> Rule-based workflows and scoped Skills handle import → analyze → cue → cleanup → export chains while keeping you in full control.
>
> **Export to your DJ software.**  
> Generate rekordbox XML and Serato crate files. Load your set and play. DJ Assistant is a preparation layer — it works alongside your existing DJ software, not against it.
>
> **It learns from you.**  
> Every cue point you move, every track you swap, every set you build, every tag you correct makes the system smarter about your preferences.
>
> **Built for privacy.**  
> Your music library is private. Audio analysis runs locally. Cloud sync is optional. You can export or delete your data at any time.

### Feature Bullets
- Local audio analysis: BPM, key, beat grid, phrases, vocal presence
- Automatic cue point generation with fast review UI + genre templates
- Smart Tag Cleanup (normalize artist/producer names, fix case, spacing, accents, aliases)
- Harmonic mixing guidance (Camelot wheel + relative keys)
- Energy-aware set builder with BPM and energy curves + templates + Lock & Fill
- Natural language search: “dark emotional tracks around 126 BPM”
- Collaborative / B2B set preparation (shared workspaces, co-editing, dual export)
- Automation Layer + scoped Skills (Cue Master, Tag Surgeon, Prep Auditor, etc.)
- Export to rekordbox XML and Serato crate
- DJ Brain: personalized preference model + behavioral history
- Desktop-first, offline-capable, privacy-respecting

### Keywords
DJ, rekordbox, Serato, cue points, BPM, key detection, harmonic mixing, set builder, music library, DJ preparation, phrase detection, energy curve, tag cleanup, B2B, collaborative, automation, skills.

---

## 3. Core Modules & Feature Descriptions

### 3.1 Library
**Purpose:** Import, organize, search, and manage tracks.  
**Key Features:** Folder scanning, watch folders, metadata extraction, duplicate detection via file hashing (BLAKE3), bulk editing, user ratings, tags, comments, **Smart Tag Cleanup**, version detection, artist graph.  
**AI Role:** Used for duplicate confidence, metadata suggestions, fuzzy name matching, and version clustering.  
**What It Does Not Do:** It does not stream music. It does not download from Spotify. It does not replace your DJ software’s library.

#### Smart Tag Cleanup (Tag Fix Tools)
DJs constantly face messy metadata: the same producer appears as “Amelie Lens”, “AMELIE LENS”, “Amelie  Lens”, “Amélie Lens”, or “AmelieLens”. The Smart Tag Cleanup tools solve this without forcing destructive changes.

**Capabilities:**
- **Fuzzy Artist / Producer Matching** — Detects names that differ only by case, leading/trailing/double spaces, accents/diacritics, punctuation, and common prefixes/suffixes (“feat.”, “ft.”, “vs.”, “pres.”).
- **Suggested Canonical Name** — Proposes a single clean version (user can accept, edit, or reject).
- **Bulk Apply** — One-click rename across the entire library (or selected folders) with full preview.
- **Alias System** — Keeps original variants as aliases so future imports auto-map to the canonical name.
- **Preview Diff + Undo / History** — Shows exactly how many tracks will be affected; every bulk fix is logged and reversible.
- **Works offline** — All matching and normalization run locally.

**Typical workflow:**
1. Open “Tag Cleanup” → “Artist / Producer”
2. System lists clusters of near-identical names with confidence scores
3. DJ reviews, picks the preferred spelling (or types a new one)
4. Applies to library → all matching tracks updated, aliases recorded
5. Future imports of the same messy name are automatically normalized

#### Additional Library Intelligence
- **Version Detection:** Automatically groups Radio Edit / Extended / Club Mix / Instrumental versions of the same track.
- **Smart Artist Graph:** Visual map of producers and frequent collaborators (useful for B2B and discovery).
- **Key + BPM Correction Memory:** Manual corrections are remembered and suggested for similar tracks.
- **Library Health Score:** Periodic report of unanalyzed tracks, tag inconsistency, orphaned files, and overplayed tracks.

### 3.2 Analysis
**Purpose:** Extract musically useful attributes from audio files locally.  
**Key Features:** BPM detection, key detection (Camelot + classical), beat grid, phrase boundaries (8/16/32-bar), vocal presence, loudness curve (EBU R128 LUFS), spectral brightness, structural markers (intro, drop, breakdown, outro), phrase confidence score, vocal density curve, safe mix-out window detection.  
**AI Role:** Local ONNX models (madmom, Essentia, CNN-based segmentation, quantized Spleeter). No cloud LLM for analysis.  
**Reliability:** BPM and beat grid are highly reliable. Key is reasonably reliable. Energy, mood, danceability, and groove are not automatically scored — they are left to DJ tags and manual input.  
**What It Does Not Do:** It does not claim to measure “groove,” “danceability,” or “mood” from audio. Those are subjective.

### 3.3 Cue Points
**Purpose:** Generate and export musically meaningful cue points.  
**Key Features:** One-click generation of 8 hot cues + memory cues, genre-aware templates (editable and savable), visual waveform editor, color-coded sections, phrase confidence indicators, export to rekordbox, Serato, Traktor, VirtualDJ, and standard `.cue` files.  
**AI Role:** Hybrid — deterministic structural markers + genre heuristics + user template preferences + override history.  
**What It Does Not Do:** It does not overwrite user cue points without permission. Every AI cue point is editable and logged.

### 3.4 Set Builder
**Purpose:** Build energy-mapped, harmonically compatible sets from constraints.  
**Key Features:** Target duration, start/peak/close BPM, energy curve, genre bias, mood filters, excluded tracks, locked favorites, one-click re-order, transition explanations, alternative suggestions, **Set Templates**, **Lock & Fill**, transition risk score, “Make it safer / more adventurous” re-optimization.  
**AI Role:** Hybrid pipeline — LLM for constraint extraction and explanation; deterministic optimization (Beam Search) for sequencing.  
**What It Does Not Do:** It does not use an LLM to sequence tracks. LLMs are not optimization engines.

**Set Templates:** Save successful sets as reusable templates (energy curve + BPM ramp + genre bias + average transition score).  
**Lock & Fill:** Lock 4–5 hero tracks in position; the system optimally fills the remaining slots.  
**Transition Risk Score:** Low / Medium / High flag based on key jump + BPM jump + phrase alignment in addition to the numeric score.

### 3.5 Search
**Purpose:** Make the library usable through natural language and structured filters.  
**Key Features:** “Find dark emotional tracks around 126 BPM.” “Give me tracks similar to this but slower and less vocal.” Hybrid search: structured filters + full-text + vector similarity (CLAP 512-dim) + personalized re-ranking.  
**AI Role:** Fast LLM parses natural language into structured query + vector modifiers.  
**What It Does Not Do:** It does not rely on pure keyword search or pure vector search alone.

### 3.6 Export
**Purpose:** Bridge DJ Assistant to the DJ’s actual workflow.  
**Key Features:** rekordbox XML export, Serato `.crate` export, CSV export, cue point export, **export presets** (Rekordbox + Serato + CSV in one click), dual-crate export for B2B.  
**AI Role:** None. Deterministic file generation (Rust quick-xml + binary crate serializer).  
**What It Does Not Do:** It does not write directly to a DJ software’s live database. It does not claim to be the canonical database.

### 3.7 Desktop Companion
**Purpose:** Local file access, watch folders, local analysis, export, cache.  
**Technology:** Tauri v2 (Rust backend + React/TypeScript frontend).  
**Responsibilities:** Folder scanning (notify crate), file hashing (BLAKE3), metadata reading (audiotags), audio analysis (ONNX Runtime + Symphonia), cue point export, sync with cloud, local waveform cache, SQLite local metadata DB, local rule engine for automations.  
**Offline Mode:** Works fully offline for analysis, library browsing, set building, tag cleanup, cue generation, and export. Cloud only for multi-device sync, collaboration, and optional LLM explanations.

### 3.8 DJ Brain
**Purpose:** Personalized intelligence layer that learns the DJ’s preferences over time.  
**What It Is:** A structured preference model + behavioral event log. Not a mystical AI consciousness.  
**Structured Data:** Preferred BPM range, preferred keys, preferred genres, avoided genres, energy curve preference, vocal preference, set length preference, preferred cue templates, preferred canonical artist spellings.  
**Behavioral Data:** Play events, cue point edits, set builder edits, crowd reaction ratings, tag correction history.  
**Inferred Data:** “Tracks that work after this track,” “overplayed tracks,” “forgotten tracks.”  
**Never Inferred:** Emotional state, career goals, private listening habits.  
**User Control:** DJ can inspect, edit, and delete every stored preference and inferred pattern.

### 3.9 Collaborative & B2B Set Preparation
**Purpose:** Enable two or more DJs to prepare a shared set together before a back-to-back (B2B) performance.  
**Key Features:**
- Shared Workspaces / Shared Sets with invite by email or link.
- Track Contribution from each DJ’s own library (lightweight reference only — no audio transfer).
- Real-time Co-Editing (presence, cursor awareness, conflict-free editing when online).
- Role-based Control (Owner / Co-DJ / Viewer).
- B2B-Specific Helpers: section ownership, “my tracks” vs “partner tracks”, complementary track suggestions, dual-crate + master set export.
- **USB Pack Generator:** Creates a clean folder structure + playlist for each DJ containing only the tracks they need to bring.
- **Pre-gig Sync Check:** One-button verification that both DJs have the same set order and all referenced tracks exist locally.
- **Change Log with Diff:** Clear history of who moved what and when.
- Offline-first with explicit conflict resolution.
- Comment & Annotation Layer on tracks and transitions.

**What It Does Not Do:**
- It does not transfer or stream actual audio files between DJs.
- It does not force both DJs to use the same library or cloud storage.
- It does not turn into a full multi-user DAW or live performance tool.

### 3.10 Automation Layer & Skills System
**Purpose:** Reduce repetitive work while keeping the DJ in complete control.  
**Design Principles:** Never silent • Always reversible • Local-first • DJ is final authority • No open-ended autonomous agents.

#### Rule-Based Workflows
- Watch Folder → Auto-analyze → Auto-generate cues → Apply tag cleanup → Add to “Unreviewed” smart playlist
- Rate track 5 stars → Suggest similar unplayed tracks → Add to “Candidates” playlist
- Before every export → Run Prep Auditor (missing cues, low-confidence analysis, tag inconsistency, energy curve gaps)
- “Gig Ready” one-click: analyze remaining tracks + generate cues + build set from last used template + export

#### Conditional Automations
- BPM confidence < 90% → flag for manual review
- Vocal presence in last 32 bars → auto-place “Vocal Warning” memory cue
- Same file hash, different metadata → auto-merge with preference rules

#### Scoped Skills (Enable / Disable / Inspect / Kill-switch)

| Skill | What it does | When it runs |
|-------|--------------|--------------|
| **Cue Master** | Generates + reviews cue points using genre templates + user override history | On demand or after analysis |
| **Tag Surgeon** | Fuzzy artist/producer cleanup + bulk alias creation | Manual or after import |
| **Set Architect** | Constraint-based set building + transition explanations | On demand |
| **Energy Cartographer** | Suggests energy curve templates based on genre + venue type (club / festival / warm-up / peak) | When creating a set |
| **Harmonic Scout** | Finds the best next track from current selection using the full scoring formula | Real-time in set builder |
| **Missing Track Hunter** | In B2B mode, detects which tracks the other DJ is missing and creates a clean “Bring USB” list | When collaborating |
| **Prep Auditor** | Pre-export checklist: missing cues, low-confidence BPM/key, duplicate artists, energy curve gaps | Before every export |
| **Library Doctor** | Periodic health report: orphaned files, unanalyzed tracks, tag inconsistency score, overplayed tracks | Weekly or on demand |

All Skills are transparent (show reasoning), overridable, logged, and can be disabled globally or per-workspace.

---

## 4. System Architecture & Component Interaction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TAURI V2 DESKTOP COMPANION                          │
│                                                                             │
│  ┌─────────────────────────┐            ┌────────────────────────────────┐  │
│  │   UI LAYER (React)      │◄──IPC─────►│ RUST CORE BACKEND              │  │
│  │   • Waveform Canvas     │  (JSON)    │ • Watch Folders (notify crate) │  │
│  │   • Energy Graph Canvas │            │ • SQLite + Local Metadata DB   │  │
│  │   • Skill Control Panel │            │ • Local Rule Engine            │  │
│  └─────────────────────────┘            └───────────────┬────────────────┘  │
│                                                         │                   │
│                                                         ▼                   │
│                                         ┌────────────────────────────────┐  │
│                                         │ NATIVE AUDIO ENGINE            │  │
│                                         │ • Symphonia (Decoding)         │  │
│                                         │ • ONNX Runtime (BPM, Key, Vocal)│  │
│                                         │ • Quick-XML (rekordbox export) │  │
│                                         │ • Binary Crate Serializer      │  │
│                                         └────────────────────────────────┘  │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │ HTTPS / WSS
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLOUD CONTROL PLANE                              │
│  • Fastify API Engine (LLM Constraint Parser & Workflow Orchestrator)       │
│  • PostgreSQL 16 + pgvector (Global Embedding Search & Set Indexing)        │
│  • Redis + BullMQ (Asynchronous Task Queue & Sync Buffer)                   │
│  • Auth Service, Track Service, Set Builder Service, Search Service         │
│  • Collaboration Service (shared sets, presence, conflict resolution)       │
│  • AI Gateway (LLM Provider + Embedding Models)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Analysis Pipeline
1. File validation (format, bitrate, corruption)  
2. Fingerprinting (BLAKE3 hash over first 1MB + track length) for duplicate detection  
3. Metadata extraction (ID3v2, MP4, FLAC, AIFF via audiotags; artwork, existing cue points)  
4. Local audio analysis: BPM, key, beat grid, structural segmentation, vocal presence, loudness (EBU R128), spectral brightness, phrase confidence, vocal density, safe mix-out window  
5. Feature computation: embeddings (CLAP 512-dim), phrase boundaries, similarity index  
6. Review gate: flag low-confidence attributes for DJ review  

### 4.2 Track Import & Processing Pipeline
```
[Local File Trigger] ──► [BLAKE3 Hash & Dedup] ──► [ID3 Tag Parser] ──► [ONNX Analysis]
                                                                             │
[rekordbox XML Export] ◄── [Set Graph Pathfinder] ◄── [Vector Index] ◄───────┘
```

### 4.3 Genre-Aware Automatic Cue Engine
The cue engine computes 8 hot cues and essential memory cues by analyzing structural phrase markers (8, 16, 32 bars) snapped to the primary beat grid.

**Cue Snapping Mathematics**  
Downbeat \( t_0 \) is established via spectral flux. Bar duration \( t_{\text{bar}} \) is defined as:

$$t_{\text{bar}} = \frac{240}{\text{BPM}}$$

All target hot cue timestamps \( T_{\text{cue}} \) snap to exact 8-bar phase boundaries:

$$T_{\text{cue}} = t_0 + \left(k \times 8 \times t_{\text{bar}}\right), \quad k \in \mathbb{N}$$

**Genre Cue Assignment Heuristics**

| Cue Slot  | Standard Electronic (EDM / Mainstage)                 | Extended Club (Melodic / Progressive / Techno / Deep) |
| --------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Hot Cue A | Downbeat (\( t = 0 \))                                | Downbeat (\( t = 0 \))                                |
| Hot Cue B | First Rhythmic Element / Vocal Intro                  | Groove Entry (Full Kick + Bassline)                   |
| Hot Cue C | Main Build-Up Start                                   | Primary Melodic Element / Lead Synth                  |
| Hot Cue D | Main Drop Peak Impact                                 | Peak Energy Drop / Primary Transition Impact          |
| Hot Cue E | Main Breakdown Start                                  | Atmospheric Breakdown / Bridge Entry                  |
| Hot Cue F | Secondary Drop                                        | Secondary Drop / Second Peak                          |
| Hot Cue G | Outro Start                                           | Outro Start (Mix-Out Window, 32 Bars Prior)           |
| Hot Cue H | Track End (-8 Bars)                                   | Track End (-16 Bars)                                  |
| Mem Cue 1 | Vocal Warning (\( T_{\text{vocal}} - 8 t_{\text{bar}} \)) | Vocal Warning (\( T_{\text{vocal}} - 8 t_{\text{bar}} \)) |
| Mem Cue 2 | Mix Out Deadline (-32 Bars)                           | Mix Out Deadline (-32 Bars)                           |

### 4.4 Hybrid Set Builder & Optimization Engine
The Set Builder combines deterministic graph traversal with LLM-assisted constraint interpretation.

```
[User Prompt / Constraints] ──► [LLM Constraint Parser] ──► [Candidate Filtering SQL]
                                                                   │
[Set Track Sequence] ◄── [Beam Search Graph Pathfinder] ◄── [Weighted Scoring Matrix]
```

**Multi-Variable Transition Scoring Function**  
Transition suitability \( S(A, B) \in [0, 1] \) between track \( A \) and track \( B \):

$$S(A, B) = w_1 S_{\text{key}}(A, B) + w_2 S_{\text{bpm}}(A, B) + w_3 S_{\text{energy}}(A, B) + w_4 S_{\text{semantic}}(A, B)$$

(Default weights: \( w_1 = 0.35 \), \( w_2 = 0.30 \), \( w_3 = 0.20 \), \( w_4 = 0.15 \))

**Vector Sub-Function Mathematics**

- **Harmonic Distance Score (\( S_{\text{key}} \)):** Evaluated over Camelot positions \( (N_A, M_A) \) and \( (N_B, M_B) \) where \( N \in [1, 12] \) and \( M \in \{\text{A}, \text{B}\} \):

$$S_{\text{key}}(A, B) = \begin{cases} 
1.00 & \text{if } N_A = N_B \text{ and } M_A = M_B \text{ (Exact Match)} \\ 
0.95 & \text{if } N_A = N_B \text{ and } M_A \neq M_B \text{ (Relative Major/Minor)} \\ 
0.90 & \text{if } \vert N_A - N_B\vert \equiv 1 \pmod{12} \text{ and } M_A = M_B \text{ (Perfect 5th/4th)} \\ 
0.80 & \text{if } \vert N_A - N_B\vert \equiv 7 \pmod{12} \text{ and } M_A = M_B \text{ (Energy Boost: +7 Semitones)} \\ 
0.40 & \text{if } \vert N_A - N_B\vert \equiv 2 \pmod{12} \text{ and } M_A = M_B \text{ (Whole Step Bump)} \\ 
0.00 & \text{otherwise (Dissonant Transition)} 
\end{cases}$$

- **Tempo Delta Score (\( S_{\text{bpm}} \)):**

$$S_{\text{bpm}}(A, B) = \begin{cases} 
1.00 & \text{if } \vert\text{BPM}_A - \text{BPM}_B\vert \le 1.0 \\ 
1.00 - \frac{\vert\text{BPM}_A - \text{BPM}_B\vert - 1.0}{5.0} & \text{if } 1.0 < \vert\text{BPM}_A - \text{BPM}_B\vert \le 6.0 \\ 
0.00 & \text{if } \vert\text{BPM}_A - \text{BPM}_B\vert > 6.0 
\end{cases}$$

- **Energy Curve Score (\( S_{\text{energy}} \)):** Given target energy trajectory \( E_{\text{target}}(t) \):

$$S_{\text{energy}}(A, B) = 1.0 - \min\left(1.0, \frac{\vert(\text{Energy}_B - \text{Energy}_A) - \Delta E_{\text{target}}\vert}{\sigma_{\text{threshold}}}\right)$$

- **Semantic Embedding Similarity (\( S_{\text{semantic}} \)):** Cosine similarity between 512-dimensional CLAP embeddings \( \mathbf{v}_A, \mathbf{v}_B \):

$$S_{\text{semantic}}(A, B) = \frac{\mathbf{v}_A \cdot \mathbf{v}_B}{\Vert\mathbf{v}_A\Vert \Vert\mathbf{v}_B\Vert}$$

**Graph Traversal Algorithm**  
Set generation uses a Beam Search Algorithm (beam width \( W = 10 \), depth \( D = \) target track count) across the transition graph to maximize cumulative set fitness \( \sum S(T_i, T_{i+1}) \) while avoiding track repetition and respecting duration limits.

### 4.5 Search Pipeline
1. Query understanding (fast LLM) → intent + modifiers  
2. Reference resolution (deterministic) → reference track embedding, BPM, key, vocal presence  
3. Vector search (pgvector) → top 200 candidates  
4. Structured filter application → BPM, vocal, mood tags  
5. Re-ranking → weighted combination: embedding similarity, BPM proximity, key compatibility, user rating  
6. Result assembly → top 50 with score breakdown  

### 4.6 Interoperability & Export Adapters

**Rekordbox XML Specification (rekordbox.xml)**  
Export structure generated natively via Rust quick-xml:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <COLLECTION Entries="1">
    <TRACK TrackID="101" Name="Solar Echoes" Artist="Subliminal" Kind="MP3 File"
           Size="12450800" TotalTime="412" AverageBpm="124.00" Tonality="8A"
           Location="file://localhost/Users/dj/Music/Solar_Echoes.mp3">
      <POSITION_MARK Name="Intro" Type="0" Start="0.000" Num="0" Red="255" Green="0" Blue="0"/>
      <POSITION_MARK Name="Groove" Type="0" Start="30.967" Num="1" Red="0" Green="255" Blue="0"/>
      <POSITION_MARK Name="Drop" Type="0" Start="61.935" Num="2" Red="255" Green="128" Blue="0"/>
      <POSITION_MARK Name="Outro" Type="0" Start="350.967" Num="6" Red="0" Green="0" Blue="255"/>
      <POSITION_MARK Name="Vocal Warning" Type="1" Start="123.870" Num="-1" Red="255" Green="255" Blue="0"/>
    </TRACK>
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT">
      <NODE Type="1" Name="DJ Assistant - Club Set Oct 2026">
        <TRACK Key="101"/>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>
```

**Serato Binary Crate Specification (.crate)**  
Binary crate files written to `_Serato_/Subcrates/*.crate` using big-endian byte structure:

```
[4 Bytes: "vrsn"] [4 Bytes Length] [UTF-16 String: "8/serato-crate"]
[4 Bytes: "otrk"] [4 Bytes Length]
    └─ [4 Bytes: "ptrk"] [4 Bytes Length] [UTF-16 String: Absolute File Path]
```

---

## 5. Data Model & Database Schema (PostgreSQL 16)

### Core Entities
- `users`, `workspaces`
- `tracks`, `track_embeddings`
- `playlists`, `playlist_tracks`
- `sets`, `set_tracks`
- `cue_points`
- `play_events`
- `ai_memory`
- `artist_aliases`
- `shared_set_members`, `set_track_contributions`
- `skills_config`, `automation_rules`, `skill_action_logs`
- `agent_action_logs` / `audit_log`

### Key Constraints
- `tracks.file_hash` UNIQUE per workspace
- Soft deletion via `deleted_at`
- `play_events` append-only
- All timestamps UTC
- Workspace isolation absolute

### Production Schema

```sql
-- Workspace & Multi-tenancy
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Core Track Library
CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    genre TEXT,
    bpm NUMERIC(5, 2) NOT NULL,
    key_camelot VARCHAR(3) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    loudness_lufs NUMERIC(4, 2),
    spectral_brightness NUMERIC(4, 3),
    vocal_presence BOOLEAN DEFAULT FALSE,
    phrase_confidence NUMERIC(3, 2),
    user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
    play_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_hash_per_workspace UNIQUE(workspace_id, file_hash)
);

-- Vector Similarity Index
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE track_embeddings (
    track_id UUID PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    embedding vector(512) NOT NULL,
    model_version TEXT NOT NULL
);

CREATE INDEX idx_track_embeddings_vector 
ON track_embeddings USING hnsw (embedding vector_cosine_ops);

-- Structural Cue Markers
CREATE TABLE cue_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position_ms INTEGER NOT NULL,
    cue_type TEXT NOT NULL CHECK (cue_type IN ('hot_cue', 'memory_cue', 'loop')),
    slot INTEGER CHECK (slot BETWEEN 1 AND 8),  -- hot cue slot A-H; NULL for memory cues / loops
    label TEXT NOT NULL,
    color_hex VARCHAR(7) DEFAULT '#FF0000',
    source TEXT NOT NULL CHECK (source IN ('ai_generated', 'user_custom', 'imported')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated Sets & Timelines
CREATE TABLE sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    event_name TEXT,
    target_duration_minutes INTEGER NOT NULL,
    energy_curve_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE set_tracks (
    set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    transition_score NUMERIC(3, 2) NOT NULL,
    transition_risk TEXT CHECK (transition_risk IN ('low', 'medium', 'high')),
    transition_notes TEXT,
    locked BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (set_id, position)
);

-- Smart Tag Cleanup: Artist / Producer Aliases
CREATE TABLE artist_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    canonical_name TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    normalized_form TEXT NOT NULL, -- lowercased, accent-stripped, space-collapsed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_alias_per_workspace UNIQUE(workspace_id, alias_name)
);

-- Collaborative / B2B Sets
CREATE TABLE shared_set_members (
    set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'co_dj', 'viewer')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (set_id, user_id)
);

CREATE TABLE set_track_contributions (
    set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    contributed_by UUID NOT NULL,
    local_file_hash VARCHAR(64),
    is_missing_for_others BOOLEAN DEFAULT FALSE,
    notes TEXT,
    PRIMARY KEY (set_id, track_id)
);

-- Skills & Automation
CREATE TABLE skills_config (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    config_json JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (workspace_id, skill_name)
);

CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    conditions_json JSONB NOT NULL,
    actions_json JSONB NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE skill_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    action TEXT NOT NULL,
    input_summary TEXT,
    output_summary TEXT,
    reversible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit & Safety Logs
CREATE TABLE agent_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Major API Endpoints
```
GET  /api/v1/tracks
POST /api/v1/tracks/import
POST /api/v1/tracks/:id/analyze
GET  /api/v1/tracks/:id/cue-points
POST /api/v1/search
POST /api/v1/sets/build
POST /api/v1/sets/:id/export
POST /api/v1/library/scan
POST /api/v1/ai/parse-query
POST /api/v1/sets/generate
POST /api/v1/tags/cleanup/preview
POST /api/v1/tags/cleanup/apply
POST /api/v1/sets/:id/invite
POST /api/v1/sets/:id/collaborate
POST /api/v1/skills/:name/run
POST /api/v1/automation/rules
GET  /api/v1/library/health
POST /api/v1/sets/:id/usb-pack
POST /api/v1/sets/:id/sync-check
```

### Example: Build a Set
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

## 6. Technical Contracts & API Interfaces

### 6.1 Tauri IPC Message Definitions (Rust ↔ React)

```typescript
// IPC Call: analyze_track
export interface AnalyzeTrackRequest {
  filePath: string;
  genreContext?: string;
}

export interface AnalyzeTrackResponse {
  trackId: string;
  fileHash: string;
  bpm: number;
  keyCamelot: string;
  durationMs: number;
  phraseConfidence: number;
  cues: Array<{
    slot: number;
    positionMs: number;
    label: string;
    cueType: 'hot_cue' | 'memory_cue';
    colorHex: string;
  }>;
}

// IPC Call: export_set
export interface ExportSetRequest {
  setId: string;
  format: 'rekordbox_xml' | 'serato_crate' | 'preset_all';
  exportPath: string;
}

export interface ExportSetResponse {
  success: boolean;
  exportedFile: string;
  trackCount: number;
}

// IPC Call: run_skill
export interface RunSkillRequest {
  skillName: string;
  params: Record<string, unknown>;
}

export interface RunSkillResponse {
  success: boolean;
  summary: string;
  reversible: boolean;
  details: unknown;
}
```

### 6.2 Set Builder Cloud Contract (POST /api/v1/sets/generate)

```typescript
export interface GenerateSetRequest {
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

export interface GenerateSetResponse {
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

---

## 7. Workstation Interface Specifications

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DJ ASSISTANT WORKSTATION                    [GIG READY] [EXPORT] [SKILLS]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ SET PROFILE: "Arena Club - Peak Hour" | Target: 120m | Key: Harmonic Ramp  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ENERGY CURVE CANVAS                                                         │
│ 10 ┼                                                  ╭───────╮             │
│  8 ┼                                           ╭──────╯       ╰──────╮      │
│  6 ┼                         ╭─────────────────╯                     ╰───   │
│  4 ┼  ╭──────────────────────╯                                              │
│  2 ┼──╯                                                                     │
│  0 ┴──┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───  │
│     00:00   00:15   00:30   00:45   01:00   01:15   01:30   01:45   02:00   │
├─────────────────────────────────────────────────────────────────────────────┤
│ SET SEQUENCE & DUAL WAVEFORM TRANSITION OVERLAY                             │
│                                                                             │
│ [Pos 04] Track A: Deep Horizon (124 BPM | 8A)                              │
│ OUT ──► |||||||||||||||||||||||||||||||||||................. [32 Bars Out]  │
│ IN  ──► .................||||||||||||||||||||||||||||||||||| [32 Bars In]   │
│ [Pos 05] Track B: Solar Wind (125 BPM | 8A) -- Score: 98% | Risk: Low      │
│                                                                             │
│ Alternatives: [Swap: Starlight (98%)] [Swap: Eclipse (94%)] [Swap Manual]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Interactive Control Nodes**
1. **Interactive Energy Curve Canvas:** Multi-point bezier node editing. Dragging energy nodes triggers real-time path re-calculation.
2. **Dual-Waveform Transition Inspector:** Visualizes incoming/outgoing tracks overlaid at phase boundary alignment zones (16/32 bars), rendering color-coded cue locations.
3. **Alternative Transition Drawer:** Displays top 3 candidate track swaps per slot without breaking global set constraints.
4. **Skills Panel:** Enable/disable individual Skills, view last run results, kill-switch.
5. **Gig Ready Button:** One-click execution of the full pre-gig workflow.

---

## 8. Safety, Integrity & Rules Engine

To protect user media libraries, all operations adhere to strict system boundaries:

```
                  ┌───────────────────────────────┐
                  │      INCOMING ACTION          │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │    IS IT READ-ONLY ON AUDIO?  │
                  └───────┬───────────────┬───────┘
                          │               │
                     YES  │               │ NO
                          ▼               ▼
                  ┌──────────────┐ ┌──────────────┐
                  │ ALLOW ACTION │ │ BLOCK ACTION │
                  └──────────────┘ └──────────────┘
```

1. **Non-Destructive Guarantee:** Source audio files are accessed strictly read-only. Metadata modifications are stored in local SQLite or exported via secondary exchange files (XML, .crate).
2. **Deterministic Overrides:** Any manual cue point shift or key correction by the DJ permanently overrides AI values for that track, saving an explicit user delta record.
3. **System Audit Logs:** All automated tasks and Skill actions log execution metrics and input/output parameters.
4. **Skill Safety:** Every Skill action is reversible by default. Bulk operations always require explicit confirmation with preview.
5. **No Silent Automation:** Every automated change surfaces a clear summary the DJ can review or undo.

---

## 9. Non-Functional Requirements (NFRs)

- **Local Analysis Speed:** < 3.0 seconds per 6-minute lossless WAV/FLAC audio track on standard consumer hardware (Apple M1 / Intel i7, 16GB RAM).
- **UI Responsiveness:** 60 FPS rendering on waveform zoom and energy curve editing.
- **Export Validation:** 100% pass rate on XML validation schemas for Pioneer rekordbox 6.0+ and Native Instruments Traktor 3.0+.
- **Memory Footprint:** < 150 MB RAM footprint for the desktop shell idle state.
- **Offline Functionality:** 100% of core audio analysis, cue generation, tag cleanup, set building, and export functionality operates without internet access. Cloud API access is required solely for vector search syncing, collaboration, and natural language set prompt parsing.
- **Automation Latency:** Rule-triggered Skills that run locally complete in < 500 ms for typical library operations.

---

## 10. MVP Scope

### Build These, Nothing Else

| Feature                                             | Priority |
| --------------------------------------------------- | -------- |
| Desktop app (Tauri v2)                              | P0       |
| Track import (folder scan, metadata)                | P0       |
| Local audio analysis (BPM, key, beat grid, phrases) | P0       |
| Track library (browse, search, filter)              | P0       |
| Cue point generation + manual edit                  | P0       |
| Set Builder (constraint-based, energy curve)        | P0       |
| Export: rekordbox XML                               | P0       |
| Export: Serato crate                                | P0       |
| Smart Tag Cleanup (artist/producer normalization)   | P1       |
| Track embeddings (CLAP)                             | P1       |
| Natural language search                             | P1       |
| Mini player (waveform preview)                      | P1       |
| Prep Auditor Skill + Gig Ready workflow             | P1       |
| Set Templates + Lock & Fill                         | P1       |
| Collaborative / B2B shared sets                     | P2       |
| Full Skills system (Cue Master, Tag Surgeon, etc.)  | P2       |
| Automation Rule Engine                              | P2       |
| USB Pack Generator + Pre-gig Sync Check             | P2       |

### MVP Does NOT Include
- Full multi-user real-time presence (basic collaboration first)
- Gig management / calendar
- Analytics dashboards beyond library health
- Brand / content / marketing tools
- Open-ended autonomous agents
- Social integrations
- Mobile app

### MVP Success Metric
> A DJ imports 500 tracks, cleans messy tags, analyzes them, builds a 2-hour set (optionally with a B2B partner), exports it to rekordbox, and says: “This saved me two hours.”

---

## 11. 90-Day Execution Roadmap & Launch Milestones

```
  DAYS 1–30: Core Engine & Desktop Shell
  [====================]
  • Tauri v2 Rust Shell with local folder watching.
  • Integrated local ONNX Runtime engine (madmom beat grid, key detection).
  • Local SQLite database schema and metadata parser.

  DAYS 31–60: Set Builder & Export Adapters
  [====================]
  • Multi-variable graph pathfinder (Beam Search engine).
  • rekordbox XML and Serato `.crate` export serializing engines.
  • Interactive Energy Canvas & Waveform Inspector in React UI.
  • Smart Tag Cleanup (fuzzy matching + aliases).

  DAYS 61–90: Field Validation & Production Polish
  [====================]
  • Closed beta testing with active resident/working DJs.
  • Performance tuning to achieve < 3s local analysis per track.
  • Verification of exports on Pioneer CDJ hardware (CDJ-2000NXS2 / CDJ-3000).
  • Prep Auditor + Gig Ready one-click workflow.
```

**Production Launch Criteria**
- Execution Speed: Full analysis and export of a 40-track library completed in < 15 minutes.
- Cue Placement Accuracy: > 90% acceptance rate on automatically placed hot cues across closed beta tracks.
- Zero Corruption Guarantee: 0 recorded file corruption errors across source user media during all testing phases.
- Tag Cleanup: > 95% of near-duplicate artist names correctly clustered in closed beta libraries.

### Longer-Term Roadmap

**V1.5**
- Cloud accounts + sync
- Smart Tag Cleanup (full production)
- Prep Auditor Skill + Gig Ready workflow
- Set Templates + Lock & Fill
- rekordbox import (read-only)
- Serato import (read-only)
- Basic analytics (library stats)
- Default automation: import → analyze → cue

**V2**
- Collaborative / B2B shared sets (invite, co-editing, track contribution, dual export)
- USB Pack Generator + Pre-gig Sync Check
- Full Skills system with enable/disable + logging
- Automation Rule Engine
- Learning-to-rank for set builder
- Traktor export
- VirtualDJ export
- Advanced search (saved queries, smart playlists)
- Custom cue point templates
- Full desktop offline mode

**V3**
- Real-time collaborative presence & conflict-free editing
- Artist Graph + Version detection
- RL-based set builder (if data supports)
- Engine DJ export
- Mobile companion (read-only library)
- Content system (only if validated)
- Marketplace (cue packs, templates)

---

## 12. Business Model & Pricing

| Tier   | Price     | Includes                                                     |
| ------ | --------- | ------------------------------------------------------------ |
| Free   | $0        | 500 tracks, basic analysis, 5 set builds/month               |
| Pro    | $15/month | 10,000 tracks, unlimited sets, cue export, priority analysis, Tag Cleanup, Prep Auditor |
| Studio | $29/month | 100,000 tracks, multiple workspaces, API access, B2B collaboration |
| Team   | $49/month | 5 seats, shared workspaces, admin controls, advanced automation |

### Cost Per Active DJ / Month

| Item                        | Cost      |
| --------------------------- | --------- |
| Audio storage               | $2.50     |
| Waveform storage            | $0.10     |
| Embedding storage           | $0.05     |
| LLM (search + explanations) | $0.75     |
| Bandwidth                   | $0.25     |
| Database + Redis            | $0.75     |
| **Total**                   | **$4.40** |

**Pro at $15/month = ~71% gross margin.**

### Revenue Models to Avoid
- AI credits (confusing, punitive)
- Marketplace commissions (needs scale)
- Label services (industry relationships, not software)
- Advertising tools (fragile integrations)

---

## 13. Security & Privacy

### Core Principles
1. Music libraries are highly private.
2. Never train general models on user data without explicit, revocable consent.
3. Workspace isolation is absolute.
4. User data is exportable and deletable.
5. AI processing is disclosed.
6. Skills and automations never perform irreversible actions without confirmation.

### Technical Measures
- OAuth 2.0 + OIDC
- TLS 1.3
- AES-256 at rest
- Short-lived JWT + refresh rotation
- Signed URLs (15-minute expiry)
- Rate limiting per workspace
- Audit logs for all write operations and Skill actions
- One-click data export
- Soft delete → hard delete after 30 days

### GDPR Compliance
- Explicit opt-in for AI training
- Right to access, erasure, portability
- Privacy dashboard showing stored and inferred data
- Integration revocation

---

## 14. Competitive Positioning & Moat

| Competitor   | What They Do Well              | What DJ Assistant Does Differently                     |
| ------------ | ------------------------------ | ------------------------------------------------------ |
| rekordbox    | Industry standard, performance | Better AI analysis, set builder, cross-software export, tag cleanup |
| Serato       | Performance, stems             | Library intelligence, preparation workflow, collaboration |
| Traktor      | Strong analysis                | Modern UX, AI-native preparation, automation           |
| DJ.Studio    | Timeline set building          | Real-time library intelligence, better integration, B2B |
| Mixed In Key | Key detection, energy          | Integrated workflow, set builder, cue points, tag tools |
| Beatport     | Discovery, purchasing          | Preparation layer that links to Beatport               |
| Spotify      | Massive library                | Metadata-only import, no audio download                |

### Defensible Assets
- **DJ Brain** — Personalized preference model + behavioral history
- **Play event history** — Proprietary behavioral data
- **Transition graph** — Learned from play events across users (with consent)
- **Set history** — Unique behavioral dataset
- **Tag alias graph** — Cleaned producer name knowledge per user and (with consent) across users
- **Skill action history** — Preference signals from how DJs override or accept automation

### Commodity Features
- BPM detection
- Key detection
- Waveform display
- Basic playlist management
- Stem separation

### Dangerous Features to Build
- Live performance tools (rekordbox/Serato will win)
- Music streaming (licensing nightmare)
- Social network (DJs don’t need another)
- Autonomous email sending (reputation + legal risk)
- Open-ended agents that can modify libraries without clear previews

---

## 15. Integrations & Legal Strategy

### DJ Software Integrations

| Priority | Integration                  | Method                                 |
| -------- | ---------------------------- | -------------------------------------- |
| 1        | rekordbox XML export         | XML file generation (Rust quick-xml)   |
| 2        | Serato crate export          | `.crate` file generation (binary)      |
| 3        | rekordbox import (read-only) | `pyrekordbox` / XML import             |
| 4        | Serato import (read-only)    | GEOB tags / `.crate` import            |
| 5        | Traktor `.nml` export        | XML generation                         |
| 6        | VirtualDJ                    | `database.xml` (read-only)             |
| 7        | Engine DJ                    | Proprietary database (lowest priority) |

**Never:** Write directly to a DJ software’s live database. Never claim to be the canonical database. Never promise bidirectional sync.

### Spotify / Music Source Strategy
**Can Build:**
- Import playlist metadata (user’s own playlists)
- Match against local library
- Identify missing tracks
- Link to Beatport/Bandcamp/Amazon/iTunes for purchase

**Must NOT Build:**
- Download audio from Spotify
- Stream Spotify audio in the app
- Store Spotify audio files
- Bypass purchase

**API Restrictions:** Spotify only allows playlist contents for playlists the user owns or collaborates on. Handle gracefully.

---

## 16. Do Not Build

- Social media tools
- Content generation
- Marketing campaigns
- Label submission management
- Career planning
- Open-ended “chat with your music” chatbot
- Spotify audio download
- Live performance tools
- Autonomous social posting
- Autonomous demo submission
- Music purchasing automation
- Silent irreversible bulk operations
- Features that require the DJ to give up ownership of their library or analysis data

---

## 17. Founder / CTO Brief

### What to Build First
A desktop app that does these things exceptionally well:
1. Analyze tracks locally (BPM, key, beat grid, phrases)
2. Generate cue points with a fast review UI
3. Clean messy artist/producer tags
4. Export to rekordbox XML

That is the MVP wedge. That is what DJs will pay for immediately.

### What to Ignore Until Product-Market Fit
Brand. Content. Marketing. Labels. Career. Open-ended agents. Complex multi-user real-time features. Analytics dashboards. Ignore until you have 1,000 paying users who love the core product.

### What Could Make This a Large Company
**The DJ Brain + play event data + tag alias graph + Skill override history.**

If you get 10,000 DJs using the set builder, logging play events, cleaning tags, and accepting/rejecting Skill suggestions, you have a proprietary dataset of DJ behavior that cannot be scraped or bought. It can only be earned by building the workflow that DJs actually use every week.

**Build the tool. Earn the data. Then build the intelligence.**

---

*This is the merged Master Product Specification & Canonical Documentation for DJ Assistant v1.1. It incorporates the original focused commercial definition, the full technical engineering specification, Smart Tag Cleanup, Collaborative/B2B preparation, the Automation Layer, the scoped Skills system, and all approved library and set-builder intelligence upgrades. It remains the single source of truth for product, engineering, marketing, and investors.*
