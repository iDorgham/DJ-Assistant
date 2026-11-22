/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS, so the DeepSource JS analyzer does not reject imports. */
// Drives the desktop app over DevTools for the 2026-11-22 fixture QA run.
// Usage: node scripts/qa/fixture-run/run-checks.cjs <step> [baseline.json]
// Steps, in the order the evidence records them:
//   library      headers, load-all, search, empty state and clear
//   open-ts      select four seeded tracks and open the Tag Surgeon scan
//   apply        open the confirmation step (read only)
//   confirm      confirm the apply
//   undo         undo the apply
//   mix-open     open the mix dock for one track and read it
//   mix-actions  preview, add and close in the mix dock
//   readback     read the fixture database and compare it with the baseline
// The app steps need Node 22+, the app running with DJ_ASSISTANT_DB_PATH
// pointing at a copy of the fixture, and
// WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222.
// A step stops with an error when an action does not succeed, so a missing
// control cannot produce a passing record.
const { readFileSync } = require("node:fs");
const { connect } = require("./cdp.cjs");
const { expr, setInput, clickByText, rightClickTitle, clickRow, loadAll } = require("./lib.cjs");

const out = (value) => process.stdout.write(`${value}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Results from page helpers that count as success. Anything else is a failure.
const SUCCESS = /^(ok|clicked|ctx:|loaded:|closed prior|none open)/;

/** Runs a page helper, fails the step unless it reports success, and prints the value. */
async function act(client, fn, args, label) {
  const value = await client.evaluate(expr(fn, ...args));
  if (typeof value !== "string" || !SUCCESS.test(value)) {
    throw new Error(`${label} did not succeed: ${value}`);
  }
  out(`${label}: ${value}`);
  return value;
}

/** Runs a page reader and prints the value without a success check. */
async function read(client, fn, args, label) {
  const value = await client.evaluate(expr(fn, ...args));
  out(`${label}: ${value}`);
  return value;
}

function closeOpenDialog() {
  const button = [...globalThis.document.querySelectorAll("[role=dialog] button")].find(
    (item) => item.textContent.trim() === "Close"
  );
  if (button) {
    button.click();
    return "closed prior";
  }
  return "none open";
}

function readDialog(limit) {
  const dialog = globalThis.document.querySelector("[role=dialog]");
  return JSON.stringify({
    dialog: dialog?.innerText?.slice(0, limit),
    buttons: [...globalThis.document.querySelectorAll("[role=dialog] button")]
      .map((item) => item.textContent.trim())
      .filter(Boolean),
  });
}

function readPlayLabels() {
  return JSON.stringify(
    [...globalThis.document.querySelectorAll('[aria-label^="Play "]')].map((element) =>
      element.getAttribute("aria-label")
    )
  );
}

function readHeaders() {
  const names = ["Title", "Artist", "BPM", "Key", "Energy", "Rating", "Time"];
  const headers = [...globalThis.document.querySelectorAll("th,[role=columnheader]")].map((node) =>
    node.textContent.trim()
  );
  return JSON.stringify(names.map((name) => headers.includes(name)));
}

function readLoadedCount() {
  const match = globalThis.document.body.innerText.match(/Library loaded: [0-9]+ tracks/);
  return match ? match[0] : "none";
}

function readNoMatch() {
  return globalThis.document.body.innerText.includes("No tracks match");
}

function readSelectedCount() {
  const match = globalThis.document.body.innerText.match(/([0-9]+) selected/);
  return match ? match[0] : "no-selected-text";
}

function readPlayerTitles() {
  const titles = globalThis.document.body.innerText.match(/Synthetic Track 00[0-9]+/g) || [];
  return JSON.stringify([...new Set(titles)].slice(0, 4));
}

function readDock() {
  const dock = globalThis.document.querySelector('[aria-label="Mix suggestions"]');
  return JSON.stringify({
    open: Boolean(dock),
    text: dock ? dock.innerText.slice(0, 700) : null,
    buttons: dock
      ? [...dock.querySelectorAll("button")]
          .map((item) => item.getAttribute("aria-label") || item.textContent.trim())
          .slice(0, 24)
      : [],
  });
}

function readMixButtonState() {
  const buttons = [
    ...globalThis.document.querySelectorAll(
      'button[title="Mix suggestions for the selected track"]'
    ),
  ];
  return JSON.stringify({
    dock: Boolean(globalThis.document.querySelector('[aria-label="Mix suggestions"]')),
    mixButton: buttons.map((item) =>
      item.className.includes("text-dj-accent") ? "open" : "closed"
    ),
  });
}

function clickMixButton() {
  const button = globalThis.document.querySelector(
    'button[title="Mix suggestions for the selected track"]'
  );
  if (!button) return "no mix button";
  button.click();
  return "clicked mix";
}

function clickDockButton(label) {
  const button = [
    ...globalThis.document.querySelectorAll('[aria-label="Mix suggestions"] button'),
  ].find((item) => item.getAttribute("aria-label") === label);
  if (!button) return `missing:${label}`;
  button.click();
  return `clicked:${label}`;
}

function clickNamedButton(label) {
  const button = globalThis.document.querySelector(`[aria-label="${label}"]`);
  if (!button) return `no:${label}`;
  button.click();
  return "clicked";
}

function readDockOpen() {
  return Boolean(globalThis.document.querySelector('[aria-label="Mix suggestions"]'));
}

function readHandle() {
  const handle = globalThis.document.querySelector('[aria-label="Resize mix suggestions dock"]');
  return handle ? handle.getAttribute("aria-valuenow") : null;
}

async function clearAndLoad(client) {
  await act(client, clickByText, ["button", "Clear search & filters"], "clear filters");
  await sleep(800);
  await act(client, loadAll, [], "load all");
  await sleep(600);
}

async function selectSeededTracks(client) {
  await act(
    client,
    setInput,
    ['input[aria-label="Search the library"]', "Synthetic Track 0000"],
    "search seeded"
  );
  await sleep(1500);
  await act(client, clickRow, ["Synthetic Track 00001"], "select 00001");
  await sleep(300);
  await act(client, clickRow, ["Synthetic Track 00004", { shift: true }], "shift-select 00004");
  await sleep(400);
}

async function openFixTags(client) {
  await act(client, rightClickTitle, ["Synthetic Track 00001"], "context menu");
  await sleep(500);
  await act(client, clickByText, ["[role=menu] button, [role=menuitem]", "Fix tags"], "Fix tags");
  await sleep(2000);
}

const steps = {
  async library(client) {
    await read(client, readHeaders, [], "L1 headers Title..Time");
    await read(client, readPlayLabels, [], "L2 rows before load-all");
    await clearAndLoad(client);
    await act(
      client,
      setInput,
      ['input[aria-label="Search the library"]', "Synthetic Track 00042"],
      "L3 search one title"
    );
    await sleep(1500);
    await read(client, readPlayLabels, [], "L3 rows");
    await act(
      client,
      setInput,
      ['input[aria-label="Search the library"]', "zzz-no-such-track"],
      "L4 search no match"
    );
    await sleep(1500);
    await read(client, readNoMatch, [], "L4 empty state shown");
    await act(client, clickByText, ["button", "Clear search & filters"], "L5 clear");
    await sleep(1200);
    await read(client, readPlayLabels, [], "L5 rows after clear");
    await read(client, readLoadedCount, [], "L6 header");
  },

  async "open-ts"(client) {
    await act(client, closeOpenDialog, [], "close prior dialog");
    await sleep(500);
    await clearAndLoad(client);
    await selectSeededTracks(client);
    await openFixTags(client);
    await read(client, readDialog, [1500], "scan dialog");
  },

  async apply(client) {
    await act(
      client,
      clickByText,
      ["[role=dialog] button", "Apply these spellings…"],
      "open apply"
    );
    await sleep(800);
    await read(client, readDialog, [700], "confirmation");
  },

  async confirm(client) {
    await act(client, clickByText, ["[role=dialog] button", "Apply"], "confirm apply");
    await sleep(2000);
    await read(client, readDialog, [500], "after apply");
  },

  async undo(client) {
    await act(client, clickByText, ["[role=dialog] button", "Undo"], "undo");
    await sleep(2000);
    await read(client, readDialog, [400], "after undo");
  },

  async "mix-open"(client) {
    await act(client, closeOpenDialog, [], "close prior dialog");
    await sleep(500);
    await act(client, clickRow, ["Synthetic Track 00001"], "select 00001");
    await sleep(400);
    await read(client, readMixButtonState, [], "mix button before");
    await act(client, clickMixButton, [], "open mix dock");
    await sleep(2500);
    await read(client, readMixButtonState, [], "mix button after");
    await read(client, readDock, [], "dock");
  },

  async "mix-actions"(client) {
    await read(client, readSelectedCount, [], "selection before add");
    await act(client, clickDockButton, ["Preview Synthetic Track 00121"], "preview");
    await sleep(1200);
    await read(client, readPlayerTitles, [], "player titles");
    await act(client, clickDockButton, ["Add Synthetic Track 00121"], "add");
    await sleep(1200);
    await read(client, readSelectedCount, [], "selection after add");
    await read(client, readHandle, [], "handle aria-valuenow");
    await act(client, clickNamedButton, ["Close mix suggestions"], "close dock");
    await sleep(900);
    await read(client, readDockOpen, [], "dock open after close");
  },
};

/** Compares the fixture database with the baseline the seed script wrote. No app needed. */
function readback(baselinePath) {
  // Loaded here, not at the top, so the app steps do not need node:sqlite.
  const { DatabaseSync } = require("node:sqlite");
  const dbPath = process.env.DJ_ASSISTANT_DB_PATH;
  if (!dbPath || !baselinePath) {
    throw new Error("readback needs DJ_ASSISTANT_DB_PATH and a baseline.json path");
  }
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const tracks = db.prepare("SELECT COUNT(*) AS n FROM tracks").get().n;
  const skillRuns = db.prepare("SELECT COUNT(*) AS n FROM skill_runs").get().n;
  const rows = db.prepare("SELECT track_id, tag FROM track_tags ORDER BY 1, 2").all();
  const identical = JSON.stringify(rows) === JSON.stringify(baseline.tag_rows);
  out(
    `tracks=${tracks} skill_runs=${skillRuns} track_tags=${rows.length} identical_to_baseline=${identical}`
  );
  if (!identical) process.exitCode = 1;
}

async function main() {
  const name = process.argv[2];
  if (name === "readback") {
    readback(process.argv[3]);
    return;
  }
  if (!Object.hasOwn(steps, name)) {
    process.stderr.write(
      `usage: run-checks.cjs <${[...Object.keys(steps), "readback"].join("|")}>\n`
    );
    process.exit(2);
  }
  const client = await connect(9222, { timeoutMs: 60000 });
  try {
    await steps[name](client);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
