// Prunes the skill library this project uses down to the skills it needs.
//
//   node scripts/skills/prune.mjs                 # dry run: what would go
//   node scripts/skills/prune.mjs --apply         # move it to a backup folder
//   node scripts/skills/prune.mjs --restore <dir>  # put a backup back
//
// Why this exists: every installed skill is advertised to the model on every
// step, in every tool. A skill hidden with `metadata.opencode/autoinvoke:false`
// is *not loadable* here (D-003), so the only way to stop paying for a skill
// is to remove it. The list itself is `prune` in `skills.policy.json`, one entry
// per skill with the reason it is not used here.
//
// The library lives in three places on a developer machine:
//
//   <repo>/.opencode/skills   the project mirror — gitignored, and what this
//                              project's tools read.
//   ~/.config/opencode/skills the machine-global library, shared with every
//                              other project on the box.
//   ~/.agents/skills          the tool's own bundled skills. **Never touched.**
//
// A skill that is installed in more than one place is advertised by all of
// them: `listSkills()` reports the project copy because it shadows the global
// one, but the global copy is still on disk and still costs tokens. Pruning
// therefore moves *every* copy of a pruned skill, and the manifest records each
// copy's own original path so `--restore` puts every one back where it came
// from. The tool's own bundled library is never a copy we may move.
//
// The tool never deletes: `--apply` moves skill directories into a timestamped
// backup *beside the source they came from*, and `--restore <dir>` puts them
// back using the manifest the backup carries.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SOURCES, isFile, listSkills, loadPolicy } from "./lib.mjs";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
/** Return the argument following `--name`, or the fallback when absent or empty. */
const value = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};

const MANIFEST = "manifest.json";

/* ------------------------------------------------------------------ modes */

// The tool is a script, but its helpers are also imported by the test suite,
// so the CLI only runs when this file *is* the command.
const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  if (flags.has("--restore")) {
    restore(value("restore", null));
  } else if (flags.has("--apply")) {
    apply();
  } else {
    report();
  }
}

/* ----------------------------------------------------------------- report */

/** Everything the policy would remove, and what it costs to keep. */
function report() {
  const policy = loadPolicy();
  const prune = policy.prune ?? {};
  const { skills } = listSkills();
  const installed = new Map(skills.map((skill) => [skill.id, skill]));

  const removable = Object.keys(prune).filter((id) => installed.has(id));
  const missing = Object.keys(prune).filter((id) => !installed.has(id));
  const removed = removable.map((id) => installed.get(id));

  // Same metric the audit uses: the description text is what every skill
  // costs on every step, in every tool, whether or not the skill is ever
  // loaded. The name and the path are on top of that.
  const tokens = (list) => Math.round(list.reduce((s, k) => s + k.description.length, 0) / 4);

  const physical = copies();
  const copyCount = [...physical.values()].reduce((sum, perSource) => sum + perSource.size, 0);

  console.log(`Library   : ${skills.length} skills, ~${tokens(skills)} tokens/step advertised`);
  console.log(`Copies    : ${copyCount} installed copies across ${SOURCES.length} sources`);
  console.log(`Prune list: ${removable.length} of ${Object.keys(prune).length} present`);
  console.log(
    `Saving    : ~${tokens(removed)} tokens/step, ${Math.round((tokens(removed) / tokens(skills)) * 100)}% of the advertised cost`
  );
  if (missing.length) console.log(`Already gone: ${missing.join(", ")}`);
  console.log("");
  for (const id of removable) {
    console.log(`  ${id.padEnd(38)} ${prune[id]}`);
  }
  console.log("");
  console.log("Dry run. Nothing changed. Re-run with --apply to move these into a backup.");
}

/* ------------------------------------------------------------------ apply */

/**
 * Move every installed copy of the prune-list skills into per-source
 * timestamped backups, recording each successful move in its manifest.
 *
 * The run is refused before anything moves when the policy puts a hot skill on
 * the prune list. Individual move errors are caught, the remaining candidates
 * are attempted, and a failure sets exit code 1 — a partial prune is not a
 * successful prune. Backup creation, manifest-write, and policy/library read
 * errors propagate.
 */
