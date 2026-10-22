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

/**
 * Glob → regular expression, shared with the agent layer.
 *
 * Supports `**` (any depth), `*` (one segment), and `?` (one character). The
 * `**` rewrites are staged through placeholders so the inserted regex
 * fragments are not themselves escaped.
 */
export function globToRegExp(pattern) {
  const fragments = {
    "@@G1@@": "(?:/.*)?",
    "@@G2@@": "(?:.*/)?",
    "@@G3@@": ".*",
  };
  let source = pattern;
  source = source.replace(/\/\*\*\//g, "@@G1@@/");
  source = source.replace(/\/\*\*$/, "@@G1@@");
  source = source.replace(/^\*\*\//, "@@G2@@");
  source = source.replace(/\*\*\//g, "@@G2@@");
  source = source.replace(/\*\*/g, "@@G3@@");

  let out = "";
  for (const ch of source) {
    if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else if ("\\^$.|+()[]{}".includes(ch)) out += `\\${ch}`;
    else out += ch;
  }
  for (const [token, fragment] of Object.entries(fragments)) {
    out = out.split(token).join(fragment);
  }
  return new RegExp(`^${out}$`);
}

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

/**
 * List skills from every source, with later sources overriding earlier IDs.
 * Returns `{ skills, overrides }`, with skills sorted by ID and overrides
 * recording which source won each duplicate.
 *
 * Parsed metadata is reused when a file's modification time and size match.
 * `cache: false` or a nonempty `DJ_ASSISTANT_NO_CACHE` bypasses cache reads and
 * writes. Cache read/write failures are ignored; directory-listing and skill-read errors
 * propagate. Missing sources and files that cannot be statted are skipped.
 */
export function listSkills({ cache = true } = {}) {
  const byId = new Map();
  const overrides = [];
  const stored = cache ? readSkillCache() : new Map();
  const next = new Map();

  for (const source of SOURCES) {
    if (!fs.existsSync(source.dir)) continue;
    for (const entry of fs.readdirSync(source.dir, { withFileTypes: true })) {
      // `npx skills add` links some skills in as directory symlinks; Node reports
      // those as symbolic links rather than directories.
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const file = path.join(source.dir, entry.name, "SKILL.md");
      if (!isFile(file)) continue;

      let stat;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      const fingerprint = `${stat.mtimeMs}:${stat.size}`;
      const cached = stored.get(file);
      const skill =
        cached && cached.fingerprint === fingerprint
          ? { ...cached.skill, symlink: entry.isSymbolicLink() }
          : readSkill(file, entry, source);

      next.set(file, { fingerprint, skill });
      if (byId.has(skill.id)) {
        const previous = byId.get(skill.id);
        overrides.push({
          id: skill.id,
          shadowed: previous.source,
          wins: source.name,
          shadowedFile: previous.file,
          file: skill.file,
        });
      }
      byId.set(skill.id, skill);
    }
  }

  if (cache) writeSkillCache(next);
  return { skills: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)), overrides };
}

/**
 * Parse one `SKILL.md` into metadata, using the directory name as its ID and
 * as the fallback name when frontmatter has no string name. Read errors propagate.
 */
function readSkill(file, entry, source) {
  const text = fs.readFileSync(file, "utf8");
  const { data, hadFrontmatter } = parseFrontmatter(text);
  return {
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
}

/* --------------------------------------------------------------- index cache */

const CACHE_DIR = path.join(ROOT, "node_modules", ".cache", "dj-assistant");
const CACHE_PATH = path.join(CACHE_DIR, "skills-index.json");

/**
 * Read the parsed-skill cache.
 *
 * Returns a map keyed by skill file path, or an empty map when
 * `DJ_ASSISTANT_NO_CACHE` is nonempty or reading/parsing the cache fails.
 */
function readSkillCache() {
  if (process.env.DJ_ASSISTANT_NO_CACHE) return new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    return new Map(parsed.entries ?? []);
  } catch {
    return new Map();
  }
}

/**
 * Persist the parsed metadata map, creating the cache directory as needed.
 * A nonempty `DJ_ASSISTANT_NO_CACHE` disables writes; write failures are ignored.
 */
function writeSkillCache(entries) {
  if (process.env.DJ_ASSISTANT_NO_CACHE) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const payload = [...entries].map(([file, value]) => [file, value]);
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify({ entries: payload })}\n`, "utf8");
  } catch {
    // A read-only or missing node_modules is not a reason to fail the brief.
  }
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
 * Resolve the policy group a skill belongs to.
 *
 * `skills.policy.json` groups the library by the kind of work a skill serves
 * ("Rust core", "Tauri shell", "Music & DJ domain", …). A skill that matches
 * no group is outside every domain the project recognises.
 * Returns the first group with a matching skill ID or glob pattern, or `null`.
 */
export function skillGroup(skillId, groups = {}) {
  for (const [group, members] of Object.entries(groups)) {
    if (!Array.isArray(members)) continue;
    for (const member of members) {
      if (member === skillId || globToRegExp(member).test(skillId)) return group;
    }
  }
  return null;
}

/**
 * BM25-flavoured scoring: ID tokens count 3x, description tokens 1x, weighted
 * by inverse document frequency so common words ("design", "code") do not
 * dominate. Length-normalized to keep long descriptions from winning on bulk.
 *
 * Each document also carries its policy group, so the matcher can tell a
 * domain-relevant skill from one that merely shares a word with the prompt.
 */
export function buildIndex(skills, hot = new Set(), groups = {}) {
  const docs = skills.map((skill) => ({
    skill,
    hot: hot.has(skill.id),
    group: skillGroup(skill.id, groups),
    ...skillTokens(skill),
  }));
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

/**
 * Resolve which project domains a task belongs to, and therefore which
 * policy groups of skills are in play.
 *
 * Three signals, strongest first:
 *
 * 1. **The files in play** — `pathDomains` maps a path prefix to a domain, so
 *    a vague "fix this" still lands in the right area. The files say where the
 *    work *is*, not only what the prompt mentions, so they win outright: when
 *    a file matches, the prompt does not get to add a second opinion.
 * 2. **Prompt vocabulary** — the curated `domains` map in the policy, used only
 *    when no file matched. The domain with the *most* distinct prompt words
 *    wins, so a task that names two areas ("make the library table prettier")
 *    does not activate the audio area just because "library" is one of its
 *    keywords. Ties keep every candidate.
 * 3. **`domainHints`** — domains contributed by the caller, which is how the
 *    agent layer passes in the domain of the subagent that owns the work. The
 *    routed subagent owns a whole tree, so it is the last resort: it only
 *    speaks when neither the files nor the prompt did.
 *
 * Returns `{ domains, groups }` as sets; groups are the union of the active
 * domains' policy groups. Both sets are empty when no signal resolves a domain.
 */
export function resolveDomains({
  prompt,
  files = [],
  domainHints = [],
  domains = {},
  pathDomains = {},
}) {
  const active = new Set();

  const normalized = ` ${String(prompt ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim()} `;
  const tokens = new Set(tokenize(prompt));
  const scored = [];
  for (const [id, domain] of Object.entries(domains)) {
    // Count the distinct prompt *words* the domain claims, not the keyword
    // entries it happens to match: "waveform" and "waveforms" are two entries
    // but one word, and counting both let one alias out-vote a real signal.
    const words = new Set();
    for (const keyword of domain.keywords ?? []) {
      for (const word of matchedWords(tokens, normalized, keyword)) words.add(word);
    }
    if (words.size) scored.push({ id, hits: words.size });
  }
  const best = scored.reduce((max, entry) => Math.max(max, entry.hits), 0);

  // The files in play are the strongest signal: they say where the work *is*,
  // not only what the prompt mentions. When a file matches, the prompt does
  // not get to add a second opinion — an unrelated word in the prompt would
  // otherwise make off-domain skills eligible at full score.
  let pathMatched = false;
  for (const file of files) {
    for (const [pattern, ids] of Object.entries(pathDomains)) {
      if (globToRegExp(pattern).test(file.replace(/\\/g, "/").replace(/^\.\//, ""))) {
        pathMatched = true;
        for (const id of ids ?? []) active.add(id);
      }
    }
  }

  if (!pathMatched) {
    for (const entry of scored) {
      if (entry.hits === best) active.add(entry.id);
    }
  }

  // The routed subagent is the last resort: it knows the area, but it owns a
  // whole tree, so it is coarser than the file paths and never overrides them.
  if (!active.size) for (const id of domainHints) active.add(id);

  const groups = new Set();
  for (const id of active) for (const group of domains[id]?.groups ?? []) groups.add(group);

  return { domains: active, groups };
}

/**
 * The prompt words a keyword matches.
 *
 * Phrases match as whole phrases and claim each of their words; single words
 * match exactly, or by a shared prefix of at least five characters in either
 * direction — so "skill" finds "skills" and "waveform" finds "waveforms", but
 * "set" never finds "settings".
 *
 * The result is a list of *prompt words*, so two alias keywords — "waveform"
 * and "waveforms" — claim the same word, and a domain's score counts the
 * words it actually claims rather than the entries it happens to match.
 */
export function matchedWords(promptTokens, normalizedPrompt, keyword) {
  const phrase = keyword
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
  if (!phrase) return [];
  if (phrase.includes(" ")) {
    if (!normalizedPrompt.includes(` ${phrase} `)) return [];
    return phrase.split(" ");
  }
  if (promptTokens.has(phrase)) return [phrase];
  // tokenize() drops every word of two characters or fewer, so `ui` can never
  // reach the token set; match it against the padded prompt instead of letting
  // the length guard below discard the keyword.
  if (phrase.length < 3) return normalizedPrompt.includes(` ${phrase} `) ? [phrase] : [];
  if (phrase.length < 5) return [];
  const matched = [];
  for (const token of promptTokens) {
    if (token.length < 5) continue;
    if (token.startsWith(phrase) || phrase.startsWith(token)) matched.push(token);
  }
  return matched;
}

/**
 * True when the keyword appears in the prompt.
 *
 * Phrases match as whole phrases; single words match exactly, or by a shared
 * prefix of at least five characters in either direction — so "skill" finds
 * "skills" and "waveform" finds "waveforms", but "set" never finds "settings".
 */
export function keywordHit(promptTokens, normalizedPrompt, keyword) {
  return matchedWords(promptTokens, normalizedPrompt, keyword).length > 0;
}

/**
 * Score a prompt against the skill index.
 *
 * Three gates decide whether a skill qualifies for scoring:
 *
 * 1. **A curated trigger** qualifies the skill. `skills.policy.json` maps project
 *    vocabulary onto skill IDs by hand. Each matching trigger adds 10 to the
 *    score and bypasses lexical qualification and domain penalties.
 * 2. **A specific ID hit** — a token from the skill's ID is in the prompt. The token
 *    must not be one of the domain-neutral words in `genericTokens`; "speed"
 *    alone used to select `performance-and-perceived-speed` and "memory" alone
 *    selected `memory-safety-patterns`, both on unrelated tasks.
 * 3. **Two independent hits**, so one shared adjective cannot pick a skill.
 *
 * When `activeGroups` is nonempty, lexical matches outside those groups have
 * their score multiplied by `offDomainPenalty` before filtering.
 *
 * Returns up to `limit` entries with ID, score, hits, hot flag, and `via` match
 * source; lexical entries also carry their group. `minScore` is inclusive and
 * applied before rounding scores to four decimals. Results sort by descending
 * rounded score, then ID; `includeHot: false` excludes hot skills.
 * Returns an empty array when the prompt has no tokens, even if a trigger matches.
 */
export function matchSkills(
  index,
  prompt,
  {
    includeHot = true,
    limit = 5,
    minScore = 0,
    triggers = {},
    activeGroups = null,
    offDomainPenalty = 0.1,
    genericTokens = new Set(),
  } = {}
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
      const generic = genericTokens.has(token);
      if (doc.idTokens.has(token) && !generic) {
        sum += 3 * index.idf(token);
        idHit = true;
        hits.push(token);
      } else if (doc.descTokens.has(token)) {
        sum += index.idf(token);
        hits.push(token);
      } else if (doc.idTokens.has(token)) {
        // A domain-neutral word that happens to be part of the skill's name
        // earns description-level weight, never the 3x name bonus.
        sum += index.idf(token);
        hits.push(token);
      }
    }
    // A single generic description word is noise: require a name hit or two words.
    if (!idHit && hits.length < 2) continue;
    const length = doc.idTokens.size + doc.descTokens.size || 1;
    const coverage = hits.length / query.size;
    const normalized = (sum / Math.sqrt(1 + length / 40)) * (0.5 + 0.5 * coverage);
    if (normalized <= 0) continue;
    const existing = results.get(doc.skill.id);
    if (existing) {
      // A triggered skill is curated by hand; it is never penalised.
      existing.score += normalized;
    } else {
      const gated =
        activeGroups && activeGroups.size && !activeGroups.has(doc.group)
          ? normalized * offDomainPenalty
          : normalized;
      results.set(doc.skill.id, {
        id: doc.skill.id,
        score: gated,
        hits,
        hot: doc.hot,
        via: "lexical",
        group: doc.group,
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
