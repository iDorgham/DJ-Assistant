import assert from "node:assert/strict";
import { test } from "node:test";

import { previewEngine, shouldRewindToStart } from "./audio-engine.ts";
import { decodedPeakLayers, normalizeSeekMs } from "../services/api.ts";

test("previewEngine initializes in paused state", () => {
  const state = previewEngine.getState();
  assert.equal(state.isPlaying, false);
  assert.equal(state.positionMs, 0);
  assert.ok(state.volume > 0);
});

test("previewEngine loadTrack sets duration and resets position", async () => {
  await previewEngine.loadTrack(300000, 128);
  const state = previewEngine.getState();
  assert.equal(state.durationMs, 300000);
  assert.equal(state.positionMs, 0);
  assert.equal(state.isPlaying, false);
});

test("previewEngine seek updates position within bounds", async () => {
  await previewEngine.loadTrack(200000, 120);
  previewEngine.seek(50000);
  assert.equal(previewEngine.getState().positionMs, 50000);

  // Exceeds bounds
  previewEngine.seek(999999);
  assert.equal(previewEngine.getState().positionMs, 200000);

  previewEngine.seek(-1000);
  assert.equal(previewEngine.getState().positionMs, 0);
});

test("previewEngine jumpBeats advances position based on BPM", async () => {
  await previewEngine.loadTrack(200000, 120); // 120 bpm = 500ms per beat
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

test("previewEngine stop rewinds so the next play starts at the beginning", async () => {
  await previewEngine.loadTrack(200000, 120);
  previewEngine.seek(90000);
  previewEngine.stop();
  const state = previewEngine.getState();
  assert.equal(state.positionMs, 0);
  assert.equal(state.isPlaying, false);
});

test("shouldRewindToStart only rewinds a finished transport", () => {
  assert.equal(shouldRewindToStart(0, 1000), false);
  assert.equal(shouldRewindToStart(999, 1000), false);
  assert.equal(shouldRewindToStart(1000, 1000), true);
  assert.equal(shouldRewindToStart(5000, 1000), true);
  assert.equal(shouldRewindToStart(0, 0), false);
});

test("normalizeSeekMs rounds and clamps the u64 seek payload", () => {
  assert.equal(normalizeSeekMs(1234.6), 1235);
  assert.equal(normalizeSeekMs(-250.4), 0);
  assert.equal(normalizeSeekMs(0), 0);
  assert.equal(normalizeSeekMs(Number.NaN), null);
  assert.equal(normalizeSeekMs(Number.POSITIVE_INFINITY), null);
  assert.equal(normalizeSeekMs(Number.NEGATIVE_INFINITY), null);
});

test("decodedPeakLayers gives the overview rail its own buffer", () => {
  // T2.4.1: the overview layer must never read the detail buffer — separate
  // arrays, its own clamping, its own length.
  const layers = decodedPeakLayers([0.5, 2, -1, Number.NaN, 0.25], [0.75, -1, Number.NaN]);
  assert.deepEqual(Array.from(layers.overviewPeaks), [0.75, 0, 0]);
  assert.equal(layers.overviewPeaks.length, 3);
  assert.notEqual(layers.overviewPeaks, layers.peaks);
});

test("decodedPeakLayers keeps decoded peaks and drops the synthetic bands", () => {
  const layers = decodedPeakLayers([0.5, 2, -1, Number.NaN, 0.25], []);
  assert.equal(layers.isEstimated, false);
  assert.equal(layers.peaks.length, 5);
  // Out-of-range and non-finite samples are clamped into 0..1.
  assert.deepEqual(Array.from(layers.peaks), [0.5, 1, 0, 0, 0.25]);
  // DetailedWaveform indexes every band with peaks.length, so each band has to
  // match the decoded length; zero-filled bands render as a body-only waveform
  // instead of stretching synthetic band energy over the real peaks.
  for (const band of [layers.lowPeaks, layers.midPeaks, layers.highPeaks]) {
    assert.equal(band.length, layers.peaks.length);
    assert.ok(band.every((value) => value === 0));
  }
});
