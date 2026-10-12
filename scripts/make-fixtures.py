#!/usr/bin/env python3
"""Generate the deterministic synthetic audio fixture corpus for the DJ library scanner.

Output tree (relative to the repository root, all under ``fixtures/audio/``)::

    wav/tagged-house-128.wav                          stereo PCM16 WAV + ID3v2.4 tags
    wav/no-tags.wav                                   valid PCM16 WAV, no metadata at all
    flac/tagged-techno-140.flac                       FLAC (ffmpeg) + Vorbis comment tags
    aiff/tagged-dnb-174.aiff                          PCM16 big-endian AIFF + ID3 chunk
    mp3/tagged-mp3-125.mp3                            hand-built tags-only MP3 (see NOTE below)
    m4a/tagged-m4a-128.m4a                            PCM-in-MP4 container + MP4 tags (see NOTE below)
    edge/Ünïcodé Ärtîst – Trâck (Extended Mix).wav    UTF-8 filename + UTF-8 tags
    edge/Don't Stop (Original Mix).wav                apostrophe/parentheses filename + tags
    corrupt/truncated.wav                             RIFF header lies about the amount of PCM
    corrupt/garbage.mp3                               4096 pseudo-random bytes, .mp3 extension
    corrupt/zero-bytes.flac                           empty file
    corrupt/header-only.aiff                          FORM/AIFF container with no audio chunks
    unsupported/notes.txt                             valid text; the scanner must skip it
    duplicates/tagged-house-128-copy.wav              byte-identical copy of the tagged WAV
    manifest.json                                     machine-readable description of all of it

Why things are done this way
----------------------------
``ffmpeg`` in this environment is a *minimal* custom build (see ``ffmpeg -version``):
it CAN encode ``pcm_s16le`` (WAV), ``pcm_s16be`` (AIFF) and ``flac``, and it has no
``lavfi`` input device, no ``sox`` and no MP3/AAC/Vorbis/Opus encoder.  Filters are
limited to aformat/anull/atrim/format/null/setpts/trim/aresample, and there is no
``null`` muxer.  Consequences:

* Audio is synthesised in Python (numpy) into interleaved PCM16 and wrapped with the
  stdlib ``wave`` module.  ffmpeg is then used only to *transcode* that WAV into FLAC
  and AIFF, and to *mux* it (still uncompressed) into an MP4/M4A container for the
  M4A fixture.
* The MP3 is built by hand.  No MP3 encoder exists anywhere in this toolchain.

NOTE on the MP3 fixture (read this before writing an assertion against it)
-------------------------------------------------------------------------
``mp3/tagged-mp3-125.mp3`` is **not real music**.  Its audio payload is a few
MPEG-1 Layer III frames with an all-zero (i.e. silent) payload, followed by nothing.
The file exists ONLY to exercise ID3 tag parsing on the MP3 container.  Its bytes are:

* a fixed MPEG-1 Layer III header ``FF FB 90 00`` (128 kbit/s, 44.1 kHz, stereo,
  no CRC), giving a frame length of ``floor(144 * 128000 / 44100) = 417`` bytes;
* ``4`` identical 417-byte frames.  Empirically verified on this machine: a *single*
  frame does not sync at all (mutagen raises ``HeaderNotFoundError: can't sync to
  MPEG frame`` and ffprobe fails with ``Invalid frame size (417): Could not seek to
  417``), because mutagen needs >= 2 frames to accept a stream and >= 4 frames before
  it stops flagging it "sketchy".  4 frames is therefore the smallest payload that
  both mutagen and ffprobe accept, and the declared duration (0.10425 s) is not a real
  frame count but mutagen's/ffprobe's bitrate-based estimate for the file size;
* a mutagen ID3v2.4 tag written with ``mutagen.id3.ID3`` via ``mutagen.mp3.MP3``
  (``add_tags()`` + ``save(v1=0)``, so no ID3v1 block is appended).

Because the payload is dummy, some tag readers -- notably the Rust ``audiotags``
crate -- may report a duration of ``0`` (or an estimated bitrate) for this file.  That
is expected and is not a bug in the fixture.  Use this file to test *tag* handling,
never duration/BPM/key analysis.

NOTE on the M4A fixture (read this before writing an assertion against it)
-------------------------------------------------------------------------
``m4a/tagged-m4a-128.m4a`` is a genuine MPEG-4 Part 14 container (major brand
``M4A ``) whose single audio track is **uncompressed 16-bit PCM**, not AAC/ALAC:
this ffmpeg build has no AAC or ALAC encoder.  MPEG-4 tag readers do not inspect the
codec -- they read the ``moov``/``udta``/``meta``/``ilst`` tag atoms and the ``mvhd``
duration -- so the file exercises the same M4A metadata path as a real AAC ``.m4a``
(mutagen ``mutagen.mp4.MP4`` in this script; ``mp4ameta`` behind the Rust
``audiotags`` crate in the scanner).  Unlike the MP3 fixture its audio is real and
decodable, so duration assertions are safe -- only "is the codec AAC?" is not true.

Determinism
-----------
Every byte is a pure function of the constants below:

* all randomness comes from ``random.Random`` seeded from a SHA-256 of
  ``"<SEED>:<tag>"`` -- the stdlib Mersenne Twister is specified to be stable, whereas
  numpy's ``Generator`` stream is explicitly *not* guaranteed stable between releases;
* every run starts by deleting the directories this script owns, so no stale bytes and
  no reused ID3 padding can leak in;
* ffmpeg is invoked with ``-map_metadata -1`` and, for FLAC, ``-fflags +bitexact
  -flags +bitexact`` so that ffmpeg's version string is not embedded as an ``encoder``
  tag (that tag would otherwise change the file hash when ffmpeg is upgraded);
* ``manifest.json`` contains no timestamps, absolute paths or tool versions, so it is
  byte-stable too.  ``bytes``/``sha256`` in the manifest are still tied to the
  generating toolchain (a different ffmpeg build can produce different FLAC bytes).

The script compares the freshly generated hashes against the previous manifest and
prints a determinism report, so running it twice in a row proves byte-stability.

Manifest contract
-----------------
``fixtures/audio/manifest.json`` is the data contract for
``crates/core/tests/{fixture_manifest,scan_corpus}.rs`` (see ``tests/common/mod.rs`` for
the deserialised shape).  Per file: ``path`` (POSIX, relative to ``fixtures/audio``),
``format``, ``extension``, ``bytes``, ``sha256``, ``supported``, ``readable``,
``corrupt``, ``duplicate_of``, ``expected`` and a human ``note``.  Two conventions
matter when consuming it:

* ``format`` and ``extension`` are lower-case and carry **no leading dot**, mirroring
  ``dj_assistant_core::SUPPORTED_EXTENSIONS`` and ``ExtractedMetadata::format``.  The
  non-audio fixture uses ``format: "text"`` with ``supported: false``.
* ``expected`` values are ``null`` when the value must be absent, so a test can tell
  "no tag" from "tag the generator did not check".  ``expected.duration_seconds`` is
  deliberately ``null`` for ``corrupt/truncated.wav``, where the RIFF header lies and
  mutagen (10.0 s) and ffprobe (0.0227 s) legitimately disagree.

Consumers should compare ``expected.duration_seconds`` with a tolerance (the Rust tests
use 1100 ms, because ``audiotags`` rounds some containers to whole seconds).

Usage
-----
    python scripts/make-fixtures.py                 # regenerate + verify
    python scripts/make-fixtures.py --verbose-probe # also dump full ffprobe JSON
    python scripts/make-fixtures.py --keep-existing # do not delete owned dirs first

Exit status is 0 only if every expectation declared in ``manifest.json`` was confirmed
by re-reading the file with ``mutagen`` *and* by ffprobe/ffmpeg.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from mutagen.aiff import AIFF
from mutagen.flac import FLAC
from mutagen.id3 import ID3, TALB, TCON, TDRC, TIT2, TPE1
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4
from mutagen.wave import WAVE

# --------------------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------------------

SEED = 20240917
SAMPLE_RATE = 44100
"""All fixtures are 44.1 kHz.  Sample rate is fixed so scanner assertions stay simple."""

MAX_BYTES = 200_000
"""Every fixture must stay well under 200 KB; enforced after generation."""

AUDIO_ROOT_REL = Path("fixtures") / "audio"
MANIFEST_NAME = "manifest.json"
MANIFEST_VERSION = 1
GENERATOR = "scripts/make-fixtures.py"

MANAGED_DIRS = (
    "wav",
    "flac",
    "aiff",
    "mp3",
    "m4a",
    "edge",
    "corrupt",
    "unsupported",
    "duplicates",
)
"""Directories owned by this script; they are wiped on every run (unless --keep-existing)."""

SUPPORTED_EXTENSIONS = ("aif", "aiff", "flac", "m4a", "mp3", "wav")
"""Extensions this corpus treats as supported, lower-case and WITHOUT a leading dot.

