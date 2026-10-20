// Shared helpers for the skill-management tooling.
//
// Skills are plain `SKILL.md` directories that OpenCode discovers from
// `~/.config/opencode/skills` (global) and `.opencode/skills` (project). This
// module finds them, parses their frontmatter, and loads the routing policy so
// the inventory/match/audit/policy scripts do not repeat that logic.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, "..", "..");
export const GLOBAL_SKILLS = path.join(os.homedir(), ".config", "opencode", "skills");
export const PROJECT_SKILLS = path.join(ROOT, ".opencode", "skills");
export const POLICY_PATH = path.join(ROOT, "skills.policy.json");
export const MANIFEST_PATH = path.join(ROOT, ".opencode", "skill-manifest.json");
export const ROUTING_DOC = path.join(ROOT, "docs", "ai", "SKILL_ROUTING.md");

// Order is precedence: a later source overrides an earlier one with the same ID.
export const SOURCES = [
  { name: "global", dir: GLOBAL_SKILLS },
  { name: "project", dir: PROJECT_SKILLS },
];

const STOPWORDS = new Set(
  (
    "a an the and or of for to in on with by from as is are be been this that these those it its " +
    "use used uses using when your you any all can into via per not no more most other others such " +
    "than then there their they them we our only also if do does done make makes making get gets " +
    "like based across between within over under about after before while where which who whom what " +
    "how why will would should could may might must just so at up out off own same very each both " +
    "few many much some need needs want wants task tasks work works project projects file files"
  ).split(" ")
);

/** True when the file exists and is a regular file. */
export function isFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

/**
 * Minimal frontmatter parser for the YAML subset skills actually use:
 * `key: value`, indented continuation blocks, `|`/`>` scalar blocks, single
 * level nesting (`metadata:` + indented children), quoted values, booleans.
 * Returns `{ data, body, hadFrontmatter }`; keys are flattened, with nested
 * keys joined as `parent/child`.
 */
export function parseFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const data = {};
  let bodyStart = 0;

  if (lines[0]?.trim() === "---") {
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---" || lines[i].trim() === "...") {
        end = i;
        break;
      }
    }
    if (end === -1) end = lines.length;
    bodyStart = end + 1;

    const set = (key, value) => {
      data[key] = value;
    };
    const readBlock = (start, indent) => {
      const parts = [];
      let i = start;
      for (; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "") {
          parts.push("");
          continue;
        }
        const leading = line.match(/^\s*/)[0].length;
        if (leading < indent) break;
        parts.push(line.trim());
      }
      return { value: parts.join(" ").replace(/\s+/g, " ").trim(), next: i };
    };

    for (let i = 1; i < end; i++) {
      const line = lines[i];
      if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
      const match = line.match(/^(\s*)([A-Za-z][\w./-]*):\s*(.*)$/);
      if (!match) continue;
      const [, indentRaw, key, rawValue] = match;
      const indent = indentRaw.length;
      let value = rawValue.trim();

      if (value === "|" || value === ">" || /^[|>][+-]?\d*$/.test(value)) {
        // Block scalar.
        const block = readBlock(i + 1, indent + 1);
        value = block.value;
        i = block.next - 1;
      } else if (value === "") {
        // A `metadata:` block is a nested mapping; any other key with an
        // indented body is a folded scalar (`description:` continuation).
        const nested =
          key === "metadata"
            ? readMapping(lines, i + 1, end, indent + 1)
            : { entries: [], next: i + 1 };
        if (nested.entries.length) {
          for (const [child, childValue] of nested.entries) set(`${key}/${child}`, childValue);
          i = nested.next - 1;
          continue;
        }
        const block = readBlock(i + 1, indent + 1);
        value = block.value;
        i = block.next - 1;
      } else {
        value = parseScalar(value);
      }

      if (indent > 0) {
        const parent = findParentKey(lines, i, end);
        set(parent ? `${parent}/${key}` : key, value);
      } else {
        set(key, value);
      }
    }
  }

  return {
    data,
    body: lines.slice(bodyStart).join("\n"),
    hadFrontmatter: lines[0]?.trim() === "---",
  };
}

function findParentKey(lines, index, end) {
  const own = lines[index].match(/^(\s*)/)[1].length;
  for (let i = index - 1; i > 0 && i < end; i--) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^(\s*)([A-Za-z][\w./-]*):/);
    if (!match) continue;
    if (match[1].length < own) return match[2];
  }
  return null;
}

/** Read one level of an indented `key: value` mapping (e.g. a `metadata:` block). */
function readMapping(lines, start, end, indent) {
  const entries = [];
  let i = start;
  for (; i < end; i++) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (line.match(/^\s*/)[0].length < indent) break;
    const match = line.match(/^\s*([A-Za-z][\w./-]*):\s*(.*)$/);
    if (!match) break;
    entries.push([match[1], parseScalar(match[2])]);
  }
  return { entries, next: i };
}

