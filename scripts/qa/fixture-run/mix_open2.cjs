/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS, so the DeepSource JS analyzer does not reject imports. */
const { connect } = require("./cdp.cjs");
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = await connect(9222, { timeoutMs: 60000 });
  const state = `JSON.stringify({dock: !!document.querySelector('[aria-label="Mix suggestions"]'), mixBtn: [...document.querySelectorAll('button[title="Mix suggestions for the selected track"]')].map(b=>b.getAttribute('class').includes('text-dj-accent') ? 'open' : 'closed'), selectedTitle: document.querySelector('[aria-selected="true"], [data-selected="true"]')?.innerText?.slice(0,40) ?? null})`;
  console.log("before", await c.evaluate(state));
  console.log(
    await c.evaluate(
      `(() => { const b=document.querySelector('button[title="Mix suggestions for the selected track"]'); if(!b) return 'no mix button'; b.click(); return 'clicked mix'; })()`
    )
  );
  await sleep(2500);
  console.log("after", await c.evaluate(state));
  console.log(
    await c.evaluate(
      `JSON.stringify({text: document.querySelector('[aria-label="Mix suggestions"]')?.innerText?.slice(0,700), buttons:[...document.querySelectorAll('[aria-label="Mix suggestions"] button')].map(b=>b.getAttribute('aria-label')||b.textContent.trim()).slice(0,24)})`
    )
  );
  c.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
