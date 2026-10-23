import assert from "node:assert/strict";
import { test } from "node:test";

import type { CuePoint } from "@dj-assistant/shared";

import {
  cueTitle,
  DEFAULT_TRACK_PANEL_TAB,
  fileFormatLabel,
  formatCueType,
  formatCueTime,
  formatFileSize,
  formatSampleRate,
  isTrackPanelTab,
  movePanelTab,
  persistTrackPanelTab,
  readTrackPanelTab,
  TRACK_PANEL_TAB_STORAGE_KEY,
  TRACK_PANEL_TABS,
} from "./track-panel.ts";
import type { StorageLike } from "./ui-state.ts";

function storage(initial?: string): StorageLike & { value: string | null } {
  return {
    value: initial ?? null,
    getItem() {
      return this.value;
    },
    setItem(_key: string, value: string) {
      this.value = value;
    },
  };
}

test("the panel tab list is the locked seven-tab contract", () => {
  assert.deepEqual(
    TRACK_PANEL_TABS.map((tab) => tab.id),
    ["overview", "tags", "cues", "analysis", "playlists", "history", "file"]
  );
  assert.deepEqual(
    TRACK_PANEL_TABS.map((tab) => tab.label),
    ["Overview", "Tags", "Cues", "Analysis", "Playlists", "History", "File"]
  );
  assert.equal(DEFAULT_TRACK_PANEL_TAB, "overview");
});

test("isTrackPanelTab accepts only a known id", () => {
  assert.equal(isTrackPanelTab("tags"), true);
  assert.equal(isTrackPanelTab("file"), true);
  assert.equal(isTrackPanelTab("extended"), false);
  assert.equal(isTrackPanelTab(null), false);
  assert.equal(isTrackPanelTab(3), false);
});

test("readTrackPanelTab falls back to Overview", () => {
  assert.equal(readTrackPanelTab(storage()), "overview");
  assert.equal(readTrackPanelTab(storage("not-a-tab")), "overview");
  assert.equal(
    readTrackPanelTab({
      getItem() {
        throw new Error("blocked");
      },
      setItem() {},
    }),
    "overview"
  );
});

test("readTrackPanelTab honours a stored tab", () => {
  assert.equal(readTrackPanelTab(storage("cues")), "cues");
  assert.equal(readTrackPanelTab(storage("history")), "history");
});

test("persistTrackPanelTab round-trips and survives blocked storage", () => {
  const store = storage();
  persistTrackPanelTab("analysis", store);
  assert.equal(store.value, "analysis");
  assert.equal(store.value && readTrackPanelTab(store), "analysis");

  assert.doesNotThrow(() =>
    persistTrackPanelTab("file", {
      getItem: () => null,
      setItem() {
        throw new Error("quota");
      },
    })
  );
});

test("persistTrackPanelTab uses the versioned key", () => {
  let key: string | null = null;
  persistTrackPanelTab("tags", {
    getItem: () => null,
    setItem(next) {
      key = next;
    },
  });
  assert.equal(key, TRACK_PANEL_TAB_STORAGE_KEY);
});

test("movePanelTab wraps and jumps to the ends", () => {
  assert.equal(movePanelTab("overview", "ArrowLeft"), "file");
  assert.equal(movePanelTab("file", "ArrowRight"), "overview");
  assert.equal(movePanelTab("tags", "ArrowRight"), "cues");
  assert.equal(movePanelTab("tags", "ArrowLeft"), "overview");
  assert.equal(movePanelTab("cues", "Home"), "overview");
  assert.equal(movePanelTab("overview", "End"), "file");
});

test("formatFileSize keeps bytes honest and scales by 1024", () => {
  assert.equal(formatFileSize(null), "—");
  assert.equal(formatFileSize(undefined), "—");
  assert.equal(formatFileSize(-1), "—");
  assert.equal(formatFileSize(Number.NaN), "—");
  assert.equal(formatFileSize(0), "0 B");
  assert.equal(formatFileSize(900), "900 B");
  assert.equal(formatFileSize(1024), "1 KB");
  assert.equal(formatFileSize(1536), "1.5 KB");
  assert.equal(formatFileSize(10 * 1024), "10 KB");
  assert.equal(formatFileSize(12.4 * 1024 * 1024), "12.4 MB");
  assert.equal(formatFileSize(2.5 * 1024 * 1024 * 1024), "2.5 GB");
});

test("formatSampleRate reports kHz without a trailing .0", () => {
  assert.equal(formatSampleRate(44_100), "44.1 kHz");
  assert.equal(formatSampleRate(48_000), "48 kHz");
  assert.equal(formatSampleRate(0), "—");
  assert.equal(formatSampleRate(null), "—");
  assert.equal(formatSampleRate(Number.NaN), "—");
});

test("formatCueType names every stored cue type", () => {
  assert.equal(formatCueType("hot_cue"), "Hot cue");
  assert.equal(formatCueType("memory_cue"), "Memory cue");
  assert.equal(formatCueType("loop"), "Loop");
});

test("formatCueTime keeps millisecond precision", () => {
  assert.equal(formatCueTime(0), "0:00.000");
  assert.equal(formatCueTime(61_250), "1:01.250");
  assert.equal(formatCueTime(3_600_001), "60:00.001");
  assert.equal(formatCueTime(null), "—");
  assert.equal(formatCueTime(-1), "—");
  assert.equal(formatCueTime(Number.NaN), "—");
});

test("cueTitle prefers the label, then the slot", () => {
  const base: CuePoint = {
    id: "c1",
    trackId: "t1",
    slot: 3,
    positionMs: 61_000,
    label: "",
    cueType: "hot_cue",
    colorHex: "#ff0000",
    source: "user_custom",
    createdAt: "2026-01-01T00:00:00Z",
  };
  assert.equal(cueTitle({ ...base, label: "Drop" }), "Drop");
  assert.equal(cueTitle(base), "Hot cue 3");
  assert.equal(cueTitle({ ...base, slot: null, cueType: "memory_cue" }), "Memory cue");
  assert.equal(cueTitle({ ...base, slot: null, cueType: "loop" }), "Loop");
});

test("fileFormatLabel normalises the stored format", () => {
  assert.equal(fileFormatLabel("mp3"), "MP3");
  assert.equal(fileFormatLabel(" Flac "), "FLAC");
  assert.equal(fileFormatLabel(null), "—");
  assert.equal(fileFormatLabel(""), "—");
});
