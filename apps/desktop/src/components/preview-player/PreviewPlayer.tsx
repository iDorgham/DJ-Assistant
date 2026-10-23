import React, { useState, useEffect, useRef, useCallback } from "react";
import type { TrackSummary } from "@dj-assistant/shared";
import { Maximize2, Minimize2, X, Music } from "lucide-react";
import type { PlayerMode } from "../../lib/ui-state";
import {
  getOrGenerateWaveform,
  createDefaultHotCues,
  type WaveformData,
  type HotCueData,
} from "../../lib/waveform-generator";
import { previewEngine, type PlaybackState } from "../../lib/audio-engine";
import { DetailedWaveform } from "./DetailedWaveform";
import { OverviewMap } from "./OverviewMap";
import { CompactWaveform } from "./CompactWaveform";
import { PlayerIdentityStrip } from "./PlayerIdentityStrip";
import { TransportSection } from "./TransportSection";
import { HotCueStrip } from "./HotCueStrip";
import { GridToolsSection } from "./GridToolsSection";

export interface PreviewPlayerProps {
  mode: PlayerMode;
  track: TrackSummary | null;
  onModeChange: (mode: PlayerMode) => void;
  onHide: () => void;
  activeView?: string;
  isDarkTheme?: boolean;
}

const STORAGE_CUES_PREFIX = "dj-assistant.hot-cues.v1:";
const DEFAULT_MINI_HEIGHT = 80;
const DEFAULT_FULL_HEIGHT = 246;

