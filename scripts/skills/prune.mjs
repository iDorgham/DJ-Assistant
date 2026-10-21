// Prunes the machine-global skill library down to the skills this project uses.
//
//   node scripts/skills/prune.mjs                 # dry run: what would go
//   node scripts/skills/prune.mjs --apply         # move it to a backup folder
//   node scripts/skills/prune.mjs --restore <dir>  # put a backup back
//
// Why this exists: every installed skill is advertised to the model on every
// step, in every tool. A skill hidden with `metadata.opencode/autoinvoke:false`
// is *not loadable* here (D-003), so the only way to stop paying for a skill is
// to remove it. The library is machine-global and shared with other projects,
// so this tool never deletes: `--apply` moves the skill directories into a
// timestamped backup next to the library, and `--restore` puts them back.
//
// The list itself is `prune` in `skills.policy.json`, one entry per skill with
// the reason it is not used here. The list is the audited part; the tool is
// the mechanical part.

import fs from "node:fs";
import path from "node:path";
import { GLOBAL_SKILLS, SOURCES, isFile, listSkills, loadPolicy } from "./lib.mjs";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
const value = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};

const BACKUP_ROOT = path.join(path.dirname(GLOBAL_SKILLS), "skills-backup");

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
  const advertised = (list) => list.reduce((sum, skill) => sum + skill.description.length, 0);
  const tokens = (list) => Math.round(advertised(list) / 4);

  const removedTokens = tokens(removed);
  const keptTokens = tokens(kept);

  console.log(
    `Library   : ${skills.length} skills, ~${tokens(skills)} tokens/step advertised (descriptions)`
  );
  console.log(`Prune list: ${removable.length} of ${Object.keys(prune).length} present`);
  console.log(
    `Saving    : ~${removedTokens} tokens/step, ${Math.round((removedTokens / (removedTokens + keptTokens)) * 100)}% of the advertised cost`
  );
  if (missing.length) {
    console.log(`Already gone: ${missing.join(", ")}`);
  }
  console.log("");
  for (const id of removable) {
    console.log(`  ${id.padEnd(38)} ${prune[id]}`);
  }
  console.log("");
  console.log("Dry run. Nothing changed. Re-run with --apply to move these into a backup.");
}

/* ------------------------------------------------------------------ apply */

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
  const backup = path.join(BACKUP_ROOT, stamp);
  fs.mkdirSync(backup, { recursive: true });

  const moved = [];
  for (const id of removable) {
    const skill = installed.get(id);
    const target = path.join(backup, id);
    try {
      fs.renameSync(skill.dir, target);
      moved.push(id);
    } catch (error) {
      console.error(`  could not move ${id}: ${error.message}`);
    }
  }

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

function restore(dir) {
  if (!dir) {
    console.error("usage: node scripts/skills/prune.mjs --restore <backup-dir>");
    process.exit(2);
  }
  const source = path.resolve(dir);
  if (!fs.existsSync(source)) {
    console.error(`No such backup folder: ${source}`);
    process.exit(2);
  }
  let restored = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const target = path.join(GLOBAL_SKILLS, entry.name);
    if (fs.existsSync(target)) {
      console.error(`  ${entry.name} is already installed — left alone`);
      continue;
    }
    fs.renameSync(path.join(source, entry.name), target);
    restored += 1;
  }
  console.log(`Restored ${restored} skills into ${GLOBAL_SKILLS}`);
}

// Referenced so the module's exports stay honest about what a prune touches.
void SOURCES;
void isFile;
