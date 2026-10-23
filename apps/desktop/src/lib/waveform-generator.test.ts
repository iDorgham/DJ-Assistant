import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getOrGenerateWaveform,
  formatTimecode,
  formatBarBeat,
  getBeatPosition,
  createDefaultHotCues,
  CDJ_CUE_COLORS,
  clampZoomLevel,
  DEFAULT_ZOOM_LEVEL,
  getFollowViewOffset,
  snapToGrid,
} from "./waveform-generator.ts";

test("formatTimecode formats minutes and seconds correctly", () => {
  assert.equal(formatTimecode(0), "0:00");
  assert.equal(formatTimecode(65000), "1:05");
  assert.equal(formatTimecode(222000), "3:42");
  assert.equal(formatTimecode(378000), "6:18");
  assert.equal(formatTimecode(222340, true), "3:42.34");
  assert.equal(formatTimecode(-50), "0:00");
  assert.equal(formatTimecode(NaN), "0:00");
});

test("formatBarBeat computes bar and beat accurately", () => {
  // 120 bpm -> 500ms per beat, 2000ms per bar
  assert.equal(formatBarBeat(0, 120), "Bar 1.1");
  assert.equal(formatBarBeat(500, 120), "Bar 1.2");
  assert.equal(formatBarBeat(1000, 120), "Bar 1.3");
  assert.equal(formatBarBeat(1500, 120), "Bar 1.4");
  assert.equal(formatBarBeat(2000, 120), "Bar 2.1");
  assert.equal(formatBarBeat(4000, 120), "Bar 3.1");
});

test("getBeatPosition returns zero-based beat index and intra-beat phase", () => {
  assert.deepEqual(getBeatPosition(0, 120), { bar: 1, beat: 1, beatIndex: 0, phase: 0 });
  assert.deepEqual(getBeatPosition(1250, 120), {
    bar: 1,
    beat: 3,
    beatIndex: 2,
    phase: 0.5,
  });
  assert.deepEqual(getBeatPosition(2000, 120), { bar: 2, beat: 1, beatIndex: 4, phase: 0 });
  // A positive grid offset shifts the first downbeat later.
  assert.equal(getBeatPosition(1100, 120, 500).beat, 2);
});

test("getOrGenerateWaveform produces normalized peaks and phrase regions", () => {
  const data = getOrGenerateWaveform("test-track-1", 240000, 126);
  assert.equal(data.trackId, "test-track-1");
  assert.equal(data.durationMs, 240000);
  assert.equal(data.bpm, 126);
  assert.equal(data.peaks.length, 16000);
  assert.equal(data.lowPeaks.length, 16000);
  assert.equal(data.midPeaks.length, 16000);
  assert.equal(data.highPeaks.length, 16000);
  assert.ok(data.phrases.length >= 4);

  // Check peaks are strictly in [0.0, 1.0]
  for (let i = 0; i < data.peaks.length; i++) {
    const p = data.peaks[i]!;
    assert.ok(p >= 0 && p <= 1.0, `Peak at ${i} should be between 0 and 1, got ${p}`);
  }
});

test("createDefaultHotCues generates 8 cues with CDJ colors", () => {
  const cues = createDefaultHotCues(300000, 124);
  assert.equal(cues.length, 8);
  assert.equal(cues[0]?.letter, "A");
  assert.equal(cues[7]?.letter, "H");
  assert.equal(cues[0]?.colorHex, CDJ_CUE_COLORS[0]);
  assert.equal(cues[0]?.positionMs, 0);
  assert.ok(cues[1]?.positionMs !== null);
  assert.ok(cues[2]?.positionMs !== null);
  assert.ok(cues[3]?.positionMs !== null);
  assert.equal(cues[4]?.positionMs, null); // E is empty
  assert.equal(cues[5]?.positionMs, null); // F is empty
});

test("clampZoomLevel keeps zoom inside 1×–16×", () => {
  assert.equal(DEFAULT_ZOOM_LEVEL, 8);
  assert.equal(clampZoomLevel(8), 8);
  assert.equal(clampZoomLevel(0.5), 1);
  assert.equal(clampZoomLevel(32), 16);
  assert.equal(clampZoomLevel(NaN), 1);
});

test("getFollowViewOffset centres the playhead and returns 0 at Fit", () => {
  // 5:00 track at 8× → 37.5s visible, so the window starts 18.75s before the head.
  assert.equal(getFollowViewOffset(150000, 300000, 8), 131250);
  // Fit shows the whole track from zero.
  assert.equal(getFollowViewOffset(150000, 300000, 1), 0);
  // The left half is allowed to be blank before the first sample.
  assert.equal(getFollowViewOffset(0, 300000, 8), -18750);
  // A missing duration still produces a finite window.
  assert.equal(getFollowViewOffset(60000, 0, 8), 48750);
});

test("snapToGrid rounds seeks to the nearest beat or bar", () => {
  // 120 BPM → 500ms per beat, 2000ms per bar.
  assert.equal(snapToGrid(260, 120, 0, "beat", 300000), 500);
  assert.equal(snapToGrid(200, 120, 0, "beat", 300000), 0);
  assert.equal(snapToGrid(1100, 120, 0, "bar", 300000), 2000);
  assert.equal(snapToGrid(900, 120, 0, "bar", 300000), 0);
  // A grid offset shifts the snap targets.
  assert.equal(snapToGrid(600, 120, 250, "beat", 300000), 750);
  // Off leaves the target alone, and every result stays inside the track.
  assert.equal(snapToGrid(333, 120, 0, "off", 300000), 333);
  assert.equal(snapToGrid(300001, 120, 0, "beat", 300000), 300000);
  assert.equal(snapToGrid(-50, 120, 0, "bar", 300000), 0);
  // Without a usable tempo the requested position is returned.
  assert.equal(snapToGrid(1234, 0, 0, "beat", 300000), 1234);
});