Dotless matches the Rust side (`dj_assistant_core::SUPPORTED_EXTENSIONS` and
`ExtractedMetadata::format` both use bare, lower-case extensions). `aif` has no
fixture of its own (`.aiff` covers the same container) but is listed because the
Rust scanner treats the two extensions alike.
"""

DURATION_TOLERANCE_SECONDS = 0.05
"""Parsers disagree slightly on duration (e.g. bitrate-estimated MP3 length)."""

LIMITATIONS = [
    "No MP3/AAC/Vorbis/Opus encoder exists in this ffmpeg build, so "
    "mp3/tagged-mp3-125.mp3 has a silent hand-built payload and exists only for tag parsing.",
    "No AAC/ALAC encoder exists in this ffmpeg build, so m4a/tagged-m4a-128.m4a stores "
    "uncompressed PCM in an MP4/M4A container: the container and its tags are real, the codec is not.",
    "ffmpeg has no lavfi input, so no tone can be generated by ffmpeg; audio is synthesised in Python.",
    "ffmpeg has no 'null' muxer, so decode self-checks decode to a temporary PCM16 WAV instead.",
    "FLAC and M4A bytes depend on the ffmpeg build (bitstream/container layout), although "
    "-fflags +bitexact keeps ffmpeg's version string and creation time out of the file.",
]

# --- hand-built MP3 geometry -----------------------------------------------------------
MP3_FRAME_COUNT = 4
"""Smallest frame count accepted by both mutagen (>=2, non-sketchy at >=4) and ffprobe."""
MP3_FRAME_HEADER = bytes((0xFF, 0xFB, 0x90, 0x00))
"""MPEG-1 Layer III, 128 kbit/s, 44.1 kHz, stereo, no CRC."""
MP3_FRAME_LEN = 417
"""floor(144 * 128000 / 44100) + 0 padding == 417 bytes for the header above."""
MP3_BITRATE = 128_000


# --------------------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------------------


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def seed_for(tag: str) -> int:
    """Stable integer seed derived from SEED and a descriptive tag."""
    return int.from_bytes(hashlib.sha256(f"{SEED}:{tag}".encode("utf-8")).digest()[:8], "big")


def rng_for(tag: str) -> random.Random:
    return random.Random(seed_for(tag))


def noise(n: int, tag: str) -> np.ndarray:
    """Deterministic white noise in [-1, 1) taken from the stdlib Mersenne Twister.

    ``random.Random.randbytes`` is used instead of a numpy Generator because numpy
    explicitly does not guarantee Generator stream compatibility between releases,
    while the Mersenne Twister is a specified, frozen algorithm.
    """
    raw = rng_for(tag).randbytes(n)
    return (np.frombuffer(raw, dtype=np.uint8).astype(np.float64) - 127.5) / 127.5


# --------------------------------------------------------------------------------------
# Audio synthesis (numpy, deterministic)
# --------------------------------------------------------------------------------------


def render_clip(
    *,
    bpm: float,
    beats: int,
    channels: int,
    tag: str,
    key_hz: float,
    hat_level: float = 0.28,
    bed_level: float = 0.02,
) -> bytes:
    """Synthesise a short, deterministic, DJ-flavoured interleaved PCM16 clip.

    A decaying pitch-swept kick on every beat, a bass note on alternate beats and a
    noise hat on every off-beat, plus a very low noise bed so the signal is not a pure
    tone.  ``hat_level`` is lowered for the FLAC fixture: broadband noise is expensive
    to store losslessly, and the 200 KB budget is enforced.
    """
    sr = SAMPLE_RATE
    beat_s = 60.0 / bpm
    n = int(round(beat_s * beats * sr))
    tone = np.zeros(n, dtype=np.float64)

    # Kick: exponentially decaying sine with a fast downward pitch sweep.
    for b in range(beats):
        start = int(round(b * beat_s * sr))
        if start >= n:
            break
        kt = np.arange(n - start, dtype=np.float64) / sr
        freq = 48.0 + 90.0 * np.exp(-kt / 0.012)
        tone[start:] += 0.85 * np.sin(2.0 * np.pi * np.cumsum(freq) / sr) * np.exp(-kt / 0.11)

    # Bass: one note every other beat, decaying over half a beat.
    for b in range(0, beats, 2):
        start = int(round(b * beat_s * sr))
        seg = min(int(round(beat_s * 0.5 * sr)), n - start)
        if seg <= 0:
            continue
        bt = np.arange(seg, dtype=np.float64) / sr
        tone[start : start + seg] += 0.35 * np.sin(2.0 * np.pi * key_hz * bt) * np.exp(-bt / 0.22)

    # Hats: short noise bursts on the off-beats.
    hat_env = np.zeros(n, dtype=np.float64)
    for b in range(beats):
        start = int(round((b + 0.5) * beat_s * sr))
        seg = min(int(round(0.06 * sr)), n - start)
        if seg <= 0:
            continue
        ht = np.arange(seg, dtype=np.float64) / sr
        hat_env[start : start + seg] += np.exp(-ht / 0.02)
    hat_noise = noise(n, f"{tag}:hats") * hat_env

    chans = []
    for c in range(channels):
        # Different gain/pan per channel keeps stereo files genuinely stereo.
        pan = 1.0 if channels == 1 else (1.0 if c == 0 else 0.72)
        bed = noise(n, f"{tag}:bed:{c}")
        chans.append(tone + hat_level * pan * hat_noise + bed_level * bed)

    peak = max(float(np.max(np.abs(ch))) for ch in chans) or 1.0
    scale = 0.89 / peak

    out = np.empty((n, channels), dtype="<i2")
    for c, ch in enumerate(chans):
        q = np.round(ch * scale * 32767.0)
        np.clip(q, -32768.0, 32767.0, out=q)
        out[:, c] = q.astype("<i2")
    return out.tobytes()


def frames_of(pcm: bytes, channels: int) -> int:
    return len(pcm) // (2 * channels)


def write_wav(path: Path, pcm: bytes, channels: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)


# --------------------------------------------------------------------------------------
# ffmpeg / ffprobe
# --------------------------------------------------------------------------------------


def require_tools() -> tuple[str, str]:
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise SystemExit("ffmpeg and ffprobe must both be on PATH for this script.")
    return ffmpeg, ffprobe


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True)


def transcode(
    ffmpeg: str,
    src: Path,
    dst: Path,
    *,
    codec: str,
    container: str,
    metadata: dict[str, str] | None = None,
    bitexact: bool = False,
) -> None:
    """Transcode PCM WAV -> FLAC/AIFF with an explicit, inherited-metadata-free command."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-i",
        str(src),
        "-map_metadata",
        "-1",
        "-c:a",
        codec,
    ]
    if bitexact:
        # Keeps ffmpeg's version string ("Lavf...") out of the tags so the file hash
        # does not change when ffmpeg is upgraded.
        cmd += ["-fflags", "+bitexact", "-flags", "+bitexact"]
    for key, value in (metadata or {}).items():
        cmd += ["-metadata", f"{key}={value}"]
    cmd += ["-f", container, str(dst)]
    proc = run(cmd)
    if proc.returncode != 0:
        raise SystemExit(
            f"ffmpeg failed ({proc.returncode}) for {dst.name}:\n{proc.stderr.decode('utf-8', 'replace')}"
        )


