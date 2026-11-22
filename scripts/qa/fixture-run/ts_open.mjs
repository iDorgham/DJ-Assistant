import { connect } from "./cdp.mjs";
import { setInput, clickByText, rightClickTitle, clickRow, loadAllJs } from "./lib.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = await connect(9222, { timeoutMs: 60000 });
console.log(
  await c.evaluate(
    `(() => { const b=[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.trim()==='Close'); if(b){b.click(); return 'closed prior';} return 'none open'; })()`
  )
);
await sleep(500);
console.log(await c.evaluate(clickByText("button", "Clear search & filters")));
await sleep(800);
console.log(await c.evaluate(loadAllJs));
await sleep(600);
console.log(
  await c.evaluate(setInput('input[aria-label="Search the library"]', "Synthetic Track 0000"))
);
await sleep(1500);
console.log(await c.evaluate(clickRow("Synthetic Track 00001")));
await sleep(300);
console.log(await c.evaluate(clickRow("Synthetic Track 00004", { shift: true })));
await sleep(400);
console.log(await c.evaluate(rightClickTitle("Synthetic Track 00001")));
await sleep(500);
console.log(await c.evaluate(clickByText("[role=menu] button, [role=menuitem]", "Fix tags")));
await sleep(2000);
console.log(
  await c.evaluate(
    `JSON.stringify({dialog: document.querySelector('[role=dialog]')?.innerText?.slice(0,1500), buttons:[...document.querySelectorAll('[role=dialog] button')].map(b=>b.textContent.trim()).filter(Boolean)})`
  )
);
c.close();
