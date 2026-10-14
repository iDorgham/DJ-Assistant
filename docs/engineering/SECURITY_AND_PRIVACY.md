# DJ Assistant — Security & Privacy

**Status:** Binding principles + operational controls  
**Last Updated:** 2026-10-08  
**Companion:** [TESTING_AND_SECURITY.md](./TESTING_AND_SECURITY.md) — test strategy, phase security gates, PR checklist, AI automation integration

DJ Assistant is built local-first and privacy-respecting by design. This document captures the non-negotiable guarantees and the threat model engineers must honor. Operational testing and security gates live in the companion document.

---

## 1. Core Guarantees

1. **Raw audio never leaves the device** unless the user explicitly chooses a future feature that requires it (none in v1 scope).
2. **Analysis is local** — BPM, key, beat grid, phrases, vocals, loudness run via ONNX on the user’s machine.
3. **Cloud receives only derived data** the user has opted in to sync (metadata, features, set structures, embeddings).
4. **No autonomous irreversible actions** — Skills and automations that mutate library data are logged and reversible; high-impact actions require confirmation.
5. **Source files are never modified** — All outputs are sidecars, exports, or local database records.

---

## 2. Data Classification

| Class | Examples | Handling |
|-------|----------|----------|
| **Critical / Local-only** | Raw audio, full waveforms, local analysis cache | Never transmitted |
| **Sensitive (user-controlled)** | Tags, cue points, set contents, preferences | Local by default; optional encrypted sync |
| **Account / Collaboration** | Auth tokens, workspace membership, shared set state | Standard secure practices; least privilege |
| **Telemetry (future)** | Anonymized performance metrics, crash reports | Opt-in, no audio or identifying library content |

---

## 3. Threat Model (Summary)

| Threat | Mitigation |
|--------|------------|
| Malicious or malformed audio files | Robust parsing (Symphonia), sandbox analysis where possible, no unsafe assumptions |
| Path traversal / arbitrary file access | Strict path canonicalization; only operate inside user-selected watch folders / library roots |
| Supply-chain attacks on models or dependencies | Pin versions, verify model checksums, prefer audited crates |
| Cloud account takeover | Strong auth, short-lived tokens, workspace-scoped permissions |
| Insider / server-side access to user data | Minimize data stored; encrypt sensitive fields at rest where practical; no raw audio |
| Skill or automation doing unwanted bulk changes | Mandatory history + undo; confirmation for high-impact ops; kill-switch |
| LLM prompt injection (constraint parsing) | Treat LLM output as untrusted; schema-validate; never let LLM directly mutate the library |

---

## 4. Local Security Practices

- Use Tauri’s security model (CSP, capability-based allowlists, no Node.js integration by default).
- Restrict filesystem access to user-approved directories.
- Store secrets (if any) in the OS keychain / credential manager, not in plaintext config.
- Prefer memory-safe languages (Rust) for the analysis and file-handling core.

---

## 5. Cloud Security Practices

- TLS everywhere.
- Authenticated and authorized API endpoints (workspace / resource scoped).
- Rate limiting and input validation on all public endpoints.
- Database credentials and LLM keys only in secure secret storage.
- Regular dependency updates and vulnerability scanning in CI.

### 5.1 Spotify Playlist Export (Post-MVP — Streaming Export, Metadata Only)

Publishes a built set (or any playlist) to the DJ's own Spotify account as a real Spotify playlist. Each local track is matched to a Spotify track by ISRC first, then by a fuzzy match (normalized title/artist/album + ±3 s duration) with a confidence score; high confidence auto-adds, medium/low go to a review queue, and unmatched tracks are reported ("search Spotify manually" / "skip"). Audio is never downloaded, streamed, stored, or uploaded.