def ffprobe_file(ffprobe: str, path: Path) -> dict:
    """Return a normalised view of `ffprobe -show_format -show_streams` plus the raw JSON."""
    proc = run(
        [
            ffprobe,
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ]
    )
    try:
        data = json.loads(proc.stdout.decode("utf-8", "replace"))
    except json.JSONDecodeError:
        data = {}

    audio = [s for s in data.get("streams", []) if s.get("codec_type") == "audio"]
    sample_rate = channels = codec = None
    if audio:
        codec = audio[0].get("codec_name")
        try:
            sample_rate = int(audio[0]["sample_rate"])
        except (KeyError, TypeError, ValueError):
            sample_rate = None
        try:
            channels = int(audio[0]["channels"])
        except (KeyError, TypeError, ValueError):
            channels = None

    raw_duration = data.get("format", {}).get("duration")
    try:
        duration = float(raw_duration) if raw_duration is not None else None
    except (TypeError, ValueError):
        duration = None

    return {
        "returncode": proc.returncode,
        "stderr": proc.stderr.decode("utf-8", "replace").strip(),
        "format_name": data.get("format", {}).get("format_name"),
        "stream_count": len(audio),
        "codec": codec,
        "sample_rate": sample_rate,
        "channels": channels,
        "duration": duration,
        "tags": data.get("format", {}).get("tags", {}) or {},
        "raw": data,
    }


def probe_is_readable(probe: dict) -> bool:
    """A fixture counts as readable only with a real audio stream.

    An empty .flac makes ffprobe exit 0 while reporting a bogus 0 Hz / 0 channel
    stream, so the exit code alone is not a safe readability signal.
    """
    return (
        probe["returncode"] == 0
        and probe["stream_count"] >= 1
        and bool(probe["sample_rate"])
    )


def decode_to_wav(ffmpeg: str, src: Path, dst: Path) -> tuple[int, str, int | None]:
    """Decode `src` to PCM16 WAV and return (exit_code, stderr, decoded_frame_count).

    This build has no `null` muxer, so a temporary WAV is used as the sink.
    """
    proc = run(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-i",
            str(src),
            "-c:a",
            "pcm_s16le",
            "-f",
            "wav",
            str(dst),
        ]
    )
    frames = None
    if proc.returncode == 0 and dst.exists():
        try:
            with wave.open(str(dst), "rb") as w:
                frames = w.getnframes()
        except wave.Error:
            frames = None
    return proc.returncode, proc.stderr.decode("utf-8", "replace").strip(), frames


# --------------------------------------------------------------------------------------
# Tagging
# --------------------------------------------------------------------------------------

TAG_FIELDS = ("title", "artist", "album", "genre", "year")


def _first(values, *keys):
    for key in keys:
        got = values.get(key)
        if got:
            if isinstance(got, (list, tuple)):
                return str(got[0]) if got else None
            return str(got)
    return None


def _id3_first(tags, *keys):
    for key in keys:
        frame = tags.get(key)
        text = getattr(frame, "text", None)
        if text:
            return str(text[0])
    return None


def read_tags(path: Path, fmt: str) -> tuple[dict, dict]:
    """Read tags/info the way a scanner would (ID3 for WAV/AIFF/MP3, Vorbis for FLAC,
    MP4 ilst for M4A)."""
    if fmt == "wav":
        audio = WAVE(path)
    elif fmt == "aiff":
        audio = AIFF(path)
    elif fmt == "mp3":
        audio = MP3(path)
    elif fmt == "flac":
        audio = FLAC(path)
    elif fmt == "m4a":
        audio = MP4(path)
    else:  # pragma: no cover - guarded by callers
        raise ValueError(f"no tag reader for {fmt!r}")

    tags = audio.tags
    meta: dict = {name: None for name in TAG_FIELDS}
    year_raw = None
    if tags is not None:
        if fmt == "flac":
            for name, keys in (
                ("title", ("title",)),
                ("artist", ("artist",)),
                ("album", ("album",)),
                ("genre", ("genre",)),
            ):
                meta[name] = _first(tags, *keys)
            year_raw = _first(tags, "date", "year")
        elif fmt == "m4a":
            # MPEG-4 ilst atoms; mutagen exposes them with their ``\xa9`` atom names.
            for name, keys in (
                ("title", ("\xa9nam",)),
                ("artist", ("\xa9ART",)),
                ("album", ("\xa9alb",)),
                ("genre", ("\xa9gen",)),
            ):
                meta[name] = _first(tags, *keys)
            year_raw = _first(tags, "\xa9day", "date", "year")
        else:
            for name, keys in (
                ("title", ("TIT2",)),
                ("artist", ("TPE1",)),
                ("album", ("TALB",)),
                ("genre", ("TCON",)),
            ):
                meta[name] = _id3_first(tags, *keys)
            year_raw = _id3_first(tags, "TDRC", "TYER", "TDOR")
    if year_raw:
        match = re.match(r"\s*(\d{4})", year_raw)
        meta["year"] = int(match.group(1)) if match else None

    info = {
        "sample_rate": getattr(audio.info, "sample_rate", None),
        "channels": getattr(audio.info, "channels", None),
        "duration_seconds": round(float(getattr(audio.info, "length", 0.0)), 6),
    }
    return meta, info