export function PreviewPlayer({
  mode,
  track,
  onModeChange,
  onHide,
  activeView = "library",
  isDarkTheme = true,
}: PreviewPlayerProps) {
  // Height state: supports live dragging continuum
  const [height, setHeight] = useState<number>(() => {
    return mode === "full" ? DEFAULT_FULL_HEIGHT : DEFAULT_MINI_HEIGHT;
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);

  // Playback engine state
  const [playback, setPlayback] = useState<PlaybackState>(() => previewEngine.getState());
  const [waveform, setWaveform] = useState<WaveformData | null>(null);

  // Grid & navigation state
  const [gridOffsetMs, setGridOffsetMs] = useState(0);
  const [bpmTweak, setBpmTweak] = useState(0);
  const [snapMode, setSnapMode] = useState<"off" | "beat" | "bar">("beat");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewOffsetMs, setViewOffsetMs] = useState(0);
  const [followPlayhead, setFollowPlayhead] = useState(true);

  // Cues state
  const [hotCues, setHotCues] = useState<HotCueData[]>([]);
  const [tempCueMs, setTempCueMs] = useState<number | null>(0);
  const [cueActive, setCueActive] = useState(false);
  // Undo affordance for destructive cue clearing (docs/ui/08: every destructive
  // action gets a visible, keyboard-reachable Undo — not a hidden modifier).
  const [clearedCue, setClearedCue] = useState<HotCueData | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const containerRef = useRef<HTMLElement>(null);

  // Sync mode changes with target heights
  useEffect(() => {
    if (mode === "mini") {
      setHeight(DEFAULT_MINI_HEIGHT);
    } else if (mode === "full") {
      setHeight((h) => (h > 140 ? h : DEFAULT_FULL_HEIGHT));
    }
  }, [mode]);

  // Subscribe to audio engine
  useEffect(() => {
    const unsubscribe = previewEngine.subscribe((state) => {
      setPlayback(state);
    });
    return unsubscribe;
  }, []);

  // When track changes, load into audio engine and generate waveform
  useEffect(() => {
    if (!track) {
      previewEngine.stop();
      setWaveform(null);
      setHotCues([]);
      setTempCueMs(null);
      return;
    }

    const duration = track.durationMs || 240000;
    const baseBpm = track.bpm || 124;
    previewEngine.loadTrack(duration, baseBpm + bpmTweak);

    const generated = getOrGenerateWaveform(
      track.id,
      duration,
      baseBpm + bpmTweak,
      track.fileHash || track.id
    );
    setWaveform(generated);
    setViewOffsetMs(0);
    setZoomLevel(1);
    setTempCueMs(0);

    // Load persisted or default hot cues
    try {
      const stored = localStorage.getItem(`${STORAGE_CUES_PREFIX}${track.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHotCues(createDefaultHotCues(duration, baseBpm, parsed));
      } else {
        setHotCues(createDefaultHotCues(duration, baseBpm));
      }
    } catch {
      setHotCues(createDefaultHotCues(duration, baseBpm));
    }
  }, [track?.id]);

  // Save hot cues when modified
  const persistCues = (updated: HotCueData[]) => {
    setHotCues(updated);
    if (!track) return;
    try {
      const serialized = updated
        .filter((c) => c.positionMs !== null)
        .map((c) => ({ slot: c.slot, positionMs: c.positionMs, label: c.label }));
      localStorage.setItem(`${STORAGE_CUES_PREFIX}${track.id}`, JSON.stringify(serialized));
    } catch {
      // Storage best-effort
    }
  };

  // Clear the pending undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  // Follow playhead logic when zoomed in
  useEffect(() => {
    if (!followPlayhead || zoomLevel <= 1.05 || !waveform) return;
    const visibleDuration = waveform.durationMs / zoomLevel;
    const currentPos = playback.positionMs;

    // If playhead wanders out of the middle 60% of visible window, re-center
    const relPos = currentPos - viewOffsetMs;
    if (relPos < visibleDuration * 0.15 || relPos > visibleDuration * 0.85) {
      const nextOffset = Math.max(
        0,
        Math.min(currentPos - visibleDuration * 0.35, waveform.durationMs - visibleDuration)
      );
      setViewOffsetMs(nextOffset);
    }
  }, [playback.positionMs, followPlayhead, zoomLevel, waveform]);

  // Keyboard controls (Space, 1-8, C) when player is focused or active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;

      // Typing fields own every key.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Space/Enter belong to the focused interactive control (native button
      // activation); the player's own shortcuts (C, 1–8) still work regardless
      // of what has focus — only typing fields swallow them.
      const role = target?.getAttribute("role");
      const ownsActivationKey =
        !!target &&
        (target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          role === "button" ||
          role === "slider" ||
          role === "separator");
      if (ownsActivationKey && (e.code === "Space" || e.key === "Enter")) return;

      if (e.code === "Space") {
        e.preventDefault();
        previewEngine.togglePlayPause();
        return;
      }

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleCuePress();
        return;
      }

      // Hot cues 1 through 8
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= 8 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleTriggerHotCue(digit);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playback.isPlaying, tempCueMs, hotCues]);

  // CUE button handler
  const handleCuePress = useCallback(() => {
    if (playback.isPlaying) {
      // If playing: return to temporary cue position and pause
      previewEngine.pause();
      if (tempCueMs !== null) {
        previewEngine.seek(tempCueMs);
      }
      setCueActive(true);
      setTimeout(() => setCueActive(false), 200);
    } else {
      // If paused: set temporary cue to current playhead position
      setTempCueMs(playback.positionMs);
      setCueActive(true);
      setTimeout(() => setCueActive(false), 200);
    }
  }, [playback.isPlaying, playback.positionMs, tempCueMs]);

  // Trigger Hot Cue A-H
  const handleTriggerHotCue = (slot: number) => {
    const cue = hotCues.find((c) => c.slot === slot);
    if (!cue) return;
    if (cue.positionMs !== null) {
      previewEngine.seek(cue.positionMs);
      if (!playback.isPlaying) {
        previewEngine.play();
      }
    } else {
      // Empty: set cue at current position
      handleSetHotCue(slot);
    }
  };

  // Set Hot Cue at current position
  const handleSetHotCue = (slot: number) => {
    const updated = hotCues.map((c) => {
      if (c.slot === slot) {
        return {
          ...c,
          positionMs: Math.round(playback.positionMs),
          label: `Cue ${c.letter}`,
        };
      }
      return c;
    });
    persistCues(updated);
  };

  // Clear Hot Cue — destructive, so offer a visible Undo for a few seconds
  const handleClearHotCue = (slot: number) => {
    const previous = hotCues.find((c) => c.slot === slot);
    const updated = hotCues.map((c) => {
      if (c.slot === slot) {
        return { ...c, positionMs: null };
      }
      return c;
    });
    persistCues(updated);

    if (previous && previous.positionMs !== null) {
      setClearedCue(previous);
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = window.setTimeout(() => setClearedCue(null), 6000);
    }
  };

  const handleUndoClearCue = () => {
    if (!clearedCue) return;
    const restored = clearedCue;
    const updated = hotCues.map((c) =>
      c.slot === restored.slot
        ? { ...c, positionMs: restored.positionMs, label: restored.label }
        : c
    );
    persistCues(updated);
    setClearedCue(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  };

  // Splitter Dragging (Live height resize)
  const applySplitterHeight = (rawHeight: number) => {
    const nextHeight = Math.max(72, Math.min(rawHeight, 440));
    setHeight(nextHeight);

    if (nextHeight >= 140 && mode !== "full") {
      onModeChange("full");
    } else if (nextHeight < 140 && mode !== "mini") {
      onModeChange("mini");
    }
  };

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);

    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const deltaY = startY - moveEvt.clientY; // Dragging up increases height
      applySplitterHeight(startHeight + deltaY);
    };

    const onMouseUp = () => {
      setIsDraggingSplitter(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Splitter Double-Click: Resets to workspace default
  const handleSplitterDoubleClick = () => {
    const defaultHeight = activeView === "preparation" ? DEFAULT_FULL_HEIGHT : DEFAULT_MINI_HEIGHT;
    const defaultMode = activeView === "preparation" ? "full" : "mini";
    setHeight(defaultHeight);
    onModeChange(defaultMode);
  };

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(16, z * 1.5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(1, z / 1.5));
  const handleZoomFit = () => {
    setZoomLevel(1);
    setViewOffsetMs(0);
  };

  const isFullView = height >= 140;

  return (
    <section
      ref={containerRef}
      aria-label="Preview player"
      style={{ height: `${height}px` }}
      className={`relative shrink-0 flex flex-col bg-dj-panel border-t border-dj-border select-none overflow-hidden ${
        isDraggingSplitter ? "transition-none" : "transition-[height] duration-250 ease-out"
      }`}
    >
      {/* ── Top Hairline Splitter Handle ─────────────────────────────────── */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Player height"
        aria-valuenow={height}
        aria-valuemin={72}
        aria-valuemax={440}
        tabIndex={0}
        onMouseDown={handleSplitterMouseDown}
        onDoubleClick={handleSplitterDoubleClick}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            applySplitterHeight(height + (e.key === "ArrowUp" ? 16 : -16));
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSplitterDoubleClick();
          }
        }}
        title="Drag or use ↑/↓ to resize player height · Double-click / Enter to reset"
        className="group absolute top-0 left-0 right-0 h-2 z-30 cursor-row-resize flex items-center justify-center hover:bg-dj-accent/20 transition-colors"
      >
        <div className="w-12 h-[2px] rounded-full bg-dj-border-strong group-hover:bg-dj-accent transition-colors" />
      </div>

      {/* ── Cue-clear undo toast (docs/ui/08: visible, keyboard-reachable Undo) ── */}
      {clearedCue && (
        <div
          role="status"
          className="absolute bottom-2 right-3 z-40 flex items-center gap-2.5 rounded border border-dj-border bg-dj-overlay px-3 py-1.5 shadow-lg text-[11px] text-dj-text"
        >
          <span className="text-dj-text-secondary">Hot cue {clearedCue.letter} cleared.</span>
          <button
            type="button"
            onClick={handleUndoClearCue}
            className="rounded px-2 py-0.5 font-medium text-dj-accent hover:bg-dj-hover transition"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setClearedCue(null)}
            aria-label="Dismiss cue cleared notification"
            className="rounded px-1 text-dj-text-muted hover:text-dj-text transition"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Player Body ─────────────────────────────────────────────────── */}
      {isFullView ? (
        /* ════════ FULL MODE (Detailed Waveform + Overview + Controls) ════ */
        <div className="flex flex-col h-full min-h-0 pt-2 px-3 pb-2 gap-1.5 justify-between">
          {/* Identity & Zoom Strip */}
          <div className="flex items-center justify-between shrink-0">
            <PlayerIdentityStrip
              track={track}
              large={true}
              positionMs={playback.positionMs}
              durationMs={playback.durationMs}
              bpm={track?.bpm || 124}
              gridOffsetMs={gridOffsetMs}
              zoomLevel={zoomLevel}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onZoomFit={handleZoomFit}
              followPlayhead={followPlayhead}
              onToggleFollow={() => setFollowPlayhead(!followPlayhead)}
            />

            {/* Honest playback disclosure: engine synthesizes beats until real
                audio decoding ships — docs/ui/06 forbids implied playback. */}
            <span
              className="rounded border border-dj-warning/40 bg-dj-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-dj-warning"
              title="Preview audio is a synthesized timing beat — decoding the real audio file is not implemented yet."
            >
              Synth preview audio
            </span>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                type="button"
                onClick={() => {
                  setHeight(DEFAULT_MINI_HEIGHT);
                  onModeChange("mini");
                }}
                title="Collapse player to Mini (72-88px)"
                aria-label="Collapse to Mini"
                className="rounded p-1 text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onHide}
                title="Hide preview player"
                aria-label="Hide player"
                className="rounded p-1 text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Primary Detailed Waveform Area */}
          <div className="flex-1 min-h-0 rounded border border-dj-border overflow-hidden relative">
            {track ? (
              <DetailedWaveform
                waveform={waveform}
                positionMs={playback.positionMs}
                durationMs={playback.durationMs}
                bpm={track.bpm || 124}
                gridOffsetMs={gridOffsetMs}
                zoomLevel={zoomLevel}
                viewOffsetMs={viewOffsetMs}
                onViewOffsetChange={setViewOffsetMs}
                onSeek={(ms) => previewEngine.seek(ms)}
                snapMode={snapMode}
                hotCues={hotCues}
                cuePositionMs={tempCueMs}
                isDarkTheme={isDarkTheme}
                onWheelZoom={(dir) =>
                  setZoomLevel((z) => Math.max(1, Math.min(16, dir === "in" ? z * 1.25 : z / 1.25)))
                }
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-dj-text-muted">
                <Music className="h-7 w-7 opacity-40" />
                <p className="text-xs font-medium">Select a track to preview & validate</p>
                <p className="text-[11px] text-dj-text-muted max-w-sm">
                  Space: Play/Pause · 1–8: Hot Cues · C: Set/Jump Cue · Drag top border to resize
                </p>
              </div>
            )}
          </div>

          {/* Full-track Overview Map */}
          {track && (
            <div className="shrink-0">
              <OverviewMap
                waveform={waveform}
                positionMs={playback.positionMs}
                durationMs={playback.durationMs}
                zoomLevel={zoomLevel}
                viewOffsetMs={viewOffsetMs}
                onViewOffsetChange={setViewOffsetMs}
                onSeek={(ms) => previewEngine.seek(ms)}
                hotCues={hotCues}
                cuePositionMs={tempCueMs}
                isDarkTheme={isDarkTheme}
              />
            </div>
          )}

          {/* Bottom Controls Row: Transport + Hot Cues + Grid Tools */}
          <div className="flex items-center justify-between gap-3 shrink-0 pt-0.5">
            {/* Transport (CUE, Play, Stop, Volume) */}
            <TransportSection
              isPlaying={playback.isPlaying}
              onPlayPause={() => previewEngine.togglePlayPause()}
              onStop={() => previewEngine.stop()}
              onCue={handleCuePress}
              cueActive={cueActive}
              volume={playback.volume}
              isMuted={playback.isMuted}
              onVolumeChange={(vol) => previewEngine.setVolume(vol)}
              onToggleMute={() => previewEngine.setMuted(!playback.isMuted)}
              compact={false}
            />

            {/* Hot Cues Row (A through H) */}
            <div className="flex-1 max-w-[560px]">
              <HotCueStrip
                cues={hotCues}
                onTriggerCue={handleTriggerHotCue}
                onSetCue={handleSetHotCue}
                onClearCue={handleClearHotCue}
                compact={false}
              />
            </div>

            {/* Grid & Beat Tools */}
            <GridToolsSection
              snapMode={snapMode}
              onToggleSnap={() =>
                setSnapMode((prev) => (prev === "beat" ? "bar" : prev === "bar" ? "off" : "beat"))
              }
              onNudge={(deltaMs) => setGridOffsetMs((curr) => curr + deltaMs)}
              onBpmFine={(deltaBpm) => setBpmTweak((curr) => curr + deltaBpm)}
              onResetGrid={() => {
                setGridOffsetMs(0);
                setBpmTweak(0);
              }}
              onJumpBeats={(beats) => previewEngine.jumpBeats(beats)}
            />
          </div>
        </div>
      ) : (
        /* ════════ MINI MODE (Compact Single Row 72–88px) ═════════════════ */
        <div className="flex items-center gap-3 h-full px-3 py-1.5 min-h-0">
          {/* Identity Strip (Compact) */}
          <div className="shrink-0 w-64 max-w-[280px]">
            <PlayerIdentityStrip
              track={track}
              large={false}
              positionMs={playback.positionMs}
              durationMs={playback.durationMs}
              bpm={track?.bpm || 124}
              gridOffsetMs={gridOffsetMs}
            />
          </div>

          {/* Compact Waveform Strip */}
          <div className="flex-1 min-w-[120px] flex items-center">
            {track ? (
              <CompactWaveform
                waveform={waveform}
                positionMs={playback.positionMs}
                durationMs={playback.durationMs}
                onSeek={(ms) => previewEngine.seek(ms)}
                hotCues={hotCues}
                cuePositionMs={tempCueMs}
                isDarkTheme={isDarkTheme}
              />
            ) : (
              <div className="flex items-center justify-center flex-1 h-7 rounded border border-dj-border bg-dj-bg text-[11px] text-dj-text-muted">
                Select a track to preview
              </div>
            )}
          </div>

          {/* Compact Transport */}
          <TransportSection
            isPlaying={playback.isPlaying}
            onPlayPause={() => previewEngine.togglePlayPause()}
            onStop={() => previewEngine.stop()}
            onCue={handleCuePress}
            cueActive={cueActive}
            volume={playback.volume}
            isMuted={playback.isMuted}
            onVolumeChange={(vol) => previewEngine.setVolume(vol)}
            onToggleMute={() => previewEngine.setMuted(!playback.isMuted)}
            compact={true}
          />

          {/* Compact Hot Cues Strip — always visible; scrolls instead of
              silently disappearing at narrow widths (docs/ui/12). */}
          <div className="flex-1 shrink min-w-[160px] max-w-[240px] overflow-x-auto">
            <HotCueStrip
              cues={hotCues}
              onTriggerCue={handleTriggerHotCue}
              onSetCue={handleSetHotCue}
              onClearCue={handleClearHotCue}
              compact={true}
            />
          </div>

          {/* Expand to Full & Close Controls */}
          <div className="flex items-center gap-1 shrink-0 border-l border-dj-border pl-2">
            <button
              type="button"
              onClick={() => {
                setHeight(DEFAULT_FULL_HEIGHT);
                onModeChange("full");
              }}
              title="Expand player to Full mode (220-280px)"
              aria-label="Expand player to Full mode"
              className="rounded p-1.5 text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onHide}
              title="Hide preview player"
              aria-label="Hide preview player"
              className="rounded p-1.5 text-dj-text-secondary hover:text-dj-text hover:bg-dj-hover transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
