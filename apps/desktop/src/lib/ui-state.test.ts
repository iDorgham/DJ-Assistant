import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_UI_STATE,
  initUiState,
  persistUiState,
  reduceUiState,
  shortcutToAction,
  UI_STATE_STORAGE_KEY,
  type StorageLike,
} from "./ui-state.ts";

function fakeStorage(
  initial: Record<string, string> = {}
): StorageLike & { dump: () => Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

test("defaults when storage is empty", () => {
  assert.deepEqual(initUiState(fakeStorage()), DEFAULT_UI_STATE);
  assert.equal(DEFAULT_UI_STATE.view, "library");
  assert.equal(DEFAULT_UI_STATE.theme, "dark");
  assert.equal(DEFAULT_UI_STATE.playerMode, "mini");
  assert.equal(DEFAULT_UI_STATE.navCollapsed, false);
});

test("defaults when storage is missing entirely", () => {
  assert.deepEqual(initUiState(undefined), DEFAULT_UI_STATE);
});

test("corrupt JSON falls back to defaults", () => {
  const storage = fakeStorage({ [UI_STATE_STORAGE_KEY]: "not-json{{" });
  assert.deepEqual(initUiState(storage), DEFAULT_UI_STATE);
});

test("throwing storage reads fall back to defaults", () => {
  const storage: StorageLike = {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {},
  };
  assert.deepEqual(initUiState(storage), DEFAULT_UI_STATE);
});

test("throwing storage writes are ignored", () => {
  const storage: StorageLike = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota exceeded");
    },
  };
  const state = reduceUiState(DEFAULT_UI_STATE, { type: "setView", view: "preparation" });
  assert.doesNotThrow(() => persistUiState(state, storage));
  assert.equal(state.view, "preparation");
});

test("unknown persisted values fall back per field", () => {
  const storage = fakeStorage({
    [UI_STATE_STORAGE_KEY]: JSON.stringify({
      view: "preparation",
      theme: "neon",
      playerMode: "full",
      navCollapsed: "yes",
      lastVisiblePlayerMode: "cinema",
    }),
  });
  assert.deepEqual(initUiState(storage), {
    ...DEFAULT_UI_STATE,
    view: "preparation",
    playerMode: "full",
  });
});

test("valid persisted state round-trips", () => {
  const storage = fakeStorage();
  const state = reduceUiState(DEFAULT_UI_STATE, { type: "setView", view: "preparation" });
  persistUiState(state, storage);
  assert.deepEqual(initUiState(storage), { ...DEFAULT_UI_STATE, view: "preparation" });
});

test("persist omits nothing and stores under the versioned key", () => {
  const storage = fakeStorage();
  persistUiState(
    {
      view: "autoPerformance",
      navCollapsed: true,
      theme: "light",
      playerMode: "full",
      lastVisiblePlayerMode: "full",
    },
    storage
  );
  assert.deepEqual(JSON.parse(storage.dump()[UI_STATE_STORAGE_KEY]), {
    view: "autoPerformance",
    navCollapsed: true,
    theme: "light",
    playerMode: "full",
    lastVisiblePlayerMode: "full",
  });
});

test("setView switches view", () => {
  const s1 = reduceUiState(DEFAULT_UI_STATE, { type: "setView", view: "autoPerformance" });
  assert.equal(s1.view, "autoPerformance");
  const s2 = reduceUiState(s1, { type: "setView", view: "library" });
  assert.equal(s2.view, "library");
});

test("toggleNav flips collapse without touching other fields", () => {
  const s = reduceUiState({ ...DEFAULT_UI_STATE, view: "preparation" }, { type: "toggleNav" });
  assert.equal(s.navCollapsed, true);
  assert.equal(s.view, "preparation");
  assert.equal(reduceUiState(s, { type: "toggleNav" }).navCollapsed, false);
});

test("togglePlayer restores the last visible mode", () => {
  let s = reduceUiState(DEFAULT_UI_STATE, { type: "setPlayerMode", mode: "full" });
  assert.equal(s.playerMode, "full");
  s = reduceUiState(s, { type: "togglePlayer" });
  assert.equal(s.playerMode, "hidden");
  s = reduceUiState(s, { type: "togglePlayer" });
  assert.equal(s.playerMode, "full");
});

test("togglePlayer from hidden restores mini by default", () => {
  const hidden = { ...DEFAULT_UI_STATE, playerMode: "hidden" as const };
  assert.equal(reduceUiState(hidden, { type: "togglePlayer" }).playerMode, "mini");
});

test("persisted lastVisiblePlayerMode never restores hidden", () => {
  const storage = fakeStorage({
    [UI_STATE_STORAGE_KEY]: JSON.stringify({
      playerMode: "hidden",
      lastVisiblePlayerMode: "hidden",
    }),
  });
  const state = initUiState(storage);
  assert.equal(state.lastVisiblePlayerMode, "mini");
  assert.equal(reduceUiState(state, { type: "togglePlayer" }).playerMode, "mini");
});

test("setPlayerMode and setTheme validate input", () => {
  assert.equal(
    reduceUiState(DEFAULT_UI_STATE, { type: "setPlayerMode", mode: "full" }).playerMode,
    "full"
  );
  assert.equal(
    reduceUiState(DEFAULT_UI_STATE, { type: "setTheme", theme: "system" }).theme,
    "system"
  );
  // @ts-expect-error runtime must still reject invalid values
  assert.equal(reduceUiState(DEFAULT_UI_STATE, { type: "setTheme", theme: "neon" }).theme, "dark");
});

test("unknown action leaves state untouched", () => {
  // @ts-expect-error deliberate unknown action
  assert.deepEqual(reduceUiState(DEFAULT_UI_STATE, { type: "explode" }), DEFAULT_UI_STATE);
});

test("Ctrl/Cmd+1..3 map to views; other keys do not", () => {
  assert.deepEqual(shortcutToAction({ key: "1", ctrlKey: true, metaKey: false }), {
    type: "setView",
    view: "library",
  });
  assert.deepEqual(shortcutToAction({ key: "2", ctrlKey: false, metaKey: true }), {
    type: "setView",
    view: "preparation",
  });
  assert.deepEqual(shortcutToAction({ key: "3", ctrlKey: true, metaKey: true }), {
    type: "setView",
    view: "autoPerformance",
  });
  assert.equal(shortcutToAction({ key: "1", ctrlKey: false, metaKey: false }), null);
  assert.equal(shortcutToAction({ key: "k", ctrlKey: true, metaKey: false }), null);
});
