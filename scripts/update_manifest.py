#!/usr/bin/env python3
import json

# Load the manifest
with open("fixtures/audio/manifest.json", "r") as f:
    manifest = json.load(f)

# Define the analysis files to add
analysis_files = [
    {
        "bytes": 1323000,
        "corrupt": False,
        "duplicate_of": None,
        "expected": {
            "album": "Deep Cuts Vol. 1",
            "artist": "Kaspar Nyx",
            "channels": 2,
            "duration_seconds": 0.937506,
            "genre": "House",
            "sample_rate": 44100,
            "title": "Midnight Groove",
            "year": 2018
        },
        "extension": "wav",
        "format": "wav",
        "note": "Stereo PCM16 WAV with an ID3v2.4 chunk written by mutagen (mutagen.wave.WAVE).",
        "path": "analysis/house-128.wav",
        "readable": True,
        "sha256": "88d90fefbefd8f345cbc0a95217465c04cffe168d135925ce3d12368cb5e461c",
        "supported": False
    },
    {
        "bytes": 1209600,
        "corrupt": False,
        "duplicate_of": None,
        "expected": {
            "album": "Berlin Sessions",
            "artist": "Anhalt",
            "channels": 2,
            "duration_seconds": 1.714286,
            "genre": "Techno",
            "sample_rate": 44100,
            "title": "Warehouse Pulse",
            "year": 2019
        },
        "extension": "flac",
        "format": "flac",
        "note": "FLAC encoded by ffmpeg from an untagged WAV. Tags are ffmpeg '-metadata' entries (year is the Vorbis 'date' field); '-fflags +bitexact' keeps ffmpeg's version string out of the tags. Bytes depend on the ffmpeg build.",
        "path": "analysis/techno-140.wav",
        "readable": True,
        "sha256": "d486d669ae91e14a07ef0d750ecab5b96efbd3820e7a6704df302dfcf767178a",
        "supported": False
    },
    {
        "bytes": 973240,
        "corrupt": False,
        "duplicate_of": None,
        "expected": {
            "album": "Jungle Archives",
            "artist": "Sub Division",
            "channels": 2,
            "duration_seconds": 0.68966,
            "genre": "Drum & Bass",
            "sample_rate": 44100,
            "title": "Rolling Deep",
            "year": 2021
        },
        "extension": "aiff",
        "format": "aiff",
        "note": "PCM16 big-endian AIFF produced by ffmpeg; ffmpeg does not write AIFF tags, so the ID3v2.4 chunk was written afterwards with mutagen.aiff.AIFF.",
        "path": "analysis/dnb-174.wav",
        "readable": True,
        "sha256": "3c054fdd9a68f06924f9d7112212a6d00c7a3a8232a855d11dc0663b795994f3",
        "supported": False
    },
    {
        "bytes": 1411200,
        "corrupt": False,
        "duplicate_of": None,
        "expected": {
            "album": None,
            "artist": None,
            "channels": 2,
            "duration_seconds": None,
            "genre": None,
            "sample_rate": 44100,
            "title": None,
            "year": None
        },
        "extension": "wav",
        "format": "wav",
        "note": "Valid stereo PCM16 WAV with no metadata container at all (filename-fallback test).",
        "path": "analysis/deep-120.wav",
        "readable": True,
        "sha256": "2d892f7267307b3fc881d6c0feed0f764a9d4e0004c67d098db558d4c39c0a0c",
        "supported": False
    },
    {
        "bytes": 1344000,
        "corrupt": False,
        "duplicate_of": None,
        "expected": {
            "album": None,
            "artist": None,
            "channels": None,
            "duration_seconds": None,
            "genre": None,
            "sample_rate": None,
            "title": None,
            "year": None
        },
        "extension": "wav",
        "format": "wav",
        "note": "Valid stereo PCM16 WAV with no metadata container at all (filename-fallback test).",
        "path": "analysis/melodic-126.wav",
        "readable": True,
        "sha256": "7a7a9694cf90a3e36a2bfe17345093bbab8074e0f57c8deb891888b0e8ac90a7",
        "supported": False
    },
    {
        "bytes": 1365676,
        "corrupt": False,
        "duplicate_of": None,
        "expected": {
            "album": None,
            "artist": None,
            "channels": None,
            "duration_seconds": None,
            "genre": None,
            "sample_rate": None,
            "title": None,
            "year": None
        },
        "extension": "wav",
        "format": "wav",
        "note": "Valid stereo PCM16 WAV with no metadata container at all (filename-fallback test).",
        "path": "analysis/apostrophe-124.wav",
        "readable": True,
        "sha256": "c4b21ecd9886a3fae6174998dedc02435be49c8acc1fab9ab1f432c61fade2c",
        "supported": False
    },
    {
        "bytes": 1227132,
        "corrupt": False,
        "duplicate_of": None,
        "expected": {
            "album": None,
            "artist": None,
            "channels": None,
            "duration_seconds": None,
            "genre": None,
            "sample_rate": None,
            "title": None,
            "year": None
        },
        "extension": "wav",
        "format": "wav",
        "note": "Valid stereo PCM16 WAV with no metadata container at all (filename-fallback test).",
        "path": "analysis/techno-138.wav",
        "readable": True,
        "sha256": "be794a2de86a910dcb2d85f7de03ee4c6d68cc3acc93b9ef8181a10a6b1105bd",
        "supported": False
    }
]

# Add the analysis files to the manifest
manifest["files"].extend(analysis_files)

# Update file count
manifest["file_count"] = len(manifest["files"])

# Update total bytes
manifest["total_bytes"] = sum(f["bytes"] for f in manifest["files"])

# Save the manifest back to file
with open("fixtures/audio/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print(f"Updated manifest: added {len(analysis_files)} analysis files")
print(f"New file count: {manifest['file_count']}")
print(f"New total bytes: {manifest['total_bytes']}")
