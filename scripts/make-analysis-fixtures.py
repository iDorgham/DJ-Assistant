#!/usr/bin/env python3
"""Generate golden analysis fixtures for the TA.6 golden fixture harness.

These are NOT the scanner fixtures (which are 1-4 beats for tag/dedup testing).
Analysis needs enough beats for onset autocorrelation to establish tempo
reliably. Full-length fixtures use 64-128 beats; short fixtures use 16 beats
and are kept only for `needs_review` regression testing.

Synthesis design (calibrated against pipeline internals):
  BPM layer:
    - Click kick: 800 Hz, 5 ms decay, 20 ms burst — mirrors click_track() in the
      BPM detector's own unit tests. Amplitude 0.85.
    - Sub-bass thump: 55→35 Hz sweep, 60 ms decay, amplitude 0.50.
    - These two are the DOMINANT spectral-flux events; the bass layer is kept quiet
      so it does not pollute the onset envelope between beats.

  Key layer:
    - Sustained bass tone: root note every other beat, amplitude 0.08.
    - The key detector uses an 8192-point Hann-windowed FFT (bin ≈ 5.4 Hz) and
      aggregates chroma over the whole track, so even a quiet bass tone produces a
      clear dominant pitch class after 64+ beats.

  Noise:
    - Light white noise bed ±0.02 for spectral richness.

Output:
  fixtures/audio/analysis/<name>.wav           (50 full-length fixtures)
  fixtures/audio/analysis/short/<name>.wav     (7 short fixtures)
  fixtures/audio/analysis/analysis_expected.json

Usage:
    py -3.12 scripts/make-analysis-fixtures.py
"""
from __future__ import annotations

import json
import math
import wave
from pathlib import Path

import numpy as np

SEED = 20240917
SAMPLE_RATE = 44100
ANALYSIS_DIR = Path("fixtures/audio/analysis")
SHORT_DIR = ANALYSIS_DIR / "short"
EXPECTED_PATH = ANALYSIS_DIR / "analysis_expected.json"

# Bass root frequencies at octave 2 (standard_hz / 2):
# C2=65.41, Db2=69.30, D2=73.42, Eb2=77.78, E2=82.41, F2=87.31
# F#2=92.50, G2=98.00, Ab2=103.83, A2=110.00, Bb2=116.54, B2=123.47

# (name, bpm, bass_hz, key_classical, key_camelot, beats)
FIXTURES = [
    # --- 24 Camelot key slots, one fixture each ---
    # Minor keys (xA)
    ("afro-1a-128",     128.0, 103.83, "Ab minor",  "1A",  64),
    ("deep-2a-122",     122.0,  77.78, "Eb minor",  "2A",  64),
    ("house-3a-124",    124.0, 116.54, "Bb minor",  "3A",  64),
    ("minimal-4a-126",  126.0,  87.31, "F minor",   "4A",  64),
    ("techno-5a-132",   132.0,  65.41, "C minor",   "5A",  64),
    ("house-6a-125",    125.0,  98.00, "G minor",   "6A",  64),
    ("melodic-7a-124",  124.0,  73.42, "D minor",   "7A",  64),
    ("house-8a-128",    128.0, 110.00, "A minor",   "8A",  64),
    ("techno-9a-135",   135.0,  82.41, "E minor",   "9A",  64),
    ("techno-10a-138",  138.0, 123.47, "B minor",   "10A", 64),
    ("dnb-11a-174",     174.0,  92.50, "F# minor",  "11A", 64),
    ("dark-12a-140",    140.0,  69.30, "Db minor",  "12A", 64),
    # Major keys (xB)
    ("trance-1b-138",   138.0, 123.47, "B major",   "1B",  64),
    ("deep-2b-122",     122.0,  92.50, "F# major",  "2B",  64),
    ("afro-3b-124",     124.0,  69.30, "Db major",  "3B",  64),
    ("house-4b-126",    126.0, 103.83, "Ab major",  "4B",  64),
    ("melodic-5b-130",  130.0,  77.78, "Eb major",  "5B",  64),
    ("disco-6b-120",    120.0, 116.54, "Bb major",  "6B",  64),
    ("house-7b-125",    125.0,  87.31, "F major",   "7B",  64),
    ("house-8b-128",    128.0,  65.41, "C major",   "8B",  64),
    ("pop-9b-120",      120.0,  98.00, "G major",   "9B",  64),
    ("country-10b-118", 118.0,  73.42, "D major",   "10B", 64),
    ("rock-11b-130",    130.0, 110.00, "A major",   "11B", 64),
    ("trance-12b-138",  138.0,  82.41, "E major",   "12B", 64),
    # --- 26 additional fixtures (genre/bpm variety) ---
    ("techno-5a-136",   136.0,  65.41, "C minor",   "5A",  96),
    ("techno-9a-140",   140.0,  82.41, "E minor",   "9A",  96),
    ("house-8a-126",    126.0, 110.00, "A minor",   "8A",  96),
    ("house-8b-124",    124.0,  65.41, "C major",   "8B",  96),
    ("dnb-11a-170",     170.0,  92.50, "F# minor",  "11A", 96),
    ("dnb-9a-175",      175.0,  82.41, "E minor",   "9A",  96),
    ("melodic-7a-122",  122.0,  73.42, "D minor",   "7A",  96),
    ("melodic-5b-128",  128.0,  77.78, "Eb major",  "5B",  96),
    ("deep-6a-122",     122.0,  98.00, "G minor",   "6A",  96),
    ("deep-10b-118",    118.0,  73.42, "D major",   "10B", 96),
    ("techno-12a-142",  142.0,  69.30, "Db minor",  "12A", 96),
    ("hard-5a-145",     145.0,  65.41, "C minor",   "5A",  96),
    ("industrial-12a-150", 150.0, 69.30, "Db minor","12A", 96),
    ("peak-8a-132",     132.0, 110.00, "A minor",   "8A",  96),
    ("peak-8b-132",     132.0,  65.41, "C major",   "8B",  96),
    ("tech-house-6b-126", 126.0, 116.54, "Bb major","6B",  96),
    ("tech-house-7b-127", 127.0,  87.31, "F major",  "7B",  96),
    ("trance-1a-138",   138.0, 103.83, "Ab minor",  "1A",  96),
    ("prog-2a-130",     130.0,  77.78, "Eb minor",  "2A",  96),
    ("prog-3a-130",     130.0, 116.54, "Bb minor",  "3A",  96),
    ("afro-4a-124",     124.0,  87.31, "F minor",   "4A",  96),
    ("minimal-3b-120",  120.0,  69.30, "Db major",  "3B",  96),
    ("tribal-4b-125",   125.0, 103.83, "Ab major",  "4B",  96),
    ("slow-9b-105",     105.0,  98.00, "G major",   "9B",  96),
    ("slow-11b-100",    100.0, 110.00, "A major",   "11B", 96),
    ("fast-dnb-1a-180", 180.0, 103.83, "Ab minor",  "1A",  128),
]

