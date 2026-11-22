import { connect } from "./cdp.mjs";
import { clickByText } from "./lib.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = await connect(9222, { timeoutMs: 60000 });
console.log(await c.evaluate(clickByText("[role=dialog] button", "Apply")));
await sleep(2000);
console.log(
  await c.evaluate(
    `JSON.stringify({dialog: document.querySelector('[role=dialog]')?.innerText?.slice(0,500)})`
  )
);
c.close();
