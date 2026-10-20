// Scores a task prompt against the shared project memory lines.
//
//   node scripts/memory/search.mjs "tauri ipc config plugin"
//   node scripts/memory/search.mjs --json --limit 12 "waveform beatgrid"
//
// The memory store is small by design (one fact per line, context cost is paid
// every session), so this is deliberately plain lexical matching rather than
// the BM25 weighting the much larger skill library needs. The reader lives in
// `lib.mjs` so `scripts/agent/preflight.mjs` sees exactly the same entries.

import { MEMORY_DIR, searchMemory } from "./lib.mjs";

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
  console.error('usage: node scripts/memory/search.mjs [--json] [--limit N] "<query>"');
  process.exit(2);
}

const limit = Number(value("limit", "10"));
if (!Number.isFinite(limit) || limit < 0) {
  console.error(`usage: --limit expects a non-negative number, got "${value("limit", "10")}"`);
  process.exit(2);
}
const results = searchMemory(prompt, limit);

if (flags.has("--json")) {
  console.log(JSON.stringify({ prompt, scanned: MEMORY_DIR, results }, null, 2));
} else if (!results.length) {
  console.log(`No memory entries match "${prompt}".`);
} else {
  console.log(`Memory matches for "${prompt}":`);
  for (const entry of results) {
    const where = entry.section ? `${entry.layer} § ${entry.section}` : entry.layer;
    // One entry per line, uncut: the point of a hit is the reason it records.
    console.log(`  ${String(entry.score).padStart(2)}  ${where.padEnd(34)}  ${entry.text}`);
  }
}

function isFlagValue(arg) {
  return argv[argv.indexOf(arg) - 1] === "--limit";
}
