import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface TransportCoreProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onCue: () => void;
  cueActive?: boolean;
  compact?: boolean;
}

/**
 * CUE + Play/Pause. Leads the transport row, immediately right of the artwork
 * and left of the volume group. There is no Stop button — pause is the
 * stop-like action (docs/plan/03-player/player-model-and-layouts.md §7).
 */
export function TransportCore({
  isPlaying,
  onPlayPause,
  onCue,
  cueActive = false,
  compact = false,
}: TransportCoreProps) {
  return (
    <div className="flex shrink-0 items-center gap-1.5" role="toolbar" aria-label="Audio transport">
      {/* CUE Button */}
      <button
        type="button"
        onClick={onCue}
        title="CUE: Set temporary cue when paused / return to cue when playing (C)"
        className={`flex select-none items-center rounded px-2.5 font-mono text-xs font-bold transition ${
          compact ? "h-7" : "h-8"
        } ${
          cueActive
            ? "bg-dj-cue text-white shadow-sm shadow-dj-cue/30"
            : "border border-dj-border bg-dj-elevated text-dj-text hover:border-dj-border-strong hover:bg-dj-hover active:bg-dj-cue/20"
        }`}
      >
        <span>CUE</span>
      </button>

      {/* Play / Pause Primary Button */}
      <button
        type="button"
        onClick={onPlayPause}
        title={
          isPlaying
            ? "Pause preview (Space)"
            : "Play preview — synthesized timing beat; decoding the real audio file is not implemented yet (Space)"
        }
        aria-label={isPlaying ? "Pause" : "Play"}
        className={`flex select-none items-center justify-center rounded px-3 transition ${
          compact ? "h-7 min-w-[34px]" : "h-8 min-w-[40px]"
        } ${
          isPlaying
            ? "bg-dj-accent text-dj-on-accent shadow-md shadow-dj-accent/25 hover:bg-dj-accent-strong"
            : "border border-dj-border bg-dj-elevated text-dj-text hover:border-dj-border-strong hover:bg-dj-hover hover:text-dj-accent"
        }`}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        )}
      </button>
    </div>
  );
}

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  /** Mini keeps the mute toggle only; the fader lives in Full. */
  compact?: boolean;
}

export function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  compact = false,
}: VolumeControlProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-l border-dj-border pl-2">
      <button
        type="button"
        onClick={onToggleMute}
        title={isMuted ? "Unmute preview" : "Mute preview"}
        aria-label={isMuted ? "Unmute preview" : "Mute preview"}
        aria-pressed={isMuted}
        className="rounded p-1 text-dj-text-secondary transition hover:text-dj-text"
      >
        {isMuted || volume === 0 ? (
          <VolumeX className="h-3.5 w-3.5 text-dj-danger" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </button>

      {!compact && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          title={`Preview Volume: ${Math.round(volume * 100)}%${isMuted ? " (muted)" : ""}`}
          aria-label="Preview volume"
          aria-valuetext={`${Math.round(volume * 100)} percent${isMuted ? ", muted" : ""}`}
          className="h-1 w-14 cursor-pointer appearance-none rounded-lg bg-dj-border accent-dj-accent"
        />
      )}
    </div>
  );
}
