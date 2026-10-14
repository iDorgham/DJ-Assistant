#!/usr/bin/env python3
"""Debug onset detection for a WAV fixture."""
import wave
import struct
import numpy as np
import math

fname = "fixtures/audio/analysis/house-8b-128.wav"
with wave.open(fname, "rb") as w:
    rate = w.getframerate()
    nframes = w.getnframes()
    data = w.readframes(nframes)

# Left channel (interleaved stereo)
samples = np.array(
    [struct.unpack_from("<h", data, i)[0] / 32768.0 for i in range(0, len(data), 4)],
    dtype=np.float32,
)

# Peak normalize to 0.9
peak = np.max(np.abs(samples))
samples = samples * (0.9 / peak)

frame_size = 1024
hop_size = 512
n = len(samples)
num_frames = (n - frame_size) // hop_size + 1
frame_rate = rate / hop_size

env = []
fft_prev = None
for i in range(num_frames):
    frame = np.zeros(frame_size, dtype=np.float32)
    seg = min(frame_size, n - i * hop_size)
    frame[:seg] = samples[i * hop_size : i * hop_size + seg]
    spec = np.abs(np.fft.rfft(frame))
    if fft_prev is None:
        env.append(np.sum(spec))
    else:
        flux = np.sum(np.maximum(spec - fft_prev, 0))
        env.append(flux)
    fft_prev = spec

env = np.array(env)
mean = np.mean(env)
std = np.std(env)
env_z = (env - mean) / std if std > 1e-6 else env - mean

env_max = float(np.max(env_z))
threshold = env_max * 0.2
print(f"env_max={env_max:.3f}, threshold={threshold:.3f}")

# Find onset peaks
peaks = []
for i in range(len(env_z)):
    v = env_z[i]
    left = env_z[i - 1] if i > 0 else float("-inf")
    right = env_z[i + 1] if i + 1 < len(env_z) else float("-inf")
    if v > threshold and v >= left and v > right:
        peaks.append(i)

print(f"Total onset peaks: {len(peaks)}")

beat_period = frame_rate / (128.0 / 60.0)  # frames per beat
print(f"Beat period at 128 BPM: {beat_period:.1f} frames")
tol = beat_period * 0.25

aligned = 0
beat_pos = 0.0
while beat_pos < len(env_z):
    tick = round(beat_pos)
    near = [p for p in peaks if abs(p - tick) <= tol]
    if near:
        aligned += 1
    beat_pos += beat_period

total_beats = round(len(env_z) / beat_period)
print(f"Aligned {aligned}/{total_beats} beats at 128 BPM, tol={tol:.1f} frames")

# Show first 10 peaks and expected beat positions
print("\nFirst 10 peaks:")
for p in peaks[:10]:
    print(f"  frame {p} = {p/frame_rate:.3f}s")
print("\nExpected beat times at 128 BPM:")
for i in range(10):
    print(f"  beat {i} = {i * 60/128:.3f}s = frame {i * 60/128 * frame_rate:.1f}")

# Autocorrelation debug
min_period = int(math.floor(60.0 / 200.0 * frame_rate))
max_period = int(math.ceil(60.0 / 60.0 * frame_rate))
print(f"\nAutocorr range: lags {min_period}..{max_period} ({200:.0f}..{60:.0f} BPM)")

best_lag = min_period
best_val = float("-inf")
for lag in range(min_period, min(max_period + 1, len(env_z))):
    m = len(env_z) - lag
    ac = float(np.dot(env_z[:m], env_z[lag : lag + m]))
    if ac > best_val:
        best_val = ac
        best_lag = lag

best_bpm_raw = 60.0 * frame_rate / best_lag
print(f"Best lag: {best_lag} = {best_bpm_raw:.1f} BPM, val={best_val:.3f}")
print(f"Candidates (x0.5, x1, x2): {best_bpm_raw*0.5:.1f}, {best_bpm_raw:.1f}, {best_bpm_raw*2:.1f} BPM")

# Check autocorr at specific lags
for test_bpm in [64.0, 128.0, 64.6, 129.2]:
    lag = int(round(60.0 * frame_rate / test_bpm))
    if lag < len(env_z):
        m = len(env_z) - lag
        ac = float(np.dot(env_z[:m], env_z[lag : lag + m]))
        print(f"  autocorr at lag={lag} ({test_bpm:.1f} BPM): {ac:.3f}")
