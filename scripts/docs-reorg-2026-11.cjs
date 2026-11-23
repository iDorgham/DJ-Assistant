#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS, so the DeepSource JS analyzer does not reject imports. */
// One-shot docs reorganisation (2026-11-22): rewrites every reference to a moved
// doc across the repository, then moves the files (git mv for tracked files).
//
//   node scripts/docs-reorg-2026-11.cjs            # dry run: prints the plan
//   node scripts/docs-reorg-2026-11.cjs --apply    # rewrite references + move
//
// Kept in the repo as the record of how old paths map to new ones; the
// RULES table below is the authoritative old -> new path map.
//
// Known quirks of the 2026-11-22 run, both corrected by hand afterwards:
// - rewriteRootPaths stops at a space, so a reference to `docs/ui/library (1).png`
//   missed its exact-match rule and the `docs/ui/` directory rule rewrote it to
//   the wrong path `docs/ui-ux/library (1).png` (those PNGs were untracked and
//   were moved and renamed by hand);
// - root-level Markdown links were rewritten twice (rewriteLinks, then
//   rewriteRootPaths), sending docs/ui-ux/... to the archive; AGENTS.md,
//   CLAUDE.md and README.md were fixed afterwards.
// The --apply guard below stops a second run on the new layout.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const APPLY = process.argv.includes("--apply");

// One-shot: the RULES describe the pre-2026-11-22 layout. Once docs/ui/ is gone
// the move has happened, and applying again would re-move the new folders.
if (APPLY && !fs.existsSync(path.join(ROOT, "docs", "ui"))) {
  process.stderr.write("docs/ui/ no longer exists: the reorganisation was already applied.\n");
  process.exit(1);
}

// Ordered: the first matching rule wins. Keys ending in "/" are directory prefixes.
const RULES = [
  // UI: the old Phase 0 set goes to the archive first, then docs/ui becomes docs/ui-ux.
  ["docs/ui-ux/archive/", "docs/ui-ux/archive/"],
  ["docs/ui-ux/", "docs/ui-ux/archive/phase0/"],
  ["docs/ui/13-REMEDIATION-STATUS.md", "docs/audits/2026-10-19-ui-remediation-status.md"],
  ["docs/ui/library.png", "docs/ui-ux/reference/icons/library-books-filled.png"],
  ["docs/ui/library (1).png", "docs/ui-ux/reference/icons/library-stack-note-filled.png"],
  ["docs/ui/music-library.png", "docs/ui-ux/reference/icons/music-library-outline.png"],
  ["docs/ui/music-and-multimedia.png", "docs/ui-ux/reference/icons/playlist-play-lines-filled.png"],
  ["docs/ui/playlist.png", "docs/ui-ux/reference/icons/playlist-play-stack-filled.png"],
  ["docs/ui/", "docs/ui-ux/"],
  ["docs/UI_UX_PLAYER_AND_LAYOUT_SPEC.md", "docs/ui-ux/reference/APP_VIEWS_PLAYER_LAYOUT_SPEC_v1.9.md"],
  ["docs/plan/05-design-system/", "docs/ui-ux/guidelines/"],

  // Approved v1 plan: product -> product/, experience -> specs/, delivery -> plans/v1/.
  ["docs/plan/01-product/", "docs/product/"],
  ["docs/plan/02-experience/", "docs/specs/experience/"],
  ["docs/plan/03-player/", "docs/specs/player/"],
  ["docs/plan/04-data-and-sync/", "docs/specs/data-and-sync/"],
  ["docs/plan/06-delivery/", "docs/plans/v1/"],
  ["docs/plan/07-diagrams/mermaid-flows.md", "docs/diagrams/18-v1-plan-mermaid-flows.md"],
  ["docs/plan/api-access-guide.md", "docs/specs/integrations/api-access-guide.md"],
  ["docs/plan/README.md", "docs/plans/v1/README.md"],
  ["docs/plan/", "docs/plans/v1/"],

  // Plans and tasks.
  ["docs/PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md", "docs/plans/phase2-library-player.md"],
  ["docs/engineering/SLICE3A_PLAN.md", "docs/plans/archive/slice-3a-tags-comments.md"],
  ["docs/engineering/DEVELOPMENT_TASK_LIST.md", "docs/tasks/archive/DEVELOPMENT_TASK_LIST.md"],

  // QA: checklists, evidence, screenshot approvals.
  ["docs/engineering/STAGE1_MANUAL_QA_CHECKLIST.md", "docs/qa/checklists/STAGE1_MANUAL_QA_CHECKLIST.md"],
  ["docs/engineering/SLICE2_MANUAL_QA_CHECKLIST.md", "docs/qa/checklists/SLICE2_MANUAL_QA_CHECKLIST.md"],
  ["docs/engineering/SLICE3A_MANUAL_QA_CHECKLIST.md", "docs/qa/checklists/SLICE3A_MANUAL_QA_CHECKLIST.md"],
  ["docs/engineering/PHASE0_ACCEPTANCE_EVIDENCE.md", "docs/qa/evidence/phase0/PHASE0_ACCEPTANCE_EVIDENCE.md"],
  ["docs/evidence/", "docs/qa/evidence/"],
  ["docs/approvals/", "docs/qa/approvals/"],

  // Audits, specs, ADRs, context, AI tooling.
  ["docs/audit/", "docs/audits/2026-10-14-spec-audit/"],
  ["capmap_phase0.md", "docs/audits/2026-11-08-phase0-capability-map.md"],
  ["docs/superpowers/specs/", "docs/specs/features/"],
  ["docs/context/", "docs/product/"],
  ["docs/ADR/", "docs/adr/"],
  ["docs/enhancements/", "docs/ai/mcp/"],
];

