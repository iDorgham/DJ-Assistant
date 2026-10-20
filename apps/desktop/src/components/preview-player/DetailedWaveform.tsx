import React, { useRef, useEffect, useState, useCallback } from "react";
import type { WaveformData, HotCueData } from "../../lib/waveform-generator";
import { formatTimecode, formatBarBeat } from "../../lib/waveform-generator";

interface DetailedWaveformProps {
  waveform: WaveformData | null;
  positionMs: number;
  durationMs: number;
  bpm: number;
  gridOffsetMs: number;
  zoomLevel: number; // 1.0 (fit) to 16.0 (zoomed in)
  viewOffsetMs: number; // Start time of visible window
  onViewOffsetChange: (offsetMs: number) => void;
  onSeek: (positionMs: number) => void;
  snapMode: "off" | "beat" | "bar";
  hotCues: HotCueData[];
  cuePositionMs: number | null;
  isDarkTheme?: boolean;
  onWheelZoom?: (direction: "in" | "out") => void;
}

export function DetailedWaveform({
  waveform,
  positionMs,
  durationMs,
  bpm,
  gridOffsetMs,
  zoomLevel,
  viewOffsetMs,
  onViewOffsetChange,
  onSeek,
  snapMode,
  hotCues,
  cuePositionMs,
  isDarkTheme = true,
  onWheelZoom,
}: DetailedWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Visible window in milliseconds
  const safeDuration = Math.max(durationMs || 180000, 1000);
  const visibleDurationMs = safeDuration / Math.max(1, zoomLevel);
  const maxOffset = Math.max(0, safeDuration - visibleDurationMs);
  const clampedOffset = Math.max(0, Math.min(viewOffsetMs, maxOffset));

  // Snap position to beat or bar if enabled
  const applySnap = useCallback(
    (targetMs: number): number => {
      if (snapMode === "off" || bpm <= 0) return targetMs;
      const beatMs = (60 / bpm) * 1000;
      const stepMs = snapMode === "bar" ? beatMs * 4 : beatMs;
      const relMs = targetMs - gridOffsetMs;
      const snapped = Math.round(relMs / stepMs) * stepMs + gridOffsetMs;
      return Math.max(0, Math.min(snapped, safeDuration));
    },
    [snapMode, bpm, gridOffsetMs, safeDuration]
  );

  // Convert mouse X to time in milliseconds
  const xToTimeMs = useCallback(
    (x: number, width: number): number => {
      const fraction = Math.max(0, Math.min(1, x / width));
      return clampedOffset + fraction * visibleDurationMs;
    },
    [clampedOffset, visibleDurationMs]
  );

  // Convert time in milliseconds to canvas X coordinate
  const timeMsToX = useCallback(
    (tMs: number, width: number): number => {
      const relTime = tMs - clampedOffset;
      return (relTime / visibleDurationMs) * width;
    },
    [clampedOffset, visibleDurationMs]
  );

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (!waveform || waveform.peaks.length === 0) {
      // Carbon: gray-90 dark / gray-10 light
      ctx.fillStyle = isDarkTheme ? "#262626" : "#f4f4f4";
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const centerY = height * 0.54;
    const maxWaveHeight = height * 0.38;

    // 1. Draw Phrase Region Background Bands (IBM Carbon data-vis palette)
    if (waveform.phrases) {
      for (const phrase of waveform.phrases) {
        const x1 = timeMsToX(phrase.startMs, width);
        const x2 = timeMsToX(phrase.endMs, width);
        if (x2 < 0 || x1 > width) continue;

        const phraseWidth = Math.max(1, x2 - x1);
        // Default/Intro/Outro: Carbon Cyan subtle tint
        let phraseBg = isDarkTheme ? "rgba(51,177,255,0.04)" : "rgba(0,114,195,0.03)";
        let phraseBorder = isDarkTheme ? "rgba(51,177,255,0.14)" : "rgba(0,114,195,0.12)";
        // Carbon gray-40 (dark) / gray-60 (light)
        let labelColor = isDarkTheme ? "#a8a8a8" : "#6f6f6f";

        if (phrase.kind === "drop") {
          // Drop: Carbon Cyan-40 bold accent
          phraseBg = isDarkTheme ? "rgba(51,177,255,0.10)" : "rgba(0,114,195,0.08)";
          phraseBorder = isDarkTheme ? "rgba(51,177,255,0.30)" : "rgba(0,114,195,0.22)";
          labelColor = isDarkTheme ? "#33b1ff" : "#0072c3"; // Carbon Cyan-40 / Cyan-60
        } else if (phrase.kind === "break") {
          // Break: Carbon Purple-60/Purple-50
          phraseBg = isDarkTheme ? "rgba(138,63,252,0.08)" : "rgba(138,63,252,0.05)";
          phraseBorder = isDarkTheme ? "rgba(138,63,252,0.25)" : "rgba(138,63,252,0.18)";
          labelColor = isDarkTheme ? "#be95ff" : "#6929c4"; // Carbon Purple-40 / Purple-70
        } else if (phrase.kind === "build") {
          // Build: Carbon Yellow-30 / Yellow-50
          phraseBg = isDarkTheme ? "rgba(241,194,27,0.08)" : "rgba(178,134,0,0.05)";
          phraseBorder = isDarkTheme ? "rgba(241,194,27,0.25)" : "rgba(178,134,0,0.18)";
          labelColor = isDarkTheme ? "#f1c21b" : "#b28600"; // Carbon Yellow-30 / Yellow-50
        }

        ctx.fillStyle = phraseBg;
        ctx.fillRect(x1, 0, phraseWidth, height);

        // Header band line
        ctx.strokeStyle = phraseBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, height);
        ctx.stroke();

        // Phrase label tag along top — IBM Plex Mono for Carbon feel
        if (phraseWidth > 40 && x1 + 4 < width) {
          ctx.fillStyle = labelColor;
          ctx.font = "600 11px 'IBM Plex Mono', monospace";
          ctx.fillText(phrase.name.toUpperCase(), Math.max(x1 + 6, 6), 14);
        }
      }
    }

    // 2. Draw Center Zero Line — Carbon border-subtle
    ctx.strokeStyle = isDarkTheme ? "rgba(244,244,244,0.08)" : "rgba(22,22,22,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // 3. Draw Beat Grid Lines
    if (bpm > 40) {
      const beatMs = (60 / bpm) * 1000;

      const firstBeatIndex = Math.floor((clampedOffset - gridOffsetMs) / beatMs);
      const lastBeatIndex = Math.ceil((clampedOffset + visibleDurationMs - gridOffsetMs) / beatMs);

      for (let b = firstBeatIndex; b <= lastBeatIndex; b++) {
        const beatTime = b * beatMs + gridOffsetMs;
        if (beatTime < 0 || beatTime > safeDuration) continue;
        const x = timeMsToX(beatTime, width);
        if (x < -10 || x > width + 10) continue;

        const isBar = b % 4 === 0;
        const barNumber = Math.floor(b / 4) + 1;

        if (isBar) {
          // Carbon gray-10 / gray-100 bar lines
          ctx.strokeStyle = isDarkTheme ? "rgba(244,244,244,0.20)" : "rgba(22,22,22,0.16)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 16);
          ctx.lineTo(x, height);
          ctx.stroke();

          // Bar number label — IBM Plex Mono
          ctx.fillStyle = isDarkTheme ? "rgba(244,244,244,0.42)" : "rgba(22,22,22,0.38)";
          ctx.font = "500 11px 'IBM Plex Mono', monospace";
          ctx.fillText(`${barNumber}.1`, x + 3, height - 4);
        } else if (visibleDurationMs < 60000) {
          // Sub-beat lines only when zoomed in
          ctx.strokeStyle = isDarkTheme ? "rgba(244,244,244,0.06)" : "rgba(22,22,22,0.05)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, centerY - maxWaveHeight * 0.6);
          ctx.lineTo(x, centerY + maxWaveHeight * 0.6);
          ctx.stroke();
        }
      }
    }

    // 4. Draw Detailed Waveform Peaks — Carbon Cyan-40/Teal-70 for audio data
    const totalPeaks = waveform.peaks.length;
    const playedX = timeMsToX(positionMs, width);

    // IBM Carbon Cyan palette for waveform audio visualization
    const playedColor = isDarkTheme ? "#33b1ff" : "#0072c3"; // Cyan-40 / Cyan-60
    const unplayedColor = isDarkTheme ? "#005d5d" : "#82cfff"; // Teal-70 / Cyan-30
    const bassColorPlayed = isDarkTheme ? "#08bdba" : "#1192e8"; // Teal-40 / Cyan-50
    const bassColorUnplayed = isDarkTheme ? "#003d3d" : "#a6c8ff"; // Deep teal / Blue-30

    const step = 2;
    for (let x = 0; x < width; x += step) {
      const tMs = xToTimeMs(x, width);
      const peakIndex = Math.min(
        totalPeaks - 1,
        Math.max(0, Math.floor((tMs / safeDuration) * totalPeaks))
      );

      const amp = waveform.peaks[peakIndex] || 0.1;
      const lowAmp = waveform.lowPeaks[peakIndex] || 0.05;
      const barH = amp * maxWaveHeight;
      const lowH = lowAmp * maxWaveHeight * 0.75;

      const isPlayed = x <= playedX;

      // Outer amplitude bar
      ctx.fillStyle = isPlayed ? playedColor : unplayedColor;
      ctx.fillRect(x, centerY - barH, step - 0.5, barH * 2);

      // Low frequency core bar (3-band depth)
      ctx.fillStyle = isPlayed ? bassColorPlayed : bassColorUnplayed;
      ctx.fillRect(x, centerY - lowH, step - 0.5, lowH * 2);
    }

    // 5. Draw Hot Cues & Temporary CUE on Waveform
    for (const cue of hotCues) {
      if (cue.positionMs === null) continue;
      const cueX = timeMsToX(cue.positionMs, width);
      if (cueX < -15 || cueX > width + 15) continue;

      // Vertical line through waveform
      ctx.strokeStyle = cue.colorHex;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cueX, 16);
      ctx.lineTo(cueX, height);
      ctx.stroke();

      // Top cue flag marker (CDJ-3000 style)
      ctx.fillStyle = cue.colorHex;
      ctx.beginPath();
      ctx.moveTo(cueX, 16);
      ctx.lineTo(cueX + 14, 16);
      ctx.lineTo(cueX + 14, 30);
      ctx.lineTo(cueX, 30);
      ctx.closePath();
      ctx.fill();

      // Flag notch triangle — Carbon gray-90 dark / white light
      ctx.fillStyle = isDarkTheme ? "#262626" : "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cueX + 14, 23);
      ctx.lineTo(cueX + 9, 30);
      ctx.lineTo(cueX + 14, 30);
      ctx.closePath();
      ctx.fill();

      // Cue letter inside flag
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(cue.letter, cueX + 6, 26);
      ctx.textAlign = "start";
    }

    // Temporary CUE marker — Carbon Orange-40/Orange-50
    if (cuePositionMs !== null) {
      const cueX = timeMsToX(cuePositionMs, width);
      if (cueX >= -15 && cueX <= width + 15) {
        const cueOrange = isDarkTheme ? "#ff832b" : "#eb6200"; // Orange-40 / Orange-50
        ctx.strokeStyle = cueOrange;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(cueX, 16);
        ctx.lineTo(cueX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small CUE badge
        ctx.fillStyle = cueOrange;
        ctx.fillRect(cueX - 17, 16, 34, 15);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("CUE", cueX, 27);
        ctx.textAlign = "start";
      }
    }

    // 6. Draw High-Contrast Real-Time Playhead — Carbon Blue-60 / white
    if (playedX >= -5 && playedX <= width + 5) {
      // Subtle cyan glow — Carbon Cyan-40
      ctx.shadowColor = isDarkTheme ? "rgba(51,177,255,0.5)" : "rgba(15,98,254,0.35)";
      ctx.shadowBlur = 6;

      // Playhead vertical line — Carbon white (dark) / Blue-60 (light)
      ctx.strokeStyle = isDarkTheme ? "#f4f4f4" : "#0f62fe";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playedX, 0);
      ctx.lineTo(playedX, height);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Top triangle needle cap — Carbon Cyan-40 / Blue-60
      ctx.fillStyle = isDarkTheme ? "#33b1ff" : "#0f62fe";
      ctx.beginPath();
      ctx.moveTo(playedX - 5, 0);
      ctx.lineTo(playedX + 5, 0);
      ctx.lineTo(playedX, 7);
      ctx.closePath();
      ctx.fill();

      // Bottom needle cap
      ctx.beginPath();
      ctx.moveTo(playedX - 4, height);
      ctx.lineTo(playedX + 4, height);
      ctx.lineTo(playedX, height - 6);
      ctx.closePath();
      ctx.fill();
    }

    // 7. Hover Line — Carbon subtle
    if (isHovering && hoverX !== null) {
      ctx.strokeStyle = isDarkTheme ? "rgba(244,244,244,0.35)" : "rgba(22,22,22,0.30)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    waveform,
    positionMs,
    durationMs,
    bpm,
    gridOffsetMs,
    zoomLevel,
    clampedOffset,
    visibleDurationMs,
    safeDuration,
    snapMode,
    hotCues,
    cuePositionMs,
    isDarkTheme,
    isHovering,
    hoverX,
    timeMsToX,
    xToTimeMs,
  ]);

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsScrubbing(true);
    const mouseX = e.clientX - rect.left;
    const targetMs = applySnap(xToTimeMs(mouseX, rect.width));
    onSeek(targetMs);

    const onMouseMove = (moveEvt: MouseEvent) => {
      const currentRect = containerRef.current?.getBoundingClientRect();
      if (!currentRect) return;
      const currentX = moveEvt.clientX - currentRect.left;
      const scrubMs = applySnap(xToTimeMs(currentX, currentRect.width));
      onSeek(scrubMs);
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Keyboard seeking per docs/ui/10: arrows seek, Home/End jump to bounds.
    let nextMs: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      nextMs = applySnap(positionMs - (e.shiftKey ? 10000 : 2000));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      nextMs = applySnap(positionMs + (e.shiftKey ? 10000 : 2000));
    } else if (e.key === "Home") {
      nextMs = 0;
    } else if (e.key === "End") {
      nextMs = safeDuration;
    }
    if (nextMs !== null) {
      e.preventDefault();
      e.stopPropagation();
      onSeek(Math.max(0, Math.min(nextMs, safeDuration)));
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // Shift / horizontal wheel: pan through the visible window
      const panAmount = (e.deltaX || e.deltaY) * (visibleDurationMs / 1000) * 1.5;
      onViewOffsetChange(clampedOffset + panAmount);
    } else if (onWheelZoom) {
      // Vertical wheel: zoom (docs/ui/06 interaction spec)
      onWheelZoom(e.deltaY < 0 ? "in" : "out");
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverX(e.clientX - rect.left);
  };

  const hoverTimeMs =
    hoverX !== null && containerRef.current
      ? applySnap(xToTimeMs(hoverX, containerRef.current.clientWidth))
      : null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setHoverX(null);
      }}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
      className={`relative w-full h-full min-h-[90px] select-none ${
        isScrubbing ? "cursor-grabbing" : "cursor-crosshair"
      } bg-dj-bg overflow-hidden`}
      role="slider"
      aria-label="Detailed waveform scrubber"
      aria-valuemin={0}
      aria-valuemax={durationMs}
      aria-valuenow={positionMs}
      aria-valuetext={`${formatTimecode(positionMs, true)}${bpm > 0 ? `, ${formatBarBeat(positionMs, bpm, gridOffsetMs)}` : ""}`}
      tabIndex={0}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Honest placeholder marker: peaks are synthesized until real audio
          decoding ships — docs/ui/06 forbids fabricated analysis data. */}
      {waveform?.isEstimated && (
        <div
          className="absolute top-1.5 right-2 z-10 rounded border border-dj-warning/40 bg-dj-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-dj-warning"
          title="Waveform shape is estimated locally — decoded peaks from the audio file are not available yet."
        >
          Estimated waveform
        </div>
      )}

      {/* Floating Hover Timecode Tooltip */}
      {isHovering && hoverX !== null && hoverTimeMs !== null && (
        <div
          className="pointer-events-none absolute top-1.5 z-20 -translate-x-1/2 rounded bg-dj-elevated/95 px-1.5 py-0.5 font-mono text-[11px] font-medium text-dj-text border border-dj-border shadow-md backdrop-blur-xs flex items-center gap-1.5"
          style={{
            left: Math.max(40, Math.min(hoverX, (containerRef.current?.clientWidth || 300) - 40)),
          }}
        >
          <span className="text-dj-accent font-semibold">{formatTimecode(hoverTimeMs, true)}</span>
          {bpm > 0 && (
            <span className="text-dj-text-muted text-[11px]">
              {formatBarBeat(hoverTimeMs, bpm, gridOffsetMs)}
            </span>
          )}
        </div>
      )}

      {/* Snap Mode Badge */}
      {snapMode !== "off" && (
        <div className="pointer-events-none absolute bottom-1 right-2 z-10 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider bg-dj-accent/15 text-dj-accent border border-dj-accent/30">
          SNAP: {snapMode.toUpperCase()}
        </div>
      )}
    </div>
  );
}