def write_id3(path: Path, fmt: str, meta: dict) -> None:
    """Attach an ID3v2.4 tag to a WAV/AIFF/MP3 file with mutagen."""
    if fmt == "wav":
        audio = WAVE(path)
    elif fmt == "aiff":
        audio = AIFF(path)
    elif fmt == "mp3":
        audio = MP3(path)
    else:  # pragma: no cover
        raise ValueError(f"no ID3 writer for {fmt!r}")

    audio.add_tags()
    assert isinstance(audio.tags, ID3), "mutagen did not attach an ID3 container"
    audio.tags.add(TIT2(encoding=3, text=meta["title"]))  # UTF-8
    audio.tags.add(TPE1(encoding=3, text=meta["artist"]))
    audio.tags.add(TALB(encoding=3, text=meta["album"]))
    audio.tags.add(TCON(encoding=3, text=meta["genre"]))
    audio.tags.add(TDRC(encoding=3, text=str(meta["year"])))
    if fmt == "mp3":
        # v1=0: keep the file to ID3v2.4 only, so the byte layout is minimal and stable.
        audio.save(v1=0)
    else:
        audio.save()


def build_mp3(path: Path, meta: dict) -> None:
    """Hand-build a minimal MPEG-1 Layer III file, then tag it with mutagen.

    See the module docstring: the payload is silent/dummy on purpose (no MP3 encoder
    exists in this toolchain) and this fixture exists ONLY to exercise tag parsing.
    """
    frame = MP3_FRAME_HEADER + bytes(MP3_FRAME_LEN - 4)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(frame * MP3_FRAME_COUNT)

    audio = MP3(path)
    assert audio.info.layer == 3 and audio.info.sample_rate == SAMPLE_RATE
    assert audio.info.channels == 2 and audio.info.bitrate == MP3_BITRATE
    assert audio.tags is None, "the freshly built MP3 must not contain tags yet"
    write_id3(path, "mp3", meta)


def build_m4a(ffmpeg: str, src_wav: Path, dst: Path, meta: dict) -> None:
    """Mux a PCM16 WAV into an MPEG-4 Part 14 container, then tag it with mutagen.

    See the module docstring: this ffmpeg build has no AAC/ALAC encoder, so the audio
    track stays uncompressed PCM.  ``-brand "M4A "`` gives the file the same major brand
    as a real M4A; ``-fflags +bitexact`` keeps ffmpeg's version string and creation time
    out so the bytes are stable across ffmpeg patch releases.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-i",
        str(src_wav),
        "-map_metadata",
        "-1",
        "-c:a",
        "pcm_s16le",
        "-brand",
        "M4A ",
        "-fflags",
        "+bitexact",
        "-flags",
        "+bitexact",
        "-f",
        "mov",
        str(dst),
    ]
    proc = run(cmd)
    if proc.returncode != 0:
        raise SystemExit(
            f"ffmpeg failed ({proc.returncode}) for {dst.name}:\n"
            f"{proc.stderr.decode('utf-8', 'replace')}"
        )

    audio = MP4(dst)
    assert audio.tags is None, "the freshly muxed M4A must not contain tags yet"
    audio["\xa9nam"] = [meta["title"]]
    audio["\xa9ART"] = [meta["artist"]]
    audio["\xa9alb"] = [meta["album"]]
    audio["\xa9gen"] = [meta["genre"]]
    audio["\xa9day"] = [str(meta["year"])]
    audio.save()


# --------------------------------------------------------------------------------------
# Corrupt / unsupported fixtures
# --------------------------------------------------------------------------------------


def build_truncated_wav(path: Path, *, channels: int = 2, present_pcm_bytes: int = 4000, claimed_seconds: float = 10.0) -> int:
    """Write a RIFF/WAVE header that claims `claimed_seconds` of PCM, then stop early.

    The stdlib ``wave`` module rewrites the header on close, so the header is built by
    hand here to keep the lie intact.
    """
    claimed = int(SAMPLE_RATE * channels * 2 * claimed_seconds)
    byte_rate = SAMPLE_RATE * channels * 2
    header = (
        b"RIFF"
        + struct.pack("<I", 36 + claimed)
        + b"WAVE"
        + b"fmt "
        + struct.pack("<IHHIIHH", 16, 1, channels, SAMPLE_RATE, byte_rate, channels * 2, 16)
        + b"data"
        + struct.pack("<I", claimed)
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + bytes(present_pcm_bytes))
    return claimed


def build_garbage_mp3(path: Path, *, size: int = 4096) -> None:
    """Deterministic pseudo-random bytes with an .mp3 extension (no ID3, no valid frame)."""
    raw = bytearray(rng_for("corrupt:garbage.mp3").randbytes(size))
    raw[0] = 0x41  # make sure the file cannot accidentally start with an MPEG sync
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(raw))


def build_header_only_aiff(path: Path) -> None:
    """A 12-byte FORM/AIFF container with no COMM and no audio chunks."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"FORM" + struct.pack(">I", 4) + b"AIFF")


NOTES_TXT = """DJ Assistant fixture corpus - non-audio file.

This file is valid UTF-8 text with a .txt extension.  It exists so tests can prove the
library scanner skips unsupported extensions instead of trying to parse them as audio.
Ünïcodé content is included on purpose: line three is deliberately not ASCII.
"""


# --------------------------------------------------------------------------------------
# Corpus bookkeeping
# --------------------------------------------------------------------------------------


@dataclass
class Fixture:
    path: str  # POSIX, relative to fixtures/audio
    fmt: str  # wav | flac | aiff | mp3 | m4a | text
    supported: bool
    corrupt: bool
    readable: bool
    duplicate_of: str | None
    expected: dict
    note: str | None = None
    bytes: int = 0
    sha256: str = ""

    def to_manifest_entry(self) -> dict:
        return {
            "path": self.path,
            "format": self.fmt,
            "extension": Path(self.path).suffix.lower().lstrip("."),
            "supported": self.supported,
            "corrupt": self.corrupt,
            "readable": self.readable,
            "duplicate_of": self.duplicate_of,
            "bytes": self.bytes,
            "sha256": self.sha256,
            "expected": self.expected,
            "note": self.note,
        }