const mapPath = (rel) => {
  for (const [from, to] of RULES) {
    if (from.endsWith("/")) {
      if (rel === from.slice(0, -1)) return to.slice(0, -1);
      if (rel.startsWith(from)) return to + rel.slice(from.length);
    } else if (rel === from) return to;
  }
  return null;
};

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });
const tracked = new Set(git("ls-files", "-z").split("\0").filter(Boolean));
const untracked = git("ls-files", "-z", "--others", "--exclude-standard").split("\0").filter(Boolean);

// Files that move.
const candidates = [...tracked, ...untracked].filter((f) => f.startsWith("docs/") || f === "capmap_phase0.md");
const moves = new Map();
for (const f of candidates) {
  const to = mapPath(f);
  if (to && to !== f) moves.set(f, to);
}
const targets = new Set();
for (const to of moves.values()) {
  if (targets.has(to)) throw new Error(`two files map to ${to}`);
  targets.add(to);
}

// Files whose references get rewritten.
const SKIP_DIR = /(^|\/)(node_modules|target|dist|\.git|skills|\.impeccable)(\/|$)/;
const TEXT = /\.(md|mdx|json|jsonc|ts|tsx|js|mjs|cjs|rs|py|sh|ps1|ya?ml|toml|txt|html|css)$/i;
const SELF = "scripts/docs-reorg-2026-11.cjs";
const local = ["AGENTS.local.md", "CLAUDE.local.md"].filter((f) => fs.existsSync(path.join(ROOT, f)));
const scan = [...new Set([...tracked, ...untracked, ...local])].filter(
  (f) => TEXT.test(f) && !SKIP_DIR.test(f) && f !== SELF && !/CHANGELOG|lock/i.test(path.basename(f)) &&
    fs.existsSync(path.join(ROOT, f))
);

const posix = (p) => p.split(path.sep).join("/");
const out = (line) => process.stdout.write(`${line}\n`);
function safeDecode(p) {
  try {
    return decodeURI(p);
  } catch {
    return p;
  }
}
const exists = (rel) => tracked.has(rel) || untracked.includes(rel) || fs.existsSync(path.join(ROOT, rel));

