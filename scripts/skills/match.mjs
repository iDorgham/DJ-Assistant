// Scores a task prompt against every installed skill description.
//
//   node scripts/skills/match.mjs "add a spectrum analyser to the waveform view"
//   node scripts/skills/match.mjs --json --top 8 --cold-only "tag editor form"
//
// Exit code is always 0 unless --fail-on-match is used and a cold match clears
// the threshold, which lets CI warn when a policy gap appears.

import { buildIndex, listSkills, loadPolicy, matchSkills, resolveDomains } from "./lib.mjs";

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
  console.error('usage: node scripts/skills/match.mjs [--json] [--top N] [--cold-only] "<task>"');
  process.exit(2);
}

const policy = loadPolicy();
const { skills } = listSkills();
const index = buildIndex(skills, new Set(policy.hot ?? []), policy.groups ?? {});
const top = Number(value("top", 5));
const minScore = Number(value("min", policy.inject?.minScore ?? 0));
const coldOnly = flags.has("--cold-only");

// The same domain gate the preflight uses, so a skill that the brief would
// never offer does not look like a match here either.
const resolved = resolveDomains({
  prompt,
  files: [],
  domains: policy.domains ?? {},
  pathDomains: policy.pathDomains ?? {},
});

const results = matchSkills(index, prompt, {
  includeHot: !coldOnly,
  limit: top,
  minScore,
  triggers: policy.triggers ?? {},
  activeGroups: resolved.groups,
  offDomainPenalty: policy.inject?.offDomainPenalty ?? 0.1,
  genericTokens: new Set(policy.genericTokens ?? []),
});

if (flags.has("--json")) {
  console.log(
    JSON.stringify({ prompt, coldOnly, minScore, domains: [...resolved.domains], results }, null, 2)
  );
} else if (!results.length) {
  console.log(`No skill matches "${prompt}" above ${minScore}.`);
} else {
  console.log(
    `Matches for "${prompt}"${coldOnly ? " (cold only)" : ""} · domains: ${
      [...resolved.domains].join(", ") || "none"
    }:`
  );
  for (const entry of results) {
    const skill = skills.find((item) => item.id === entry.id);
    const label = entry.hot ? "hot " : "cold";
    const via = entry.via === "trigger" ? "trigger" : "lexical";
    console.log(
      `  ${entry.score.toFixed(3)}  ${label}  ${via.padEnd(7)}  ${entry.id}  ::  ${truncate(skill?.description ?? "", 90)}`
    );
  }
}

if (flags.has("--fail-on-match") && results.some((entry) => !entry.hot)) process.exit(1);

function isFlagValue(arg) {
  const previous = argv[argv.indexOf(arg) - 1];
  return previous === "--top" || previous === "--min";
}

function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
