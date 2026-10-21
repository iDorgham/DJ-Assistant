// Tests for the agent-layer tooling.
//
//   pnpm test:agent
//   node --test scripts/agent/preflight.test.mjs
//
// The file is named rather than globbed: a directory argument is treated as a
// module path and a quoted glob needs Node 21+, while the project documents
// Node 20 as the floor.
//
// The suite is deliberately machine-independent: the skill-library assertions
// are skipped when the machine-global skills are not installed, so the tests
// pass on a fresh clone as well as on the workstation that installed them.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { listSkills, loadPolicy, resolveDomains, tokenize } from "../skills/lib.mjs";
import { readLayer, searchMemory, stripMarkup } from "../memory/lib.mjs";
import {
  buildBrief,
  globToRegExp,
  keywordHit,
  matchPath,
  parsePorcelain,
  renderBrief,
  scoreAgents,
  scoreCommands,
  selectVerification,
} from "./lib.mjs";
import { loadRegistry } from "./lib.mjs";

const registry = loadRegistry();
const policy = loadPolicy();
const installed = new Set(listSkills().skills.map((skill) => skill.id));

describe("path matching", () => {
  it("matches a directory tree", () => {
    assert.equal(matchPath("apps/desktop/src-tauri/**", "apps/desktop/src-tauri/src/lib.rs"), true);
    assert.equal(matchPath("apps/desktop/src-tauri/**", "apps/desktop/src/main.tsx"), false);
  });

  it("matches any depth for a leading globstar", () => {
    assert.equal(matchPath("**/*.rs", "crates/core/src/lib.rs"), true);
    assert.equal(matchPath("**/*.rs", "lib.rs"), true);
    assert.equal(matchPath("**/*.rs", "crates/core/src/lib.ts"), false);
  });

  it("keeps a single star inside one segment", () => {
    assert.equal(matchPath("*.md", "AGENTS.md"), true);
    assert.equal(matchPath("*.md", "docs/ai/AGENTS.md"), false);
  });

  it("keeps a single star inside one segment with a prefix", () => {
    assert.equal(matchPath("apps/desktop/src/**/*.tsx", "apps/desktop/src/App.tsx"), true);
    assert.equal(matchPath("apps/desktop/src/**/*.tsx", "apps/desktop/src/ui/Button.tsx"), true);
    assert.equal(matchPath("apps/desktop/src/**/*.tsx", "apps/api/src/main.tsx"), false);
  });

  it("escapes regex characters in the pattern", () => {
    assert.equal(globToRegExp("a.b").test("a.b"), true);
    assert.equal(globToRegExp("a.b").test("axb"), false);
  });
});

describe("git porcelain parsing", () => {
  it("reads modified, added, and untracked paths", () => {
    const output = [
      " M README.md",
      "A  crates/core/src/lib.rs",
      "?? scripts/agent/preflight.mjs",
      "?? a path with spaces.md",
      "",
    ].join("\0");
    assert.deepEqual(parsePorcelain(output), [
      "README.md",
      "crates/core/src/lib.rs",
      "scripts/agent/preflight.mjs",
      "a path with spaces.md",
    ]);
  });

  it("keeps a non-ASCII path intact", () => {
    // `-z` leaves path bytes unquoted, which is what keeps this readable; the
    // quoted form would arrive as caf\303\251.md and lose its backslashes.
    assert.deepEqual(parsePorcelain("?? café.md\0"), ["café.md"]);
  });

  it("takes the destination of a rename and drops the origin", () => {
    assert.deepEqual(parsePorcelain("R  newname.md\0oldname.md\0"), ["newname.md"]);
  });

  it("consumes the origin field whichever status column carries the rename", () => {
    // `XY path`: the letters are columns 0 and 1, so a rename reported in the
    // worktree column reads "MR" rather than "R ".
    assert.deepEqual(parsePorcelain("MR newname.md\0oldname.md\0"), ["newname.md"]);
    // A deleted source plus an untracked destination is what an unstaged move
    // actually looks like, and neither record carries a second field.
    assert.deepEqual(parsePorcelain(" D old.md\0?? new.md\0"), ["old.md", "new.md"]);
  });
});

