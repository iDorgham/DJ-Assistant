import React, { useState, useEffect, useRef, useCallback } from "react";
import type { TrackSummary } from "@dj-assistant/shared";
import { Maximize2, Minimize2, X, Music } from "lucide-react";
import type { PlayerMode } from "../../lib/ui-state";
import {
  DEFAULT_FULL_HEIGHT,
  DEFAULT_MINI_HEIGHT,
  MAX_MINI_HEIGHT,
  MAX_PLAYER_HEIGHT,
  MIN_FULL_HEIGHT,
  MIN_MINI_HEIGHT,
  resolvePlayerHeight,
} from "../../lib/ui-state";
import {
  clampZoomLevel,
  createDefaultHotCues,
  DEFAULT_ZOOM_LEVEL,
  getFollowViewOffset,
  getOrGenerateWaveform,
  type WaveformData,
  type HotCueData,
} from "../../lib/waveform-generator";
import { previewEngine, type PlaybackState } from "../../lib/audio-engine";
import { DetailedWaveform } from "./DetailedWaveform";
import { OverviewMap } from "./OverviewMap";
import { CompactWaveform } from "./CompactWaveform";
import { PlayerArtworkRail } from "./PlayerArtworkRail";
import { PlayerTrackLine } from "./PlayerTrackLine";
import { WaveformZoomControls } from "./WaveformZoomControls";
import { TransportCore, VolumeControl } from "./TransportSection";
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