def expected_for(meta: dict, *, channels: int, frames: int) -> dict:
    return {
        "title": meta.get("title"),
        "artist": meta.get("artist"),
        "album": meta.get("album"),
        "genre": meta.get("genre"),
        "year": meta.get("year"),
        "sample_rate": SAMPLE_RATE if frames else None,
        "channels": channels if frames else None,
        "duration_seconds": round(frames / SAMPLE_RATE, 6) if frames else None,
    }


class Corpus:
    def __init__(self, root: Path, ffmpeg: str, ffprobe: str):
        self.root = root
        self.ffmpeg = ffmpeg
        self.ffprobe = ffprobe
        self.tmp = Path(tempfile.mkdtemp(prefix="dj-fixtures-build-"))
        self.records: list[Fixture] = []

    # -- paths -------------------------------------------------------------------------
    def path(self, rel: str) -> Path:
        return self.root / Path(rel)

    def register(
        self,
        rel: str,
        *,
        fmt: str,
        expected: dict,
        supported: bool = True,
        corrupt: bool = False,
        readable: bool = True,
        duplicate_of: str | None = None,
        note: str | None = None,
    ) -> Fixture:
        data = self.path(rel).read_bytes()
        if len(data) > MAX_BYTES:
            raise SystemExit(f"{rel} is {len(data)} bytes, over the {MAX_BYTES}-byte budget")
        fixture = Fixture(
            path=rel,
            fmt=fmt,
            supported=supported,
            corrupt=corrupt,
            readable=readable,
            duplicate_of=duplicate_of,
            expected=expected,
            note=note,
            bytes=len(data),
            sha256=sha256_bytes(data),
        )
        self.records.append(fixture)
        return fixture

    def intermediated_wav(self, name: str, pcm: bytes, channels: int) -> Path:
        """Untagged scratch WAV used as the ffmpeg input (never part of the corpus)."""
        path = self.tmp / f"{name}.wav"
        write_wav(path, pcm, channels)
        return path


# --------------------------------------------------------------------------------------
# Generation
# --------------------------------------------------------------------------------------

HOUSE = {
    "title": "Midnight Groove",
    "artist": "Kaspar Nyx",
    "album": "Deep Cuts Vol. 1",
    "genre": "House",
    "year": 2018,
}
TECHNO = {
    "title": "Warehouse Pulse",
    "artist": "Anhalt",
    "album": "Berlin Sessions",
    "genre": "Techno",
    "year": 2019,
}
DNB = {
    "title": "Rolling Deep",
    "artist": "Sub Division",
    "album": "Jungle Archives",
    "genre": "Drum & Bass",
    "year": 2021,
}
MP3_META = {
    "title": "Placeholder Tone",
    "artist": "Fixture Bot",
    "album": "Tag Parsing Only",
    "genre": "Electronic",
    "year": 2022,
}
M4A_META = {
    "title": "Container Bound",
    "artist": "MP4 Ensemble",
    "album": "Codec Coverage",
    "genre": "House",
    "year": 2020,
}
UNICODE_META = {
    "title": "Trâck (Extended Mix)",
    "artist": "Ünïcodé Ärtîst",
    "album": "Naïve Édition 日本語",
    "genre": "Électro",
    "year": 2023,
}
APOSTROPHE_META = {
    "title": "Don't Stop",
    "artist": "O'Brien & Sons",
    "album": "Original Mix",
    "genre": "Funk / Disco",
    "year": 2017,
}

HOUSE_REL = "wav/tagged-house-128.wav"
UNICODE_REL = "edge/Ünïcodé Ärtîst – Trâck (Extended Mix).wav"  # U+2013 EN DASH
APOSTROPHE_REL = "edge/Don't Stop (Original Mix).wav"


