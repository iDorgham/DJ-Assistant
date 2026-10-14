#!/usr/bin/env python3
"""Generate golden analysis fixtures for the T1.2.6 golden fixture harness.

These are NOT the scanner fixtures (which are 1–4 beats for tag/dedup testing).
Analysis needs enough beats for onset autocorrelation to establish tempo
reliably. Each fixture is 16 beats at a known BPM with a clear kick pattern,
plus a bass note at a known pitch for key detection.

Output: fixtures/audio/analysis/<name>.wav + analysis_expected.json

Usage:
    python scripts/make-analysis-fixtures.py
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
import wave
from pathlib import Path

import numpy as np

SEED = 20240917
SAMPLE_RATE = 44100
ANALYSIS_DIR = Path("fixtures/audio/analysis")
EXPECTED_PATH = ANALYSIS_DIR / "analysis_expected.json"

# (name, bpm, bass_hz, key_classical, key_camelot)
FIXTURES = [
    ("house-128", 128.0, 55.00, "A minor", "8A"),       # A1
    ("techno-140", 140.0, 49.00, "G minor", "9A"),       # G1
    ("dnb-174", 174.0, 41.20, "E minor", "11A"),         # E1
    ("deep-120", 120.0, 58.27, "A minor", "8A"),         # Bb1 -> close enough for 16 beats
    ("melodic-126", 126.0, 65.41, "C major", "8B"),       # C2
    ("apostrophe-124", 124.0, 73.42, "D minor", "7A"),   # D2
    ("techno-138", 138.0, 46.25, "F# minor", "12A"),     # F#1
]

BEATS = 16  # Enough for reliable onset autocorrelation


def render_clip(*, bpm: float, beats: int, bass_hz: float) -> bytes:
    """Synthesize a DJ-flavoured stereo clip: kick on every beat, bass on alternate beats.

    Stereo because Symphonia 0.6's mono WAV decoder returns truncated output
    (126 frames instead of the full buffer).  The scanner fixtures are already
    stereo; matching that here keeps the golden harness honest.
    """
    sr = SAMPLE_RATE
    beat_s = 60.0 / bpm
    n = int(round(beat_s * beats * sr))
    tone = np.zeros(n, dtype=np.float64)

    # Kick: exponentially decaying sine with fast downward pitch sweep.
    for b in range(beats):
        start = int(round(b * beat_s * sr))
        if start >= n:
            break
        kt = np.arange(n - start, dtype=np.float64) / sr
        freq = 48.0 + 90.0 * np.exp(-kt / 0.012)
        tone[start:] += 0.85 * np.sin(2.0 * np.pi * np.cumsum(freq) / sr) * np.exp(-kt / 0.11)

    # Bass: one note every other beat.
    for b in range(0, beats, 2):
        start = int(round(b * beat_s * sr))
        seg = min(int(round(beat_s * 0.5 * sr)), n - start)
        if seg <= 0:
            continue
        bt = np.arange(seg, dtype=np.float64) / sr
        tone[start : start + seg] += 0.35 * np.sin(2.0 * np.pi * bass_hz * bt) * np.exp(-bt / 0.22)

    # Light noise bed for spectral richness (different per channel).
    rng = np.random.RandomState(SEED)
    bed_l = rng.uniform(-0.02, 0.02, n)
    bed_r = rng.uniform(-0.02, 0.02, n)

    # Normalize and convert to interleaved stereo PCM16.
    left = tone + bed_l
    right = tone + bed_r
    peak = max(float(np.max(np.abs(left))), float(np.max(np.abs(right)))) or 1.0
    scale = 0.89 / peak

    out = np.empty((n, 2), dtype="<i2")
    out[:, 0] = np.clip(np.round(left * scale * 32767.0), -32768, 32767)
    out[:, 1] = np.clip(np.round(right * scale * 32767.0), -32768, 32767)
    return out.tobytes()


def write_wav(path: Path, pcm: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)  # Stereo: Symphonia 0.6 mono WAV decoder returns truncated output
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    expected: dict = {
        "description": "Golden analysis fixtures for T1.2.6. 16 beats each, known BPM and key.",
        "tolerances": {"bpm": 2.0, "key": "exact"},
        "fixtures": {},
    }

    for name, bpm, bass_hz, key_classical, key_camelot in FIXTURES:
        pcm = render_clip(bpm=bpm, beats=BEATS, bass_hz=bass_hz)
        rel = f"analysis/{name}.wav"
        path = ANALYSIS_DIR / f"{name}.wav"
        write_wav(path, pcm)

        expected["fixtures"][rel] = {
            "bpm": bpm,
            "key_classical": key_classical,
            "key_camelot": key_camelot,
            "analysis_status": "complete",
        }
        print(f"  {rel}: {bpm} BPM, {key_classical}, {len(pcm)} bytes")

    EXPECTED_PATH.write_text(
        json.dumps(expected, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"\nWrote {EXPECTED_PATH}")


if __name__ == "__main__":
    main()