describe("keyword matching", () => {
  const hit = (query, keyword) => keywordHit(new Set(tokenize(query)), ` ${query} `, keyword);

  it("matches an exact token", () => {
    assert.equal(hit("add a waveform", "waveform"), true);
  });

  it("matches a phrase", () => {
    assert.equal(hit("the beat grid writer", "beat grid"), true);
    assert.equal(hit("the beatgrid writer", "beat grid"), false);
  });

  it("matches across a shared prefix of five characters", () => {
    assert.equal(hit("the waveforms", "waveform"), true);
    assert.equal(hit("the skills", "skill"), true);
  });

  it("does not match a short word inside a longer one", () => {
    assert.equal(hit("the settings panel", "set"), false);
  });
});

describe("agent routing", () => {
  it("routes a Tauri task to the Tauri specialist", () => {
    const [top] = scoreAgents(registry, { prompt: "add a tauri command and ipc handler" });
    assert.equal(top.id, "tauri-expert");
  });

  it("routes an audio task to the audio specialist", () => {
    const [top] = scoreAgents(registry, { prompt: "improve the beatgrid and waveform rendering" });
    assert.equal(top.id, "audio-dj-expert");
  });

  it("routes by the files in play, even for a vague prompt", () => {
    const [top] = scoreAgents(registry, {
      prompt: "fix this",
      files: ["apps/desktop/src-tauri/src/lib.rs"],
    });
    assert.equal(top.id, "tauri-expert");
    assert.deepEqual(top.ownedFiles, ["apps/desktop/src-tauri/src/lib.rs"]);
  });

  it("recommends nobody for a task outside the registry", () => {
    const matches = scoreAgents(registry, { prompt: "write a poem about the sea" });
    assert.equal(matches.length, 0);
  });
});

describe("verification selection", () => {
  it("picks the Rust checks for Rust files", () => {
    const groups = selectVerification(registry, {
      prompt: "change the parser",
      files: ["crates/core/src/lib.rs"],
    });
    assert.ok(groups.some((group) => group.id === "rust"));
  });

  it("picks the UI note for a component change", () => {
    const groups = selectVerification(registry, {
      prompt: "restyle the player",
      files: ["apps/desktop/src/components/Player.tsx"],
    });
    assert.ok(groups.some((group) => group.id === "ui"));
  });

  it("does not select a check for a word that merely contains the keyword", () => {
    // "trust" contains rust and "guide" contains ui; substring matching used to
    // hand those prompts builds and tests the change does not need.
    const ids = (prompt) =>
      selectVerification(registry, { prompt, files: [] }).map((group) => group.id);
    assert.ok(!ids("document the trust boundary").includes("rust"));
    assert.ok(!ids("update the user guide").includes("ui"));
  });

  it("keeps a two-letter keyword whole-word matchable", () => {
    // tokenize() drops short words, so `ui` never reaches the token set — the
    // group has to be selected from the padded prompt or it silently vanishes.
    const ids = (prompt) =>
      selectVerification(registry, { prompt, files: [] }).map((group) => group.id);
    assert.ok(ids("fix the ui").includes("ui"), "fix the ui selected nothing");
    assert.ok(ids("polish the waveform ui").includes("ui"), "trailing ui was lost");
  });
});

describe("command matching", () => {
  it("reaches a hyphenated command from prose that separates its words", () => {
    const matched = scoreCommands(registry, "audit the installed skills").map((entry) => entry.id);
    assert.ok(matched.includes("skills-audit"), matched.join(", "));
  });
});

