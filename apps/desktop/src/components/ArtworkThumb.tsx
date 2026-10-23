import { useEffect, useState } from "react";
import { Music } from "lucide-react";

import { getArtwork } from "../services/api";

/** Cached cover art with a music-note placeholder when none is stored. */
export function ArtworkThumb({
  trackId,
  hasArtwork,
  large = false,
}: {
  trackId: string;
  hasArtwork: boolean;
  large?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasArtwork) {
      setSrc(null);
      return;
    }
    getArtwork({ trackId })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch((err) => {
        console.error("Failed to load artwork:", err);
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, hasArtwork]);

  if (!src) {
    return (
      <div
        className={
          large
            ? "flex h-20 w-20 items-center justify-center rounded-md border border-dj-border bg-dj-elevated"
            : "flex h-9 w-9 items-center justify-center rounded-sm border border-dj-border bg-dj-elevated"
        }
        title={hasArtwork ? "Loading artwork..." : "No embedded artwork"}
      >
        <Music className={large ? "h-8 w-8 text-dj-text-muted" : "h-4 w-4 text-dj-text-muted"} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={
        large
          ? "h-20 w-20 rounded-md border border-dj-border object-cover"
          : "h-9 w-9 rounded-sm border border-dj-border object-cover"
      }
    />
  );
}