# Short fixtures (kept for needs_review regression tests)
SHORT_FIXTURES = [
    ("house-128",      128.0,  55.00, "A minor",   "8A"),
    ("techno-140",     140.0,  49.00, "G minor",   "9A"),
    ("dnb-174",        174.0,  41.20, "E minor",   "11A"),
    ("deep-120",       120.0,  58.27, "A minor",   "8A"),
    ("melodic-126",    126.0,  65.41, "C major",   "8B"),
    ("apostrophe-124", 124.0,  73.42, "D minor",   "7A"),
    ("techno-138",     138.0,  46.25, "F# minor",  "12A"),
]
SHORT_BEATS = 16

# ----- Synthesis constants (calibrated against pipeline internals) -----
# Click kick parameters (matching click_track() in BPM unit tests)
CLICK_AMP     = 0.85   # 800 Hz burst amplitude
CLICK_FREQ_HZ = 800.0  # Matches BPM unit test click_track
CLICK_TAU_S   = 0.005  # 5 ms decay
CLICK_DUR_S   = 0.020  # 20 ms burst

# Sub-bass kick thump (low-end presence; won't dominate onset flux)
SUB_AMP   = 0.50   # below click but audible
SUB_TAU_S = 0.060  # 60 ms decay

# Bass tone (for key detection — quiet to avoid polluting onset envelope)
# Key detector uses 8192-point FFT → even amplitude 0.08 over 30s tracks = clear chroma
BASS_AMP      = 0.08   # LOW — must not dominate spectral flux between beats
BASS_DUR_FRAC = 1.80   # hold bass for 1.8 beat durations (crosses into next beat window)
BASS_TAU_S    = 0.80   # slow release for sustained chroma

# Noise bed
NOISE_AMP = 0.02


