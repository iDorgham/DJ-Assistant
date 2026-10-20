import { useState, useEffect } from "react";
import type { TrackSummary } from "@dj-assistant/shared";
import { Music, ZoomIn, ZoomOut, LocateFixed } from "lucide-react";
import { getArtwork } from "../../services/api";
import { formatTimecode, formatBarBeat } from "../../lib/waveform-generator";
import { formatBpm, formatKey } from "../../lib/library";

interface PlayerIdentityStripProps {
  track: TrackSummary | null;
  large?: boolean;
  positionMs: number;
  durationMs: number;
  bpm: number;
  gridOffsetMs: number;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
  followPlayhead?: boolean;
  onToggleFollow?: () => void;
}

export function PlayerIdentityStrip({
  track,
  large = false,
  positionMs,
  durationMs,
  bpm,
  gridOffsetMs,
  zoomLevel = 1,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  followPlayhead = true,
  onToggleFollow,
}: PlayerIdentityStripProps) {
  const [artworkSrc, setArtworkSrc] = useState<string | null>(null);
  const [showRemaining, setShowRemaining] = useState(false);

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

  const safeDuration = durationMs || track?.durationMs || 180000;
  const elapsedText = formatTimecode(positionMs, large);
  const totalText = formatTimecode(safeDuration, large);
  const remainingMs = Math.max(0, safeDuration - positionMs);
  const remainingText = `-${formatTimecode(remainingMs, large)}`;

  return (
    <div className={`flex items-center gap-3 w-full min-w-0 ${large ? "h-12 px-3 py-1" : "h-9"}`}>
      {/* Artwork */}
      <div
        className={`shrink-0 rounded-sm border border-dj-border bg-dj-elevated flex items-center justify-center overflow-hidden transition-all ${
          large ? "h-11 w-11" : "h-8 w-8"
        }`}
      >
        {artworkSrc ? (
          <img src={artworkSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <Music className={`text-dj-text-muted ${large ? "h-5 w-5" : "h-4 w-4"}`} />
        )}
      </div>

      {/* Identity: Title + Artist */}
      <div className="min-w-0 flex-1 max-w-[280px]">
        <p
          className={`truncate font-semibold text-dj-text ${
            large ? "text-[14px] leading-tight" : "text-[12px] leading-tight"
          }`}
          title={track ? `${track.title} — ${track.artist}` : "No track loaded"}
        >
          {track?.title || "No track selected"}
        </p>
        <p className="truncate text-[11px] text-dj-text-secondary leading-tight mt-0.5">
          {track?.artist || "Select a track to preview & validate"}
        </p>
      </div>

      {/* Musical Metadata Chips */}
      {track && (
        <div className="flex items-center gap-1.5 shrink-0">
          {/* BPM Chip */}
          <span
            className="rounded px-2 py-0.5 font-mono text-[11px] font-semibold bg-dj-elevated border border-dj-border text-dj-text flex items-center gap-1"
            title="Track tempo (BPM)"
          >
            <span className="text-[11px] uppercase tracking-wider text-dj-text-muted">BPM</span>
            <span>{formatBpm(bpm || track.bpm)}</span>
          </span>

          {/* Key Chip (Camelot) */}
          {(track.keyCamelot || track.keyClassical) && (
            <span
              className="rounded px-2 py-0.5 font-mono text-[11px] font-semibold bg-dj-accent/15 border border-dj-accent/30 text-dj-accent flex items-center gap-1"
              title={`Key: ${formatKey(track.keyCamelot, track.keyClassical)}`}
            >
              <span className="text-[11px] uppercase tracking-wider text-dj-accent/75">KEY</span>
              <span>{formatKey(track.keyCamelot, track.keyClassical)}</span>
            </span>
          )}

          {/* Honest disclosure in compact mode: the full player carries a
              "Synth preview audio" pill — mini mode must not hide it
              (critique 2026-10-19, docs/ui/06). */}
          {!large && (
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-dj-warning/15 border border-dj-warning/40 text-dj-warning"
              title="Preview audio is a synthesized timing beat — real audio decoding is not implemented yet"
            >
              Synth
            </span>
          )}

          {/* LUFS chip removed until real loudness analysis ships — docs/ui/06:
              never render fabricated analysis values. */}

          {/* Bar / Beat Counter */}
          {large && (
            <span
              className="inline-flex rounded px-2 py-0.5 font-mono text-[11px] font-medium bg-dj-elevated border border-dj-border text-dj-text-secondary"
              title="Current bar and beat position"
            >
              {formatBarBeat(positionMs, bpm || track.bpm || 124, gridOffsetMs)}
            </span>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Time Display: Elapsed / Total (Click to toggle remaining) */}
      <button
        type="button"
        onClick={() => setShowRemaining(!showRemaining)}
        className="shrink-0 rounded px-2 py-0.5 font-mono text-[12px] font-medium text-dj-text hover:bg-dj-elevated transition cursor-pointer"
        title="Click to toggle remaining time"
      >
        <span className="font-semibold text-dj-accent">
          {showRemaining ? remainingText : elapsedText}
        </span>
        <span className="text-dj-text-muted mx-1">/</span>
        <span className="text-dj-text-secondary">{totalText}</span>
      </button>

      {/* Zoom Controls (Full Mode Only) */}
      {large && (
        <div className="flex items-center gap-0.5 shrink-0 border-l border-dj-border pl-2 ml-1">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={zoomLevel <= 1.05}
            title="Zoom out (scroll down over the waveform)"
            className="rounded p-1 text-dj-text-secondary hover:text-dj-text hover:bg-dj-elevated disabled:opacity-40 transition"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>

          <span
            className="w-10 text-center font-mono text-[11px] text-dj-text-muted"
            title="Zoom multiplier"
          >
            {zoomLevel <= 1.05 ? "Fit" : `${zoomLevel.toFixed(1)}×`}
          </span>

          <button
            type="button"
            onClick={onZoomIn}
            disabled={zoomLevel >= 16}
            title="Zoom in (scroll up over the waveform)"
            className="rounded p-1 text-dj-text-secondary hover:text-dj-text hover:bg-dj-elevated disabled:opacity-40 transition"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onZoomFit}
            title="Fit entire track"
            className="rounded px-1.5 py-0.5 font-mono text-[11px] text-dj-text-secondary hover:text-dj-text hover:bg-dj-elevated transition border border-dj-border"
          >
            Fit
          </button>

          <button
            type="button"
            onClick={onToggleFollow}
            title={followPlayhead ? "Follow playhead: ON" : "Follow playhead: OFF"}
            aria-pressed={followPlayhead}
            className={`rounded p-1 transition ${
              followPlayhead
                ? "bg-dj-accent/15 text-dj-accent border border-dj-accent/30"
                : "text-dj-text-muted hover:text-dj-text hover:bg-dj-elevated"
            }`}
          >
            <LocateFixed className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
