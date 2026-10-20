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
