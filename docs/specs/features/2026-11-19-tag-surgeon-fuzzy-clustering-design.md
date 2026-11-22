# T2.2.1 — Tag Surgeon fuzzy clustering (design)

Date: 2026-11-19 · Branch: `feat/tag-surgeon-fuzzy-clustering` (cut from `origin/main` `7036f833`)
Ledger: [`docs/sdd/04-TASKS.md`](../../sdd/04-TASKS.md) §2.2 · Acceptance: [`docs/sdd/05-ACCEPTANCE.md`](../../sdd/05-ACCEPTANCE.md) P2.2

## 1. Status of the decisions

Ratified in the design gate on 2026-11-19:

| Question | Decision |
| -------- | -------- |
| Which field does the first surface cluster? | **Custom tags** (`track_tags`), not artists or genre. The engine stays field-agnostic. |
| How is the risky "prefixes" dimension handled? | **Fold = cluster, prefix = advisory edge.** Prefix relations never merge a cluster. |
| Algorithm shape | **Approach A** — fold-bucket in one pass, no thresholds. Rejected: union-find with edit distance (transitive chaining, untunable), ONNX embeddings (nondeterministic, wrong metric). |

Why tags: the `Fix tags` menu item already promises it ("Tag cleaning arrives with the
Tag Surgeon (T2.2)"), `04-TASKS.md` §2.2's own T2.2.5/T2.2.6 wording is tag operations, and
migration 007 says out loud that `track_tags` exists so the Tag Surgeon has "a table to
clean up later". Artists are what acceptance P2.2 measures in words, and the engine serves
them unchanged — the artist surface is a later slice, not a rewrite.

## 2. Problem

Tags are user-typed strings in a table whose primary key is `(track_id, tag)` with SQLite's
default BINARY collation. Nothing normalizes what the user types, so `Melodic House`,
`melodic house` and `melodic house ` are three distinct rows, and a single track can carry
all three at once. The tag filter (`EXISTS` in `library_query.rs`) and `TagChips` then treat
them as unrelated tags, which splits the user's own vocabulary.

T2.2.1's job is only to **find and report** those groups. Suggesting a canonical spelling is
T2.2.2, previewing the change is T2.2.3, applying it is T2.2.4.

## 3. Non-goals

Canonical-name suggestion · preview-diff UI · bulk apply · the `aliases` table and import
auto-mapping · undo/history · artist, title and label surfaces · splitting comma-joined
multi-artist strings · typo correction (edit distance) · any write to the database or to a
source file.

## 4. Normalization contract

`normalize_tag` produces a *fold key*. The steps are ordered and part of the contract; the
function is **idempotent** (folding a key yields the same key), which is a test, not an
aspiration.

1. Unicode lowercase (`str::to_lowercase`, not ASCII-only). This is **not** full case
   folding: `ß` stays `ß` (see the deliberate non-folds below).
2. NFD-decompose, then drop the combining **diacritic** blocks used with Latin, Greek and
   Cyrillic bases (U+0300–U+036F, U+1AB0–U+1AFF, U+1DC0–U+1DFF, U+FE20–U+FE2F). Marks that
   are orthographic in other scripts — kana voicing (U+3099/U+309A), Indic and Thai vowel
   signs and viramas — are **kept** as key characters, and the key is NFC-recomposed.
   Stripping them would fold `ガ` into `カ`: an invented equivalence, not an accent.
3. Replace every character that is not a Unicode letter, digit or kept mark with a **space** — not with
   nothing. Punctuation in a tag vocabulary is a separator, so this is what folds `Hi-NRG` with
   `Hi NRG` and `Drum 'n' Bass` with `Drum N Bass`; stripping instead would reattach the halves
   into a third key (`hinrg`) and match neither.
4. Collapse runs of whitespace to one space; trim both ends.

Folded (these are the task line's five dimensions): case, spacing (leading/trailing/internal),
accents/diacritics, punctuation and symbols.

```
"RÜFÜS DU SOL"   → "rufus du sol"
"rüfus  du sol "  → "rufus du sol"
"İbrahim Çelik"   → "ibrahim celik"
"DJ-Lackmus"      → "dj lackmus"      = "DJ Lackmus"
"Drum 'n' Bass"   → "drum n bass"     = "Drum N Bass"
"!!!"             → ""                (excluded, see §5)
"ガ"              → "ガ"              ≠ "カ"   (voicing mark kept)
"ม่า"             → "ม่า"              ≠ "มา"   (Thai tone mark kept)
```

The residual recall loss is a tag written with the punctuation *removed* rather than replaced
(`DJLackmus`), which stays its own key. That is the same conservative trade as the next
paragraph: a missed merge costs a review pass, a false merge renames the user's tag.

The fold key is **internal**: the UI shows raw spellings (§9), because `h as` is a correct key
for `H;as` and a nonsense thing to show a user.

Deliberately **not** folded: `ß`→`ss`, `ı`→`i`, `æ`→`ae`, `ø`→`o`, `đ`→`d`. Those characters
survive step 2 (they are not decomposable) and are letters, so they fold only to themselves.
The cost is recall — `Straße` and `Strasse` stay two keys. The benefit is that the folder
never invents an equivalence, which is what P2.2's "high precision" bar rewards. Expanding
this table is a later decision with its own evidence, not a silent part of step 2.

`İ` is precisely why a hand-rolled Latin-1 table was rejected: `İ`.to_lowercase() is `i` +
U+0307 COMBINING DOT ABOVE, which only step 2's mark-strip removes.

## 5. Clusters and prefix edges

**Input.** The distinct tag vocabulary of the selection: one entry per spelling, each with the
ids of the tracks carrying it. Spelling duplicates are impossible by the primary key, so the
vocabulary is already distinct.

**Exclusion guard.** A value whose fold key is empty is excluded from clustering and counted
as `ignored`. Without it, `!!!` and `???` — two different tags, both emptied by steps 3–4 —
would merge into one cluster. This guard is load-bearing, not defensive.

**Cluster.** ≥2 distinct raw spellings sharing one non-empty key. A single spelling under a key
is not a cluster; there is nothing to clean. A cluster reports:

- `key`, and its members' `raw` + `track_count`;
- `distinct_track_count` — the size of the **union** of member track ids, never the sum. A
  track carrying two spellings of the same tag is one affected track, and the sum would
  overstate the work the later bulk apply has to do.

**Representative spelling.** For any fold key, its representative is the raw spelling carrying
the most tracks, ties broken by byte-smallest raw. The rule exists once, is used by the dialog
for every label it shows, and is a test case (it is the only place a display choice is made).

**Prefix edge.** A relation between two **different** keys where all of:

- `narrower` is ≥3 characters (otherwise `ho` attaches to every House tag);
- `broader` starts with `narrower` **followed by a space** — a word boundary, so `Melodic House`
  matches `Melodic House Techno` and does not match `Melodic Houseplants`;
- the two keys are not equal.

Edges are emitted as pairs and **never** transitively closed: `A→B` and `B→C` do not imply
`A→C`, and no cluster joins because an edge exists. Edges carry the key *and* that key's
representative spelling plus its track count, on both sides. The spelling is not decoration:
edges are computed across the whole vocabulary, not only clustered keys, and the most
interesting finding — `Melodic House` ⊂ `Melodic House & Techno` — sits between two
**singletons**, which appear nowhere in `clusters`. Without a label on the edge the dialog
could only show a fold key it is not allowed to render (§4).

**Determinism.** Clusters order by `distinct_track_count` desc, then `key` asc. Members order by
`track_count` desc, then `raw` asc (byte order). Edges order by the smaller side's count desc,
then `narrower_key` asc, then `broader_key` asc. Two runs over the same library return
byte-identical JSON; that is asserted.

**Complexity.** Folding and bucketing are O(n). Edge detection is O(n²) over distinct keys in
the worst case; an implementation may bucket keys by first character to avoid the quadratic
scan, since that changes nothing observable. Tags are a vocabulary (tens-to-thousands), not a
per-track payload, so this is not a hot path.

## 6. Modules and boundaries

Each unit answers "what does it do, how do I call it, what does it depend on" without reading
another file.

| Unit | Responsibility | Depends on |
| ---- | -------------- | ---------- |
| `crates/core/src/tag_clustering.rs` **(new)** | The pure algorithm: fold, cluster, edge. No SQL, no Tauri, no I/O. | `unicode-normalization` |
| `crates/core/src/library_reads.rs` | `tag_vocabulary_rows(ids)` → a `Statement` (SQL as data, per the module's existing rule). | existing `Statement` / `ReadError` |
| `apps/desktop/src-tauri/src/commands.rs` | `tag_cluster`: lock, run the statement, map rows to `TagValue`, call the core, serialize. | core, rusqlite |
| `packages/shared` | `TagClusterRequest` / `TagClusterReport` TS types mirroring the Rust `serde` shapes. | — |
| `apps/desktop/src/services/api.ts` | `tagCluster()` with the mock fallback (a browser tab is a mock: it returns an empty report, never a fake cluster). | shared types |
| `apps/desktop/src/components/TagSurgeonDialog.tsx` **(new)** | Render the report; no editing. | api |
| `apps/desktop/src/lib/library-menu.ts` | `fixTags` stops being disabled. | — |

```rust
// crates/core/src/tag_clustering.rs
pub struct TagValue { pub raw: String, pub track_ids: Vec<String> }
pub struct ClusterMember { pub raw: String, pub track_count: usize }
pub struct SpellingCluster {
    pub key: String,
    pub members: Vec<ClusterMember>,
    pub distinct_track_count: usize,
}
pub struct PrefixEdge {
    pub narrower_key: String,
    pub narrower_label: String,
    pub narrower_tracks: usize,
    pub broader_key: String,
    pub broader_label: String,
    pub broader_tracks: usize,
    pub shared_prefix: String,
}
pub struct ClusterReport {
    pub scanned_tags: usize,
    pub ignored_tags: usize,
    pub clusters: Vec<SpellingCluster>,
    pub prefix_edges: Vec<PrefixEdge>,
}

pub fn normalize_tag(input: &str) -> String;
pub fn cluster_tags(values: &[TagValue]) -> ClusterReport;
```

`track_ids` rather than a count is the one place the slice pays for correctness: the union in §5
cannot be computed from counts alone. At ~10 tags/track this is fine for a user-triggered read;
if it ever hurts, the fix is a per-cluster id set in the command, not a different algorithm.

## 7. Read path

`core` keeps its existing rule — it holds SQL as data and never runs it, so the statement is
unit-testable on any toolchain and executable by a feature-gated test.

The vocabulary is a join, so it cannot go through `present_rows` (that helper is
`SELECT {columns} FROM tracks …` and has no way to name `track_tags`). The builder writes its
own statement but reuses the same `Statement` type and the same `EmptySelection` rule:

```rust
pub fn tag_vocabulary_rows(ids: Option<&[String]>) -> Result<Statement, ReadError>;
```

```sql
SELECT tt.track_id, tt.tag
FROM track_tags tt
JOIN tracks t ON t.id = tt.track_id
WHERE t.removed_at IS NULL            -- the module's one rule, kept by construction
  [AND t.id IN (?, ?, …)]             -- bound ids only when the caller passed a selection
```

The `removed_at IS NULL` predicate is the requirement that survives any reshaping of the
query, and the execution test in §11 pins it.

**Test-fixture drift found while writing this spec — resolved in this slice:**
`source_branch_execution.rs` included migrations 001–008 and omitted
`009_beatgrid_confidence.sql`; the fixture array now includes 009, so the harness executes
against the app's current schema.

## 8. IPC contract

`tag_cluster(request: { trackIds?: string[] }) -> ClusterReport` (camelCased on the wire,
matching the existing command models).

- `trackIds: Some([])` is `ReadError::EmptySelection` → the `Result<T, String>` boundary; the
  menu always has a context row so the UI cannot reach it, and the test proves it is refused
  rather than silently scanning the library.
- `trackIds: None` means the whole library. Not reachable from the row menu in this slice; it
  exists because the engine and the read are scope-agnostic and T2.2.3's preview needs it.
- Errors propagate; nothing is swallowed into an empty report (the project's error-handling
  rule: no success-shaped results).

## 9. UI

- `fixTags` moves out of the stub path in [`library-menu.ts`](../../../apps/desktop/src/lib/library-menu.ts):
  delete the `id === "fixTags"` clause from `isDisabled` and the layout's "Tag cleaning arrives…"
  tooltip. It is already in `SELECTION_ACTIONS`, which §5's scope now honors.
- `RowContextMenu`'s `actions` map gains `fixTags: onFixTags`; `App.tsx` passes
  `onFixTags={() => openTagSurgeon(editorScope)}` — the **same** selection resolution the
  metadata editor uses, so `docs/ui-ux/03-LIBRARY-VIEW.md:174`'s "on selection" and §3.5's
  multi-select rule cannot diverge between the two menus.
- `TagSurgeonDialog`: title "Tag Surgeon — duplicate spellings"; a subtitle naming the scope
  ("N tracks"); the cluster list (`melodic house` ×3 · `Melodic House ` ×1 → 4 tracks); a
  separate **Possibly related** section for prefix edges, phrased so it cannot read as a
  proposed change; an `ignored_tags` note when non-zero ("2 tags are punctuation-only and were
  left alone"); and loading / error / empty states. Empty is not an error:
  "No duplicate spellings in these N tracks."
- **No apply button.** The "(Undo toast)" in that spec line belongs to T2.2.4; shipping a
  dialog that can only look apply-shaped is the honest failure mode this slice must avoid.
- Tokens follow `docs/ui-ux/`, reusing the `MetadataEditor` dialog shell, and it is reachable and
  dismissible by keyboard the way that dialog already is.

## 10. Invariants

1. The slice **writes nothing** — no DML, no migration, no `skill_runs` row. A read-only scan
   that logged itself as a Skill execution would leave the undo system a phantom run to clean
   up later.
2. No source audio file is opened, and no tag is modified. Seeding test data goes through the
   app's own tag editor (§12), which writes only `track_tags`.
3. Clustering is deterministic and order-independent: permuting the input rows cannot change
   the serialized report.
4. A prefix relation never merges a cluster. If a future slice wants that, it is a new decision.

## 11. Testing

**Rust unit tests** (`crates/core`, run by `pnpm rust:test:portable` — the desktop test binary
cannot start on this box, `STATUS_ENTRYPOINT_NOT_FOUND`): one test per dimension (case, space,
accent, punctuation) proving the merge, including punctuation-as-**separator** (`Hi-NRG` = `Hi
NRG`) and the documented non-folds (`ß`, `ı`); prefix edges proving the word-boundary rule, the
3-character floor, and the non-merge; the singleton-edge case (an edge whose sides appear in no
cluster still carries displayable labels); the empty-key guard; the representative-spelling rule
with its tie-break; the union count for a track carrying two spellings; idempotence and
determinism; permutation invariance; exact ordering of clusters, members and edges.

**SQL execution test** (extend `crates/core/tests/source_branch_execution.rs` against the real
migrations): the statement runs, returns `(track_id, tag)`, excludes a soft-removed track's
tags, and honours an id list. `cargo test -p dj-assistant-core --features cli`.

**TS tests** (`node --test`): `fixTags` is no longer disabled and has no stub tooltip;
`appliesToWholeSelection("fixTags")` still true; the report→label formatter (counts, the
"possibly related" wording, the ignored-tags sentence) — pure helpers in `lib/`, because a
`.tsx` component cannot fail the desktop harness.

**Native running-window QA** (DoD 6) — see §12.

**Coverage of P2.2:** directional only, and recorded as such. P2.2 wants ≥95% precision on
near-duplicate *artist* names; this slice has no artist surface and the live library has no
artist near-dupes. Fold-key equality is **not** a zero-false-merge proof: the punctuation rule
merges distinct values such as `C#` and `C` by design. Precision therefore still needs
negative examples or measured validation; what keeps this slice safe is that the report is
advisory and read-only — no merge is ever a write. §13 keeps the measurement in view rather
than claiming the gate closed.

## 12. QA plan against a library that cannot answer it

`track_tags` has **0 rows**, and there is no foldable artist duplicate either, so the built-in
data cannot exercise a positive case. This is finding F-019's shape again, and the plan is
stated instead of quietly unit-tested around:

1. In the native Tauri window (`dj-assistant-desktop.exe`, never a browser tab), select three
   tracks and seed punctuation/accent/prefix pairs through **Edit tags…** (DB-only path,
   undoable): `Hi-NRG` + `Café` + `!!!` on one, `Hi NRG` + `Cafe` on the second,
   `Hi NRG Techno` on the third. Case + trailing-space variants **cannot** be seeded this
   way — the editor's `normalizeTags` trims and ASCII-lowercases before writing — so
   case/space folding stays covered by the engine unit tests, while the live pairs exercise
   punctuation, accents, the punctuation-only ignore rule and whole-word prefixes.
2. Right-click → **Fix tags** → the dialog shows two clusters titled by their raw
   representatives (`cafe`, `hi nrg` — the editor lowercases on write, so raw spelling and
   fold key coincide for this seed), each with `distinct_track_count` 2, one advisory edge
   labelled with raw spellings (`hi nrg ⊂ hi nrg techno`) carrying each side's
   representative track count, and the punctuation-only note; a single-track scan of the
   first track shows the empty state plus the same note.
3. Cross-check read-only with `node:sqlite` (`readOnly`, WAL-safe while the app holds it):
   the vocabulary the dialog names equals the rows the DB has. Every count in the UI is checked
   against SQL, never asserted from the screenshot (finding F-015).
4. The third seeded track (`Hi NRG Techno`) must appear as an edge under **Possibly
   related** and is **not** folded into the `hi nrg` cluster; the punctuation-only tag
   (`!!!`) is reported under `ignored_tags` rather than clustered.
5. Revert: delete the seeded tags through the same editor and verify `track_tags` is back to 0
   rows and `tracks` still shows 0 diffs.
6. Record as `docs/qa/evidence/2026-11-19-T221-TAG-CLUSTERING-QA.md`.

If the seeded-write-and-revert route is unacceptable for a slice, the alternative is honest and
narrower: ship the engine + command with the menu item still disabled, DoD 6 unmet, and the box
unticked until the T2.2.3 surface. The design prefers the seeded pass; it is not silently
preferred over the human's call.

## 13. Known limits to carry forward

- Non-folding `ß`/`ı`/`æ` costs recall (§4) — revisit with data, not with eagerness.
- The diacritic strip list (§4) is block-based: a script whose accents live outside those
  blocks keeps its marks — a recall cost, never a false merge. Extending the list is a
  precision decision with its own evidence.
- The vocabulary is scoped to a selection, so a user must select broadly (or all) to see
  library-wide spread. T2.2.3's preview should decide whether a library-wide entry is warranted.
- No `skill_runs` row means no history for a scan. Correct for a read; T2.2.4 must not inherit
  that silence for a write.
- `ignored_tags` tells the user a punctuation-only tag exists but not that it is odd. Fine for
  a read-only slice; worth a line in T2.2.2.

## 14. Dependency

`unicode-normalization` added to `crates/core` (NFD + mark stripping per §4). It is the
narrowest crate that makes `İbrahim Çelik` fold correctly; the alternative — a hand-rolled
Latin-1/Latin-Extended-A table — cannot handle that case at all, and would silently
under-report accents it does not know. Dependabot's rust-minor-patch group already covers it.

## 15. Definition of done

Engine + read path + command + dialog implemented behind strict TDD; `pnpm lint`,
`pnpm typecheck`, `pnpm rust:fmt`, `pnpm rust:clippy`, the desktop `node --test` suite and
`pnpm rust:test:portable` green; the §12 native pass recorded; `docs/sdd/04-TASKS.md` T2.2.1
annotated with what shipped, what was measured, and what stayed open. **The checkbox is the
human's to tick on `main` after merge** — no box is ticked on the feature branch.
