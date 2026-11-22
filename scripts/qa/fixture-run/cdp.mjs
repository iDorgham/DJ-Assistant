// Minimal Chrome DevTools Protocol client for the WebView2 test window.
// Connects to the page target on the remote-debugging port and evaluates JS.
export async function connect(port = 9222, { timeoutMs = 240000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let target;
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page" && /localhost:1420|tauri/.test(t.url));
      if (target) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!target) throw new Error("DevTools page target not found");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  async function evaluate(expression) {
    const res = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.result?.exceptionDetails) {
      const d = res.result.exceptionDetails;
      throw new Error(d.exception?.description || d.text);
    }
    return res.result?.result?.value;
  }

  return { evaluate, call: send, close: () => ws.close(), url: target.url };
}
