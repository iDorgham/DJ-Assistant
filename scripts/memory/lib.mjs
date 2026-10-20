// Shared reader for the layered project memory store.
//
//   docs/ai/memory/{facts,conventions,decisions,feedback,state}.md
//
// The store is small by design — every line is re-sent as context to every tool
// on every session — so this module stays deliberately simple: read the layers
// into flat entries, then score them lexically. `scripts/memory/search.mjs`
// and `scripts/agent/preflight.mjs` both use it so the two never disagree
// about what the memory says.

import fs from "node:fs";
import path from "node:path";
import { ROOT, tokenize } from "../skills/lib.mjs";

export const MEMORY_DIR = path.join(ROOT, "docs", "ai", "memory");
export const LAYERS = ["facts", "conventions", "decisions", "feedback", "state"];

/**
 * Generic verbs that match everything ("add a line…", "add a file…") and carry
 * no signal in a memory lookup. The skill matcher has its own, larger
 * stopword list; this one only covers the verbs the memory store leans on.
 */
const QUERY_STOPWORDS = new Set(
  (
    "add added adding make made making new old find found fix fixed update updated " +
    "change changed create created remove removed write wrote read run ran build built " +
    "keep kept try trying good better best want need also just let lets show shows give " +
    "take put call calls"
  ).split(" ")
);

/**
 * Read one memory file into `{ layer, section, text }` entries.
 *
 * The store has two shapes: `facts`/`conventions`/`state` are bullet lists,
 * while `decisions`/`feedback` are `## <id> · <title>` ledgers with a prose
 * body. Bullets become one entry each; a prose block becomes one entry carrying
 * its section heading, so searching a decision ID still hits.
 *
 * The file's opening paragraph is a description of the file itself ("Permanent,
 * verifiable facts…", "Append-only, newest last…"). It matches nearly every
 * prompt, so it is skipped.
 */
export function readLayer(layer) {
  const file = path.join(MEMORY_DIR, `${layer}.md`);
  if (!fs.existsSync(file)) return [];
  const entries = [];
  let section = null;
  let bullet = null;
  let block = [];
  let introDone = false;

  const addBullet = () => {
    if (bullet !== null) entries.push({ layer, section, text: stripMarkup(bullet) });
    bullet = null;
  };
  const addBlock = () => {
    if (!block.length) return;
    if (introDone) {
      entries.push({ layer, section, text: stripMarkup(block.join(" ")) });
    } else {
      // The first prose block describes the file, not the project.
      introDone = true;
    }
    block = [];
  };
  const flush = () => {
    addBullet();
    addBlock();
  };

  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      flush();
      introDone = true;
      section = stripMarkup(line.slice(3));
      continue;
    }
    if (!line) {
      flush();
      continue;
    }
    if (/^[-*] /.test(line)) {
      addBlock();
      addBullet();
      introDone = true;
      bullet = line.slice(2);
      continue;
    }
    if (line.startsWith("# ")) continue;
    // Indented continuation of a wrapped bullet belongs to that same fact.
    if (bullet !== null && /^\s/.test(raw)) bullet += ` ${line}`;
    else if (bullet !== null) {
      addBullet();
      block.push(line);
    } else block.push(line);
  }
  flush();
  return entries;
}

/** Every entry in the store, layer by layer. */
export function readMemory() {
  return LAYERS.flatMap(readLayer);
}

/**
 * Score a query against the memory store.
 *
 * `hit` is deliberately more forgiving than an exact token match: agents query
 * with domain vocabulary ("waveform", "beatgrid") and the store records the
 * inflected form ("waveforms"), which an exact-only matcher would silently
 * miss. The length floor keeps short tokens honest.
 */
export function searchMemory(query, limit = 10) {
  const tokens = new Set(tokenize(query).filter((token) => !QUERY_STOPWORDS.has(token)));
  if (!tokens.size) return [];
  const entries = readMemory().map((entry) => ({
    ...entry,
    haystack: new Set(tokenize(`${entry.text} ${entry.section ?? ""}`)),
  }));

  return entries
    .map((entry) => {
      const matched = [...tokens].filter((token) => hit(entry.haystack, token));
      return {
        layer: entry.layer,
        section: entry.section,
        text: entry.text,
        score: matched.length,
        matched,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.layer.localeCompare(b.layer))
    .slice(0, limit);
}

/** Memory prose embeds `**bold**`, `code`, and links — match on plain text. */
export function stripMarkup(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

function hit(haystack, token) {
  if (haystack.has(token)) return true;
  if (token.length < 5) return false;
  for (const word of haystack) if (word.startsWith(token)) return true;
  return false;
}