describe("memory reader", () => {
  it("skips the file intro paragraph", () => {
    const facts = readLayer("facts");
    assert.ok(facts.length > 0);
    assert.equal(
      facts.some((entry) => entry.text.startsWith("Permanent, verifiable facts")),
      false
    );
  });

  it("does not return the intro for a generic query", () => {
    const results = searchMemory("add a line to the facts file", 5);
    assert.equal(
      results.some((entry) => entry.text.startsWith("Permanent, verifiable facts")),
      false
    );
  });

  it("keeps one ledger entry as one result", () => {
    for (const layer of ["decisions", "feedback"]) {
      const sections = readLayer(layer).map((entry) => entry.section);
      assert.equal(new Set(sections).size, sections.length, `${layer} split an entry`);
    }
  });

  it("matches a ledger ID without crossing the layer", () => {
    const results = searchMemory("F-001", 5);
    assert.ok(results.length, "the ID query returned nothing");
    assert.ok(
      results.every((entry) => entry.layer === "feedback" && entry.section.startsWith("F-001")),
      results.map((entry) => `${entry.layer}#${entry.section}`).join(", ")
    );
  });

  it("keeps underscores inside inline code", () => {
    assert.equal(
      stripMarkup("regenerate `SKILL_ROUTING.md` and **facts.md**"),
      "regenerate SKILL_ROUTING.md and facts.md"
    );
  });
});

describe("the brief", () => {
  it("returns the four sections an agent needs", () => {
    const brief = buildBrief({
      prompt: "add a spectrum analyser to the waveform view",
      files: [],
      top: 3,
      memoryLimit: 4,
    });
    assert.equal(typeof brief.prompt, "string");
    assert.ok(Array.isArray(brief.skills));
    assert.ok(Array.isArray(brief.memory));
    assert.ok(Array.isArray(brief.agents));
    assert.ok(Array.isArray(brief.verify));
    assert.ok(brief.handoff.includes("RESULT"));
  });
  it("names the agent that should own the work", () => {
    const brief = buildBrief({ prompt: "fix the beatgrid writer in crates/analysis", files: [] });
    assert.ok(brief.agents.some((agent) => agent.id === "audio-dj-expert"));
  });

  it("implies the checks of the agent it routes to", () => {
    const brief = buildBrief({ prompt: "add a tauri ipc command", files: [] });
    assert.ok(brief.agents.some((agent) => agent.id === "tauri-expert"));
    assert.ok(brief.verify.some((group) => group.id === "rust"));
  });

  it("prints a selected memory line in full", () => {
    const brief = buildBrief({
      prompt: "why are hidden skills not loadable, metadata.opencode/autoinvoke false",
      files: [],
      memoryLimit: 2,
    });
    const long = brief.memory.find((entry) => entry.text.length > 120);
    assert.ok(long, "no long memory entry was selected");
    assert.ok(renderBrief(brief).includes(long.text), "the brief cut the entry short");
  });

  it(
    "matches the curated trigger for a spectrum prompt",
    { skip: !installed.has("ffmpeg-waveforms-visualization") },
    () => {
      const brief = buildBrief({ prompt: "add a spectrum analyser to the waveform view" });
      assert.ok(brief.skills.some((skill) => skill.id === "ffmpeg-waveforms-visualization"));
    }
  );
});

