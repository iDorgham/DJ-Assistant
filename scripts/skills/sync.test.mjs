//   pnpm test:agent
//   node --test scripts/skills/sync.test.mjs
//
// The mirror is what a second AI tool reads, so the two properties that matter
// are that it reflects the source after a change and that refreshing it cannot
// quietly destroy anything: an unchanged copy must stay a no-op, and a target
// entry that is not in the requested set must survive untouched.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { apply, plan } from "./sync.mjs";

const scratch = path.join(os.tmpdir(), `dj-assistant-skills-sync-test-${process.pid}`);
const source = path.join(scratch, "source");
const target = path.join(scratch, "target");

after(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

/** A `SKILL.md` directory, with any extra files written verbatim. */
function makeSkill(dir, name, files) {
  const skill = path.join(dir, name);
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(skill, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
  }
  return skill;
}

/** The relative paths a tree holds, sorted, so trees can be compared by shape. */
function listing(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .map((name) => String(name).split(path.sep).join("/"))
    .sort();
}

describe("skills:sync plan", () => {
  it("reports create for a skill the mirror does not have yet", () => {
    makeSkill(source, "alpha", { "SKILL.md": "---\nname: alpha\n---\nbody\n" });
    const result = plan(["alpha"], source, target);
    assert.deepEqual(result, [{ name: "alpha", action: "create" }]);
    assert.equal(fs.existsSync(path.join(target, "alpha")), false, "a dry run writes nothing");
  });

  it("reports unchanged once the bytes match, update when they drift apart", () => {
    makeSkill(source, "beta", { "SKILL.md": "one\n" });
    apply(["beta"], source, target);
    assert.deepEqual(plan(["beta"], source, target), [{ name: "beta", action: "unchanged" }]);

    makeSkill(source, "beta", { "SKILL.md": "two\n", "assets/extra.css": "x\n" });
    assert.deepEqual(plan(["beta"], source, target), [{ name: "beta", action: "update" }]);

    apply(["beta"], source, target);
    assert.deepEqual(plan(["beta"], source, target), [{ name: "beta", action: "unchanged" }]);
    assert.deepEqual(listing(path.join(target, "beta")), [
      "SKILL.md",
      "assets",
      "assets/extra.css",
    ]);
  });

  it("reports missing when the source does not hold the skill", () => {
    assert.deepEqual(plan(["ghost"], source, target), [{ name: "ghost", action: "missing" }]);
  });

  it("leaves a mirror entry outside the requested set alone", () => {
    makeSkill(source, "gamma", { "SKILL.md": "gamma\n" });
    makeSkill(target, "kept", { "SKILL.md": "not in the set\n" });
    apply(["gamma"], source, target);

    assert.equal(
      fs.readFileSync(path.join(target, "kept", "SKILL.md"), "utf8"),
      "not in the set\n"
    );
    assert.deepEqual(plan(["gamma"], source, target), [{ name: "gamma", action: "unchanged" }]);
  });

  it("replaces a stale file that the source has since removed", () => {
    makeSkill(source, "delta", { "SKILL.md": "delta\n", "old.md": "going away\n" });
    apply(["delta"], source, target);
    fs.rmSync(path.join(source, "delta", "old.md"));
    apply(["delta"], source, target);

    assert.deepEqual(listing(path.join(target, "delta")), ["SKILL.md"]);
  });

  it("reports the same shape whether it is planning or writing", () => {
    makeSkill(source, "epsilon", { "SKILL.md": "epsilon\n" });
    apply(["epsilon"], source, target);
    const again = apply(["epsilon", "ghost"], source, target);
    assert.deepEqual(again, [
      { name: "epsilon", action: "unchanged" },
      { name: "ghost", action: "missing" },
    ]);
  });
});
