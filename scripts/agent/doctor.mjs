// Health check for the workspace agent layer.
//
//   node scripts/agent/doctor.mjs
//   node scripts/agent/doctor.mjs --json
//
// Reports:
//   - registry entries that no longer match the canonical agent/command files
//   - mirror drift (an adapter directory that disagrees with the canonical one)
//   - mirrors that are not generated on this machine, as one summary line
//   - tool directories that mirror canonical files but are not in the registry
//   - registry skills that are not installed
//   - the context cost of the shared memory store
//
// Exit code 1 when a hard problem is found, so it can gate a maintenance PR.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, listSkills, loadPolicy } from "../skills/lib.mjs";
import { readMemory } from "../memory/lib.mjs";
import { loadRegistry, registrySources } from "./lib.mjs";
const argv = process.argv.slice(2);
const asJson = argv.includes("--json");

const registry = loadRegistry();
const { skills: installed } = listSkills();
const installedIds = new Set(installed.map((skill) => skill.id));

const hard = [];
const soft = [];

/* ------------------------------------------- canonical vs. registry entries */

const canonical = registry.sources?.canonical ?? {};
const canonicalAgents = listIds(canonical.agents);
const canonicalCommands = listIds(canonical.commands);

for (const agent of registry.agents ?? []) {
  if (!canonicalAgents.includes(agent.id)) {
    hard.push(`registry agent "${agent.id}" has no canonical file in ${canonical.agents}`);
  }
}
for (const id of canonicalAgents) {
  if (!(registry.agents ?? []).some((agent) => agent.id === id)) {
    hard.push(`canonical agent "${id}" (${canonical.agents}/${id}.md) is not in the registry`);
  }
}
for (const command of registry.commands ?? []) {
  if (!canonicalCommands.includes(command.id)) {
    hard.push(`registry command "${command.id}" has no canonical file in ${canonical.commands}`);
  }
}
for (const id of canonicalCommands) {
  if (!(registry.commands ?? []).some((command) => command.id === id)) {
    hard.push(`canonical command "${id}" (${canonical.commands}/${id}.md) is not in the registry`);
  }
}

/* ------------------------------------------------------------- mirror drift */

// Mirrors are gitignored and generated, so their absence is the normal state
// of a fresh clone. Absent directories are counted once instead of listed one
// per kind, which would bury real findings under ~27 sync hints.
const mirrorDirs = registrySources(registry)
  .filter((source) => source.id !== "canonical")
  .flatMap((source) =>
    ["agents", "commands"]
      .map((kind) => ({ id: source.id, kind, dir: source[kind], canonicalDir: canonical[kind] }))
      .filter((entry) => entry.dir && entry.canonicalDir)
  );
const missing = mirrorDirs.filter((entry) => !fs.existsSync(path.join(ROOT, entry.dir)));
const missingDirs = new Set(missing.map((entry) => entry.dir));

const drift = [];
for (const { id, dir, canonicalDir } of mirrorDirs) {
  if (missingDirs.has(dir)) continue;
  for (const file of listIds(canonicalDir)) {
    const from = path.join(ROOT, canonicalDir, `${file}.md`);
    const to = path.join(ROOT, dir, `${file}.md`);
    if (!fs.existsSync(to)) {
      drift.push(`${id}: ${dir}/${file}.md is missing`);
      continue;
    }
    if (!sameContent(from, to)) {
      drift.push(`${id}: ${dir}/${file}.md differs from ${canonicalDir}/${file}.md`);
    }
  }
  for (const file of listIds(dir)) {
    if (!listIds(canonicalDir).includes(file)) {
      soft.push(`mirror ${id}: ${dir}/${file}.md has no canonical counterpart`);
    }
  }
}
for (const line of drift) soft.push(`mirror drift — ${line}`);
if (missing.length) {
  const ids = [...new Set(missing.map((entry) => entry.id))];
  soft.push(
    `${missing.length} mirror dir(s) not generated on this machine (${shortList(
      ids
    )}) — gitignored local state; run \`pnpm agent:sync --write\` to create them`
  );
}

/* ---------------------------------------------------- unregistered tool dirs */

// A directory holding files named after canonical agents is being read by some
// tool whether the registry knows about it or not. Sync and drift checks only
// cover registered mirrors, so an unregistered one serves stale prose in silence.
const registeredDirs = new Set(
  registrySources(registry).flatMap((source) => [source.agents, source.commands, source.prompts])
);
const canonicalIds = new Set([...listIds(canonical.agents), ...listIds(canonical.commands)]);
const candidates = [];

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith(".")) continue;
  for (const kind of ["agents", "commands", "prompts"]) {
    const dir = path.posix.join(entry.name, kind);
    if (registeredDirs.has(dir)) continue;
    const mirrored = listIds(dir).filter((id) => canonicalIds.has(id));
    if (mirrored.length) candidates.push({ dir, mirrored });
  }
}

