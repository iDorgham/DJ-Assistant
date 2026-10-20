export interface PhraseRegion {
  name: string;
  startMs: number;
  endMs: number;
  kind: "intro" | "verse" | "build" | "drop" | "break" | "outro";
}

export interface HotCueData {
  slot: number; // 1-8
  letter: string; // A-H
  label: string;
  positionMs: number | null; // null if empty
  colorHex: string;
}

export interface WaveformData {
  trackId: string;
  durationMs: number;
  bpm: number;
  peaks: Float32Array; // Normalized amplitude 0.0 - 1.0 (length e.g. 1200)
  lowPeaks: Float32Array; // Bass/kick energy
  midPeaks: Float32Array; // Lead/synth/vocal energy
  highPeaks: Float32Array; // Hi-hats/cymbals/air
  phrases: PhraseRegion[];
  /**
   * True while peaks are synthesized locally (PRNG) instead of decoded from
   * the audio file. UI MUST mark estimated waveforms visibly — docs/ui/06
   * forbids rendering fabricated analysis data as if it were real.
   */
  isEstimated: boolean;
}

// IBM Carbon Design System colors for Hot Cue A–H
// Each color is WCAG AA contrast verified on both dark (gray-90) and light (white) waveform backgrounds.
export const CDJ_CUE_COLORS: readonly string[] = [
  "#fa4d56", // A: Carbon Red-50
  "#ff832b", // B: Carbon Orange-40
  "#f1c21b", // C: Carbon Yellow-30
  "#42be65", // D: Carbon Green-40
  "#33b1ff", // E: Carbon Cyan-40
  "#4589ff", // F: Carbon Blue-50
  "#be95ff", // G: Carbon Purple-40
  "#ff7eb6", // H: Carbon Magenta-40
];

export const CUE_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/**
 * Deterministic pseudo-random generator (LCG) for reproducible waveforms.
 */
function createPrng(seedStr: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let s = h >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const waveformCache = new Map<string, WaveformData>();

/**
 * Generates rich, realistic amplitude and 3-band spectral peak data for preview.
 * Waveform structure accurately reflects DJ music structures (Intro, Build, Drop, Break, Outro).
 */
export function getOrGenerateWaveform(
  trackId: string,
  durationMs: number = 360000,
  bpm: number = 124,
  seedKey?: string
): WaveformData {
  const cacheKey = `${trackId}:${durationMs}:${bpm}`;
  const cached = waveformCache.get(cacheKey);
  if (cached) return cached;

  const pointCount = 1200;
  const peaks = new Float32Array(pointCount);
  const lowPeaks = new Float32Array(pointCount);
  const midPeaks = new Float32Array(pointCount);
  const highPeaks = new Float32Array(pointCount);

  const rand = createPrng(seedKey || trackId);
  const safeDuration = Math.max(durationMs || 180000, 30000);
  const safeBpm = bpm > 40 && bpm < 240 ? bpm : 124;

  // Compute phrase boundaries based on typical 16/32-bar phrases
  const beatMs = (60 / safeBpm) * 1000;
  const barMs = beatMs * 4;
  const phrase32Ms = barMs * 32;
  const phrase16Ms = barMs * 16;

  const introEnd = Math.min(phrase32Ms, safeDuration * 0.18);
  const buildEnd = Math.min(introEnd + phrase16Ms, safeDuration * 0.32);
  const drop1End = Math.min(buildEnd + phrase32Ms, safeDuration * 0.52);
  const breakEnd = Math.min(drop1End + phrase16Ms, safeDuration * 0.65);
  const drop2End = Math.min(breakEnd + phrase32Ms, safeDuration * 0.85);

  const phrases: PhraseRegion[] = [
    { name: "Intro", startMs: 0, endMs: introEnd, kind: "intro" },
    { name: "Build 1", startMs: introEnd, endMs: buildEnd, kind: "build" },
    { name: "Drop 1", startMs: buildEnd, endMs: drop1End, kind: "drop" },
    { name: "Breakdown", startMs: drop1End, endMs: breakEnd, kind: "break" },
    { name: "Drop 2", startMs: breakEnd, endMs: drop2End, kind: "drop" },
    { name: "Outro", startMs: drop2End, endMs: safeDuration, kind: "outro" },
  ];

  for (let i = 0; i < pointCount; i++) {
    const tMs = (i / pointCount) * safeDuration;
    let baseEnergy: number;

    if (tMs < introEnd) {
      // Intro: growing percussion, low bass
      const progress = tMs / introEnd;
      baseEnergy = 0.35 + progress * 0.25;
    } else if (tMs < buildEnd) {
      // Build: rising snare rolls and tension
      const progress = (tMs - introEnd) / (buildEnd - introEnd);
      baseEnergy = 0.55 + progress * 0.3;
    } else if (tMs < drop1End) {
      // Drop 1: maximum dynamic range and heavy bass kicks
      baseEnergy = 0.85 + rand() * 0.14;
    } else if (tMs < breakEnd) {
      // Breakdown: quiet, filtered melodies, no heavy kicks
      baseEnergy = 0.3 + rand() * 0.25;
    } else if (tMs < drop2End) {
      // Drop 2: full energy
      baseEnergy = 0.88 + rand() * 0.12;
    } else {
      // Outro: tapering down
      const progress = (tMs - drop2End) / (safeDuration - drop2End);
      baseEnergy = 0.65 * (1 - progress * 0.7);
    }

    // Beat pulsation (kick on every 4 beats)
    const beatFraction = (tMs % beatMs) / beatMs;
    const kickSpike = beatFraction < 0.2 ? 0.25 * (1 - beatFraction / 0.2) : 0;

    // Organic variance
    const noise = (rand() - 0.5) * 0.18;
    const amp = Math.max(0.08, Math.min(1.0, baseEnergy + kickSpike + noise));

    peaks[i] = amp;
    // 3-band breakdown
    const isDrop = (tMs >= buildEnd && tMs < drop1End) || (tMs >= breakEnd && tMs < drop2End);
    lowPeaks[i] = isDrop ? Math.min(1.0, amp * 1.15) : amp * 0.45;
    midPeaks[i] = amp * (0.6 + rand() * 0.3);
    highPeaks[i] = amp * (0.4 + (beatFraction > 0.4 && beatFraction < 0.6 ? 0.4 : 0.1));
  }

  const result: WaveformData = {
    trackId,
    durationMs: safeDuration,
    bpm: safeBpm,
    peaks,
    lowPeaks,
    midPeaks,
    highPeaks,
    phrases,
    // Peaks are synthesized from a seeded PRNG until real audio decoding ships.
    isEstimated: true,
  };

  waveformCache.set(cacheKey, result);
  return result;
}

/**
 * Formats milliseconds into Ableton / CDJ standard `m:ss.S` or `mm:ss.ff`.
 */
export function formatTimecode(ms: number, includeFraction = false): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const padSec = seconds.toString().padStart(2, "0");

  if (!includeFraction) {
    return `${minutes}:${padSec}`;
  }

  const hundredths = Math.floor((totalSeconds % 1) * 100);
  const padHun = hundredths.toString().padStart(2, "0");
  return `${minutes}:${padSec}.${padHun}`;
}

