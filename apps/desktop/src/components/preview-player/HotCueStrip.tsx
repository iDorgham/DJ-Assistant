import React from "react";
import type { HotCueData } from "../../lib/waveform-generator";
import { formatTimecode } from "../../lib/waveform-generator";

interface HotCueStripProps {
  cues: HotCueData[];
  onTriggerCue: (slot: number) => void;
  onSetCue: (slot: number) => void;
  onClearCue: (slot: number) => void;
  compact?: boolean;
}

export function HotCueStrip({
  cues,
  onTriggerCue,
  onSetCue,
  onClearCue,
  compact = false,
}: HotCueStripProps) {
  const handleClick = (e: React.MouseEvent, cue: HotCueData) => {
    e.preventDefault();
    if (e.shiftKey) {
      if (cue.positionMs !== null) {
        onClearCue(cue.slot);
      }
      return;
    }

    if (cue.positionMs !== null) {
      onTriggerCue(cue.slot);
    } else {
      onSetCue(cue.slot);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, cue: HotCueData) => {
    e.preventDefault();
    if (cue.positionMs !== null) {
      onClearCue(cue.slot);
    }
  };

  return (
    <div
      className="flex items-center gap-1.5 w-full"
      role="toolbar"
      aria-label="Hot cue pads (A through H)"
    >
      {cues.map((cue) => {
        const isSet = cue.positionMs !== null;
        return (
          <div key={cue.letter} className="group relative flex-1 min-w-[36px] max-w-[80px]">
            <button
              type="button"
              onClick={(e) => handleClick(e, cue)}
              onContextMenu={(e) => handleContextMenu(e, cue)}
              title={
                isSet
                  ? `Hot cue ${cue.letter} (${formatTimecode(cue.positionMs!, true)}) — Click to jump · clear with the × or right-click (Key: ${cue.slot})`
                  : `Hot cue ${cue.letter} (Empty) — Click to set at current position (Key: ${cue.slot})`
              }
              className={`w-full transition-all select-none flex flex-col items-center justify-center ${
                compact ? "h-7 px-1" : "h-[30px] px-1.5"
              } ${
                isSet
                  ? "bg-dj-elevated border hover:brightness-110 active:scale-95"
                  : "bg-dj-bg/60 border border-dashed border-dj-border hover:border-dj-border-strong hover:bg-dj-elevated/40"
              }`}
              style={{
                borderColor: isSet ? cue.colorHex : undefined,
                boxShadow: isSet ? `0 0 6px ${cue.colorHex}22` : undefined,
              }}
            >
              {/* Top accent line if set — Carbon 2px indicator bar */}
              {isSet && (
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ backgroundColor: cue.colorHex }}
                />
              )}

              <div className="flex items-center gap-1 leading-none">
                <span
                  className="font-mono font-bold text-[11px]"
                  style={{ color: isSet ? cue.colorHex : "var(--color-dj-text-muted)" }}
                >
                  {cue.letter}
                </span>

                {isSet && !compact && (
                  <span className="font-mono text-[11px] leading-none text-dj-text-secondary truncate">
                    {formatTimecode(cue.positionMs!, false)}
                  </span>
                )}
              </div>
            </button>

            {/* Visible clear affordance for set cues — Carbon flat close button style */}
            {isSet && (
              <button
                type="button"
                onClick={() => onClearCue(cue.slot)}
                aria-label={`Clear hot cue ${cue.letter}`}
                title={`Clear hot cue ${cue.letter} — Undo offered after clearing`}
                className="absolute -top-1.5 -right-1.5 z-10 flex h-4 w-4 items-center justify-center border border-dj-border bg-dj-overlay text-[11px] leading-none text-dj-text-secondary shadow-sm transition opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto hover:border-dj-danger hover:text-dj-danger"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
