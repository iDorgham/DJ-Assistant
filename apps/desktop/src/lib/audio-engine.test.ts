import assert from "node:assert/strict";
import { test } from "node:test";

import { previewEngine } from "./audio-engine.ts";

test("previewEngine initializes in paused state", () => {
  const state = previewEngine.getState();
  assert.equal(state.isPlaying, false);
  assert.equal(state.positionMs, 0);
  assert.ok(state.volume > 0);
});

test("previewEngine loadTrack sets duration and resets position", () => {
  previewEngine.loadTrack(300000, 128);
  const state = previewEngine.getState();
  assert.equal(state.durationMs, 300000);
  assert.equal(state.positionMs, 0);
  assert.equal(state.isPlaying, false);
});

test("previewEngine seek updates position within bounds", () => {
  previewEngine.loadTrack(200000, 120);
  previewEngine.seek(50000);
  assert.equal(previewEngine.getState().positionMs, 50000);

  // Exceeds bounds
  previewEngine.seek(999999);
  assert.equal(previewEngine.getState().positionMs, 200000);

  previewEngine.seek(-1000);
  assert.equal(previewEngine.getState().positionMs, 0);
});

test("previewEngine jumpBeats advances position based on BPM", () => {
  previewEngine.loadTrack(200000, 120); // 120 bpm = 500ms per beat
  previewEngine.seek(10000);
  previewEngine.jumpBeats(4); // +2000ms
  assert.equal(previewEngine.getState().positionMs, 12000);

  previewEngine.jumpBeats(-8); // -4000ms
  assert.equal(previewEngine.getState().positionMs, 8000);
});

test("previewEngine volume and mute controls", () => {
  previewEngine.setVolume(0.5);
  assert.equal(previewEngine.getState().volume, 0.5);

  previewEngine.setMuted(true);
  assert.equal(previewEngine.getState().isMuted, true);

  previewEngine.setMuted(false);
  assert.equal(previewEngine.getState().isMuted, false);
});
