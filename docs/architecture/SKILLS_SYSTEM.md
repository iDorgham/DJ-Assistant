# DJ Assistant — Skills System

**Status:** Approved concept (Canonical v1.1)  
**Last Updated:** 2026-10-08

Skills are the primary mechanism for scoped, reversible, inspectable automation in DJ Assistant.

---

## 1. Design Goals

1. **Scoped** — Each Skill does one clear job.
2. **Transparent** — Users can see what a Skill did and why.
3. **Reversible** — Every successful run that mutates data writes an undo record.
4. **Controllable** — Enable / disable globally or per workspace. Kill-switch available.
5. **Composable** — Automation rules can chain Skills into workflows (Import → Analyze → Cue → Cleanup → Export).
6. **Non-autonomous** — Skills never take irreversible actions without explicit confirmation when risk is high.

---

## 2. Core Skills (v1 Catalog)

| Skill ID | Name | Primary Responsibility | Typical Trigger |
|----------|------|------------------------|-----------------|
| `cue_master` | Cue Master | Generate / refine 8 hot cues + memory cues using structural markers + genre templates | After analysis, on demand |
| `tag_surgeon` | Tag Surgeon | Fuzzy artist/title cleanup, canonicalization, alias management | Manual or post-import |
| `set_architect` | Set Architect | Constraint extraction + Beam Search set construction | Set Builder UI / natural language |
| `energy_cartographer` | Energy Cartographer | Energy curve computation, visualization, and suggestions | Set building, Prep Auditor |
| `harmonic_scout` | Harmonic Scout | Find harmonic + tempo compatible candidates | Set Builder, library search |
| `missing_track_hunter` | Missing Track Hunter | Detect gaps in versions, missing files, broken paths | Library health |
| `prep_auditor` | Prep Auditor | Pre-gig checklist: unanalyzed tracks, missing cues, tag issues, energy gaps | Gig Ready workflow |
| `library_doctor` | Library Doctor | Overall library health score + recommended fixes | Periodic / on demand |

Additional Skills may be added later; the system is designed to be extensible.

---

## 3. Skill Lifecycle

```
[Trigger] (manual, rule, or workflow)
    │
    ▼
[Pre-flight] — Check enabled? Permissions? Dry-run?
    │
    ▼
[Snapshot] — Capture before_state for affected entities
    │
    ▼
[Execute] — Perform the work (local preferred)
    │
    ▼
[Record] — Write skill_runs entry + after_state
    │
    ▼
[Notify UI] — Show results, diffs, confidence, undo button
```

---

## 4. Required Interface (Conceptual)

Every Skill must implement (or be describable by) roughly:

```ts
interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;

  // Capabilities
  isEnabled(context: WorkspaceContext): boolean;
  canRun(input: SkillInput): boolean | { ok: false; reason: string };

  // Execution
  run(input: SkillInput, ctx: SkillContext): Promise<SkillResult>;

  // Reversibility
  undo(runId: string, ctx: SkillContext): Promise<void>;

  // Observability
  getLastRuns(limit: number): Promise<SkillRunSummary[]>;
}
```

`SkillResult` includes:
- success / failure
- human-readable summary
- structured changes (for UI diff)
- confidence scores where applicable
- references to created history records

---

## 5. Automation Rules & Workflows

Users (and later templates) can define rules:

```
WHEN  [tracks imported] OR [analysis completed]
IF    [genre contains "Techno"] AND [cues missing]
THEN  run Cue Master (template: "Extended Club")
```

**Gig Ready** is a special one-click workflow that runs a curated sequence:
1. Library Doctor (quick health)
2. Analyze missing tracks
3. Tag Surgeon (optional)
4. Cue Master on selected / new tracks
5. Prep Auditor final check
6. Export package (USB Pack / set export)

---

## 6. Safety & Control Surfaces

| Control | Description |
|---------|-------------|
| Global enable/disable | Per Skill in Settings → Skills |
| Workspace override | Different defaults for different libraries / gigs |
| Kill-switch | Immediately stop all running Skills and disable new runs |
| Confirmation thresholds | High-impact bulk actions require explicit confirm |
| Dry-run / Preview | Show proposed changes before applying |
| Full history | Every run is inspectable and undoable (within retention policy) |

---

## 7. Implementation Notes for Engineers

- Prefer pure, testable core logic in Rust (or shared packages) with thin Skill wrappers.
- History / undo records must be written **before** the mutation is committed, or in the same transaction.
- Skills that call the LLM (e.g. constraint parsing inside Set Architect) must treat the LLM as untrusted input and validate structured output.
- UI must always offer an obvious path to inspect “what just happened” and undo.

---

## 8. Related Documents

- [Architecture](./ARCHITECTURE.md)
- [Data Model](./DATA_MODEL.md) — `skill_runs` / action history tables
- [Canonical Documentation §3.10](../product/CANONICAL_DOCUMENTATION.md)