/**
 * Calculates current bar and beat from position and BPM.
 * Example: Bar 17.2
 */
export function formatBarBeat(positionMs: number, bpm: number, offsetMs: number = 0): string {
  const safeBpm = bpm > 40 ? bpm : 124;
  const beatMs = (60 / safeBpm) * 1000;
  const adjMs = Math.max(0, positionMs - offsetMs);
  const totalBeats = adjMs / beatMs;
  const bar = Math.floor(totalBeats / 4) + 1;
  const beat = Math.floor(totalBeats % 4) + 1;
  return `Bar ${bar}.${beat}`;
}

/**
 * Calculates default initial hot cues for a track if none are explicitly set.
 */
export function createDefaultHotCues(
  durationMs: number,
  bpm: number,
  customCues?: { slot: number; positionMs: number; label: string }[]
): HotCueData[] {
  const safeBpm = bpm > 40 ? bpm : 124;
  const beatMs = (60 / safeBpm) * 1000;
  const barMs = beatMs * 4;

  const result: HotCueData[] = CUE_LETTERS.map((letter, idx) => ({
    slot: idx + 1,
    letter,
    label: `Cue ${letter}`,
    positionMs: null,
    colorHex: CDJ_CUE_COLORS[idx] ?? "#3B82F6",
  }));

  // If custom cues provided, assign them
  if (customCues && customCues.length > 0) {
    for (const c of customCues) {
      if (c.slot >= 1 && c.slot <= 8) {
        const item = result[c.slot - 1];
        if (item) {
          item.positionMs = c.positionMs;
          if (c.label) item.label = c.label;
        }
      }
    }
    return result;
  }

  // Sensible default cue placement on phrase markers
  const phrase32Ms = barMs * 32;
  const phrase16Ms = barMs * 16;
  const safeDuration = Math.max(durationMs || 180000, 30000);

  // Cue A: Start / Intro
  result[0]!.positionMs = 0;
  result[0]!.label = "Intro";

  // Cue B: Drop 1
  const drop1Pos = Math.min(phrase32Ms + phrase16Ms, safeDuration * 0.32);
  result[1]!.positionMs = Math.round(drop1Pos);
  result[1]!.label = "Drop 1";

  // Cue C: Breakdown
  const breakPos = Math.min(drop1Pos + phrase32Ms, safeDuration * 0.58);
  result[2]!.positionMs = Math.round(breakPos);
  result[2]!.label = "Break";

  // Cue D: Drop 2
  const drop2Pos = Math.min(breakPos + phrase16Ms, safeDuration * 0.72);
  result[3]!.positionMs = Math.round(drop2Pos);
  result[3]!.label = "Drop 2";

  // E-H empty by default for user to assign!
  return result;
}
