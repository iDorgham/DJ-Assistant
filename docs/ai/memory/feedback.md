# Corrections & learned lessons

Append-only, newest last. Every entry is a **correction** (human said "no") or a
**lesson** (a mistake was found and the fix is worth remembering). Promote
anything that has become a standing rule into [`conventions.md`](./conventions.md)
and note it with a pointer back to here.

## F-001 · `policy.mjs` frontmatter duplication (2026-10-19)

`head = lines.slice(0, end)` in `scripts/skills/policy.mjs` duplicated the YAML
frontmatter up to 32× in 146 global skill files. Fixed to `slice(0, 1)`, all 146
repaired against a pre-repair backup (0 mismatches), and `--apply` now refuses
without `--force`.
**Rule:** any script that rewrites external skill files must be idempotent and
guarded; back up before touching the global library.

## F-002 · PowerShell `Select-Object -First N` kills the writer (2026-10-19)

Piping a long-running Node writer into `Select-Object -First N` breaks the pipe
and terminates the writer mid-write on Windows. Use `Select-String` or consume
the whole output instead.

## F-003 · Skills hidden with `autoinvoke: false` are unloadable (2026-10-20)

Verified empirically: `skill({ id })` returns `Unable to load skill` for a hidden
skill. Hiding therefore removes capability rather than context cost. See
[D-003](./decisions.md).

## F-004 · Do not parallelise writes to the same file (2026-10-20)

Multiple `edit` calls against one file in a single block silently conflict; run
same-file edits sequentially and batch only across independent files.

## F-005 · A shared worktree can rewrite your file before you stage it (2026-10-21)

`5d259065` committed a `search.mjs` that a concurrent session had already rewritten
to import `./lib.mjs` — a file that commit did not contain, so it was broken
standalone and its message described code that was not in it. `git status` did not
warn: the rewrite had been picked up by the same `git add` that staged my work.

Stage first, then extract **the index** — the tree the commit is about to become
— into a directory that did not exist a moment ago, and run it there:
`d=$(mktemp -d) && git archive "$(git write-tree)" scripts agents.registry.json
skills.policy.json package.json docs | tar -x -C "$d" &&
node "$d/scripts/agent/preflight.test.mjs"`. A fixed path keeps files from an
earlier extraction, so a missing one can pass; `git archive HEAD` exports the
*previous* commit, so as originally written this check could not have caught the
breakage it describes. Fix forward with a note; do not rewrite published history.

## F-006 · Check the installed tool's schema before accepting a severity (2026-10-21)

Two reviewers graded the trailing `edit: "*"` deny in the agent files P1 — "blocks
every file edit, so `/remember` cannot write". It blocked nothing: OpenCode
1.1.6x parses only the singular `permission:` object, moves the unknown
`permissions:` key into model options, and enforces **zero** of those rules with
no error or warning (verified with `opencode agent list` on two test agents). The
ordering was still wrong and becomes live on a v2-config release, so it is fixed
— catch-all deny first — and the real bypass went the same round: `node scripts/*`
shell grants let a "read-only" agent run `sync.mjs --write` and `policy.mjs
--apply`.
**Rule:** for a config file, confirm what the *installed* version parses before
agreeing a finding is live; and prefer named-script shell grants over wildcards,
because a wildcard grant quietly outranks the deny it sits next to. See
[D-008](./decisions.md).

## F-007 · One shared word is enough to pick a skill — and BM25 rewards it (2026-10-22)

The skill matcher let a single **skill-ID hit** qualify a skill, and the ID
tokens earned a 3× weight. Inverse document frequency then made the *rarest*
such word the most valuable one, so the rarest generic adjective won: on a
task about the agent layer and shared memory, the preflight offered
`performance-and-perceived-speed` (from "speed"), `memory-safety-patterns`
(from "memory"), and `upstash-redis-js` (from "agents" + "memory" + "tools") —
three skills with nothing to do with the work, injected on every such prompt
in every tool. The library already carried the domain grouping the fix needed;
the matcher simply never read it.
**Rule:** a lexical matcher needs a **negative signal**, not just a score.
Give it the project's own domain structure, require a name hit to use a word
that is not domain-neutral, and require two independent hits otherwise. A
matcher that can only say "yes" will always say yes to the wrong thing — and
BM25 makes the rarest wrong answer the most confident one. See
[D-011](./decisions.md).

## F-008 · "Kept installed, hidden" is not a state that exists here (2026-10-22)

