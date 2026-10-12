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
