import { test } from "node:test";
import assert from "node:assert/strict";

import { ReadGate, tabsToRefreshAfterWrite } from "./read-gate.ts";

/** A read whose result arrives when the test says so. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** Mirrors useTabRead.run: publish only while the token is current. */
async function read(gate: ReadGate, join: boolean, fetch: Promise<string>, shown: string[]) {
  const token = gate.begin(join);
  if (token === null) return;
  try {
    const value = await fetch;
    if (gate.isCurrent(token)) shown.push(value);
  } finally {
    gate.settle(token);
  }
}

test("a tab switch during a write: the fresh score loads and the old one cannot replace it", async () => {
  const health = new ReadGate();
  const shown: string[] = [];

  // The user starts a duplicate write, then switches to Health: Health starts
  // a scan that will see the library as it was before the write.
  const beforeWrite = deferred<string>();
  const first = read(health, false, beforeWrite.promise, shown);

  // The write finishes: afterWrite orphans the pending read and restarts the
  // open tab.
  health.invalidate();
  assert.deepEqual(tabsToRefreshAfterWrite("health"), ["duplicates", "health"]);
  const afterWrite = deferred<string>();
  const second = read(health, false, afterWrite.promise, shown);

  // The fresh scan lands first, then the old one arrives late.
  afterWrite.resolve("score after write");
  await second;
  beforeWrite.resolve("score before write");
  await first;

  assert.deepEqual(shown, ["score after write"]);
});

test("joining a pending read does not start a second one", async () => {
  const gate = new ReadGate();
  const shown: string[] = [];
  const scan = deferred<string>();
  const first = read(gate, true, scan.promise, shown);
  assert.equal(gate.begin(true), null, "a tab switch mid-scan joins the scan");
  scan.resolve("one scan");
  await first;
  assert.deepEqual(shown, ["one scan"]);
  // Once it settled, the next activation starts a new read.
  assert.notEqual(gate.begin(true), null);
});

test("an orphaned read settling late does not clear the newer read's pending state", async () => {
  const gate = new ReadGate();
  const old = gate.begin(false);
  gate.invalidate();
  const fresh = gate.begin(false);
  assert.ok(old !== null && fresh !== null);
  gate.settle(old);
  assert.equal(gate.begin(true), null, "the fresh read is still pending");
});

test("a write on the Duplicates tab refreshes only Duplicates", () => {
  assert.deepEqual(tabsToRefreshAfterWrite("duplicates"), ["duplicates"]);
  assert.deepEqual(tabsToRefreshAfterWrite("versions"), ["duplicates", "versions"]);
});