**Authentication & tokens**
- OAuth 2.0 **Authorization Code + PKCE** (RFC 7636), desktop/Tauri, entirely in the app.
- Embedded **public** client ID only; **no client secret anywhere** and no cloud dependency.
- Redirect: loopback (`http://127.0.0.1:<port>/callback`) or custom URI scheme; the OAuth `state` parameter is required and verified on callback (CSRF).
- Access + refresh tokens live in the **OS keychain** — never plaintext, never in the SQLite DB, never logged.
- **Minimal scopes:** `playlist-modify-private` (default); `playlist-modify-public` only when the DJ explicitly opts into a public playlist; `playlist-read-private` only when updating an existing playlist. No library/email scopes.

**Data flow (metadata only)**
- Only track metadata (title/artist/album/ISRC/duration) and search queries leave the device. No audio is downloaded, streamed, stored, or uploaded.
- No AI training on Spotify data.

**Threat model**

| Threat | Mitigation |
|--------|------------|
| Token theft / exfiltration | OS keychain storage; tokens never in the DB, logs, or client bundles; short-lived access tokens refreshed from the keychain-held refresh token |
| Scope creep | Minimal scopes; public/read scopes opt-in only; no library/email scopes requested |
| Malicious redirect / deep-link interception | Registered/allow-listed redirect URI; loopback bound to `127.0.0.1`; PKCE code verifier blocks code interception |
| CSRF on the OAuth callback | Random `state` parameter generated per flow and verified before exchanging the code |
| Over-broad playlist access | Limited to the DJ's own playlists; no access beyond what Spotify permits for owned/collaborative playlists |
| Accidental public exposure of a playlist | Private by default; making a playlist public requires explicit opt-in |

**Disconnect / revocation**
- Disconnect removes locally stored tokens; it does not revoke the Spotify authorization grant.

**Rate limits & errors**
- `429` + `Retry-After` → exponential backoff; `401` → token refresh; surface `403`/`404` to the reviewer.

### 5.2 Discovery, Enrichment & Multi-Provider (TF shipped; TD/TE/TX post-MVP)

The §5.1 posture extends to every provider: only track metadata, audio
fingerprints (AcoustID/Chromaprint, computed locally) and search queries leave
the device; audio never does. Additional rules:

- **Opt-in per provider** — external similarity, enrichment lookup, charts/radar
  and each export target are enabled individually; the shipped foundations
  (similar scoring, gap detection, buy-links, provider registry) need no network.
- **Enrichment writes DB only** — online proposals apply to canonical DB fields
  through preview → apply → undo; source-file hashes must be unchanged after apply.
- **Unofficial feeds labelled** — chart snapshots and radar feeds without an
  official API are marked as such in the UI; credential-based scraping is not used.
- **No in-app playback** — for Spotify, Deezer, Apple Music, YouTube Music,
  SoundCloud and TIDAL alike: playlist export is metadata-only, and streaming
  audio inside the app is out of scope.

---

## 6. Skills & Automation Safety Rules

1. Every mutating Skill writes a `before_state` snapshot before applying changes.
2. Bulk operations show a preview (affected count + sample) and require confirmation above a threshold.
3. Users can disable any Skill or all Skills instantly.
4. A global kill-switch stops in-flight work and prevents new Skill runs.
5. History retention policy is documented and configurable.

---

## 7. What We Explicitly Do Not Do

- Upload audio libraries for “cloud analysis”.
- Train models on user audio without explicit, separate consent (out of scope for v1).
- Provide features that enable or encourage copyright infringement or unauthorized distribution.
- Run hidden or always-on network connections that the user cannot disable.

---

## 8. Related Documents

- [Testing & Security Plan](./TESTING_AND_SECURITY.md) — **primary operational security & testing controls**
- [AI Development Automation Plan](../devops/AI_DEVELOPMENT_AUTOMATION_PLAN.md)
- [Architecture](../architecture/ARCHITECTURE.md)
- [Skills System](../architecture/SKILLS_SYSTEM.md)
- [SDD Acceptance Criteria](../sdd/05-ACCEPTANCE.md)
- [Canonical Documentation](../product/CANONICAL_DOCUMENTATION.md) — Product-level privacy statements
