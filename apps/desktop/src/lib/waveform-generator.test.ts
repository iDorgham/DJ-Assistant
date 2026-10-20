import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getOrGenerateWaveform,
  formatTimecode,
  formatBarBeat,
  createDefaultHotCues,
  CDJ_CUE_COLORS,
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

test("getOrGenerateWaveform produces normalized peaks and phrase regions", () => {
  const data = getOrGenerateWaveform("test-track-1", 240000, 126);
  assert.equal(data.trackId, "test-track-1");
  assert.equal(data.durationMs, 240000);
  assert.equal(data.bpm, 126);
  assert.equal(data.peaks.length, 1200);
  assert.equal(data.lowPeaks.length, 1200);
  assert.equal(data.midPeaks.length, 1200);
  assert.equal(data.highPeaks.length, 1200);
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