def generate(corpus: Corpus) -> None:
    # 1 -- tagged stereo WAV (ID3v2.4 via mutagen) -------------------------------------
    house_pcm = render_clip(bpm=128, beats=2, channels=2, tag="house-128", key_hz=55.0)
    write_wav(corpus.path(HOUSE_REL), house_pcm, 2)
    write_id3(corpus.path(HOUSE_REL), "wav", HOUSE)
    corpus.register(
        HOUSE_REL,
        fmt="wav",
        expected=expected_for(HOUSE, channels=2, frames=frames_of(house_pcm, 2)),
        note="Stereo PCM16 WAV with an ID3v2.4 chunk written by mutagen (mutagen.wave.WAVE).",
    )

    # 2 -- tagged FLAC built by ffmpeg from an untagged scratch WAV ---------------------
    # Broadband noise is expensive to store losslessly, so the FLAC source uses a lower
    # noise floor than the PCM fixtures (measured: ~138 KB instead of ~206 KB, i.e. still
    # under the 200 KB budget).
    techno_pcm = render_clip(
        bpm=140, beats=4, channels=2, tag="techno-140", key_hz=49.0, hat_level=0.10, bed_level=0.001
    )
    techno_src = corpus.intermediated_wav("techno-140", techno_pcm, 2)
    techno_rel = "flac/tagged-techno-140.flac"
    transcode(
        corpus.ffmpeg,
        techno_src,
        corpus.path(techno_rel),
        codec="flac",
        container="flac",
        metadata={
            "title": TECHNO["title"],
            "artist": TECHNO["artist"],
            "album": TECHNO["album"],
            "genre": TECHNO["genre"],
            "date": str(TECHNO["year"]),
        },
        bitexact=True,
    )
    corpus.register(
        techno_rel,
        fmt="flac",
        expected=expected_for(TECHNO, channels=2, frames=frames_of(techno_pcm, 2)),
        note=(
            "FLAC encoded by ffmpeg from an untagged WAV. Tags are ffmpeg '-metadata' "
            "entries (year is the Vorbis 'date' field); '-fflags +bitexact' keeps ffmpeg's "
            "version string out of the tags. Bytes depend on the ffmpeg build."
        ),
    )

    # 3 -- tagged AIFF (PCM16 big-endian by ffmpeg, tags by mutagen) --------------------
    dnb_pcm = render_clip(bpm=174, beats=2, channels=2, tag="dnb-174", key_hz=41.2)
    dnb_src = corpus.intermediated_wav("dnb-174", dnb_pcm, 2)
    dnb_rel = "aiff/tagged-dnb-174.aiff"
    transcode(corpus.ffmpeg, dnb_src, corpus.path(dnb_rel), codec="pcm_s16be", container="aiff")
    write_id3(corpus.path(dnb_rel), "aiff", DNB)
    corpus.register(
        dnb_rel,
        fmt="aiff",
        expected=expected_for(DNB, channels=2, frames=frames_of(dnb_pcm, 2)),
        note=(
            "PCM16 big-endian AIFF produced by ffmpeg; ffmpeg does not write AIFF tags, so "
            "the ID3v2.4 chunk was written afterwards with mutagen.aiff.AIFF."
        ),
    )

    # 4 -- hand-built tags-only MP3 ----------------------------------------------------
    mp3_rel = "mp3/tagged-mp3-125.mp3"
    build_mp3(corpus.path(mp3_rel), MP3_META)
    mp3_audio_bytes = MP3_FRAME_COUNT * MP3_FRAME_LEN
    corpus.register(
        mp3_rel,
        fmt="mp3",
        expected={
            "title": MP3_META["title"],
            "artist": MP3_META["artist"],
            "album": MP3_META["album"],
            "genre": MP3_META["genre"],
            "year": MP3_META["year"],
            "sample_rate": SAMPLE_RATE,
            "channels": 2,
            # mutagen/ffprobe estimate length as 8 * audio_bytes / bitrate (no Xing header).
            "duration_seconds": round(8 * mp3_audio_bytes / MP3_BITRATE, 6),
        },
        note=(
            "TAGS ONLY - the audio payload is 4 silent hand-built MPEG-1 Layer III frames "
            "(no MP3 encoder exists in this environment). Do not use it for duration/BPM/key "
            "assertions; audiotags may report duration 0."
        ),
    )

    # 4b -- tagged M4A (uncompressed PCM muxed into an MPEG-4 Part 14 container) --------
    m4a_pcm = render_clip(bpm=128, beats=2, channels=2, tag="m4a-128", key_hz=57.0)
    m4a_src = corpus.intermediated_wav("m4a-128", m4a_pcm, 2)
    m4a_rel = "m4a/tagged-m4a-128.m4a"
    build_m4a(corpus.ffmpeg, m4a_src, corpus.path(m4a_rel), M4A_META)
    corpus.register(
        m4a_rel,
        fmt="m4a",
        expected=expected_for(M4A_META, channels=2, frames=frames_of(m4a_pcm, 2)),
        note=(
            "MPEG-4 Part 14 container (major brand 'M4A ') holding uncompressed PCM16, not "
            "AAC: no AAC/ALAC encoder exists in this environment. Tags are MP4 ilst atoms "
            "written by mutagen.mp4.MP4; duration comes from the mvhd atom."
        ),
    )

    # 5 -- valid WAV with no metadata at all ------------------------------------------
    notags_pcm = render_clip(bpm=120, beats=1, channels=2, tag="no-tags", key_hz=58.27)
    notags_rel = "wav/no-tags.wav"
    write_wav(corpus.path(notags_rel), notags_pcm, 2)
    corpus.register(
        notags_rel,
        fmt="wav",
        expected=expected_for({}, channels=2, frames=frames_of(notags_pcm, 2)),
        note="Valid stereo PCM16 WAV with no metadata container at all (filename-fallback test).",
    )

    # 6 -- UTF-8 filename + UTF-8 (multi-script) tags ----------------------------------
    unicode_pcm = render_clip(bpm=126, beats=2, channels=1, tag="unicode", key_hz=65.41)
    write_wav(corpus.path(UNICODE_REL), unicode_pcm, 1)
    write_id3(corpus.path(UNICODE_REL), "wav", UNICODE_META)
    corpus.register(
        UNICODE_REL,
        fmt="wav",
        expected=expected_for(UNICODE_META, channels=1, frames=frames_of(unicode_pcm, 1)),
        note="Mono WAV: UTF-8 filename (en dash U+2013) plus Latin-1/Cyrillic/CJK tag text in UTF-8.",
    )

    # 6b -- apostrophe + parentheses + ampersand --------------------------------------
    apostrophe_pcm = render_clip(bpm=124, beats=3, channels=1, tag="apostrophe", key_hz=73.42)
    write_wav(corpus.path(APOSTROPHE_REL), apostrophe_pcm, 1)
    write_id3(corpus.path(APOSTROPHE_REL), "wav", APOSTROPHE_META)
    corpus.register(
        APOSTROPHE_REL,
        fmt="wav",
        expected=expected_for(APOSTROPHE_META, channels=1, frames=frames_of(apostrophe_pcm, 1)),
        note="Mono WAV whose filename and tags contain an apostrophe, parentheses and an ampersand.",
    )

    # 7 -- corrupt / malformed --------------------------------------------------------
    truncated_rel = "corrupt/truncated.wav"
    claimed = build_truncated_wav(corpus.path(truncated_rel))
    corpus.register(
        truncated_rel,
        fmt="wav",
        corrupt=True,
        readable=True,
        expected={
            "title": None,
            "artist": None,
            "album": None,
            "genre": None,
            "year": None,
            "sample_rate": SAMPLE_RATE,
            "channels": 2,
            # The two parsers disagree on purpose: mutagen trusts the header (10.0 s),
            # ffprobe reports the bytes that actually exist (~0.0227 s).
            "duration_seconds": None,
        },
        note=(
            f"RIFF header claims {claimed} PCM bytes / 10.0 s but only 4000 bytes of PCM are "
            "present. mutagen reports 10.0 s (header), ffprobe reports ~0.0227 s (real bytes). "
            "Streams still parse; use it to test header/data mismatch handling."
        ),
    )

    garbage_rel = "corrupt/garbage.mp3"
    build_garbage_mp3(corpus.path(garbage_rel))
    corpus.register(
        garbage_rel,
        fmt="mp3",
        corrupt=True,
        readable=False,
        expected=expected_for({}, channels=0, frames=0),
        note="4096 deterministic pseudo-random bytes with an .mp3 extension (no ID3, no valid frame).",
    )

    empty_rel = "corrupt/zero-bytes.flac"
    corpus.path(empty_rel).parent.mkdir(parents=True, exist_ok=True)
    corpus.path(empty_rel).write_bytes(b"")
    corpus.register(
        empty_rel,
        fmt="flac",
        corrupt=True,
        readable=False,
        expected=expected_for({}, channels=0, frames=0),
        note=(
            "Empty (0-byte) file with a .flac extension. ffprobe exits 0 but reports a bogus "
            "stream with 0 Hz / 0 channels, so readability must require sample_rate > 0."
        ),
    )

    header_only_rel = "corrupt/header-only.aiff"
    build_header_only_aiff(corpus.path(header_only_rel))
    corpus.register(
        header_only_rel,
        fmt="aiff",
        corrupt=True,
        readable=False,
        expected=expected_for({}, channels=0, frames=0),
        note="12-byte FORM/AIFF container with no COMM chunk and no audio data (no 'readable' stream).",
    )

    # 8 -- unsupported extension ------------------------------------------------------
    notes_rel = "unsupported/notes.txt"
    corpus.path(notes_rel).parent.mkdir(parents=True, exist_ok=True)
    corpus.path(notes_rel).write_text(NOTES_TXT, encoding="utf-8", newline="\n")
    corpus.register(
        notes_rel,
        fmt="text",
        supported=False,
        readable=False,
        expected=expected_for({}, channels=0, frames=0),
        note="Valid UTF-8 text with a non-audio extension; the scanner must skip it.",
    )

    # 9 -- byte-for-byte duplicate under a different filename --------------------------
    duplicate_rel = "duplicates/tagged-house-128-copy.wav"
    corpus.path(duplicate_rel).parent.mkdir(parents=True, exist_ok=True)
    original_bytes = corpus.path(HOUSE_REL).read_bytes()
    corpus.path(duplicate_rel).write_bytes(original_bytes)
    corpus.register(
        duplicate_rel,
        fmt="wav",
        expected=expected_for(HOUSE, channels=2, frames=frames_of(house_pcm, 2)),
        duplicate_of=HOUSE_REL,
        note="Byte-for-byte copy of the tagged WAV under a different filename (hash-dedup test).",
    )


