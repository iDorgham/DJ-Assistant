/**
 * API smoke tests using Fastify's built-in `inject` (no network, no server).
 *
 * The API compiles to CommonJS (no `"type": "module"` in package.json), so the
 * built output is loaded through `createRequire` and the default export lives on
 * `.default`.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, test } from "node:test";

// Prevent the module from binding a port during tests.
process.env.NODE_ENV = "test";

const require = createRequire(import.meta.url);
const app = require("../dist/index.js").default;

after(async () => {
  await app.close();
});

test("GET /health returns ok with service metadata", async () => {
  const res = await app.inject({ method: "GET", url: "/health" });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "dj-assistant-api");
  assert.ok(!Number.isNaN(Date.parse(body.timestamp)), "timestamp must be a parseable date");
});

test("unknown routes return 404", async () => {
  const res = await app.inject({ method: "GET", url: "/does-not-exist" });
  assert.equal(res.statusCode, 404);
});