export function PreviewPlayer({
  mode,
  track,
  onModeChange,
  onHide,
  activeView = "library",
  isDarkTheme = true,
}: PreviewPlayerProps) {
  // Height state: supports live dragging continuum
  const [height, setHeight] = useState<number>(() =>
    mode === "full" ? DEFAULT_FULL_HEIGHT : DEFAULT_MINI_HEIGHT
  );
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  // Full swaps the hot-cue row for grid & beat tools on demand.
  const [fullRowPanel, setFullRowPanel] = useState<"cues" | "grid">("cues");

  // Playback engine state
  const [playback, setPlayback] = useState<PlaybackState>(() => previewEngine.getState());
  const [waveform, setWaveform] = useState<WaveformData | null>(null);

  // Grid & navigation state
  const [gridOffsetMs, setGridOffsetMs] = useState(0);
  const [bpmTweak, setBpmTweak] = useState(0);
  const [snapMode, setSnapMode] = useState<"off" | "beat" | "bar">("beat");
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM_LEVEL);
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

  // Calibrated tempo — the analysed BPM plus the grid-panel fine tune. The
  // grid, bar counter and beat jump all read this single value.
  const effectiveBpm = (track?.bpm || 124) + bpmTweak;
  const trackId = track?.id;
  const trackDurationMs = track?.durationMs;
  const trackBpm = track?.bpm;
  const trackFileHash = track?.fileHash;

  // Sync mode changes with target heights. Full keeps the height the user
  // dragged to; Mini always returns to its compact row height.
  useEffect(() => {
    if (mode === "mini") {
      setHeight(DEFAULT_MINI_HEIGHT);
    } else if (mode === "full") {
      setHeight((h) => (h >= MIN_FULL_HEIGHT ? h : DEFAULT_FULL_HEIGHT));
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
    if (!trackId) {
      previewEngine.stop();
      setWaveform(null);
      setHotCues([]);
      setTempCueMs(null);
      return;
    }

    const duration = trackDurationMs || 240000;
    const baseBpm = trackBpm || 124;
    previewEngine.loadTrack(duration, baseBpm);

    const generated = getOrGenerateWaveform(trackId, duration, baseBpm, trackFileHash || trackId);
    setWaveform(generated);
    setZoomLevel(DEFAULT_ZOOM_LEVEL);
    setFollowPlayhead(true);
    setTempCueMs(0);
    // Calibration and grid offset belong to the previous track.
    setBpmTweak(0);
    setGridOffsetMs(0);

    // Load persisted or default hot cues
    try {
      const stored = localStorage.getItem(`${STORAGE_CUES_PREFIX}${trackId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHotCues(createDefaultHotCues(duration, baseBpm, parsed));
      } else {
        setHotCues(createDefaultHotCues(duration, baseBpm));
      }
    } catch {
      setHotCues(createDefaultHotCues(duration, baseBpm));
    }
  }, [trackId, trackDurationMs, trackBpm, trackFileHash]);

  // Keep the engine tempo in step with the grid calibration: beat jump and the
  // synthesised pulse must follow the BPM shown in the track line immediately.
  useEffect(() => {
    previewEngine.setBpm(effectiveBpm);
  }, [effectiveBpm]);

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

  // Traktor-style parallel view: while follow is on the reading head is pinned
  // to the centre of the waveform, so the visible window is always half a
  // window behind and half ahead of the playhead. Fit shows the whole track.
  useEffect(() => {
    if (!followPlayhead) return;
    const duration = Math.max(playback.durationMs || trackDurationMs || 180000, 1000);
    setViewOffsetMs(getFollowViewOffset(playback.positionMs, duration, zoomLevel));
  }, [playback.positionMs, playback.durationMs, followPlayhead, zoomLevel, trackDurationMs]);

  // Manual pans (wheel, overview window drag) take the view off the playhead.
  const handleViewOffsetChange = useCallback((offsetMs: number) => {
    setFollowPlayhead(false);
    setViewOffsetMs(offsetMs);
  }, []);

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
    const nextHeight = resolvePlayerHeight(rawHeight);
    setHeight(nextHeight);

    const nextMode = nextHeight >= MIN_FULL_HEIGHT ? "full" : "mini";
    if (nextMode !== mode) {
      onModeChange(nextMode);
    }
  };

  // Keyboard steps stay within the active presentation; from the Mini ceiling
  // the next ↑ crosses the unsupported gap straight into Full.
  const stepSplitterHeight = (delta: number) => {
    if (delta > 0 && height === MAX_MINI_HEIGHT) {
      applySplitterHeight(MIN_FULL_HEIGHT);
      return;
    }
    applySplitterHeight(height + delta);
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
    const prefersFull = activeView === "playlists";
    setHeight(prefersFull ? DEFAULT_FULL_HEIGHT : DEFAULT_MINI_HEIGHT);
    onModeChange(prefersFull ? "full" : "mini");
  };

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => clampZoomLevel(z * 1.5));
  const handleZoomOut = () => setZoomLevel((z) => clampZoomLevel(z / 1.5));
  const handleZoomFit = () => {
    setZoomLevel(1);
    setViewOffsetMs(0);
  };

  const isDetailedView = height >= MIN_FULL_HEIGHT;

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
        aria-valuemin={MIN_MINI_HEIGHT}
        aria-valuemax={MAX_PLAYER_HEIGHT}
        tabIndex={0}
        onMouseDown={handleSplitterMouseDown}
        onDoubleClick={handleSplitterDoubleClick}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            stepSplitterHeight(e.key === "ArrowUp" ? 16 : -16);
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
      {isDetailedView ? (
        /* ════════ FULL MODE (Detailed Waveform + Overview + Controls) ════ */
        <div className="flex h-full min-h-0 flex-col">
          {/* Upper region: artwork rail | waveform + track line + overview rail.
              Artwork is deliberately larger than the Mini cover (160 vs 91). */}
          <div className="flex min-h-0 flex-1">
            <div className="flex w-[184px] shrink-0 items-start justify-center border-r border-dj-border px-3 pt-3">
              <PlayerArtworkRail track={track} size="full" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 pb-2 pt-2">
              {/* Primary Detailed Waveform Area */}
              <div className="relative min-h-0 flex-1 overflow-hidden rounded border border-dj-border">
                {track ? (
                  <DetailedWaveform
                    waveform={waveform}
                    positionMs={playback.positionMs}
                    durationMs={playback.durationMs}
                    bpm={effectiveBpm}
                    gridOffsetMs={gridOffsetMs}
                    zoomLevel={zoomLevel}
                    viewOffsetMs={viewOffsetMs}
                    onViewOffsetChange={handleViewOffsetChange}
                    onSeek={(ms) => previewEngine.seek(ms)}
                    snapMode={snapMode}
                    hotCues={hotCues}
                    cuePositionMs={tempCueMs}
                    isDarkTheme={isDarkTheme}
                    onWheelZoom={(dir) =>
                      setZoomLevel((z) => clampZoomLevel(dir === "in" ? z * 1.25 : z / 1.25))
                    }
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-dj-text-muted">
                    <Music className="h-7 w-7 opacity-40" />
                    <p className="text-xs font-medium">Select a track to preview & validate</p>
                    <p className="text-[11px] text-dj-text-muted max-w-sm">
                      Space: Play/Pause · 1–8: Hot Cues · C: Set/Jump Cue · Drag top border to
                      resize
                    </p>
                  </div>
                )}

                {/* Zoom cluster pinned to the waveform's top-right */}
                {track && (
                  <div className="absolute right-1.5 top-1.5 z-20">
                    <WaveformZoomControls
                      zoomLevel={zoomLevel}
                      followPlayhead={followPlayhead}
                      onZoomIn={handleZoomIn}
                      onZoomOut={handleZoomOut}
                      onZoomFit={handleZoomFit}
                      onToggleFollow={() => setFollowPlayhead(!followPlayhead)}
                    />
                  </div>
                )}
              </div>

              {/* Track line — title/artist left, time right, directly above the rail */}
              <PlayerTrackLine
                track={track}
                large={true}
                positionMs={playback.positionMs}
                durationMs={playback.durationMs}
                bpm={effectiveBpm}
                gridOffsetMs={gridOffsetMs}
                isDarkTheme={isDarkTheme}
              />

              {/* Full-track Overview Map (the rail) */}
              {track && (
                <div className="shrink-0">
                  <OverviewMap
                    waveform={waveform}
                    positionMs={playback.positionMs}
                    durationMs={playback.durationMs}
                    zoomLevel={zoomLevel}
                    viewOffsetMs={viewOffsetMs}
                    onViewOffsetChange={handleViewOffsetChange}
                    onSeek={(ms) => previewEngine.seek(ms)}
                    hotCues={hotCues}
                    cuePositionMs={tempCueMs}
                    isDarkTheme={isDarkTheme}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Transport row — spans the full dock width, directly under the rail.
              CUE/Play + volume, the Hot cues ↔ Grid & beat panel switch, then
              the dock actions. One 30px panel row keeps the waveform tall. */}
          <div className="flex shrink-0 items-center gap-2.5 border-t border-dj-border px-3 py-2">
            <div className="flex shrink-0 items-center gap-2">
              <TransportCore
                isPlaying={playback.isPlaying}
                onPlayPause={() => previewEngine.togglePlayPause()}
                onCue={handleCuePress}
                cueActive={cueActive}
                compact={false}
              />
              <VolumeControl
                volume={playback.volume}
                isMuted={playback.isMuted}
                onVolumeChange={(vol) => previewEngine.setVolume(vol)}
                onToggleMute={() => previewEngine.setMuted(!playback.isMuted)}
                compact={false}
              />
            </div>

            <span aria-hidden="true" className="h-7 w-px shrink-0 bg-dj-border" />

            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div
                role="group"
                aria-label="Full player panel"
                className="flex shrink-0 rounded-sm border border-dj-border bg-dj-bg p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setFullRowPanel("cues")}
                  aria-pressed={fullRowPanel === "cues"}
                  title="Show hot cues A–H"
                  className={`rounded-[1px] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition ${
                    fullRowPanel === "cues"
                      ? "bg-dj-active text-dj-text shadow-sm"
                      : "text-dj-text-muted hover:bg-dj-hover hover:text-dj-text"
                  }`}
                >
                  Hot cues
                </button>
                <button
                  type="button"
                  onClick={() => setFullRowPanel("grid")}
                  aria-pressed={fullRowPanel === "grid"}
                  title="Show beat grid and beat-navigation tools"
                  className={`rounded-[1px] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition ${
                    fullRowPanel === "grid"
                      ? "bg-dj-active text-dj-text shadow-sm"
                      : "text-dj-text-muted hover:bg-dj-hover hover:text-dj-text"
                  }`}
                >
                  Grid &amp; beat
                </button>
              </div>

              <div className="min-w-0 flex-1">
                {fullRowPanel === "cues" ? (
                  <div className="mx-auto w-full max-w-[608px]">
                    <HotCueStrip
                      cues={hotCues}
                      onTriggerCue={handleTriggerHotCue}
                      onSetCue={handleSetHotCue}
                      onClearCue={handleClearHotCue}
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-0.5">
                    <GridToolsSection
                      snapMode={snapMode}
                      onToggleSnap={() =>
                        setSnapMode((prev) =>
                          prev === "beat" ? "bar" : prev === "bar" ? "off" : "beat"
                        )
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
                )}
              </div>
            </div>

            {/* Dock actions: collapse to Mini, hide */}
            <div className="flex shrink-0 items-center gap-1 border-l border-dj-border pl-2">
              <button
                type="button"
                onClick={() => {
                  setHeight(DEFAULT_MINI_HEIGHT);
                  onModeChange("mini");
                }}
                title={`Collapse player to Mini (${DEFAULT_MINI_HEIGHT}px)`}
                aria-label="Collapse to Mini"
                className="rounded p-1 text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onHide}
                title="Hide preview player"
                aria-label="Hide player"
                className="rounded p-1 text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ════════ MINI MODE (Full-height artwork + track line + rail + transport) ════ */
        <div className="flex h-full min-h-0 gap-3 px-3 py-1.5">
          {/* Artwork spans the full mini height */}
          <PlayerArtworkRail track={track} size="fill" />

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 py-0.5">
            {/* Track line above the rail */}
            <PlayerTrackLine
              track={track}
              positionMs={playback.positionMs}
              durationMs={playback.durationMs}
              bpm={effectiveBpm}
              isDarkTheme={isDarkTheme}
            />

            {/* Compact Waveform Strip = the progress rail */}
            <div className="flex min-w-0 items-center">
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
                <div className="flex h-7 flex-1 items-center justify-center rounded border border-dj-border bg-dj-bg text-[11px] text-dj-text-muted">
                  Select a track to preview
                </div>
              )}
            </div>

            {/* Transport row: CUE/Play → mute → hot cues → expand/hide.
                The pad strip keeps 8px of air on both sides and scrolls
                instead of silently dropping pads at narrow widths. */}
            <div className="flex min-w-0 items-center gap-2.5">
              <TransportCore
                isPlaying={playback.isPlaying}
                onPlayPause={() => previewEngine.togglePlayPause()}
                onCue={handleCuePress}
                cueActive={cueActive}
                compact={true}
              />

              <VolumeControl
                volume={playback.volume}
                isMuted={playback.isMuted}
                onVolumeChange={(vol) => previewEngine.setVolume(vol)}
                onToggleMute={() => previewEngine.setMuted(!playback.isMuted)}
                compact={true}
              />

              <div className="min-w-0 flex-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <HotCueStrip
                  cues={hotCues}
                  onTriggerCue={handleTriggerHotCue}
                  onSetCue={handleSetHotCue}
                  onClearCue={handleClearHotCue}
                />
              </div>

              {/* Expand to Full & Close Controls */}
              <div className="flex shrink-0 items-center gap-1 border-l border-dj-border pl-2">
                <button
                  type="button"
                  onClick={() => {
                    setHeight(DEFAULT_FULL_HEIGHT);
                    onModeChange("full");
                  }}
                  title={`Expand player to Full mode (${DEFAULT_FULL_HEIGHT}px)`}
                  aria-label="Expand player to Full mode"
                  className="rounded p-1.5 text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onHide}
                  title="Hide preview player"
                  aria-label="Hide preview player"
                  className="rounded p-1.5 text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
