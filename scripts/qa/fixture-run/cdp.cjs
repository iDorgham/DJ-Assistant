// Minimal Chrome DevTools Protocol client for the WebView2 test window.
// Connects to the page target on the remote-debugging port and evaluates JS.
// Needs Node 22+ (the global WebSocket), which is the version CI uses.

/**
 * Waits for the app's page target on the DevTools port and opens a socket to it.
 * Returns `evaluate(expression)`, a raw `call(method, params)`, and `close()`.
 * Any request still pending when the socket closes is rejected, so a step fails
 * instead of exiting early with success.
 */
async function connect(port = 9222, { timeoutMs = 240000 } = {}) {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error("the QA driver needs Node 22+ (global WebSocket)");
  }
  const deadline = Date.now() + timeoutMs;
  let target = null;
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page" && /localhost:1420|tauri/.test(t.url));
      if (target) break;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!target) throw new Error("DevTools page target not found");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id).resolve(message);
      pending.delete(message.id);
    }
  };
  ws.onclose = () => {
    for (const request of pending.values()) {
      request.reject(new Error("DevTools socket closed before the reply"));
    }
    pending.clear();
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.error) {
      throw new Error(`protocol error: ${response.error.message}`);
    }
    if (response.result?.exceptionDetails) {
      const details = response.result.exceptionDetails;
      throw new Error(details.exception?.description || details.text);
    }
    return response.result?.result?.value;
  }

  return { evaluate, call: send, close: () => ws.close(), url: target.url };
}

module.exports = { connect };
