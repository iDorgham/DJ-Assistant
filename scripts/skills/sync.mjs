// Mirrors the hot project skills into a second tool's own skills directory.
//
//   node scripts/skills/sync.mjs             # dry run: what would be copied
//   node scripts/skills/sync.mjs --write     # apply
//
// Why this exists: OpenCode reads `.opencode/skills`, Qoder reads
// `.qoder/skills`. Only the first is this project's skill library, so without a
// mirror the domain skills (the DJ and music ones) are invisible to Qoder
// sessions. The same argument holds for agents and commands, which
// `pnpm agent:sync` already mirrors — this is that script, for skills.
//
// The mirror carries the `hot` set from `skills.policy.json`, not the whole
// library: every installed skill is advertised to the model on every step
// (D-012), so copying all 116 would make Qoder pay for skills this project
// marked as unused. The source of truth stays `.opencode/skills` — refresh the
// mirror after `npx skills add`, a `skills:prune --restore`, or any edit to the
// hot list. Never hand-edit `.qoder/skills`; the next sync overwrites it.
//
// Nothing here is deleted: an entry in the mirror that is not in the requested
// set is left alone, and the tool only replaces the directories it owns.

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_SKILLS, ROOT, loadPolicy } from "./lib.mjs";

const QODER_SKILLS = path.join(ROOT, ".qoder", "skills");

const argv = process.argv.slice(2);
const write = argv.includes("--write");

/* ------------------------------------------------------------------- plan */

/**
 * A content hash for a skill directory: the relative path and bytes of every
 * file in it, so a copy is recognised as unchanged and a rename or an edit
 * inside a subdirectory is not.
 */
export function signature(dir) {
  const hash = crypto.createHash("sha1");
  const walk = (current, prefix) => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), relative);
      else
        hash
          .update(relative)
          .update("\0")
          .update(fs.readFileSync(path.join(current, entry.name)));
    }
  };
  walk(dir, "");
  return hash.digest("hex");
}

/** Where each requested skill stands: `create`, `update`, `unchanged` or `missing`. */
export function plan(names, sourceDir, targetDir) {
  return names.map((name) => {
    if (name !== path.basename(name) || name === "." || name === "..") {
      throw new Error(`invalid skill name: ${name}`);
    }
    const from = path.join(sourceDir, name);
    const to = path.join(targetDir, name);
    if (!fs.existsSync(from)) return { name, action: "missing" };
    if (!fs.existsSync(to)) return { name, action: "create" };
    return { name, action: signature(from) === signature(to) ? "unchanged" : "update" };
  });
}

/**
 * Replace the mirror's copy of each requested skill that needs it. The target
 * is removed before the copy so a file the source no longer has cannot survive
 * in it; entries outside `names` are not touched. Returns the same plan the
 * dry run prints, so a caller can tell what was skipped from what was copied.
 */
export function apply(names, sourceDir, targetDir) {
  const entries = plan(names, sourceDir, targetDir);
  fs.mkdirSync(targetDir, { recursive: true });
  for (const { name, action } of entries) {
    if (action === "missing" || action === "unchanged") continue;
    const to = path.join(targetDir, name);
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(path.join(sourceDir, name), to, { recursive: true, verbatimSymlinks: true });
  }
  return entries;
}

/* --------------------------------------------------------------- reporting */

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const names = loadPolicy().hot ?? [];
  if (!fs.existsSync(PROJECT_SKILLS)) {
    console.log(
      `No project skill library at ${path.relative(process.cwd(), PROJECT_SKILLS)} — nothing to mirror.`
    );
    console.log(
      "This machine has only the global OpenCode library; Qoder already reads its own global skills."
    );
    process.exitCode = 0;
  } else {
    const entries = write
      ? apply(names, PROJECT_SKILLS, QODER_SKILLS)
      : plan(names, PROJECT_SKILLS, QODER_SKILLS);
    const touched = entries.filter(
      (entry) => entry.action === "create" || entry.action === "update"
    );
    const missing = entries.filter((entry) => entry.action === "missing");
    for (const { name, action } of touched) {
      console.log(`${action.padEnd(6)} .qoder/skills/${name}`);
    }
    for (const { name } of missing) {
      console.log(`note   ${name} is hot but absent from .opencode/skills — not mirrored`);
    }
    if (!touched.length && !missing.length) {
      console.log(`Mirror is in sync — ${names.length} hot skill(s) in .qoder/skills.`);
    } else {
      console.log(
        `\n${touched.length} of ${names.length} hot skill(s) ${write ? "written" : "would change"}; ${missing.length} missing from the source.`
      );
      if (!write && touched.length) console.log("Re-run with --write to apply.");
    }
    if (missing.length && write) process.exitCode = 1;
  }
}
