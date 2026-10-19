import test from "node:test";
import assert from "node:assert/strict";
import { nextTheme, resolveStoredTheme, resolveTheme, THEME_LABELS } from "./theme.ts";
import type { StorageLike } from "./ui-state.ts";

function storageWith(value: string | null): StorageLike {
  return {
    getItem: () => value,
    setItem: () => {},
  };
}

test("explicit themes ignore the system preference", () => {
  assert.equal(resolveTheme("dark", true), "dark");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("light", false), "light");
});

test("system follows the OS preference", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("theme toggle cycles dark -> light -> system -> dark", () => {
  assert.equal(nextTheme("dark"), "light");
  assert.equal(nextTheme("light"), "system");
  assert.equal(nextTheme("system"), "dark");
});

test("every theme has a human label", () => {
  assert.deepEqual(THEME_LABELS, { dark: "Dark", light: "Light", system: "System" });
});

test("stored theme resolves before first paint", () => {
  assert.equal(resolveStoredTheme(storageWith(JSON.stringify({ theme: "light" })), true), "light");
  assert.equal(resolveStoredTheme(storageWith(JSON.stringify({ theme: "dark" })), false), "dark");
  assert.equal(
    resolveStoredTheme(storageWith(JSON.stringify({ theme: "system" })), false),
    "light"
  );
  assert.equal(resolveStoredTheme(storageWith(null), true), "dark");
});
