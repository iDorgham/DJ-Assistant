/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS, so the DeepSource JS analyzer does not reject imports. */
const { connect } = require("./cdp.cjs");
const { clickByText } = require("./lib.cjs");
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = await connect(9222, { timeoutMs: 60000 });
  console.log(await c.evaluate(clickByText("[role=dialog] button", "Undo")));
  await sleep(2000);
  console.log(
    await c.evaluate(
      `JSON.stringify({dialog: document.querySelector('[role=dialog]')?.innerText?.slice(0,400)})`
    )
  );
  c.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
