/* global document */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS, so the DeepSource JS analyzer does not reject imports. */
// Drives the desktop app over DevTools for the 2026-11-22 fixture QA run.
// Usage: node scripts/qa/fixture-run/run-checks.cjs <step>
// Steps, in the order the evidence records them:
//   library      headers, load-all, search and clear
//   open-ts      select four seeded tracks and open the Tag Surgeon scan
//   apply        open the confirmation step (read only)
//   confirm      confirm the apply
//   undo         undo the apply
//   mix-open     open the mix dock for one track and read it
//   mix-actions  preview, add and close in the mix dock
// Each step needs the app running with DJ_ASSISTANT_DB_PATH pointing at a copy
// of the fixture and WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222.
const { connect } = require("./cdp.cjs");
const { expr, setInput, clickByText, rightClickTitle, clickRow, loadAll } = require("./lib.cjs");

const out = (value) => process.stdout.write(`${value}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function closeOpenDialog() {
  const button = [...document.querySelectorAll("[role=dialog] button")].find(
    (item) => item.textContent.trim() === "Close"
  );
  if (button) {
    button.click();
    return "closed prior";
  }
  return "none open";
}

function readDialog(limit) {
  const dialog = document.querySelector("[role=dialog]");
  return JSON.stringify({
    dialog: dialog?.innerText?.slice(0, limit),
    buttons: [...document.querySelectorAll("[role=dialog] button")]
      .map((item) => item.textContent.trim())
      .filter(Boolean),
  });
}

function readPlayLabels() {
  return JSON.stringify(
    [...document.querySelectorAll('[aria-label^="Play "]')].map((element) =>
      element.getAttribute("aria-label")
    )
  );
}

function readHeaders() {
  const names = ["Title", "Artist", "BPM", "Key", "Energy", "Rating", "Time"];
  const headers = [...document.querySelectorAll("th,[role=columnheader]")].map((e) =>
    e.textContent.trim()
  );
  return JSON.stringify(names.map((name) => headers.includes(name)));
}

function readStatus() {
  const match = document.body.innerText.match(/[0-9]+ of [0-9]+ tracks/);
  return match ? match[0] : "none";
}

function readNoMatch() {
  return document.body.innerText.includes("No tracks match");
}

function readSelectedCount() {
  const match = document.body.innerText.match(/([0-9]+) selected/);
  return match ? match[0] : "no-selected-text";
}

function readPlayerTitles() {
  const titles = document.body.innerText.match(/Synthetic Track 00[0-9]+/g) || [];
  return JSON.stringify([...new Set(titles)].slice(0, 4));
}

function readDock() {
  const dock = document.querySelector('[aria-label="Mix suggestions"]');
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
    ...document.querySelectorAll('button[title="Mix suggestions for the selected track"]'),
  ];
  return JSON.stringify({
    dock: Boolean(document.querySelector('[aria-label="Mix suggestions"]')),
    mixButton: buttons.map((b) => (b.className.includes("text-dj-accent") ? "open" : "closed")),
  });
}

function clickMixButton() {
  const button = document.querySelector('button[title="Mix suggestions for the selected track"]');
  if (!button) return "no mix button";
  button.click();
  return "clicked mix";
}

function clickDockButton(label) {
  const button = [...document.querySelectorAll('[aria-label="Mix suggestions"] button')].find(
    (item) => item.getAttribute("aria-label") === label
  );
  if (!button) return `missing:${label}`;
  button.click();
  return `clicked:${label}`;
}

function clickNamedButton(label) {
  const button = document.querySelector(`[aria-label="${label}"]`);
  if (!button) return `no:${label}`;
  button.click();
  return "clicked";
}

function readDockOpen() {
  return Boolean(document.querySelector('[aria-label="Mix suggestions"]'));
}

function readHandle() {
  const handle = document.querySelector('[aria-label="Resize mix suggestions dock"]');
  return handle ? handle.getAttribute("aria-valuenow") : null;
}

async function clearAndLoad(client) {
  out(await client.evaluate(expr(clickByText, "button", "Clear search & filters")));
  await sleep(800);
  out(await client.evaluate(expr(loadAll)));
  await sleep(600);
}

async function selectSeededTracks(client) {
  out(
    await client.evaluate(
      expr(setInput, 'input[aria-label="Search the library"]', "Synthetic Track 0000")
    )
  );
  await sleep(1500);
  out(await client.evaluate(expr(clickRow, "Synthetic Track 00001")));
  await sleep(300);
  out(await client.evaluate(expr(clickRow, "Synthetic Track 00004", { shift: true })));
  await sleep(400);
}

async function openFixTags(client) {
  out(await client.evaluate(expr(rightClickTitle, "Synthetic Track 00001")));
  await sleep(500);
  out(await client.evaluate(expr(clickByText, "[role=menu] button, [role=menuitem]", "Fix tags")));
  await sleep(2000);
}

const steps = {
  async library(client) {
    out(`L1 headers: ${await client.evaluate(expr(readHeaders))}`);
    out(`L2 status before load-all: ${await client.evaluate(expr(readStatus))}`);
    await clearAndLoad(client);
    out(`L4 status after load-all: ${await client.evaluate(expr(readStatus))}`);
    out(
      await client.evaluate(
        expr(setInput, 'input[aria-label="Search the library"]', "Synthetic Track 00042")
      )
    );
    await sleep(1500);
    out(`L3 rows: ${await client.evaluate(expr(readPlayLabels))}`);
    out(
      await client.evaluate(
        expr(setInput, 'input[aria-label="Search the library"]', "zzz-no-such-track")
      )
    );
    await sleep(1500);
    out(`L4 empty state: ${await client.evaluate(expr(readNoMatch))}`);
    out(await client.evaluate(expr(clickByText, "button", "Clear search & filters")));
    await sleep(1200);
    out(`L5 rows after clear: ${await client.evaluate(expr(readPlayLabels))}`);
  },

  async "open-ts"(client) {
    out(await client.evaluate(expr(closeOpenDialog)));
    await sleep(500);
    await clearAndLoad(client);
    await selectSeededTracks(client);
    await openFixTags(client);
    out(await client.evaluate(expr(readDialog, 1500)));
  },

  async apply(client) {
    out(await client.evaluate(expr(clickByText, "[role=dialog] button", "Apply these spellings…")));
    await sleep(800);
    out(await client.evaluate(expr(readDialog, 700)));
  },

  async confirm(client) {
    out(await client.evaluate(expr(clickByText, "[role=dialog] button", "Apply")));
    await sleep(2000);
    out(await client.evaluate(expr(readDialog, 500)));
  },

  async undo(client) {
    out(await client.evaluate(expr(clickByText, "[role=dialog] button", "Undo")));
    await sleep(2000);
    out(await client.evaluate(expr(readDialog, 400)));
  },

  async "mix-open"(client) {
    out(await client.evaluate(expr(closeOpenDialog)));
    await sleep(500);
    out(await client.evaluate(expr(clickRow, "Synthetic Track 00001")));
    await sleep(400);
    out(`before: ${await client.evaluate(expr(readMixButtonState))}`);
    out(await client.evaluate(expr(clickMixButton)));
    await sleep(2500);
    out(`after: ${await client.evaluate(expr(readMixButtonState))}`);
    out(await client.evaluate(expr(readDock)));
  },

  async "mix-actions"(client) {
    out(`selection before add: ${await client.evaluate(expr(readSelectedCount))}`);
    out(await client.evaluate(expr(clickDockButton, "Preview Synthetic Track 00121")));
    await sleep(1200);
    out(`player titles: ${await client.evaluate(expr(readPlayerTitles))}`);
    out(await client.evaluate(expr(clickDockButton, "Add Synthetic Track 00121")));
    await sleep(1200);
    out(`selection after add: ${await client.evaluate(expr(readSelectedCount))}`);
    out(`handle aria-valuenow: ${await client.evaluate(expr(readHandle))}`);
    out(await client.evaluate(expr(clickNamedButton, "Close mix suggestions")));
    await sleep(900);
    out(`dock open after close: ${await client.evaluate(expr(readDockOpen))}`);
  },
};

async function main() {
  const name = process.argv[2];
  if (!steps[name]) {
    process.stderr.write(`usage: run-checks.cjs <${Object.keys(steps).join("|")}>\n`);
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
