// Shared helpers for DOM interaction in the React app.
const setInput = (sel, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) throw new Error('no input ' + ${JSON.stringify(sel)});
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`;
const clickByText = (sel, text) => `(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim() === ${JSON.stringify(text)});
  if (!el) return 'missing:' + ${JSON.stringify(text)};
  el.click(); return 'clicked';
})()`;
const rightClickTitle = (title) => `(() => {
  const cell = [...document.querySelectorAll('[aria-label^="Play "]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify("Play " + title)});
  if (!cell) return 'no-play-button';
  let row = cell; for (let i = 0; i < 8 && row && !row.textContent.includes(${JSON.stringify(title)}); i++) row = row.parentElement;
  const target = row.querySelector('[role=gridcell], td, div') || row;
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300, button: 2 }));
  return 'ctx:' + row.tagName + ':' + (row.className || '').toString().slice(0, 60);
})()`;
const clickRow = (title, { shift = false, ctrl = false } = {}) => `(() => {
  const cell = [...document.querySelectorAll('[aria-label^="Play "]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify("Play " + title)});
  if (!cell) return 'no-row:' + ${JSON.stringify(title)};
  let row = cell; for (let i = 0; i < 8 && row && !row.textContent.includes(${JSON.stringify(title)}); i++) row = row.parentElement;
  const target = [...row.querySelectorAll('td,[role=gridcell],div')].find(d => d.textContent.trim() === ${JSON.stringify(title)}) || row;
  const opts = { bubbles: true, cancelable: true, button: 0, shiftKey: ${shift}, ctrlKey: ${ctrl}, metaKey: false };
  target.dispatchEvent(new MouseEvent('mousedown', opts));
  target.dispatchEvent(new MouseEvent('mouseup', opts));
  target.dispatchEvent(new MouseEvent('click', opts));
  return 'clicked:' + row.tagName;
})()`;
const loadAllJs = `(async () => {
  for (let i = 0; i < 40; i++) {
    const m = document.body.innerText.match(/([0-9]+) of ([0-9]+) tracks/);
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Load more');
    if (!btn) return 'loaded:' + (m ? m[0] : 'no-count');
    btn.click();
    await new Promise(r => setTimeout(r, 900));
  }
  return 'gave-up';
})()`;

module.exports = { setInput, clickByText, rightClickTitle, clickRow, loadAllJs };