// A gitignored tool directory is this machine's local state, not something a
// clean checkout can be wrong about — report it, but do not tell the reader to
// delete another tool's files.
const ignoredDirs = gitIgnored(candidates.map((candidate) => `${candidate.dir}/`));
const unregistered = [];

for (const { dir, mirrored } of candidates) {
  const local = ignoredDirs.has(dir);
  unregistered.push({ dir, local });
  soft.push(
    local
      ? `${dir}/ mirrors ${mirrored.length} canonical file(s) and is gitignored — local state, leave it to its own tool`
      : `${dir}/ mirrors ${mirrored.length} canonical file(s) but is not in agents.registry.json — register it or delete the copies`
  );
}

/* ------------------------------------------------------------ skill coverage */

const unknownSkills = new Set();
for (const agent of registry.agents ?? []) {
  for (const skill of agent.skills ?? []) {
    if (!installedIds.has(skill)) unknownSkills.add(`${agent.id} → ${skill}`);
  }
}
for (const line of [...unknownSkills].sort()) {
  soft.push(`registry references a skill that is not installed: ${line}`);
}

/* --------------------------------------------------------- routing coherence */

const policy = loadPolicy();
const domains = policy.domains ?? {};
const groups = policy.groups ?? {};
const hot = new Set(policy.hot ?? []);
const prune = policy.prune ?? {};

for (const [id, domain] of Object.entries(domains)) {
  for (const group of domain.groups ?? []) {
    if (!groups[group]) hard.push(`domain "${id}" points at a group that does not exist: ${group}`);
  }
  for (const skill of domain.defaultSkills ?? []) {
    if (!installedIds.has(skill)) {
      soft.push(`domain "${id}" default skill is not installed: ${skill}`);
    }
  }
  // A repeated keyword is a copy-paste slip. The domain score counts the
  // distinct prompt words a domain claims, so the repeat no longer inflates
  // anything — but it misleads whoever reads the policy next.
  const seen = new Set();
  for (const keyword of domain.keywords ?? []) {
    if (seen.has(keyword)) hard.push(`domain "${id}" repeats the keyword "${keyword}"`);
    seen.add(keyword);
  }
}
for (const [pattern, ids] of Object.entries(policy.pathDomains ?? {})) {
  for (const id of ids ?? []) {
    if (!domains[id]) hard.push(`pathDomains "${pattern}" points at an unknown domain: ${id}`);
  }
}
for (const agent of registry.agents ?? []) {
  for (const id of agent.domains ?? []) {
    if (!domains[id]) hard.push(`agent "${agent.id}" points at an unknown domain: ${id}`);
  }
}

// A skill cannot be both a priority and a removal: the policy would reach for
// it on one prompt and delete it on the next. A prune entry that is not
// installed is *expected* — that is what a completed prune looks like — so the
// diagnostic is reserved for the contradictory references below.
for (const id of Object.keys(prune)) {
  if (hot.has(id)) hard.push(`"${id}" is in the hot set and on the prune list`);
}
for (const [id, domain] of Object.entries(domains)) {
  for (const skill of domain.defaultSkills ?? []) {
    if (skill in prune)
      hard.push(`domain "${id}" defaults to "${skill}", which is on the prune list`);
  }
}

/* ------------------------------------------------------------ memory weight */

const memoryEntries = readMemory();
const memoryChars = memoryEntries.reduce((sum, entry) => sum + entry.text.length, 0);
const memoryLines = memoryEntries.length;

const report = {
  canonical,
  mirrors: registrySources(registry).filter((source) => source.id !== "canonical").length,
  missingMirrors: missing.map((entry) => entry.dir),
  agents: registry.agents?.length ?? 0,
  commands: registry.commands?.length ?? 0,
  memoryEntries: memoryLines,
  memoryTokens: Math.round(memoryChars / 4),
  drift: drift.length,
  unregistered,
  hard,
  soft,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Agent layer: ${report.agents} agents, ${report.commands} commands, ${report.mirrors} mirrors`
  );
  console.log(`Memory: ${report.memoryEntries} entries (~${report.memoryTokens} tokens/step)`);
  console.log("");
  console.log(`Hard problems: ${hard.length}`);
  for (const line of hard) console.log(`  x ${line}`);
  console.log(`Findings: ${soft.length}`);
  for (const line of soft) console.log(`  - ${line}`);
  if (!hard.length && !soft.length) console.log("  clean");
}

if (hard.length) process.exit(1);

/* ------------------------------------------------------------------ helpers */

function listIds(dir) {
  if (!dir) return [];
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
}

function sameContent(a, b) {
  const read = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  return read(a) === read(b);
}

/** First few names of a list, collapsed so one finding stays one line. */
function shortList(items, max = 6) {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max}`;
}

/** The subset of `dirs` (repo-relative) that git considers ignored. */
function gitIgnored(dirs) {
  if (!dirs.length) return new Set();
  try {
    const output = execFileSync("git", ["check-ignore", "--stdin"], {
      cwd: ROOT,
      input: dirs.join("\n"),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return new Set(
      output
        .split("\n")
        .map((line) => line.trim().replace(/\/$/, ""))
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}
