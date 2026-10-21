// Shared helpers for the agent-layer tooling.
//
// The registry (`agents.registry.json`) is the routing data: which subagent
// owns which files, which skills it brings, and which checks a change implies.
// This module loads it, matches paths against it, and scores agents and
// commands against a prompt plus the files in play.
//
//   scripts/agent/preflight.mjs  — the automatic brief for any prompt
//   scripts/agent/doctor.mjs     — checks the registry against the disk

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  buildIndex,
  globToRegExp,
  isFile,
  keywordHit,
  listSkills,
  loadPolicy,
  matchSkills,
  resolveDomains as resolveSkillDomains,
  tokenize,
} from "../skills/lib.mjs";
import { searchMemory } from "../memory/lib.mjs";

export const REGISTRY_PATH = path.join(ROOT, "agents.registry.json");
export { globToRegExp, keywordHit };

/** Load `agents.registry.json`, failing with a clear message when missing. */
export function loadRegistry() {
  if (!isFile(REGISTRY_PATH)) {
    throw new Error(`Missing ${path.relative(ROOT, REGISTRY_PATH)} — cannot route agents.`);
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
}

/* ------------------------------------------------------------------- paths */

/** True when `file` matches the glob `pattern`. */
export function matchPath(pattern, file) {
  const normalized = file.replace(/\\/g, "/").replace(/^\.\//, "");
  return globToRegExp(pattern).test(normalized);
}

/** True when the file matches at least one of the patterns. */
export function matchAny(patterns, file) {
  return (patterns ?? []).some((pattern) => matchPath(pattern, file));
}

/* ------------------------------------------------------------------ prompts */

const PATH_LIKE = /[\w./\\-]+\.(rs|tsx?|mjs|cjs|json|toml|md|css|scss|py|yml|yaml|sql)\b/g;

/** Extract repository paths that appear in the prompt text. */
export function pathsInPrompt(prompt) {
  const found = new Set();
  for (const match of String(prompt).matchAll(PATH_LIKE)) {
    const candidate = match[0].replace(/\\/g, "/");
    if (fs.existsSync(path.join(ROOT, candidate))) found.add(candidate);
  }
  return [...found];
}

/**
 * Files changed in the working tree — the strongest signal of which agent
 * owns the work, especially for a vague prompt like "fix the bug".
 *
 * `noise` lists the AI-tooling adapter directories: they are local copies of
 * the agent layer, not product source, so they must not drag the routing
 * towards "the agent layer needs editing" on every session.
 */
export function gitChangedFiles({ root = ROOT, noise = [], limit = 200 } = {}) {
  try {
    const output = execFileSync("git", ["status", "--porcelain", "-z", "-uall"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parsePorcelain(output)
      .filter((file) => !noise.some((dir) => file === dir || file.startsWith(`${dir}/`)))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Parse `git status --porcelain -z` output into a list of paths.
 *
 * `-z` separates records with NUL and leaves path bytes unquoted, which is what
 * makes non-ASCII names survive: the quoted form prints `café.md` as
 * `caf\303\251.md`, and any later backslash handling turns that into a path.
 * Rename and copy records are followed by the original path, which is not the
 * file being changed, so it is consumed with its pair.
 */
export function parsePorcelain(output) {
  const records = String(output).split("\0");
  const files = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    // A rename or copy record is followed by a second NUL-separated field
    // holding the old path. Either status column can carry the letter, so check
    // both rather than only the index one.
    if (/[RC]/.test(record.slice(0, 2))) index += 1;
    const file = record.slice(3).replace(/^\.\//, "");
    if (file) files.push(file);
  }
  return files;
}

/* ----------------------------------------------------------------- scoring */

/**
 * Score every registered agent against the prompt and the files in play.
 *
 * Keywords answer "what is this about"; owned paths answer "who should touch
 * it". An agent that matches on both is the strongest recommendation.
 */
export function scoreAgents(registry, { prompt, files = [] }) {
  const normalized = ` ${String(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim()} `;
  const tokens = new Set(tokenize(prompt));

  const scored = (registry.agents ?? []).map((agent) => {
    const keywordHits = (agent.keywords ?? []).filter((keyword) =>
      keywordHit(tokens, normalized, keyword)
    );
    const ownedFiles = files.filter((file) => matchAny(agent.owns, file));
    const keywordScore = keywordHits.length
      ? Math.min(1, 0.5 + (keywordHits.length - 1) * 0.25)
      : 0;
    const pathScore = ownedFiles.length ? Math.min(1, 0.6 + (ownedFiles.length - 1) * 0.2) : 0;
    const score = Math.max(keywordScore, pathScore) + 0.2 * Math.min(keywordScore, pathScore);
    return {
      id: agent.id,
      score: Number(score.toFixed(3)),
      keywordHits,
      ownedFiles,
      agent,
    };
  });

  return scored
    .filter((entry) => entry.score >= 0.35)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Score the registered commands against the prompt. */
export function scoreCommands(registry, prompt) {
  const normalized = ` ${String(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim()} `;
  const tokens = new Set(tokenize(prompt));

  return (registry.commands ?? [])
    .map((command) => {
      const words = new Set(tokenize(`${command.id} ${command.summary} ${command.use}`));
      let overlap = 0;
      for (const token of tokens) if (words.has(token)) overlap += 1;
      // A hyphenated ID is two words, and prose rarely spells them adjacently:
      // "audit the installed skills" has to reach `/skills-audit` even though it
      // never contains the phrase "skills audit".
      const idTokens = tokenize(command.id.replace(/[-_]/g, " "));
      const idCoverage = idTokens.length
        ? idTokens.filter((token) => tokens.has(token)).length / idTokens.length
        : 0;
      const idHit = Math.max(keywordHit(tokens, normalized, command.id) ? 1 : 0, idCoverage);
      const score = idHit * 0.8 + Math.min(0.4, overlap * 0.08);
      return { id: command.id, score: Number(score.toFixed(3)), command };
    })
    .filter((entry) => entry.score >= 0.3)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Pick the verification groups implied by the files in play and the prompt. */
export function selectVerification(registry, { prompt, files = [] }) {
  const normalized = ` ${String(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim()} `;
  const tokens = new Set(tokenize(prompt));
  const selected = [];
  for (const group of registry.verify ?? []) {
    const matchedFiles = files.filter((file) => matchAny(group.paths, file));
    // Word-level matching: a substring test let "trust" select the Rust checks
    // and "guide" select the UI ones, and agents run every check they are shown.
    const keywordHits = (group.keywords ?? []).filter((keyword) =>
      keywordHit(tokens, normalized, keyword)
    );
    if (!matchedFiles.length && !keywordHits.length) continue;
    selected.push({ ...group, matchedFiles, keywordHits });
  }
  return selected;
}

/* ------------------------------------------------------------------- misc */

/**
 * Resolve the domains a task belongs to, adding the routed subagent's own
 * domains on top of the prompt and file signals.
 *
 * The registry records which domains a specialist owns, so the agent that owns
 * the work also owns the domain — a vague "fix this" over `crates/core/**`
 * still lands in the Rust and audio areas.
 */
export function resolveDomains({ prompt, files = [], registry, policy }) {
  const hints = [];
  for (const entry of scoreAgents(registry, { prompt, files })) {
    for (const id of entry.agent.domains ?? []) hints.push(id);
  }
  return resolveSkillDomains({
    prompt,
    files,
    domainHints: hints,
    domains: policy.domains ?? {},
    pathDomains: policy.pathDomains ?? {},
  });
}

/**
 * Build the full brief for a prompt: memory lines, skills, agents, commands,
 * and the checks the work implies. Pure apart from reading the registry, the
 * policy, the installed skills, and the memory store.
 */
export function buildBrief({ prompt, files = [], top, memoryLimit, minScore }) {
  const registry = loadRegistry();
  const policy = loadPolicy();
  const { skills } = listSkills();
  const index = buildIndex(skills, new Set(policy.hot ?? []), policy.groups ?? {});

  const skillLimit = top ?? policy.inject?.maxInject ?? 3;
  const memoryCap = memoryLimit ?? 4;
  const floor = minScore ?? policy.inject?.minScore ?? 0.55;

  const resolved = resolveDomains({ prompt, files, registry, policy });

  const matched = matchSkills(index, prompt, {
    includeHot: true,
    limit: skillLimit,
    minScore: floor,
    triggers: policy.triggers ?? {},
    activeGroups: resolved.groups,
    offDomainPenalty: policy.inject?.offDomainPenalty ?? 0.1,
    genericTokens: new Set(policy.genericTokens ?? []),
  });

  // A vague prompt ("fix this") gives the matcher nothing to score, even when
  // the files in play say exactly which area the work is in. The domain's
  // default skills fill those empty slots — and only those, so a prompt with a
  // real signal is never diluted by them.
  //
  // Priority is deliberate: a skill in the active domain, then the domain's
  // own defaults, and only then a skill from outside the domain. An
  // off-domain match is a guess; a domain default is a considered one.
  const inDomain = (entry) =>
    entry.via === "trigger" || !resolved.groups.size || resolved.groups.has(entry.group);
  const picked = matched.filter(inDomain);
  const offDomain = matched.filter((entry) => !inDomain(entry));

  for (const id of resolved.domains) {
    if (picked.length >= skillLimit) break;
    for (const skillId of policy.domains?.[id]?.defaultSkills ?? []) {
      if (picked.length >= skillLimit) break;
      if (picked.some((entry) => entry.id === skillId)) continue;
      if (offDomain.some((entry) => entry.id === skillId)) continue;
      const skill = skills.find((item) => item.id === skillId);
      if (!skill) continue;
      picked.push({
        id: skillId,
        score: 0,
        hot: skill.hot ?? (policy.hot ?? []).includes(skillId),
        via: "domain",
        group: index.docs.find((doc) => doc.skill.id === skillId)?.group ?? null,
      });
    }
  }

  for (const entry of offDomain) {
    if (picked.length >= skillLimit) break;
    picked.push(entry);
  }

  const agents = scoreAgents(registry, { prompt, files }).slice(
    0,
    registry.delegation?.maxParallel ?? 2
  );
  const commands = scoreCommands(registry, prompt).slice(0, 3);
  const verification = selectVerification(registry, { prompt, files });

  // A delegated agent implies its own checks: Tauri work means Rust checks
  // even when the prompt never says "rust".
  const selected = new Set(verification.map((group) => group.id));
  for (const entry of agents) {
    for (const id of entry.agent.verify ?? []) {
      if (selected.has(id)) continue;
      const group = (registry.verify ?? []).find((item) => item.id === id);
      if (!group) continue;
      selected.add(id);
      verification.push({ ...group, matchedFiles: [], keywordHits: [] });
    }
  }

  return {
    prompt,
    files,
    domains: [...resolved.domains],
    domainGroups: [...resolved.groups],
    skills: picked.map((entry) => ({
      id: entry.id,
      score: entry.score,
      hot: entry.hot,
      via: entry.via,
      group: entry.group ?? null,
      description: skills.find((skill) => skill.id === entry.id)?.description ?? "",
    })),
    memory: searchMemory(prompt, memoryCap).map((entry) => ({
      layer: entry.layer,
      section: entry.section,
      text: entry.text,
      score: entry.score,
    })),
    agents: agents.map((entry) => ({
      id: entry.id,
      score: entry.score,
      why: entry.keywordHits.length
        ? `keywords: ${entry.keywordHits.join(", ")}`
        : `owns: ${entry.ownedFiles.slice(0, 3).join(", ")}`,
      skills: entry.agent.skills ?? [],
      spawn: entry.agent.spawn,
    })),
    commands: commands.map((entry) => ({
      id: entry.id,
      score: entry.score,
      use: entry.command.use,
    })),
    verify: verification.map((group) => ({
      id: group.id,
      label: group.label,
      commands: group.commands,
      note: group.note,
    })),
    handoff: registry.delegation?.handoff ?? "",
  };
}

/** Render a brief as the compact text an agent reads at the start of a task. */
export function renderBrief(brief) {
  const lines = [];
  lines.push(`Preflight · "${truncate(brief.prompt, 90)}"`);

  if (brief.files.length) {
    lines.push(`Files in play · ${brief.files.slice(0, 6).join(", ")}`);
  }

  lines.push("");
  lines.push("Skills · load with the `skill` tool");
  if (brief.domains.length) {
    lines.push(`  domain: ${brief.domains.join(", ")}`);
  }
  if (brief.skills.length) {
    brief.skills.forEach((skill, index) => {
      const label = skill.hot ? "hot " : "cold";
      lines.push(
        `  ${String(index + 1).padStart(2)}. ${skill.id.padEnd(34)} ${label} ${skill.via.padEnd(8)} ${truncate(skill.description, 70)}`
      );
    });
  } else {
    lines.push("  (none above the match threshold — continue without a skill)");
  }

  lines.push("");
  lines.push("Memory");
  if (brief.memory.length) {
    for (const entry of brief.memory) {
      const where = entry.section ? `${entry.layer} § ${entry.section}` : entry.layer;
      // Full text: a memory line cut mid-sentence can drop the reason that
      // makes it actionable, and the plan tells the agent to apply it.
      lines.push(`  ${where.padEnd(30)} ${entry.text}`);
    }
  } else {
    lines.push("  (no matching memory lines)");
  }

  lines.push("");
  lines.push("Agents");
  if (brief.agents.length) {
    for (const agent of brief.agents) {
      lines.push(`  delegate → ${agent.id.padEnd(20)} ${agent.why}`);
      if (agent.spawn) lines.push(`     when:    ${truncate(agent.spawn, 84)}`);
      if (agent.skills.length) lines.push(`     skills: ${agent.skills.join(", ")}`);
    }
    lines.push(`  handoff: ${brief.handoff}`);
  } else {
    lines.push("  (no specialist agent needed — work it directly)");
  }

  if (brief.commands.length) {
    lines.push("");
    lines.push("Commands");
    for (const command of brief.commands) {
      lines.push(`  /${command.id.padEnd(14)} ${command.use}`);
    }
  }

  lines.push("");
  lines.push("Checks");
  if (brief.verify.length) {
    for (const group of brief.verify) {
      if (group.commands.length) {
        lines.push(`  ${group.label.padEnd(8)} ${group.commands.join(" · ")}`);
      } else if (group.note) {
        lines.push(`  ${group.label.padEnd(8)} ${group.note}`);
      }
    }
  } else {
    lines.push("  (none implied by this prompt)");
  }

  lines.push("");
  lines.push("Plan");
  const plan = [];
  if (brief.skills.length) {
    plan.push(`load skills: ${brief.skills.map((skill) => skill.id).join(", ")}`);
  }
  if (brief.agents.length) {
    plan.push(`delegate to ${brief.agents.map((agent) => agent.id).join(" + ")}`);
  }
  const checks = brief.verify.flatMap((group) => group.commands);
  if (checks.length) plan.push(`run checks: ${checks.join(", ")}`);
  if (brief.memory.length) plan.push("apply the memory lines above before deciding");
  if (!plan.length) plan.push("proceed directly — nothing to load");
  plan.forEach((step, index) => lines.push(`  ${index + 1}. ${step}`));

  return lines.join("\n");
}

/** List the agent and command files the registry points at. */
export function registryFiles(registry) {
  const files = [];
  for (const source of registrySources(registry)) {
    for (const kind of ["agents", "commands"]) {
      const dir = source[kind];
      if (!dir) continue;
      const absolute = path.join(ROOT, dir);
      if (!fs.existsSync(absolute)) continue;
      for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        files.push({
          source: source.id,
          kind,
          id: entry.name.replace(/\.md$/, ""),
          path: `${dir}/${entry.name}`,
        });
      }
    }
  }
  return files;
}

/** The canonical source plus every mirror, as a flat list. */
export function registrySources(registry) {
  const sources = [];
  if (registry.sources?.canonical) {
    sources.push({ id: "canonical", ...registry.sources.canonical });
  }
  for (const mirror of registry.sources?.mirrors ?? []) {
    sources.push({ id: mirror.id, ...mirror });
  }
  return sources;
}

function truncate(text, max) {
  const value = String(text ?? "");
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
