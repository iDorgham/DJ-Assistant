/* global document, MouseEvent */
// Page-side helpers for the DevTools driver. Each function is serialised with
// toString() and run inside the WebView, so the browser executes this exact
// source. Arguments are passed as JSON. Only `document`, `window` and the
// arguments are used: no closures.

/** Builds the expression that calls `fn` in the page with JSON arguments. */
function expr(fn, ...args) {
  return `(${fn.toString()})(${args.map((arg) => JSON.stringify(arg)).join(", ")})`;
}

function setInput(selector, value) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`no input ${selector}`);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return "ok";
}

function clickByText(selector, text) {
  const el = [...document.querySelectorAll(selector)].find(
    (element) => element.textContent.trim() === text
  );
  if (!el) return `missing:${text}`;
  el.click();
  return "clicked";
}

function findPlayCell(title) {
  return [...document.querySelectorAll('[aria-label^="Play "]')].find(
    (element) => element.getAttribute("aria-label") === `Play ${title}`
  );
}

function rightClickTitle(title) {
  const cell = findPlayCell(title);
  if (!cell) return "no-play-button";
  let row = cell;
  for (let i = 0; i < 8 && row && !row.textContent.includes(title); i++) row = row.parentElement;
  const target = row.querySelector("[role=gridcell], td, div") || row;
  target.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 300,
      clientY: 300,
      button: 2,
    })
  );
  return `ctx:${row.tagName}:${(row.className || "").toString().slice(0, 60)}`;
}

function clickRow(title, options) {
  const { shift = false, ctrl = false } = options || {};
  const cell = findPlayCell(title);
  if (!cell) return `no-row:${title}`;
  let row = cell;
  for (let i = 0; i < 8 && row && !row.textContent.includes(title); i++) row = row.parentElement;
  const target =
    [...row.querySelectorAll("td,[role=gridcell],div")].find(
      (node) => node.textContent.trim() === title
    ) || row;
  const opts = {
    bubbles: true,
    cancelable: true,
    button: 0,
    shiftKey: shift,
    ctrlKey: ctrl,
    metaKey: false,
  };
  target.dispatchEvent(new MouseEvent("mousedown", opts));
  target.dispatchEvent(new MouseEvent("mouseup", opts));
  target.dispatchEvent(new MouseEvent("click", opts));
  return `clicked:${row.tagName}`;
}

async function loadAll() {
  for (let i = 0; i < 40; i++) {
    const match = document.body.innerText.match(/([0-9]+) of ([0-9]+) tracks/);
    const btn = [...document.querySelectorAll("button")].find(
      (item) => item.textContent.trim() === "Load more"
    );
    if (!btn) return `loaded:${match ? match[0] : "no-count"}`;
    btn.click();
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  return "gave-up";
}

module.exports = { expr, setInput, clickByText, rightClickTitle, clickRow, loadAll };
