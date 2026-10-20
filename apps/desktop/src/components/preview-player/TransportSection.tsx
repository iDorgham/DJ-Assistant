import { Play, Pause, Square, Volume2, VolumeX } from "lucide-react";

interface TransportSectionProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onCue: () => void;
  cueActive?: boolean;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  compact?: boolean;
}

export function TransportSection({
  isPlaying,
  onPlayPause,
  onStop,
  onCue,
  cueActive = false,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  compact = false,
}: TransportSectionProps) {
  return (
    <div className="flex items-center gap-1.5 shrink-0" role="toolbar" aria-label="Audio transport">
      {/* CUE Button */}
      <button
        type="button"
        onClick={onCue}
        title="CUE: Set temporary cue when paused / return to cue when playing (C)"
        className={`rounded px-2.5 font-mono font-bold text-xs flex items-center transition select-none ${
          compact ? "h-7" : "h-8"
        } ${
          cueActive
            ? "bg-dj-cue text-white shadow-sm shadow-dj-cue/30"
            : "bg-dj-elevated border border-dj-border text-dj-text hover:bg-dj-hover hover:border-dj-border-strong active:bg-dj-cue/20"
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
        className={`rounded px-3 flex items-center justify-center transition select-none ${
          compact ? "h-7 min-w-[34px]" : "h-8 min-w-[40px]"
        } ${
          isPlaying
            ? "bg-dj-accent text-dj-on-accent shadow-md shadow-dj-accent/25 hover:bg-dj-accent-strong"
            : "bg-dj-elevated border border-dj-border text-dj-text hover:bg-dj-hover hover:border-dj-border-strong hover:text-dj-accent"
        }`}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Stop Button (docs/ui/06 §5 Transport) */}
      <button
        type="button"
        onClick={onStop}
        title="Stop and return to cue"
        aria-label="Stop"
        className={`rounded p-1.5 bg-dj-elevated border border-dj-border text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition select-none ${
          compact ? "h-7 w-7" : "h-8 w-8"
        } flex items-center justify-center`}
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>

      {/* Volume Control (Compact Horizontal Fader) */}
      {!compact && (
        <div className="flex items-center gap-1 ml-2 border-l border-dj-border pl-2 group">
          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? "Unmute preview" : "Mute preview"}
            aria-label={isMuted ? "Unmute preview" : "Mute preview"}
            aria-pressed={isMuted}
            className="rounded p-1 text-dj-text-secondary hover:text-dj-text transition"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-3.5 w-3.5 text-dj-danger" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
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
            className="w-14 h-1 bg-dj-border rounded-lg appearance-none cursor-pointer accent-dj-accent"
          />
        </div>
      )}
    </div>
  );
}
