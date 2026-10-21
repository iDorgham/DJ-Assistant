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
— and run it: `mkdir -p /tmp/x && git archive "$(git write-tree)" scripts |
tar -x -C /tmp/x && node /tmp/x/scripts/...` (`tar -x -C` needs the directory to
already exist). (`git archive HEAD` exports the *previous* commit, so
as originally written this check could not have caught this breakage.) Fix
forward with a note; do not rewrite published history.

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
