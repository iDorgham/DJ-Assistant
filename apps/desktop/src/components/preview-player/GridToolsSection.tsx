import { useState } from "react";
import { ChevronLeft, ChevronRight, Magnet, RotateCcw } from "lucide-react";

interface GridToolsSectionProps {
  snapMode: "off" | "beat" | "bar";
  onToggleSnap: () => void;
  onNudge: (deltaMs: number) => void;
  onBpmFine: (deltaBpm: number) => void;
  onResetGrid: () => void;
  onJumpBeats: (beats: number) => void;
}

/**
 * Compact grid toolbar used in Full's "Grid & beat" panel. Every control keeps
 * a visible label or tooltip; the group scrolls horizontally rather than
 * silently dropping controls when the dock is narrow (docs/ui/12).
 */
export function GridToolsSection({
  snapMode,
  onToggleSnap,
  onNudge,
  onBpmFine,
  onResetGrid,
  onJumpBeats,
}: GridToolsSectionProps) {
  const [jumpSize, setJumpSize] = useState<number>(4);

  return (
    <div
      className="flex h-7 min-w-max items-center gap-1.5 text-xs"
      role="toolbar"
      aria-label="Beat grid and navigation tools"
    >
      {/* Beat Jump Controls */}
      <div
        className="flex h-7 items-center rounded-sm border border-dj-border bg-dj-bg p-0.5"
        title="Beat Jump"
      >
        <button
          type="button"
          onClick={() => onJumpBeats(-jumpSize)}
          title={`Jump back ${jumpSize} beats`}
          aria-label={`Jump back ${jumpSize} beats`}
          className="flex h-6 w-6 items-center justify-center rounded-[1px] text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <label className="sr-only" htmlFor="beat-jump-size">
          Beat jump size
        </label>
        <select
          id="beat-jump-size"
          value={jumpSize}
          onChange={(e) => setJumpSize(Number(e.target.value))}
          className="h-6 w-10 cursor-pointer rounded-[1px] border-0 bg-transparent px-0.5 text-center font-mono text-[10px] font-semibold text-dj-text outline-none transition hover:bg-dj-hover"
          title="Beats to jump"
        >
          {[1, 4, 8, 16, 32].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onJumpBeats(jumpSize)}
          title={`Jump forward ${jumpSize} beats`}
          aria-label={`Jump forward ${jumpSize} beats`}
          className="flex h-6 w-6 items-center justify-center rounded-[1px] text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <span aria-hidden="true" className="h-4 w-px shrink-0 bg-dj-border" />

      {/* Grid Snap Toggle */}
      <button
        type="button"
        onClick={onToggleSnap}
        aria-pressed={snapMode !== "off"}
        title={`Grid snap: ${snapMode.toUpperCase()} — click to cycle off → beat → bar`}
        className={`flex h-7 shrink-0 items-center gap-1 rounded-sm border px-2 font-mono text-[10px] font-semibold uppercase tracking-wider transition ${
          snapMode !== "off"
            ? "border-dj-accent/70 bg-dj-accent/15 text-dj-accent"
            : "border-dj-border bg-dj-bg text-dj-text-muted hover:text-dj-text"
        }`}
      >
        <Magnet className="h-3 w-3" />
        <span>{snapMode === "off" ? "Snap off" : snapMode}</span>
      </button>

      <span aria-hidden="true" className="h-4 w-px shrink-0 bg-dj-border" />

      {/* Grid Nudge Controls */}
      <div
        className="flex h-7 items-center gap-0.5 rounded-sm border border-dj-border bg-dj-bg px-1"
        title="Fine grid nudge in 10 ms steps"
      >
        <span className="px-0.5 font-mono text-[9px] uppercase tracking-wider text-dj-text-muted">
          Grid
        </span>
        <button
          type="button"
          onClick={() => onNudge(-10)}
          title="Nudge grid left 10 ms"
          aria-label="Nudge grid left 10 milliseconds"
          className="h-5 min-w-6 rounded-[1px] px-1 font-mono text-[10px] tabular-nums text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
        >
          −10
        </button>
        <button
          type="button"
          onClick={() => onNudge(10)}
          title="Nudge grid right 10 ms"
          aria-label="Nudge grid right 10 milliseconds"
          className="h-5 min-w-6 rounded-[1px] px-1 font-mono text-[10px] tabular-nums text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
        >
          +10
        </button>
      </div>

      {/* BPM Fine Calibration — always visible, never silently hidden */}
      <div
        className="flex h-7 items-center gap-0.5 rounded-sm border border-dj-border bg-dj-bg px-1"
        title="BPM calibration in 0.1 BPM steps"
      >
        <span className="px-0.5 font-mono text-[9px] uppercase tracking-wider text-dj-text-muted">
          BPM
        </span>
        <button
          type="button"
          onClick={() => onBpmFine(-0.1)}
          title="BPM −0.1"
          aria-label="Decrease BPM by 0.1"
          className="h-5 min-w-7 rounded-[1px] px-1 font-mono text-[10px] tabular-nums text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
        >
          −.1
        </button>
        <button
          type="button"
          onClick={() => onBpmFine(0.1)}
          title="BPM +0.1"
          aria-label="Increase BPM by 0.1"
          className="h-5 min-w-7 rounded-[1px] px-1 font-mono text-[10px] tabular-nums text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
        >
          +.1
        </button>
      </div>

      {/* Reset Grid */}
      <button
        type="button"
        onClick={onResetGrid}
        title="Reset grid offset and BPM calibration"
        aria-label="Reset grid offset and BPM calibration"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-dj-text-muted transition hover:bg-dj-hover hover:text-dj-text"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
