import { useEffect, useState } from "react";
import type { TrackSummary } from "@dj-assistant/shared";
import { Music } from "lucide-react";
import { getArtwork } from "../../services/api";

interface PlayerArtworkRailProps {
  track: TrackSummary | null;
  /**
   * "full" — the 160px hero cover used in Full/Extended (larger than Mini).
   * "fill" — spans the whole dock height (Mini, ~91px at 104px).
   */
  size?: "full" | "fill";
}

/**
 * Artwork-only left rail. BPM/key deliberately live on the track line — the
 * artwork column carries the cover and nothing else (docs/ui/06A §8.1).
 */
export function PlayerArtworkRail({ track, size = "full" }: PlayerArtworkRailProps) {
  const [artworkSrc, setArtworkSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!track?.artworkHash) {
      setArtworkSrc(null);
      return;
    }
    getArtwork({ trackId: track.id })
      .then((dataUrl) => {
        if (!cancelled) setArtworkSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setArtworkSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [track?.id, track?.artworkHash]);

  const fill = size === "fill";

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-dj-border bg-dj-elevated ${
        fill ? "h-full aspect-square" : "h-40 w-40"
      }`}
      title={track ? `${track.title} — ${track.artist}` : "No track loaded"}
    >
      {artworkSrc ? (
        <img src={artworkSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        <Music
          aria-hidden="true"
          className={`text-dj-text-muted ${fill ? "h-7 w-7" : "h-10 w-10"}`}
        />
      )}
    </div>
  );
}
