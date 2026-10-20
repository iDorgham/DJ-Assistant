// Tests for the agent-layer tooling.
//
//   node --test scripts/agent/
//
// The suite is deliberately machine-independent: the skill-library assertions
// are skipped when the machine-global skills are not installed, so the tests
// pass on a fresh clone as well as on the workstation that installed them.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listSkills, tokenize } from "../skills/lib.mjs";
import { readLayer, searchMemory } from "../memory/lib.mjs";
import {
  buildBrief,
  globToRegExp,
  keywordHit,
  matchPath,
  parsePorcelain,
  scoreAgents,
  selectVerification,
} from "./lib.mjs";
import { loadRegistry } from "./lib.mjs";

const registry = loadRegistry();
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
      '?? "a path with spaces.md"',
      "",
    ].join("\n");
    assert.deepEqual(parsePorcelain(output), [
      "README.md",
      "crates/core/src/lib.rs",
      "scripts/agent/preflight.mjs",
      "a path with spaces.md",
    ]);
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

  it(
    "matches the curated trigger for a spectrum prompt",
    { skip: !installed.has("ffmpeg-waveforms-visualization") },
    () => {
      const brief = buildBrief({ prompt: "add a spectrum analyser to the waveform view" });
      assert.ok(brief.skills.some((skill) => skill.id === "ffmpeg-waveforms-visualization"));
    }
  );
});
