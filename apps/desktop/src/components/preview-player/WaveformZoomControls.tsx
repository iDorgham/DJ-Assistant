import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";

interface WaveformZoomControlsProps {
  zoomLevel: number;
  followPlayhead: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onToggleFollow: () => void;
}

/**
 * Floating zoom cluster pinned to the detailed waveform's top-right.
 * Zoom affects the detailed waveform only (docs/ui/06 §3).
 */
export function WaveformZoomControls({
  zoomLevel,
  followPlayhead,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onToggleFollow,
}: WaveformZoomControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Waveform zoom"
      className="flex items-center gap-0.5 rounded border border-dj-border bg-dj-overlay/90 px-1 py-0.5 shadow-sm backdrop-blur-xs"
    >
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoomLevel <= 1.05}
        title="Zoom out (scroll down over the waveform)"
        aria-label="Zoom out"
        className="flex h-5 w-5 items-center justify-center rounded text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text disabled:opacity-40"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>

      <span
        className="min-w-[30px] text-center font-mono text-[10px] tabular-nums text-dj-text-muted"
        title="Zoom multiplier"
      >
        {zoomLevel <= 1.05 ? "Fit" : `${zoomLevel.toFixed(1)}×`}
      </span>

      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoomLevel >= 16}
        title="Zoom in (scroll up over the waveform)"
        aria-label="Zoom in"
        className="flex h-5 w-5 items-center justify-center rounded text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text disabled:opacity-40"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={onZoomFit}
        title="Fit entire track"
        className="rounded border border-dj-border px-1.5 py-0.5 font-mono text-[10px] text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
      >
        Fit
      </button>

      <button
        type="button"
        onClick={onToggleFollow}
        title={followPlayhead ? "Follow playhead: ON" : "Follow playhead: OFF"}
        aria-label="Follow playhead"
        aria-pressed={followPlayhead}
        className={`flex h-5 w-5 items-center justify-center rounded transition ${
          followPlayhead
            ? "border border-dj-accent/30 bg-dj-accent/15 text-dj-accent"
            : "text-dj-text-muted hover:bg-dj-hover hover:text-dj-text"
        }`}
      >
        <LocateFixed className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