// 1) Relative markdown links: ](target) resolved against the file's OLD folder.
function rewriteLinks(file, text) {
  const newFile = moves.get(file) ?? file;
  const oldDir = path.posix.dirname(file);
  const newDir = path.posix.dirname(newFile);
  return text.replace(/\]\(\s*(<?)([^)\s>]+)(>?)((?:\s+"[^"]*")?)\s*\)/g, (m, lt, target, gt, title) => {
    if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) return m;
    const cut = target.indexOf("#");
    const rawPath = cut === -1 ? target : target.slice(0, cut);
    const hash = cut === -1 ? "" : target.slice(cut);
    if (!rawPath) return m;
    const decoded = safeDecode(rawPath);
    const oldAbs = path.posix.normalize(path.posix.join(oldDir, decoded));
    if (oldAbs.startsWith("..")) return m;
    const trailing = decoded.endsWith("/") ? "/" : "";
    const key = oldAbs.replace(/\/$/, "");
    if (!exists(key)) return m; // leave already-broken links for the link check to report
    const newAbs = moves.get(key) ?? mapPath(key) ?? key;
    if (newAbs === key && newDir === oldDir) return m;
    const rel = (path.posix.relative(newDir, newAbs) || ".") + trailing;
    const enc = rel.includes(" ") ? rel.replace(/ /g, "%20") : rel;
    return `](${lt}${enc}${hash}${gt}${title})`;
  });
}

// 2) Repo-root path strings such as `docs/ui/01-DESIGN-SYSTEM.md` or `docs/plan/`.
function rewriteRootPaths(text) {
  return text.replace(/(?<![\w./-])(docs\/[A-Za-z0-9_\-./()*]*[A-Za-z0-9_\-/*]|docs\/|capmap_phase0\.md)/g, (tok) => {
    for (const [from, to] of RULES) {
      if (from.endsWith("/")) {
        if (tok === from.slice(0, -1)) return to.slice(0, -1);
        if (tok.startsWith(from)) return to + tok.slice(from.length);
      } else if (tok === from || (tok.startsWith(from) && !/[\w-]/.test(tok[from.length]))) {
        return to + tok.slice(from.length);
      }
    }
    return tok;
  });
}

let changed = 0;
for (const f of scan) {
  const abs = path.join(ROOT, f);
  const before = fs.readFileSync(abs, "utf8");
  let after = /\.mdx?$/i.test(f) ? rewriteLinks(f, before) : before;
  after = rewriteRootPaths(after);
  if (after !== before) {
    changed++;
    if (APPLY) fs.writeFileSync(abs, after);
    else out(`rewrite ${f}`);
  }
}

// docs/ui-ux must be emptied before docs/ui can take its name, and a case-only
// rename (ADR -> adr) needs a temporary name on a case-insensitive filesystem.
const order = [...moves].sort(([a], [b]) => Number(!a.startsWith("docs/ui-ux/")) - Number(!b.startsWith("docs/ui-ux/")));
const tmp = (p) => p.replace(/^docs\/ui-ux\//, "docs/_ui-ux-old/").replace(/^docs\/ADR\//, "docs/_adr-tmp/");
for (const [from, to] of order) {
  if (!APPLY) { out(`move ${from} -> ${to}`); continue; }
  const via = tmp(from);
  const step = (a, b) => {
    fs.mkdirSync(path.dirname(path.join(ROOT, b)), { recursive: true });
    if (tracked.has(from)) git("mv", a, b);
    else fs.renameSync(path.join(ROOT, a), path.join(ROOT, b));
  };
  if (via !== from) step(from, via);
}
for (const [from, to] of order) {
  if (!APPLY) continue;
  const src = tmp(from);
  fs.mkdirSync(path.dirname(path.join(ROOT, to)), { recursive: true });
  if (tracked.has(from)) git("mv", src, to);
  else fs.renameSync(path.join(ROOT, src), path.join(ROOT, to));
}
if (APPLY) {
  for (const d of ["docs/_ui-ux-old", "docs/_adr-tmp", "docs/ui", "docs/plan", "docs/audit", "docs/context", "docs/evidence", "docs/approvals", "docs/enhancements", "docs/superpowers"]) {
    removeEmptyDirs(path.join(ROOT, d));
  }
}
// Removes a folder tree only where it holds no files; anything left is reported.
function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) removeEmptyDirs(path.join(dir, e.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  else out(`left in place (not empty): ${posix(path.relative(ROOT, dir))}`);
}
out(`${APPLY ? "applied" : "dry run"}: ${moves.size} moves, ${changed} files with rewritten references`);
