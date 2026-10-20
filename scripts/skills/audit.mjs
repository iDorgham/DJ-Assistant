// Integrity and curation report for the installed skill library.
//
//   node scripts/skills/audit.mjs
//   node scripts/skills/audit.mjs --json
//
// Exit code 1 when a hard problem is found (missing description, duplicate ID),
// so it can gate a maintenance PR. Soft findings (near duplicates, oversize,
// policy drift) only report.

import fs from "node:fs";
import { estimateTokens, listSkills, loadPolicy, tokenize } from "./lib.mjs";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");

const policy = loadPolicy();
const { skills, overrides } = listSkills();
const hot = new Set(policy.hot ?? []);
const duplicates = policy.duplicates ?? {};

const hard = [];
const soft = [];

for (const skill of skills) {
  if (!skill.hadFrontmatter) hard.push(`${skill.id}: no YAML frontmatter`);
  if (!skill.description.trim())
    hard.push(`${skill.id}: empty description (skill is never advertised)`);
  if (!skill.hasName)
    soft.push(`${skill.id}: frontmatter \`name\` is absent (display name falls back to the ID)`);
  if (skill.lines > 500 && hot.has(skill.id)) {
    soft.push(`${skill.id}: ${skill.lines} lines (>500 — move detail into references/)`);
  }
}

// A project copy shadowing the machine-global skill of the same ID is expected:
// `.opencode/skills/` is a locally synced mirror of the global library
// (gitignored and eslint-ignored, so it never ships). Only an *identical* local
// copy is pure vendoring — a copy that has drifted still wins silently, so it
// surfaces as a finding rather than passing as a mirror. Shadowing between any
// other pair of sources is a real ID collision.
const sameText = (a, b) =>
  fs.readFileSync(a, "utf8").replace(/\r\n/g, "\n") ===
  fs.readFileSync(b, "utf8").replace(/\r\n/g, "\n");

let vendored = 0;
let driftedShadows = 0;

for (const override of overrides) {
  const shadow = override.shadowed === "global" && override.wins === "project";
  const identical =
    shadow &&
    override.shadowedFile &&
    override.file &&
    sameText(override.shadowedFile, override.file);
  if (identical) {
    vendored += 1;
    continue;
  }
  if (shadow) {
    driftedShadows += 1;
    soft.push(
      `${override.id}: the project copy differs from the global one it shadows — intentional override, or stale mirror to refresh?`
    );
    continue;
  }
  hard.push(
    `${override.id}: defined in both ${override.shadowed} and ${override.wins} (later source wins)`
  );
}

const nearPairs = [];
const docs = skills.map((skill) => ({
  id: skill.id,
  tokens: new Set(tokenize(skill.description)),
}));
for (let i = 0; i < docs.length; i++) {
  for (let j = i + 1; j < docs.length; j++) {
    if (docs[i].id.split("-")[0] === docs[j].id.split("-")[0]) continue;
    const score = jaccard(docs[i].tokens, docs[j].tokens);
    if (score >= 0.5)
      nearPairs.push({ a: docs[i].id, b: docs[j].id, score: Number(score.toFixed(2)) });
  }
}
nearPairs.sort((a, b) => b.score - a.score);
for (const pair of nearPairs) {
  const known = pair.a in duplicates || pair.b in duplicates;
  if (!known)
    soft.push(
      `near duplicate (${pair.score}): ${pair.a} <-> ${pair.b} — add to policy.duplicates or merge`
    );
}

const installed = new Set(skills.map((skill) => skill.id));
const hotMissing = [...hot].filter((id) => !installed.has(id));
for (const id of hotMissing) soft.push(`hot list names ${id}, which is not installed`);

const unclassified = skills
  .filter((skill) => !hot.has(skill.id) && !(skill.id in duplicates))
  .map((skill) => skill.id);
const duplicateMissing = Object.keys(duplicates).filter((id) => !installed.has(id));
for (const id of duplicateMissing)
  soft.push(`duplicates map names ${id}, which is not installed (stale entry)`);

const advertised = skills.reduce((sum, skill) => sum + skill.description.length, 0);
const hotAdvertised = skills
  .filter((skill) => hot.has(skill.id))
  .reduce((sum, skill) => sum + skill.description.length, 0);

const report = {
  total: skills.length,
  hot: skills.filter((skill) => hot.has(skill.id)).length,
  cold: skills.filter((skill) => !hot.has(skill.id)).length,
  vendored,
  driftedShadows,
  advertisedTokensPerStep: estimateTokens("x".repeat(advertised)),
  hotTokensPerStep: estimateTokens("x".repeat(hotAdvertised)),
  unclassified,
  nearPairs,
  hard,
  soft,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Installed skills : ${report.total} (${report.hot} hot, ${report.cold} cold)`);
  console.log(
    `Advertised cost  : ~${report.advertisedTokensPerStep} tokens/step (all skills; priority set ~${report.hotTokensPerStep})`
  );
  console.log("");
  console.log(`Hard problems: ${hard.length}`);
  for (const line of hard) console.log(`  x ${line}`);
  console.log(`Findings: ${soft.length}`);
  for (const line of soft) console.log(`  - ${line}`);
  if (!hard.length && !soft.length) console.log("  clean");
  console.log("");
  console.log(`Outside the priority set (curate into hot if useful): ${unclassified.length}`);
  if (unclassified.length) {
    const shown = unclassified.slice(0, 30);
    console.log(`  ${shown.join(", ")}${unclassified.length > shown.length ? ", …" : ""}`);
  }
}

if (hard.length) process.exit(1);

/** Jaccard similarity of two token sets. */
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}
