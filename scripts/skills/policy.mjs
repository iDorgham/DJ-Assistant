// Dry-run / repair tool for the `metadata.opencode/autoinvoke` flag in the
// machine-global skill files.
//
// IMPORTANT: in this environment a skill that is hidden from the advertised list
// cannot be loaded with the `skill` tool, so `--apply` is refused unless forced.
// The hot/cold split is a priority ranking for the matcher (see AGENTS.md →
// "Agent skills"), not a visibility filter.
//
//   node scripts/skills/policy.mjs                  # dry run, prints what would change
//   node scripts/skills/policy.mjs --restore        # remove every flag we manage
//   node scripts/skills/policy.mjs --apply --force  # hide the cold set (NOT recommended)
//
// Only files under ~/.config/opencode/skills are touched.

import fs from "node:fs";
import { listSkills, loadPolicy } from "./lib.mjs";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const restore = argv.includes("--restore");
const followSymlinks = argv.includes("--follow-symlinks");
const force = argv.includes("--force");

if (apply && !force) {
  console.error(
    "Refusing to run --apply: a skill hidden from the advertised list is not loadable in this\n" +
      "environment, so hiding only breaks skills. Re-run with --force only if you have verified\n" +
      "that hidden skills can still be loaded here."
  );
  process.exit(1);
}

const policy = loadPolicy();
const hot = new Set(policy.hot ?? []);
const { skills } = listSkills();
// Symlinked skills point at another tool's copy (`npx skills add`); writing
// through them would edit that copy too, so skip them unless asked.
const global = skills.filter(
  (skill) => skill.source === "global" && (followSymlinks || !skill.symlink)
);
const skipped = skills.filter(
  (skill) => skill.source === "global" && skill.symlink && !followSymlinks
);

const changes = [];
for (const skill of global) {
  const desired = restore ? "restore" : hot.has(skill.id) ? "hot" : "cold";
  const next = update(desired, fs.readFileSync(skill.file, "utf8"));
  if (next !== null)
    changes.push({ id: skill.id, action: desired, file: skill.file, content: next });
}

for (const change of changes) {
  if (apply || restore) fs.writeFileSync(change.file, change.content, "utf8");
}

const verb = apply || restore ? "Wrote" : "Would write";
console.log(
  `${verb} ${changes.length} of ${global.length} global skills (${apply || restore ? "" : "dry run, pass --apply to write"})`
);
if (skipped.length)
  console.log(`Skipped ${skipped.length} symlinked skills (use --follow-symlinks to include them)`);
for (const change of changes) console.log(`  ${change.action.padEnd(7)} ${change.id}`);
if (!changes.length) console.log("  nothing to do");

/**
 * Returns the rewritten file, or null when it already matches the target.
 *
 * Only our own `opencode/autoinvoke` key is managed; an upstream
 * `disable-model-invocation: true` is never touched.
 * `mode` is `hot` (advertised: drop our flag), `cold` (hidden: add our flag),
 * or `restore` (drop every flag we added).
 */
function update(mode, text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.findIndex(
    (line, index) => index > 0 && (line.trim() === "---" || line.trim() === "...")
  );
  if (end === -1) return null;

  const head = lines.slice(0, 1); // the opening `---` only
  let frontmatter = lines.slice(1, end);
  const before = frontmatter.join("\n");
  const hasOur = frontmatter.some((line) => /^\s*opencode\/autoinvoke\s*:/.test(line));
  const hasUpstream = frontmatter.some((line) => /^\s*disable-model-invocation\s*:/.test(line));

  if (mode === "restore" || mode === "hot") {
    if (!hasOur) return null;
    frontmatter = frontmatter.filter((line) => !/^\s*opencode\/autoinvoke\s*:/.test(line));
    // Drop a `metadata:` block we may have left with no children.
    frontmatter = frontmatter.filter((line, index) => {
      if (!/^metadata\s*:\s*$/.test(line)) return true;
      const next = frontmatter[index + 1];
      return next !== undefined && /^\s+\S/.test(next);
    });
  } else if (hasUpstream || hasOur) {
    // Already hidden — by the upstream flag or by us. Nothing to add.
    return null;
  } else {
    const metadataIndex = frontmatter.findIndex((line) => /^metadata\s*:/.test(line));
    if (metadataIndex !== -1) {
      frontmatter.splice(metadataIndex + 1, 0, "  opencode/autoinvoke: false");
    } else {
      frontmatter.push("metadata:", "  opencode/autoinvoke: false");
    }
  }

  if (frontmatter.join("\n") === before) return null;
  const result = [...head, ...frontmatter, ...lines.slice(end)].join("\n");
  return result === text ? null : result;
}
