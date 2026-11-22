/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS, so the DeepSource JS analyzer does not reject imports. */
const { connect } = require("./cdp.cjs");
const { clickByText } = require("./lib.cjs");
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = await connect(9222, { timeoutMs: 60000 });
  const sel = `(() => { const m = document.body.innerText.match(/([0-9]+) selected/); return m ? m[0] : 'no-selected-text'; })()`;
  const player = `(() => { const p = document.body.innerText.match(/Synthetic Track 00[0-9]+/g); return JSON.stringify([...new Set(p||[])].slice(0,4)); })()`;
  console.log("selection before add:", await c.evaluate(sel));
  console.log(
    await c.evaluate(
      clickByText('[aria-label="Mix suggestions"] button', "Preview Synthetic Track 00121") || "x"
    )
  );
  await sleep(600);
  console.log(
    await c.evaluate(
      `(() => { const b=[...document.querySelectorAll('[aria-label="Mix suggestions"] button')].find(b=>b.getAttribute('aria-label')==='Preview Synthetic Track 00121'); if(!b) return 'missing'; b.click(); return 'preview clicked'; })()`
    )
  );
  await sleep(1200);
  console.log("player titles:", await c.evaluate(player));
  console.log(
    await c.evaluate(
      `(() => { const b=[...document.querySelectorAll('[aria-label="Mix suggestions"] button')].find(b=>b.getAttribute('aria-label')==='Add Synthetic Track 00121'); if(!b) return 'missing add'; b.click(); return 'add clicked'; })()`
    )
  );
  await sleep(1200);
  console.log("selection after add:", await c.evaluate(sel));
  console.log(
    "handle:",
    await c.evaluate(
      `document.querySelector('[aria-label="Resize mix suggestions dock"]')?.getAttribute('aria-valuenow')`
    )
  );
  console.log(
    await c.evaluate(
      `(() => { const b=document.querySelector('[aria-label="Close mix suggestions"]'); if(!b) return 'no close'; b.click(); return 'close clicked'; })()`
    )
  );
  await sleep(900);
  console.log(
    "dock after close:",
    await c.evaluate(`!!document.querySelector('[aria-label="Mix suggestions"]')`)
  );
  c.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
