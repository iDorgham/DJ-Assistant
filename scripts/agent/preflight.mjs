// The automatic brief for any prompt.
//
//   node scripts/agent/preflight.mjs "add a spectrum analyser to the waveform view"
//   node scripts/agent/preflight.mjs --json --top 5 "fix the beatgrid writer"
//   node scripts/agent/preflight.mjs --paths apps/desktop/src/App.tsx "review this"
//
// One command turns a raw prompt into everything an agent needs before it
// starts: the memory lines that apply, the skills worth loading, the subagent
// that should own the work, and the checks the change implies.
//
// It is read-only and never blocks: with no matches it still prints a brief.

import { buildBrief, gitChangedFiles, loadRegistry, pathsInPrompt, renderBrief } from "./lib.mjs";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
const value = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};

const prompt = argv
  .filter((arg) => !arg.startsWith("--") && !isFlagValue(arg))
  .join(" ")
  .trim();
if (!prompt) {
  console.error(
    'usage: node scripts/agent/preflight.mjs [--json] [--top N] [--memory-limit N] [--paths a,b] "<task>"'
  );
  process.exit(2);
}

const registry = loadRegistry();
const files = collectFiles();
const brief = buildBrief({
  prompt,
  files,
  top: Number(value("top", 0)) || undefined,
  memoryLimit: Number(value("memory-limit", 0)) || undefined,
  minScore: Number(value("min", 0)) || undefined,
});

if (flags.has("--json")) console.log(JSON.stringify(brief, null, 2));
else console.log(renderBrief(brief));

/* ------------------------------------------------------------------ helpers */

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
