/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS, so the DeepSource JS analyzer does not reject imports. */
const { connect } = require("./cdp.cjs");
const { setInput, clickByText, loadAllJs } = require("./lib.cjs");
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = await connect(9222, { timeoutMs: 60000 });
  const status = `(() => { const m = document.body.innerText.match(/[0-9]+ of [0-9]+ tracks/); return m ? m[0] : 'none'; })()`;
  const headers = `JSON.stringify(['Title','Artist','BPM','Key','Energy','Rating','Time'].map(h => [...document.querySelectorAll('th,[role=columnheader]')].some(e => e.textContent.trim() === h)))`;
  const plays = `document.querySelectorAll('[aria-label^="Play "]').length`;
  console.log(
    "L1 headers present (Title,Artist,BPM,Key,Energy,Rating,Time):",
    await c.evaluate(headers)
  );
  console.log(
    "L2 status before load-all:",
    await c.evaluate(status),
    "DOM rows:",
    await c.evaluate(plays)
  );
  console.log("L3 load-all:", await c.evaluate(loadAllJs));
  await sleep(800);
  console.log("L4 status after load-all:", await c.evaluate(status));
  console.log(
    "L5 search one title:",
    await c.evaluate(setInput('input[aria-label="Search the library"]', "Synthetic Track 00042"))
  );
  await sleep(1500);
  console.log(
    "   rows:",
    await c.evaluate(
      `JSON.stringify([...document.querySelectorAll('[aria-label^="Play "]')].map(e=>e.getAttribute('aria-label')))`
    )
  );
  console.log(
    "L6 search no-match:",
    await c.evaluate(setInput('input[aria-label="Search the library"]', "zzz-no-such-track"))
  );
  await sleep(1500);
  console.log(
    "   empty state shown:",
    await c.evaluate(`document.body.innerText.includes('No tracks match')`)
  );
  console.log("L7 clear:", await c.evaluate(clickByText("button", "Clear search & filters")));
  await sleep(1200);
  console.log("   rows after clear:", await c.evaluate(plays), "status:", await c.evaluate(status));
  c.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