# --------------------------------------------------------------------------------------
# Verification
# --------------------------------------------------------------------------------------


def verify(corpus: Corpus, *, verbose_probe: bool, out=sys.stdout) -> list[str]:
    """Re-read every fixture with mutagen and ffprobe and confirm the declared expectations."""
    errors: list[str] = []
    probe_dir = corpus.tmp / "decoded"
    probe_dir.mkdir(parents=True, exist_ok=True)

    for index, rec in enumerate(corpus.records):
        abs_path = corpus.path(rec.path)
        label = rec.path
        problems: list[str] = []

        if rec.fmt == "text":
            # Non-audio: only check that it is what it claims to be.
            try:
                abs_path.read_text(encoding="utf-8")
            except UnicodeDecodeError as exc:  # pragma: no cover
                problems.append(f"not valid UTF-8: {exc}")
            if rec.supported or Path(rec.path).suffix.lower().lstrip(".") in SUPPORTED_EXTENSIONS:
                problems.append("a text fixture must not be declared supported")
            if rec.duplicate_of or rec.corrupt:
                problems.append("a text fixture must not be corrupt or a duplicate")
            print(f"[ffprobe] {label:52s} skipped (non-audio extension)", file=out)
            _report(label, problems, errors, out=out)
            continue

        # --- ffprobe -----------------------------------------------------------------
        probe = ffprobe_file(corpus.ffprobe, abs_path)
        readable = probe_is_readable(probe)
        if probe["returncode"] == 0:
            print(
                f"[ffprobe] {label:52s} rc=0 codec={probe['codec']} "
                f"sr={probe['sample_rate']} ch={probe['channels']} "
                f"dur={probe['duration']} fmt={probe['format_name']}",
                file=out,
            )
        else:
            print(
                f"[ffprobe] {label:52s} rc={_rc_text(probe['returncode'])} "
                f"streams={probe['stream_count']} stderr={probe['stderr'][:70]!r}",
                file=out,
            )
        if verbose_probe:
            print(json.dumps(probe["raw"], indent=2, sort_keys=True), file=out)

        if readable != rec.readable:
            problems.append(f"readable expected {rec.readable}, ffprobe says {readable}")
        if readable:
            if probe["sample_rate"] != rec.expected["sample_rate"]:
                problems.append(
                    f"ffprobe sample_rate {probe['sample_rate']} != expected {rec.expected['sample_rate']}"
                )
            if probe["channels"] != rec.expected["channels"]:
                problems.append(
                    f"ffprobe channels {probe['channels']} != expected {rec.expected['channels']}"
                )
            want_duration = rec.expected["duration_seconds"]
            if want_duration is not None and probe["duration"] is not None:
                if abs(probe["duration"] - want_duration) > DURATION_TOLERANCE_SECONDS:
                    problems.append(
                        f"ffprobe duration {probe['duration']} != expected {want_duration} "
                        f"(+/-{DURATION_TOLERANCE_SECONDS})"
                    )

        # --- mutagen -----------------------------------------------------------------
        try:
            meta, info = read_tags(abs_path, rec.fmt)
            mutagen_ok = True
        except Exception as exc:  # mutagen raises several unrelated error types
            meta, info, mutagen_ok = {}, {}, False
            if rec.readable:
                problems.append(f"mutagen could not read a readable fixture: {type(exc).__name__}: {exc}")
            print(f"[mutagen] {label:52s} unreadable ({type(exc).__name__})", file=out)

        if mutagen_ok:
            for name in TAG_FIELDS:
                got, want = meta.get(name), rec.expected[name]
                if got != want:
                    problems.append(f"tag {name}: {got!r} != expected {want!r}")
            if readable:
                if info["sample_rate"] != rec.expected["sample_rate"]:
                    problems.append(
                        f"mutagen sample_rate {info['sample_rate']} != {rec.expected['sample_rate']}"
                    )
                if info["channels"] != rec.expected["channels"]:
                    problems.append(
                        f"mutagen channels {info['channels']} != {rec.expected['channels']}"
                    )
                want_duration = rec.expected["duration_seconds"]
                if want_duration is not None and abs(info["duration_seconds"] - want_duration) > DURATION_TOLERANCE_SECONDS:
                    problems.append(
                        f"mutagen duration {info['duration_seconds']} != expected {want_duration}"
                    )
            print(
                f"[mutagen] {label:52s} title={meta.get('title')!r} artist={meta.get('artist')!r} "
                f"album={meta.get('album')!r} genre={meta.get('genre')!r} year={meta.get('year')!r} "
                f"dur={info.get('duration_seconds')}",
                file=out,
            )

        # --- decode self-check -------------------------------------------------------
        decoded_path = probe_dir / f"{index}-{abs_path.stem}.wav"
        rc, stderr, frames = decode_to_wav(corpus.ffmpeg, abs_path, decoded_path)
        if rec.readable:
            if rc != 0:
                problems.append(f"ffmpeg could not decode a readable fixture: {stderr[:120]}")
            elif rec.fmt in ("wav", "flac", "aiff", "m4a") and rec.expected["duration_seconds"] is not None:
                # Skipped when duration_seconds is deliberately null (e.g. truncated.wav,
                # where the header lies and the two parsers disagree).
                want_frames = round(rec.expected["duration_seconds"] * SAMPLE_RATE)
                if frames != want_frames:
                    problems.append(f"decoded {frames} frames, expected {want_frames}")
        print(
            f"[decode]  {label:52s} rc={_rc_text(rc)} decoded_frames={frames}"
            + ("" if rc == 0 else f" stderr={stderr[:70]!r}"),
            file=out,
        )

        _report(label, problems, errors, out=out)

    return errors


def _report(label: str, problems: list[str], errors: list[str], *, out) -> None:
    if problems:
        for problem in problems:
            print(f"[MISMATCH] {label}: {problem}", file=out)
        errors.extend(f"{label}: {p}" for p in problems)


# --------------------------------------------------------------------------------------
# Manifest
# --------------------------------------------------------------------------------------


