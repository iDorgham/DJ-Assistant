import { useState } from "react";
import type { TrackSummary } from "@dj-assistant/shared";
import { PanelRight } from "lucide-react";
import { formatTimecode, getBeatPosition } from "../../lib/waveform-generator";
import { formatBpm, formatKey } from "../../lib/library";
import { camelotColor } from "../../lib/camelot";

interface PlayerTrackLineProps {
  track: TrackSummary | null;
  positionMs: number;
  durationMs: number;
  bpm: number;
  gridOffsetMs?: number;
  /** Full uses the 24px line with hundredths; Mini uses the 20px line. */
  large?: boolean;
  isDarkTheme?: boolean;
  /** Opens the shared track panel for the loaded track. */
  onInspect?: (trigger: HTMLElement) => void;
}

/**
 * One line above the progress rail: title — artist on the left, BPM/key chips
 * (and the bar counter in Full), elapsed/total time flush right. The key chip
 * follows the Camelot wheel colour for the track's code.
 */
export function PlayerTrackLine({
  track,
  positionMs,
  durationMs,
  bpm,
  gridOffsetMs = 0,
  large = false,
  isDarkTheme = true,
  onInspect,
}: PlayerTrackLineProps) {
  const [showRemaining, setShowRemaining] = useState(false);

  const safeDuration = durationMs || track?.durationMs || 0;
  const elapsedText = formatTimecode(positionMs, large);
  const totalText = formatTimecode(safeDuration, large);
  const remainingMs = Math.max(0, safeDuration - positionMs);
  const remainingText = `-${formatTimecode(remainingMs, large)}`;
  const keyLabel = track ? formatKey(track.keyCamelot, track.keyClassical) : "-";
  const keyColor = camelotColor(track?.keyCamelot, isDarkTheme ? "dark" : "light");
  const beatPosition = getBeatPosition(positionMs, bpm || track?.bpm || 124, gridOffsetMs);

  return (
    <div className={`flex w-full min-w-0 shrink-0 items-center gap-3 ${large ? "h-6" : "h-5"}`}>
      {/* Identity: Title — Artist, single line */}
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span
          className={`truncate font-semibold text-dj-text ${
            large ? "text-[13px] leading-none" : "text-[12px] leading-none"
          }`}
          title={track ? `${track.title} — ${track.artist}` : "No track loaded"}
        >
          {track?.title || "No track selected"}
        </span>
        {track?.artist && (
          <>
            <span aria-hidden="true" className="shrink-0 text-[11px] text-dj-text-muted">
              —
            </span>
            <span className="truncate text-[11px] text-dj-text-secondary">{track.artist}</span>
          </>
        )}
      </div>

      {/* Musical metadata chips */}
      {track && (
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="flex items-center gap-1 rounded-sm border border-dj-border bg-dj-elevated px-2 py-0.5 font-mono text-[11px] font-semibold text-dj-text"
            title={`Track tempo: ${formatBpm(bpm || track.bpm)} BPM`}
          >
            <span className="text-[9px] uppercase tracking-wider text-dj-text-muted">BPM</span>
            <span className="tabular-nums">{formatBpm(bpm || track.bpm)}</span>
          </span>

          {(track.keyCamelot || track.keyClassical) && (
            <span
              className={`flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                keyColor ? "" : "border-dj-accent/30 bg-dj-accent/15 text-dj-accent"
              }`}
              style={
                keyColor
                  ? {
                      color: keyColor.hex,
                      borderColor: keyColor.border,
                      backgroundColor: keyColor.background,
                    }
                  : undefined
              }
              title={`Key: ${keyLabel}${keyColor ? " · Camelot wheel colour" : ""}`}
            >
              <span className="text-[9px] uppercase tracking-wider opacity-70">KEY</span>
              <span>{keyLabel}</span>
            </span>
          )}

          {large && (
            <span
              className="inline-flex items-center gap-1 rounded-sm border border-dj-border bg-dj-elevated px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums text-dj-text-secondary"
              title="Current bar and beat position"
            >
              <span className="text-[9px] uppercase tracking-wider text-dj-text-muted">Bar</span>
              <span>
                {beatPosition.bar}.{beatPosition.beat}
              </span>
            </span>
          )}
        </div>
      )}

      <div className="flex-1" />

      {track && onInspect && (
        <button
          type="button"
          onClick={(event) => onInspect(event.currentTarget)}
          aria-label={`Open the track panel for ${track.title || "Untitled"}`}
          title="Open track panel"
          className="shrink-0 rounded-sm p-0.5 text-dj-text-muted transition hover:bg-dj-elevated hover:text-dj-text focus-visible:outline-2 focus-visible:outline-dj-accent"
        >
          <PanelRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Time: elapsed / total — click toggles remaining */}
      <button
        type="button"
        onClick={() => setShowRemaining(!showRemaining)}
        className="shrink-0 cursor-pointer rounded-sm px-2 py-0.5 font-mono text-[12px] font-medium tabular-nums text-dj-text transition hover:bg-dj-elevated"
        title="Click to toggle remaining time"
      >
        <span className="font-semibold text-dj-accent">
          {showRemaining ? remainingText : elapsedText}
        </span>
        <span className="mx-1 text-dj-text-muted">/</span>
        <span className="text-dj-text-secondary">{totalText}</span>
      </button>
    </div>
  );
}
