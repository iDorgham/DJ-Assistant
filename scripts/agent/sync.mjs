// Mirrors the canonical agent/command files to every tool adapter directory.
//
//   node scripts/agent/sync.mjs            # dry run — list what would change
//   node scripts/agent/sync.mjs --write    # apply
//
// The canonical source is `agents.registry.json` → `sources.canonical`
// (`.opencode/agents` and `.opencode/commands`, the tracked copies). Every
// other adapter directory (`.kilo`, `.qoder`, `.claude`, `.cursor`, …) holds a
// local mirror, because each AI tool on this machine reads its own directory.
//
// The script is idempotent and guarded: it only writes into directories the
// registry names, it never deletes anything, and it reports every change.

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../skills/lib.mjs";
import { loadRegistry, registrySources } from "./lib.mjs";

const write = process.argv.includes("--write");
const registry = loadRegistry();
const canonical = registry.sources?.canonical ?? {};

const changes = [];
let unchanged = 0;

for (const source of registrySources(registry)) {
  if (source.id === "canonical") continue;
  for (const kind of ["agents", "commands"]) {
    const targetDir = source[kind];
    const sourceDir = canonical[kind];
    if (!targetDir || !sourceDir) continue;

    const absoluteTarget = path.join(ROOT, targetDir);
    const absoluteSource = path.join(ROOT, sourceDir);
    if (!fs.existsSync(absoluteSource)) continue;

    // A dry run reports what it would write; creating the directories here
    // would leave a clean clone looking like a half-synced one, which
    // `agent:doctor` then reads as per-file drift instead of "not generated".
    if (write) fs.mkdirSync(absoluteTarget, { recursive: true });
    for (const name of fs.readdirSync(absoluteSource).filter((file) => file.endsWith(".md"))) {
      const from = path.join(absoluteSource, name);
      const to = path.join(absoluteTarget, name);
      const content = fs.readFileSync(from, "utf8");
      const current = fs.existsSync(to) ? fs.readFileSync(to, "utf8") : null;
      if (current !== null && current.replace(/\r\n/g, "\n") === content.replace(/\r\n/g, "\n")) {
        unchanged += 1;
        continue;
      }
      changes.push({
        mirror: source.id,
        kind,
        path: `${targetDir}/${name}`,
        action: current ? "update" : "create",
      });
      if (write) fs.writeFileSync(to, content, "utf8");
    }
  }
}

if (!changes.length) {
  console.log(`Agent layer is in sync — ${unchanged} mirrored files unchanged.`);
} else {
  for (const change of changes) {
    console.log(`${change.action.padEnd(6)} ${change.path}`);
  }
  console.log(
    `\n${changes.length} file(s) ${write ? "written" : "would change"} (${unchanged} already in sync).`
  );
}

if (!write && changes.length) {
  console.log("Re-run with --write to apply.");
}
