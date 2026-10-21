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
// The library lives in three places on a developer machine, and this tool only
// touches the one this project owns:
//
//   <repo>/.opencode/skills   the project mirror — gitignored, and what this
//                              project's tools actually read. **Pruned.**
//   ~/.config/opencode/skills the machine-global library, shared with every
//                              other project on the box. **Left alone.**
//   ~/.agents/skills          the tool's own bundled skills. **Left alone.**
//
// The prune list is project-scoped, so pruning the global library with it would
// remove skills other projects still need.
//
// The tool never deletes: `--apply` moves skill directories into a timestamped
// backup *beside the source*, and `--restore <dir>` puts them back using the
// manifest the backup carries.

import fs from "node:fs";
import path from "node:path";
import { PROJECT_SKILLS, isFile, listSkills, loadPolicy } from "./lib.mjs";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
/** Return the argument following `--name`, or the fallback when absent or empty. */
const value = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};

// Only the project mirror is pruned. The global library is shared with other
// projects on this machine; the tool's own bundled skills are not ours to move.
const SOURCE = value("source", "project");
const MANIFEST = "manifest.json";

/* ------------------------------------------------------------------ modes */

if (flags.has("--restore")) {
  restore(value("restore", null));
} else if (flags.has("--apply")) {
  apply();
} else {
  report();
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
  const kept = skills.filter((skill) => !prune[skill.id]);
  const removed = removable.map((id) => installed.get(id));

  // Same metric the audit uses: the description text is what every skill
  // costs on every step, in every tool, whether or not the skill is ever
  // loaded. The name and the path are on top of that.
  const tokens = (list) => Math.round(list.reduce((s, k) => s + k.description.length, 0) / 4);

  console.log(`Library   : ${skills.length} skills, ~${tokens(skills)} tokens/step advertised`);
  console.log(`Source    : ${SOURCE} — ${sourceRoot()}`);
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
 * Move visible prune-list skills from the selected source into a timestamped
 * backup and record successful moves in its manifest.
 *
 * Individual move errors are caught and remaining candidates are attempted.
 * Missing hot skills after pruning set exit code 1; backup creation,
 * manifest-write, and policy/library read errors propagate.
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

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(backupRoot(), stamp);
  fs.mkdirSync(backup, { recursive: true });

  const moved = [];
  const entries = [];
  for (const id of removable) {
    const skill = installed.get(id);
    if (skill.source !== SOURCE) continue;
    const target = path.join(backup, id);
    try {
      move(skill.dir, target);
      moved.push(id);
      entries.push({ id, source: skill.source, from: skill.dir, to: target });
    } catch (error) {
      console.error(`  could not move ${id}: ${error.message}`);
    }
  }
  fs.writeFileSync(
    path.join(backup, MANIFEST),
    `${JSON.stringify({ createdAt: new Date().toISOString(), source: SOURCE, entries }, null, 2)}\n`,
    "utf8"
  );

  // The hot set must survive the prune: a skill the policy marks as priority
  // is one the project reaches for, and losing it silently is worse than the
  // tokens it costs.
  const after = new Set(listSkills().skills.map((skill) => skill.id));
  const lost = (policy.hot ?? []).filter((id) => !after.has(id));

  console.log(`Moved ${moved.length} skills to ${backup}`);
  console.log(`Remaining: ${after.size} skills`);
  if (lost.length) {
    console.error(`WARNING: hot skills are missing after the prune: ${lost.join(", ")}`);
    console.error(`Restore with: node scripts/skills/prune.mjs --restore ${backup}`);
    process.exitCode = 1;
  } else {
    console.log(`Restore with: node scripts/skills/prune.mjs --restore ${backup}`);
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
    if (!fs.existsSync(entry.to)) continue;
    if (fs.existsSync(entry.from)) {
      console.error(`  ${entry.id} is already installed — left alone`);
      continue;
    }
    fs.mkdirSync(path.dirname(entry.from), { recursive: true });
    move(entry.to, entry.from);
    restored += 1;
  }
  console.log(`Restored ${restored} skills into ${sourceRoot()}`);
}

/* --------------------------------------------------------------- helpers */

/** The directory the pruned source lives in. */
function sourceRoot() {
  return SOURCE === "project" ? PROJECT_SKILLS : path.join(process.env.USERPROFILE, ".config", "opencode", "skills");
}

/**
 * Where the backup goes: beside the source, so the move is a rename on the
 * same volume. A backup on another drive cannot be renamed into place, and
 * copying a skill tree in and out is slower and can half-fail.
 */
function backupRoot() {
  return path.join(path.dirname(sourceRoot()), "skills-backup");
}

/**
 * Move a directory, falling back to copy-then-delete when the two paths are
 * on different volumes (`rename` cannot cross a drive boundary on Windows).
 * Preserves symlink targets verbatim during copying. Other rename errors and
 * copy or removal errors propagate; a failed fallback can leave a partial copy
 * or both paths in place.
 */
function move(from, to) {
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
