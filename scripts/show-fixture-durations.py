"""Print the duration fields declared in the fixture manifest."""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "fixtures", "audio", "manifest.json")


def main() -> int:
    with open(MANIFEST, encoding="utf-8") as fh:
        manifest = json.load(fh)

    print(f"{'path':52s} {'format':6s} {'dur_seconds':>12s}  supported")
    for entry in manifest["files"]:
        duration = entry["expected"].get("duration_seconds")
        print(
            f"{entry['path']:52s} {entry['format']:6s} {str(duration):>12s}  {entry['supported']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