describe("domain routing", () => {
  it("resolves a domain from the prompt vocabulary", () => {
    const resolved = resolveDomains({
      prompt: "add a spectrum analyser to the waveform view",
      files: [],
      domains: policy.domains,
      pathDomains: policy.pathDomains,
    });
    assert.ok(resolved.domains.has("audio"), [...resolved.domains].join(", "));
  });

  it("resolves a domain from the files in play", () => {
    const resolved = resolveDomains({
      prompt: "fix this",
      files: ["crates/core/src/library_query.rs"],
      domains: policy.domains,
      pathDomains: policy.pathDomains,
    });
    assert.ok(resolved.domains.has("rust"), [...resolved.domains].join(", "));
  });

  it("resolves a domain from the routed subagent", () => {
    const brief = buildBrief({ prompt: "add a tauri ipc command", files: [] });
    assert.ok(brief.agents.some((agent) => agent.id === "tauri-expert"));
    assert.ok(brief.domains.includes("tauri"), brief.domains.join(", "));
  });

  it("does not offer a skill from an unrelated domain", () => {
    // "memory" and "speed" used to select memory-safety-patterns and
    // performance-and-perceived-speed on a task about the agent layer.
    const brief = buildBrief({
      prompt: "understand the agent routing and the shared memory, make it fast",
      files: [],
    });
    const offered = brief.skills.map((skill) => skill.id);
    assert.ok(!offered.includes("memory-safety-patterns"), offered.join(", "));
    assert.ok(!offered.includes("performance-and-perceived-speed"), offered.join(", "));
    assert.ok(!offered.includes("upstash-redis-js"), offered.join(", "));
  });

  it("keeps a curated trigger even when the skill sits in another group", () => {
    const brief = buildBrief({ prompt: "add a spectrum analyser to the waveform view" });
    assert.ok(brief.skills.some((skill) => skill.id === "ffmpeg-waveforms-visualization"));
  });

  it("offers the domain default when the prompt carries no signal", () => {
    // "fix this" gives the matcher nothing to score; the files say Rust.
    const brief = buildBrief({
      prompt: "fix this",
      files: ["crates/core/src/library_query.rs"],
    });
    assert.ok(
      brief.skills.some((skill) => skill.via === "domain"),
      brief.skills.map((skill) => skill.id).join(", ")
    );
  });

  it("does not dilute a real match with the domain defaults", () => {
    const brief = buildBrief({ prompt: "add a tauri ipc command", files: [] });
    assert.equal(brief.skills[0].via, "trigger");
  });

  it("lets the strongest prompt domain win", () => {
    // "library" is an audio keyword and "table"/"prettier" are interface ones.
    // The area the task is *about* must not lose to the word that happens to
    // be in the most skill names.
    const brief = buildBrief({ prompt: "make the library table prettier", files: [] });
    assert.ok(brief.domains.includes("ui"), brief.domains.join(", "));
    assert.ok(!brief.domains.includes("audio"), brief.domains.join(", "));
  });

  it("keeps every domain on a tie", () => {
    const brief = buildBrief({ prompt: "add a tauri ipc command to the waveform view" });
    assert.ok(brief.domains.includes("tauri"), brief.domains.join(", "));
    assert.ok(brief.domains.includes("audio"), brief.domains.join(", "));
  });

  it("does not treat the word library as an audio signal", () => {
    // "library" names the whole app, so it is not an audio keyword — it would
    // pull every library task into the music domain.
    const brief = buildBrief({ prompt: "write a rust unit test for the library query builder" });
    assert.ok(!brief.domains.includes("audio"), brief.domains.join(", "));
  });

  it("routes a vague prompt by the files in play", () => {
    const brief = buildBrief({ prompt: "fix this", files: ["crates/core/src/library_query.rs"] });
    assert.ok(brief.domains.includes("rust"), brief.domains.join(", "));
  });
});

describe("preflight CLI", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const script = path.join(root, "scripts", "agent", "preflight.mjs");

  const run = (args, input) =>
    execFileSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
      input,
    });

  it("takes the task from stdin, apostrophes and all", () => {
    const task = "fix the deck's gain fader, cost $100";
    const brief = JSON.parse(
      run(["--json", "--stdin", "--top", "0", "--memory-limit", "0"], task + "\n")
    );
    assert.equal(brief.prompt, task);
  });

  it("rejects an empty stdin instead of routing an empty prompt", () => {
    assert.throws(
      () => run(["--stdin"], ""),
      (error) => error.status === 2,
      "empty input should fail with the usage exit code"
    );
  });
});
