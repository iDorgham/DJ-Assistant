#!/usr/bin/env python3
import json

# Load the manifest
with open("fixtures/audio/manifest.json", "r") as f:
    manifest = json.load(f)

# Set supported to true for analysis files
for f in manifest["files"]:
    if f["path"].startswith("analysis/"):
        f["supported"] = True

# Save the manifest back to file
with open("fixtures/audio/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print("Set supported=true for analysis files in manifest")
