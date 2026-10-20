// The automatic brief for any prompt.
//
//   node scripts/agent/preflight.mjs "add a spectrum analyser to the waveform view"
//   node scripts/agent/preflight.mjs --json --top 5 "fix the beatgrid writer"
//   node scripts/agent/preflight.mjs --paths apps/desktop/src/App.tsx "review this"
//   node scripts/agent/preflight.mjs --stdin <<'TASK'
//   the deck's gain fader — $100 in a backtick `task`
//   TASK
//
// One command turns a raw prompt into everything an agent needs before it
// starts: the memory lines that apply, the skills worth loading, the subagent
// that should own the work, and the checks the change implies.
//
// It is read-only and never blocks: with no matches it still prints a brief.

import fs from "node:fs";
import { buildBrief, gitChangedFiles, loadRegistry, pathsInPrompt, renderBrief } from "./lib.mjs";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
const value = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};

// `--stdin` exists because a prompt quoted for the shell is a prompt that can
// execute: single quotes survive `$(…)` and backticks but break on an
// apostrophe, so the safe form pipes the text in untouched.
let prompt = argv
  .filter((arg) => !arg.startsWith("--") && !isFlagValue(arg))
  .join(" ")
  .trim();
if (flags.has("--stdin")) prompt = fs.readFileSync(0, "utf8").trim();
if (!prompt) {
  console.error(
    'usage: node scripts/agent/preflight.mjs [--json] [--stdin] [--top N] [--memory-limit N] [--paths a,b] "<task>"'
  );
  process.exit(2);
}

const registry = loadRegistry();
const files = collectFiles();
const brief = buildBrief({
  prompt,
  files,
  top: count("top"),
  memoryLimit: count("memory-limit"),
  minScore: count("min"),
});

if (flags.has("--json")) console.log(JSON.stringify(brief, null, 2));
else console.log(renderBrief(brief));

/* ------------------------------------------------------------------ helpers */

/**
 * A numeric flag, or `undefined` when absent so the caller keeps its default.
 * Zero is a real answer ("no skills", "no memory lines"), and a negative or
 * non-numeric one is a usage error rather than a silent wide slice.
 */
function count(name) {
  const raw = value(name, null);
  if (raw === null) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`usage: --${name} expects a non-negative number, got "${raw}"`);
    process.exit(2);
  }
  return parsed;
}

function collectFiles() {
  const explicit = String(value("paths", ""))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const fromPrompt = pathsInPrompt(prompt);
  const fromGit = flags.has("--no-git") ? [] : gitChangedFiles({ noise: registry.noise ?? [] });
  return [...new Set([...explicit, ...fromPrompt, ...fromGit])];
}

function isFlagValue(arg) {
  const previous = argv[argv.indexOf(arg) - 1];
  return ["--top", "--min", "--memory-limit", "--paths"].includes(previous);
}