def render_clip(*, bpm: float, beats: int, bass_hz: float) -> bytes:
    """Synthesize a DJ-flavoured stereo clip.

    Two separate layers:
      1. Sharp click-kick on every beat (drives BPM onset detector)
      2. Very quiet sustained bass tone (drives key chroma detector)

    Stereo because Symphonia 0.6's mono WAV decoder returns truncated output.
    """
    sr = SAMPLE_RATE
    beat_s = 60.0 / bpm
    n = int(round(beat_s * beats * sr))

    tone = np.zeros(n, dtype=np.float64)

    burst_samples = int(round(CLICK_DUR_S * sr))
    bt_burst = np.arange(burst_samples, dtype=np.float64) / sr

    # Pre-compute click burst shape: 800 Hz, fast (5 ms) decay
    click_env = np.exp(-bt_burst / CLICK_TAU_S)
    click_sig = CLICK_AMP * np.sin(2.0 * np.pi * CLICK_FREQ_HZ * bt_burst) * click_env

    # Pre-compute sub-bass thump: pitch sweep 55→35 Hz, 60 ms decay
    sub_env  = np.exp(-bt_burst / SUB_TAU_S)
    sub_freq = 55.0 + 20.0 * np.exp(-bt_burst / 0.010)
    sub_phase = np.cumsum(sub_freq) / sr
    sub_sig  = SUB_AMP * np.sin(2.0 * np.pi * sub_phase) * sub_env

    kick_sig = click_sig + sub_sig

    # Layer 1: click-kick on every beat
    for b in range(beats):
        start = int(round(b * beat_s * sr))
        end   = min(start + burst_samples, n)
        seg   = end - start
        if seg <= 0:
            break
        tone[start:end] += kick_sig[:seg]

    # Layer 2: quiet bass tone every other beat (key detection)
    for b in range(0, beats, 2):
        start = int(round(b * beat_s * sr))
        seg   = min(int(round(beat_s * BASS_DUR_FRAC * sr)), n - start)
        if seg <= 0:
            continue
        bt = np.arange(seg, dtype=np.float64) / sr
        env  = np.exp(-bt / BASS_TAU_S)
        # Fundamental only (clean pitch class signal for chroma)
        tone[start : start + seg] += BASS_AMP * np.sin(2.0 * np.pi * bass_hz * bt) * env

    # Light noise bed (different per channel)
    rng   = np.random.RandomState(SEED)
    bed_l = rng.uniform(-NOISE_AMP, NOISE_AMP, n)
    bed_r = rng.uniform(-NOISE_AMP, NOISE_AMP, n)

    # Normalize and convert to interleaved stereo PCM16
    left  = tone + bed_l
    right = tone + bed_r
    peak  = max(float(np.max(np.abs(left))), float(np.max(np.abs(right)))) or 1.0
    scale = 0.89 / peak
    out   = np.empty((n, 2), dtype="<i2")
    out[:, 0] = np.clip(np.round(left  * scale * 32767.0), -32768, 32767)
    out[:, 1] = np.clip(np.round(right * scale * 32767.0), -32768, 32767)
    return out.tobytes()


def write_wav(path: Path, pcm: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)   # Stereo: Symphonia 0.6 mono WAV decoder returns truncated output
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)


def main() -> None:
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    SHORT_DIR.mkdir(parents=True, exist_ok=True)

    expected: dict = {
        "description": (
            "Golden analysis fixtures for TA.6. "
            "Full fixtures: 64-128 beats, all 24 Camelot keys. "
            "Short fixtures: 16 beats, kept in analysis/short/ for needs_review regression."
        ),
        "tolerances": {"bpm": 2.0, "key": "exact"},
        "fixtures": {},
    }

    full_count = 0
    short_count = 0

    # --- Full-length fixtures (complete status) ---
    print(f"\nGenerating {len(FIXTURES)} full-length fixtures...")
    for name, bpm, bass_hz, key_classical, key_camelot, beats in FIXTURES:
        rel  = f"analysis/{name}.wav"
        path = ANALYSIS_DIR / f"{name}.wav"
        pcm = render_clip(bpm=bpm, beats=beats, bass_hz=bass_hz)
        write_wav(path, pcm)
        duration_s = (len(pcm) // 4) / SAMPLE_RATE
        print(f"  {rel}: {bpm} BPM  {key_camelot} ({key_classical})  {beats} beats  {duration_s:.1f}s")
        expected["fixtures"][rel] = {
            "bpm":           bpm,
            "key_classical": key_classical,
            "key_camelot":   key_camelot,
            "analysis_status": "complete",
        }
        full_count += 1

    # --- Short fixtures (needs_review status) ---
    print(f"\nGenerating {len(SHORT_FIXTURES)} short fixtures in analysis/short/...")
    for name, bpm, bass_hz, key_classical, key_camelot in SHORT_FIXTURES:
        rel  = f"analysis/short/{name}.wav"
        path = SHORT_DIR / f"{name}.wav"
        pcm  = render_clip(bpm=bpm, beats=SHORT_BEATS, bass_hz=bass_hz)
        write_wav(path, pcm)
        duration_s = (len(pcm) // 4) / SAMPLE_RATE
        print(f"  {rel}: {bpm} BPM  {key_camelot} ({key_classical})  {SHORT_BEATS} beats  {duration_s:.1f}s  -> needs_review")
        expected["fixtures"][rel] = {
            "analysis_status": "needs_review",
        }
        short_count += 1

    EXPECTED_PATH.write_text(
        json.dumps(expected, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(f"\n{'=' * 60}")
    print(f"Wrote {EXPECTED_PATH}")
    print(f"Full fixtures (complete):       {full_count}")
    print(f"Short fixtures (needs_review):  {short_count}")
    print(f"Total entries in manifest:      {full_count + short_count}")


if __name__ == "__main__":
    main()
