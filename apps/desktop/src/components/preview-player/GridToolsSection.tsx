import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Magnet } from "lucide-react";

interface GridToolsSectionProps {
  snapMode: "off" | "beat" | "bar";
  onToggleSnap: () => void;
  onNudge: (deltaMs: number) => void;
  onBpmFine: (deltaBpm: number) => void;
  onResetGrid: () => void;
  onJumpBeats: (beats: number) => void;
}

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
      className="flex items-center gap-2 shrink-0 text-xs border-l border-dj-border pl-2.5"
      role="toolbar"
      aria-label="Beat grid and navigation tools"
    >
      {/* Beat Jump Controls */}
      <div
        className="flex items-center rounded border border-dj-border bg-dj-elevated p-0.5"
        title="Beat Jump"
      >
        <button
          type="button"
          onClick={() => onJumpBeats(-jumpSize)}
          title={`Jump back ${jumpSize} beats`}
          aria-label={`Jump back ${jumpSize} beats`}
          className="rounded px-1.5 py-1 text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Jump Size Selector */}
        <div className="flex items-center gap-0.5 px-1 font-mono text-[11px]">
          {[1, 4, 8, 16, 32].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setJumpSize(size)}
              className={`rounded px-1 py-0.5 font-medium transition ${
                jumpSize === size
                  ? "bg-dj-active text-dj-accent"
                  : "text-dj-text-muted hover:text-dj-text"
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onJumpBeats(jumpSize)}
          title={`Jump forward ${jumpSize} beats`}
          aria-label={`Jump forward ${jumpSize} beats`}
          className="rounded px-1.5 py-1 text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Grid Snap Toggle */}
      <button
        type="button"
        onClick={onToggleSnap}
        title={`Grid snap: ${snapMode.toUpperCase()} (Click to toggle)`}
        className={`flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] font-semibold border transition select-none ${
          snapMode !== "off"
            ? "border-dj-accent bg-dj-accent/15 text-dj-accent"
            : "border-dj-border bg-dj-elevated text-dj-text-muted hover:text-dj-text"
        }`}
      >
        <Magnet className="h-3 w-3" />
        <span>{snapMode === "off" ? "SNAP" : snapMode.toUpperCase()}</span>
      </button>

      {/* Grid Nudge Controls */}
      <div
        className="flex items-center rounded border border-dj-border bg-dj-elevated p-0.5"
        title="Fine grid nudge"
      >
        <button
          type="button"
          onClick={() => onNudge(-10)}
          title="Nudge grid left (-10ms)"
          className="rounded px-1.5 py-0.5 font-mono text-[11px] text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
        >
          &lt; NUDGE
        </button>
        <span className="text-dj-border mx-0.5">|</span>
        <button
          type="button"
          onClick={() => onNudge(10)}
          title="Nudge grid right (+10ms)"
          className="rounded px-1.5 py-0.5 font-mono text-[11px] text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
        >
          NUDGE &gt;
        </button>
      </div>

      {/* BPM Fine Calibration — always visible, never silently hidden */}
      <div
        className="flex items-center rounded border border-dj-border bg-dj-elevated p-0.5"
        title="BPM calibration"
      >
        <button
          type="button"
          onClick={() => onBpmFine(-0.1)}
          title="BPM -0.1"
          className="rounded px-1.5 py-0.5 font-mono text-[11px] text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
        >
          -0.1
        </button>
        <span className="text-dj-border mx-0.5">|</span>
        <button
          type="button"
          onClick={() => onBpmFine(0.1)}
          title="BPM +0.1"
          className="rounded px-1.5 py-0.5 font-mono text-[11px] text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
        >
          +0.1
        </button>
      </div>

      {/* Reset Grid */}
      <button
        type="button"
        onClick={onResetGrid}
        title="Reset grid offset and calibration"
        aria-label="Reset grid"
        className="rounded p-1 text-dj-text-muted hover:text-dj-text hover:bg-dj-elevated transition"
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
}