def load_previous_manifest(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def build_manifest(records: list[Fixture]) -> dict:
    ordered = sorted(records, key=lambda r: r.path)
    return {
        "manifest_version": MANIFEST_VERSION,
        "generator": GENERATOR,
        "description": (
            "Deterministic synthetic audio fixtures for the DJ Assistant library scanner. "
            "Paths are POSIX-style and relative to fixtures/audio. 'expected' fields are "
            "null when the value is expected to be absent. 'extension' and "
            "'supported_extensions' are lower-case and carry no leading dot, matching "
            "dj_assistant_core::SUPPORTED_EXTENSIONS and ExtractedMetadata::format. "
            "Consumed by crates/core/tests/{fixture_manifest,scan_corpus}.rs."
        ),
        "seed": SEED,
        "sample_rate": SAMPLE_RATE,
        "supported_extensions": list(SUPPORTED_EXTENSIONS),
        "duration_tolerance_seconds": DURATION_TOLERANCE_SECONDS,
        "max_file_bytes": MAX_BYTES,
        "file_count": len(ordered),
        "total_bytes": sum(r.bytes for r in ordered),
        "limitations": LIMITATIONS,
        "files": [r.to_manifest_entry() for r in ordered],
    }


def write_manifest(path: Path, manifest: dict) -> bytes:
    data = (json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")
    path.write_bytes(data)
    return data


def determinism_report(previous: dict | None, records: list[Fixture], *, out=sys.stdout) -> bool:
    """Compare freshly generated hashes with the previous manifest and report drift."""
    if not previous or "files" not in previous:
        print(
            "\n[determinism] no previous manifest.json found - this was the first run. "
            "Run the script again to prove byte-stability.",
            file=out,
        )
        return True

    old = {entry["path"]: entry.get("sha256") for entry in previous["files"]}
    new = {rec.path: rec.sha256 for rec in records}
    changed = sorted(p for p in set(old) & set(new) if old[p] != new[p])
    added = sorted(set(new) - set(old))
    removed = sorted(set(old) - set(new))

    if not changed and not added and not removed:
        print(
            f"\n[determinism] OK - all {len(new)} files are byte-identical to the previous "
            "manifest (sha256 match).",
            file=out,
        )
        return True

    print("\n[determinism] DRIFT DETECTED", file=out)
    for p in changed:
        print(f"  changed: {p}\n    was {old[p]}\n    now {new[p]}", file=out)
    for p in added:
        print(f"  added:   {p}", file=out)
    for p in removed:
        print(f"  removed: {p}", file=out)
    return False


# --------------------------------------------------------------------------------------
# Filesystem preparation
# --------------------------------------------------------------------------------------


def prepare(audio_root: Path, *, keep_existing: bool) -> None:
    resolved = audio_root.resolve()
    if resolved.name != "audio" or resolved.parent.name != "fixtures":
        raise SystemExit(f"refusing to write fixtures outside <root>/fixtures/audio: {resolved}")
    audio_root.mkdir(parents=True, exist_ok=True)
    if keep_existing:
        return
    for name in MANAGED_DIRS:
        target = (audio_root / name)
        if target.exists():
            if target.resolve().parent != resolved:
                raise SystemExit(f"refusing to delete {target.resolve()}")
            shutil.rmtree(target)
    manifest = audio_root / MANIFEST_NAME
    if manifest.exists():
        manifest.unlink()


# --------------------------------------------------------------------------------------
# Reporting
# --------------------------------------------------------------------------------------


def _rc_text(rc: int) -> str:
    """Windows reports negative ffmpeg exit codes as large unsigned values; normalise them."""
    return str(rc - 2**32 if rc >= 2**31 else rc)


def print_summary(records: list[Fixture], manifest: dict, *, out=sys.stdout) -> None:
    print("\n=== Fixture summary (fixtures/audio) ===", file=out)
    header = f"{'path':<52} {'fmt':<5} {'bytes':>7}  {'sha256[:12]':<12} {'state':<8} {'tags':<5} {'dup':<4} note"
    print(header, file=out)
    print("-" * len(header), file=out)
    for rec in sorted(records, key=lambda r: r.path):
        tagged = any(rec.expected[name] is not None for name in TAG_FIELDS)
        note = rec.note or ""
        if len(note) > 58:
            note = note[:55] + "..."
        print(
            f"{rec.path:<52} {rec.fmt:<5} {rec.bytes:>7}  {rec.sha256[:12]:<12} "
            f"{'corrupt' if rec.corrupt else 'ok':<8} "
            f"{'yes' if tagged else 'no':<5} "
            f"{'yes' if rec.duplicate_of else '-':<4} "
            f"{note}",
            file=out,
        )
    print("-" * len(header), file=out)
    print(
        f"{manifest['file_count']} files, {manifest['total_bytes']} bytes total, "
        f"largest {max(r.bytes for r in records)} bytes (budget {MAX_BYTES})",
        file=out,
    )
    print(
        f"corrupt/invalid: {sum(1 for r in records if r.corrupt)}, "
        f"duplicates: {sum(1 for r in records if r.duplicate_of)}, "
        f"unsupported: {sum(1 for r in records if not r.supported)}",
        file=out,
    )
    print(
        "\n'environment limitations':\n  - " + "\n  - ".join(LIMITATIONS),
        file=out,
    )


# --------------------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate deterministic synthetic audio fixtures for the DJ library scanner."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="repository root (default: the parent of this script's directory)",
    )
    parser.add_argument(
        "--keep-existing",
        action="store_true",
        help="do not delete the fixture directories this script owns before generating",
    )
    parser.add_argument(
        "--verbose-probe",
        action="store_true",
        help="print the full ffprobe JSON document for every fixture",
    )
    args = parser.parse_args(argv)

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):  # pragma: no cover - non-reconfigurable stream
        pass

    ffmpeg, ffprobe = require_tools()
    audio_root = (args.root / AUDIO_ROOT_REL).resolve()
    manifest_path = audio_root / MANIFEST_NAME

    previous = load_previous_manifest(manifest_path)
    prepare(audio_root, keep_existing=args.keep_existing)

    corpus = Corpus(audio_root, ffmpeg, ffprobe)
    try:
        print(f"seed={SEED} sample_rate={SAMPLE_RATE} root={audio_root}")
        generate(corpus)
        print(f"\ngenerated {len(corpus.records)} fixtures; verifying with mutagen + ffprobe/ffmpeg...\n")

        errors = verify(corpus, verbose_probe=args.verbose_probe)
        manifest = build_manifest(corpus.records)
        manifest_bytes = write_manifest(manifest_path, manifest)
        print(
            f"\n[manifest] wrote {MANIFEST_NAME} "
            f"({len(manifest_bytes)} bytes, sha256={sha256_bytes(manifest_bytes)[:16]})",
        )
        deterministic = determinism_report(previous, corpus.records)
        print_summary(corpus.records, manifest)

        if errors:
            print(f"\nFAILED: {len(errors)} expectation mismatch(es):", file=sys.stderr)
            for err in errors:
                print(f"  - {err}", file=sys.stderr)
            return 1
        if not deterministic:
            print("\nFAILED: fixture bytes changed between runs.", file=sys.stderr)
            return 1
        print("\nOK: every declared expectation was confirmed by re-reading each file.")
        return 0
    finally:
        shutil.rmtree(corpus.tmp, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
