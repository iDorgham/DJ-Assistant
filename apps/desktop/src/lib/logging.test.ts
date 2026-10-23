import assert from "node:assert/strict";
import { test } from "node:test";

import { redact } from "./logging.ts";

test("redacts credentials, bearer tokens and URL secrets", () => {
  const input = [
    "Authorization: Bearer abc.def.ghi",
    "access_token=super-secret",
    "https://example.test/callback?api_key=hidden&next=1",
  ].join(" ");

  const output = redact(input);

  assert.doesNotMatch(output, /abc\.def\.ghi/);
  assert.doesNotMatch(output, /super-secret/);
  assert.doesNotMatch(output, /hidden/);
  assert.match(output, /Authorization=\[redacted\]/);
  assert.match(output, /api_key=\[redacted\]/);
});

test("redacts user-home paths without removing the rest of the path", () => {
  const output = redact("C:\\Users\\Alice\\Music\\track.flac /Users/alice/Music/track.flac");

  assert.match(output, /C:\\Users\\\[user\]\\Music\\track\.flac/);
  assert.match(output, /\/Users\/\[user\]\/Music\/track\.flac/);
  assert.doesNotMatch(output, /Alice|alice\/Music/);
});

test("redacts email addresses", () => {
  assert.equal(redact("contact dj@example.com for support"), "contact [email] for support");
});

test("leaves ordinary messages and relative paths untouched", () => {
  const message = "Library loaded: 42 tracks from Music/imports";
  assert.equal(redact(message), message);
});