/** Parse an inline YAML scalar: list, quoted string, boolean, or plain text. */
function parseScalar(raw) {
  let value = String(raw).trim();
  if (value.startsWith("[")) {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  if (/^["']/.test(value)) {
    const quote = value[0];
    const close = value.indexOf(quote, 1);
    if (close !== -1) value = value.slice(1, close);
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  return value;
}

/** Resolve `metadata.opencode/autoinvoke` / `disable-model-invocation`. */
export function isAutoinvokeDisabled(data) {
  const value = data["metadata/opencode/autoinvoke"] ?? data["disable-model-invocation"];
  return value === false || value === "false";
}

/** List skills from every source, with later sources overriding earlier IDs. */
export function listSkills() {
  const byId = new Map();
  const overrides = [];
  for (const source of SOURCES) {
    if (!fs.existsSync(source.dir)) continue;
    for (const entry of fs.readdirSync(source.dir, { withFileTypes: true })) {
      // `npx skills add` links some skills in as directory symlinks; Node reports
      // those as symbolic links rather than directories.
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const file = path.join(source.dir, entry.name, "SKILL.md");
      if (!isFile(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      const { data, hadFrontmatter } = parseFrontmatter(text);
      const skill = {
        id: entry.name,
        source: source.name,
        file,
        dir: path.join(source.dir, entry.name),
        symlink: entry.isSymbolicLink(),
        name: typeof data.name === "string" ? data.name : entry.name,
        hasName: Object.prototype.hasOwnProperty.call(data, "name"),
        description: typeof data.description === "string" ? data.description : "",
        autoinvoke: !isAutoinvokeDisabled(data),
        hadFrontmatter,
        lines: text.split("\n").length,
        bytes: Buffer.byteLength(text),
      };
      if (byId.has(skill.id))
        overrides.push({ id: skill.id, shadowed: byId.get(skill.id).source, wins: source.name });
      byId.set(skill.id, skill);
    }
  }
  return { skills: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)), overrides };
}

/** Load `skills.policy.json`, failing with a clear message when missing. */
export function loadPolicy() {
  if (!isFile(POLICY_PATH)) {
    throw new Error(`Missing ${path.relative(ROOT, POLICY_PATH)} — cannot classify skills.`);
  }
  return JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
}

export function isHot(policy, id) {
  return (policy.hot ?? []).includes(id);
}

/* ---------------------------------------------------------------- matching */

export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/** Tokens that carry most of a skill's identity come from its ID. */
export function skillTokens(skill) {
  const idTokens = tokenize(skill.id.replace(/[-_]/g, " "));
  const descTokens = tokenize(skill.description);
  return { idTokens: new Set(idTokens), descTokens: new Set(descTokens) };
}

/**
 * BM25-flavoured scoring: ID tokens count 3x, description tokens 1x, weighted
 * by inverse document frequency so common words ("design", "code") do not
 * dominate. Length-normalized to keep long descriptions from winning on bulk.
 */
export function buildIndex(skills, hot = new Set()) {
  const docs = skills.map((skill) => ({ skill, hot: hot.has(skill.id), ...skillTokens(skill) }));
  const df = new Map();
  for (const doc of docs) {
    for (const token of new Set([...doc.idTokens, ...doc.descTokens])) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  const total = docs.length || 1;
  const idf = (token) =>
    Math.log(1 + (total - (df.get(token) ?? 0) + 0.5) / ((df.get(token) ?? 0) + 0.5));
  return { docs, idf };
}

export function matchSkills(
  index,
  prompt,
  { includeHot = true, limit = 5, minScore = 0, triggers = {} } = {}
) {
  const queryTokens = tokenize(prompt);
  if (queryTokens.length === 0) return [];
  const query = new Set(queryTokens);
  const haystack = ` ${String(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  const results = new Map();

  // 1. Curated triggers win outright: project vocabulary mapped to skills by hand.
  for (const [needle, ids] of Object.entries(triggers)) {
    const phrase = needle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!triggerHits(haystack, phrase)) continue;
    for (const id of ids ?? []) {
      const doc = index.docs.find((item) => item.skill.id === id);
      if (!doc) continue;
      const current = results.get(id) ?? { id, score: 0, hits: [], hot: doc.hot, via: "trigger" };
      current.score += 10;
      if (!current.hits.includes(needle)) current.hits.push(needle);
      current.via = "trigger";
      results.set(id, current);
    }
  }

  // 2. Lexical pass for everything the trigger map does not cover.
  for (const doc of index.docs) {
    let sum = 0;
    let idHit = false;
    const hits = [];
    for (const token of query) {
      if (doc.idTokens.has(token)) {
        sum += 3 * index.idf(token);
        idHit = true;
        hits.push(token);
      } else if (doc.descTokens.has(token)) {
        sum += index.idf(token);
        hits.push(token);
      }
    }
    // A single generic description word is noise; require an ID match or two words.
    if (!idHit && hits.length < 2) continue;
    const length = doc.idTokens.size + doc.descTokens.size || 1;
    const coverage = hits.length / query.size;
    const normalized = (sum / Math.sqrt(1 + length / 40)) * (0.5 + 0.5 * coverage);
    if (normalized <= 0) continue;
    const existing = results.get(doc.skill.id);
    if (existing) {
      existing.score += normalized;
    } else {
      results.set(doc.skill.id, {
        id: doc.skill.id,
        score: normalized,
        hits,
        hot: doc.hot,
        via: "lexical",
      });
    }
  }

  return [...results.values()]
    .filter((entry) => entry.score >= minScore)
    .filter((entry) => includeHot || !entry.hot)
    .map((entry) => ({ ...entry, score: Number(entry.score.toFixed(4)) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** True when `phrase` appears in the normalized haystack; single words match prefixes. */
function triggerHits(haystack, phrase) {
  if (!phrase) return false;
  if (phrase.includes(" ")) return haystack.includes(` ${phrase} `);
  return haystack.split(" ").some((word) => word.startsWith(phrase));
}

/* ------------------------------------------------------------------- misc */
export function estimateTokens(text) {
  return Math.round(String(text).length / 4);
}

export function readManifest() {
  if (!isFile(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
