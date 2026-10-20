// Health check for the workspace agent layer.
//
//   node scripts/agent/doctor.mjs
//   node scripts/agent/doctor.mjs --json
//
// Reports:
//   - registry entries that no longer match the canonical agent/command files
//   - mirror drift (an adapter directory that disagrees with the canonical one)
//   - tool directories that mirror canonical files but are not in the registry
//   - registry skills that are not installed
//   - the context cost of the shared memory store
//
// Exit code 1 when a hard problem is found, so it can gate a maintenance PR.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, listSkills } from "../skills/lib.mjs";
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

const drift = [];
for (const source of registrySources(registry)) {
  if (source.id === "canonical") continue;
  for (const kind of ["agents", "commands"]) {
    const dir = source[kind];
    if (!dir) continue;
    const canonicalDir = canonical[kind];
    if (!canonicalDir) continue;
    if (!fs.existsSync(path.join(ROOT, dir))) {
      soft.push(`mirror ${source.id}: ${dir} does not exist (run \`pnpm agent:sync --write\`)`);
      continue;
    }
    for (const id of listIds(canonicalDir)) {
      const from = path.join(ROOT, canonicalDir, `${id}.md`);
      const to = path.join(ROOT, dir, `${id}.md`);
      if (!fs.existsSync(to)) {
        drift.push(`${source.id}: ${dir}/${id}.md is missing`);
        continue;
      }
      if (!sameContent(from, to)) {
        drift.push(`${source.id}: ${dir}/${id}.md differs from ${canonicalDir}/${id}.md`);
      }
    }
    for (const id of listIds(dir)) {
      if (!listIds(canonicalDir).includes(id)) {
        soft.push(`mirror ${source.id}: ${dir}/${id}.md has no canonical counterpart`);
      }
    }
  }
}
for (const line of drift) soft.push(`mirror drift — ${line}`);

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

/* ------------------------------------------------------------ memory weight */

const memoryEntries = readMemory();
const memoryChars = memoryEntries.reduce((sum, entry) => sum + entry.text.length, 0);
const memoryLines = memoryEntries.length;

const report = {
  canonical,
  mirrors: registrySources(registry).filter((source) => source.id !== "canonical").length,
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