function apply() {
  const policy = loadPolicy();
  const prune = policy.prune ?? {};
  const { skills } = listSkills();
  const installed = new Map(skills.map((skill) => [skill.id, skill]));

  const removable = Object.keys(prune).filter((id) => installed.has(id));
  if (!removable.length) {
    console.log("Nothing to prune — every skill on the list is already gone.");
    return;
  }

  // The hot set must survive the prune: a skill the policy marks as priority
  // is one the project reaches for, and losing it silently is worse than the
  // tokens it costs. Check *before* anything moves, so the tool refuses the
  // unsafe operation instead of reporting the damage afterwards.
  const hot = policy.hot ?? [];
  const overlap = hotPruneOverlap(hot, removable);
  if (overlap.length) {
    console.error("Refusing to prune: these skills are in the hot set and on the prune list:");
    for (const id of overlap) console.error(`  ${id}`);
    console.error("Fix the policy first — a skill cannot be both a priority and a removal.");
    process.exitCode = 1;
    return;
  }

  const physical = copies();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backups = [];
  const failed = [];

  for (const source of SOURCES) {
    const ids = removable.filter((id) => physical.has(id) && physical.get(id).has(source.name));
    if (!ids.length) continue;

    const backup = path.join(backupRoot(source.dir), stamp);
    fs.mkdirSync(backup, { recursive: true });

    const entries = [];
    for (const id of ids) {
      const from = physical.get(id).get(source.name);
      const to = path.join(backup, id);
      try {
        move(from, to);
        entries.push({ id, source: source.name, from, to });
      } catch (error) {
        console.error(`  could not move ${id} from ${source.name}: ${error.message}`);
        failed.push(`${id} (${source.name})`);
      }
    }

    fs.writeFileSync(
      path.join(backup, MANIFEST),
      `${JSON.stringify({ createdAt: new Date().toISOString(), source: source.name, entries }, null, 2)}\n`,
      "utf8"
    );
    backups.push({ dir: backup, source: source.name, moved: entries.length });
  }

  const moved = backups.reduce((sum, entry) => sum + entry.moved, 0);
  const after = new Set(listSkills().skills.map((skill) => skill.id));
  const lost = hot.filter((id) => !after.has(id));

  console.log(`Moved ${moved} skill copies into ${backups.length} backup folder(s)`);
  for (const backup of backups) {
    console.log(`  ${backup.moved} from ${backup.source} → ${backup.dir}`);
  }
  console.log(`Remaining: ${after.size} skills`);

  // A partial prune is not a successful prune: the caller must be able to tell
  // a complete removal from one that hit a locked directory.
  if (failed.length) {
    console.error(`FAILED to move ${failed.length} skill copies: ${failed.join(", ")}`);
    console.error("The prune is incomplete — restore the backups below to undo what did move.");
    process.exitCode = 1;
  }

  for (const backup of backups) {
    console.log(`Restore with: node scripts/skills/prune.mjs --restore ${backup.dir}`);
  }

  if (lost.length) {
    console.error(`WARNING: hot skills are missing after the prune: ${lost.join(", ")}`);
    process.exitCode = 1;
  }
}

/* ---------------------------------------------------------------- restore */

/**
 * Restore a backup manifest's entries to their original paths, skipping entries
 * whose backup target does not resolve or whose destination already exists.
 *
 * `dir` is a backup directory, resolved relative to the working directory.
 * Exits with code 2 when it is absent or has no manifest. Manifest read/parse,
 * directory-creation, and move errors propagate, leaving earlier restores in place.
 */
function restore(dir) {
  if (!dir) {
    console.error("usage: node scripts/skills/prune.mjs --restore <backup-dir>");
    process.exit(2);
  }
  const source = path.resolve(dir);
  const manifestPath = path.join(source, MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    console.error(`No manifest in ${source} — is this a prune backup folder?`);
    process.exit(2);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let restored = 0;
  for (const entry of manifest.entries ?? []) {
    // The backup holds what the source held: a symlink whose target moved
    // still *exists* as a link, so ask the filesystem about the link itself
    // and not about what it points at.
    if (!pathExists(entry.to)) continue;
    if (pathExists(entry.from)) {
      console.error(`  ${entry.id} is already installed — left alone`);
      continue;
    }
    fs.mkdirSync(path.dirname(entry.from), { recursive: true });
    try {
      move(entry.to, entry.from);
      restored += 1;
    } catch (error) {
      console.error(`  could not restore ${entry.id}: ${error.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`Restored ${restored} skills into ${manifest.source} (${source})`);
}

/* --------------------------------------------------------------- helpers */

/**
 * The skills a prune would remove that the policy also marks as a priority.
 *
 * A skill cannot be both: the policy would reach for it on one prompt and
 * delete it on the next. The prune refuses the whole operation when this is
 * not empty, so the hot set is never damaged in the first place.
 */
export function hotPruneOverlap(hot = [], removable = []) {
  const priority = new Set(hot);
  return removable.filter((id) => priority.has(id));
}

/**
 * Every installed copy of every skill, keyed by skill id.
 *
 * `listSkills()` collapses the copies of one skill into a single entry — the
 * last source wins — so the copies that are shadowed are invisible to it. The
 * prune needs all of them, each with its own path, so that a skill stops
 * being advertised wherever it happens to live.
 */
export function copies() {
  const byId = new Map();
  for (const source of SOURCES) {
    if (!fs.existsSync(source.dir)) continue;
    for (const entry of fs.readdirSync(source.dir, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (!isFile(path.join(source.dir, entry.name, "SKILL.md"))) continue;
      if (!byId.has(entry.name)) byId.set(entry.name, new Map());
      byId.get(entry.name).set(source.name, path.join(source.dir, entry.name));
    }
  }
  return byId;
}

/**
 * Whether a path is there, without following what it points at.
 *
 * `fs.existsSync` resolves a symlink, so a link whose target has gone reads
 * as missing — and the restore would skip a skill that is still in the backup.
 */
export function pathExists(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Where a source's backup goes: beside the source, so the move is a rename on
 * the same volume. A backup on another drive cannot be renamed into place,
 * and copying a skill tree in and out is slower and can half-fail.
 */
export function backupRoot(sourceDir) {
  return path.join(path.dirname(sourceDir), "skills-backup");
}

/**
 * Move a directory, falling back to copy-then-delete when the two paths are
 * on different volumes (`rename` cannot cross a drive boundary on Windows).
 * Preserves symlink targets verbatim during copying. Other rename errors and
 * copy or removal errors propagate; a failed fallback can leave a partial copy
 * or both paths in place.
 */
export function move(from, to) {
  try {
    fs.renameSync(from, to);
    return;
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
  }
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true, force: true });
  fs.rmSync(from, { recursive: true, force: true });
}

// Referenced so the module's exports stay honest about what a prune touches.
void isFile;
