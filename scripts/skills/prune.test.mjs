//   pnpm test:agent
//   node --test scripts/skills/prune.test.mjs
//
// The prune tool moves real directories on a developer's machine, so its
// safety guarantees are worth pinning down: the hot set must survive, a
// failed move must not look like a successful prune, and a restore must put
// back every copy — including one that is a symlink.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { copies, hotPruneOverlap, move, pathExists } from "./prune.mjs";
import { listSkills } from "./lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scratch = path.join(os.tmpdir(), `dj-assistant-prune-test-${process.pid}`);
const installed = new Set(listSkills().skills.map((skill) => skill.id));

after(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

/** A throwaway directory tree. */
function makeTree(name) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * A link to a directory.
 *
 * Windows refuses a directory symlink without elevation, but a junction needs
 * no privilege and behaves the same way here: the link is a thing of its own
 * that can outlive what it points at.
 */
function makeLink(target, link) {
  if (process.platform === "win32") {
    fs.symlinkSync(path.resolve(target), link, "junction");
    return;
  }
  fs.symlinkSync(path.relative(path.dirname(link), target), link, "dir");
}

/** Whether this machine lets a test create a link at all. */
let linkSupport = null;
function canLink() {
  if (linkSupport !== null) return linkSupport;
  const dir = makeTree("link-probe");
  const target = path.join(dir, "target");
  fs.mkdirSync(target);
  try {
    makeLink(target, path.join(dir, "link"));
    linkSupport = true;
  } catch {
    linkSupport = false;
  }
  return linkSupport;
}

describe("the hot set survives the prune", () => {
  it("names the skills that are both a priority and a removal", () => {
    const overlap = hotPruneOverlap(["tauri", "react-best-practices"], ["react", "tauri", "nextjs"]);
    assert.deepEqual(overlap, ["tauri"]);
  });

  it("reports nothing when the two lists do not meet", () => {
    assert.deepEqual(hotPruneOverlap(["tauri"], ["nextjs", "electron"]), []);
    assert.deepEqual(hotPruneOverlap([], ["nextjs"]), []);
  });
});

describe("a path is there even when its target is not", () => {
  it(
    "sees a symlink whose target has gone",
    { skip: canLink() ? false : "this machine does not allow creating links" },
    () => {
      const dir = makeTree("dangling");
      const target = path.join(dir, "target");
      const link = path.join(dir, "link");
      fs.mkdirSync(target);
      makeLink(target, link);
      fs.rmSync(target, { recursive: true, force: true });

      // The link is still in the backup; only what it pointed at is gone.
      assert.equal(fs.existsSync(link), false, "the target no longer resolves");
      assert.equal(pathExists(link), true, "the link itself is still there");
    }
  );

  it("reports a path that was never there", () => {
    assert.equal(pathExists(path.join(scratch, "nope")), false);
  });
});

describe("moving a skill keeps what it is", () => {
  it("moves a directory and leaves nothing behind", () => {
    const dir = makeTree("move-dir");
    const from = path.join(dir, "skill");
    fs.mkdirSync(from);
    fs.writeFileSync(path.join(from, "SKILL.md"), "# skill");

    const to = path.join(dir, "backup", "skill");
    fs.mkdirSync(path.dirname(to), { recursive: true });
    move(from, to);

    assert.equal(fs.existsSync(from), false);
    assert.equal(fs.existsSync(path.join(to, "SKILL.md")), true);
  });

  it(
    "moves a symlink as a link, not as what it points at",
    { skip: canLink() ? false : "this machine does not allow creating links" },
    () => {
      const dir = makeTree("move-link");
      const target = path.join(dir, "target");
      const from = path.join(dir, "skill");
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, "SKILL.md"), "# skill");
      makeLink(target, from);

      const to = path.join(dir, "backup", "skill");
      fs.mkdirSync(path.dirname(to), { recursive: true });
      move(from, to);

      assert.equal(fs.existsSync(from), false);
      assert.equal(fs.lstatSync(to).isSymbolicLink(), true, "the backup holds a link");
      assert.equal(fs.existsSync(path.join(target, "SKILL.md")), true, "the target is untouched");
    }
  );
});

describe("every installed copy is found", () => {
  it(
    "sees the copies that listSkills collapses",
    { skip: installed.size ? false : "no skill library is installed" },
    () => {
      // listSkills() reports one entry per skill id — the project copy shadows
      // the global one — so the shadowed copy is invisible to it. The prune
      // needs it, or the skill keeps being advertised after the prune.
      const physical = copies();
      assert.ok(physical.size > 0, "no skills found at all");

      for (const [id, perSource] of physical) {
        assert.ok(perSource.size >= 1, `${id} has no copy`);
        for (const [source, dir] of perSource) {
          assert.ok(fs.existsSync(path.join(dir, "SKILL.md")), `${id} (${source}) has no SKILL.md`);
        }
      }

      const shadowed = [...physical.values()].filter((perSource) => perSource.size > 1);
      assert.ok(
        shadowed.length > 0,
        "expected at least one skill installed in more than one source"
      );
    }
  );
});

describe("the project tree is where the policy says", () => {
  it("keeps the path policy in step with the scripts that actually route", () => {
    const policy = JSON.parse(fs.readFileSync(path.join(root, "skills.policy.json"), "utf8"));
    const patterns = Object.keys(policy.pathDomains ?? {});
    assert.ok(patterns.includes("scripts/agent/**"), "the agent scripts are not mapped");
    assert.ok(patterns.includes("scripts/skills/**"), "the skill scripts are not mapped");
    assert.ok(patterns.includes("scripts/memory/**"), "the memory scripts are not mapped");
    assert.ok(
      !patterns.includes("scripts/**"),
      "scripts/** still swallows the fixture, model and database scripts"
    );
  });
});