`skills.policy.json` recorded seventeen known duplicates, most of them with a
hidden-related reason — two of them with exactly "Kept installed, hidden" — and
`builtinHidden` named `playwright-cli` as
hidden. Nothing in the library was hidden: all 240 skills were advertised,
duplicate or not, and were paid for on every step. A reason field that
describes an action nobody took is worse than no reason at all — it reads as
"already handled" and stops anyone from noticing the cost. The duplicates now
carry a real `prune` list and a tool that moves them out.
**Rule:** a note in a policy file must describe something that is actually
true of the system it governs. Verify the state before recording it. See
[D-003](./decisions.md) and [D-012](./decisions.md).

## F-009 · A QA session that cannot reach the real system proves nothing (2026-10-22)

The Slice 2 running-window QA (T2.1.2 / T2.1.4 / T2.1.6) was nearly run in a
browser tab. `pnpm dev:desktop` starts **only** the Vite server, and without the
Tauri IPC (`__TAURI_INTERNALS__`) `apps/desktop/src/services/api.ts` falls back
to a **mock** API: the table shows mock rows, the writes are no-ops and the
console even says `[Mock API] Tauri not detected`. A checklist executed there
would have produced a clean sheet of PASSes for a system that was never
touched.
**Rule:** before recording a QA result, prove the session reaches the real
system — here: the window is the `tauri dev` shell, the database is
`%APPDATA%\com.djassistant.desktop\dj_assistant.db`, and a read-only CLI
(`dj-query`) confirms the rows the UI claims to have written. A PASS needs the
observation **and** the independent check; a mock-backed session is not
evidence. See F-009 in [`state.md`](./state.md) and the checklist in
[`docs/engineering/SLICE2_MANUAL_QA_CHECKLIST.md`](../../engineering/SLICE2_MANUAL_QA_CHECKLIST.md).

## F-010 · Never stash to "check something else" in this worktree (2026-10-27)

A shell command that was only meant to read an exit code ended with a stray
`git stash push --include-untracked -- .`. In this worktree that swept the
**other sessions' in-flight files** — `AI_RULES.md`, `capmap_phase0.md`,
`check_schema.py`, `scripts/reset_qa_baseline.sql`, two unmerged component
tests — into an Agent-created stash, together with the day's own edits. The
tree went empty mid-task. `git stash apply` plus a file-by-file check against
the stash's own list restored all 17 paths, and only the created entry was
dropped; the two pre-existing stashes were left alone.
**Rule:** no stash of any kind as an exploratory step. When a unique-tagged
stash is genuinely required, list its paths first, restore with `apply` (never
`pop`), confirm every listed path is back, and drop only the entry created in
this session — `git stash` is a numbered queue shared with the other sessions.
**Also:** the branch shown at session start is a snapshot. This session began
labelled `fix/issue-61-cli-migration-tolerance` while the checkout was already
`main` — re-read `git branch --show-current` before any branch-sensitive
command, not the header.

## F-011 · A `crates/core` planner is untested until `tests/schema` runs it (2026-10-29)

`library_writes::read_patch_statement` built `WHERE id IN (?2, ?3, …)` while
binding only the ids at `?1…?n`. Twenty-six in-module unit tests passed — they
assert SQL *text*. The first execution against real SQLite (T2.1.3) failed
outright: `Wrong number of parameters passed to query. Got 1, needed 2`. Every
metadata edit in the app would have errored, not just the new bulk path.
**Rule:** core holds SQL as data and never runs it, so a new or edited planner
function there needs a case in `tests/schema/tests/` that executes the built
statement against `open_migrated()`. An assertion on the SQL string is not
verification of the bind order. The desktop crate's own tests cannot fill this
gap on this box — its harness does not load.

## F-012 · What the library UI can and cannot be verified with here (2026-10-29)

- **A Vite browser tab is worse than a mock — it is empty.** Without Tauri IPC
  the library loads 0 tracks, so no table, selection or row dialog can be
  reached at all. Do not plan "verify in the browser" for library views.
- **Computer Use cannot emit a modifier click.** `click` takes no `ctrlKey`/
  `shiftKey`, `press_key` cannot hold a modifier, and a `drag` arrives without
  `shiftKey`. Selection in the library table is mouse-modifier-only
  (`applyRowSelection`), so multi-select has no automated route.
- **What does work:** `pnpm tauri dev` drives the real app against the real
  database, and single-row flows are fully automatable there — the T2.1.3
  Apply → Undo round-trip was verified that way, net-zero on the user's library.
  Pure logic behind a dialog stays testable with `node --test` in `src/lib`.
**Rule:** when a check needs multi-select, hand that two-click step to the user
instead of concluding the UI is untestable.
