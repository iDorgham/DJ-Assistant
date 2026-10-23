import React, { useCallback, useEffect, useRef, useState } from "react";
import type { WaveformData, HotCueData } from "../../lib/waveform-generator";
import {
  formatTimecode,
  formatBarBeat,
  getBeatPosition,
  snapToGrid,
} from "../../lib/waveform-generator";

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

interface WaveformSize {
  width: number;
  height: number;
}

/** Dark text on every Carbon cue colour beats white at 11px (4.4:1–12.5:1). */
const CUE_TEXT_COLOR = "#161616";

/**
 * Traktor/Rekordbox-style detailed waveform.
 *
 * - Per-pixel 3-band peaks (bass / mids / highs) at 16k source resolution.
 * - Full-height bar lines and short top/bottom beat ticks, drawn under and over
 *   the peaks so they stay readable on quiet and loud passages.
 * - CDJ beat counter (bar, beat, four count rectangles) pinned to the left.
 * - Centred reading head, coloured cue flags and a dashed temporary CUE.
 */
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
  const [size, setSize] = useState<WaveformSize>({ width: 0, height: 0 });

  // Canvas reads clientWidth/Height once; a ResizeObserver keeps it in sync
  // while the splitter drags or the window resizes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Visible window in milliseconds
  const safeDuration = Math.max(durationMs || 180000, 1000);
  const visibleDurationMs = safeDuration / Math.max(1, zoomLevel);
  // Traktor-style "parallel" view: the reading head is fixed at the middle and
  // the waveform scrolls underneath it. The window is centred on the playhead,
  // so an offset of -visible/2 puts the track's first sample on the centre line
  // and leaves the left half blank. Fit (1×) shows the whole track instead.
  const isFit = zoomLevel <= 1.05;
  const offsetMin = -visibleDurationMs / 2;
  const offsetMax = safeDuration - visibleDurationMs / 2;
  const effectiveOffset = isFit ? 0 : Math.max(offsetMin, Math.min(viewOffsetMs, offsetMax));

  // Snap position to beat or bar if enabled
  const applySnap = useCallback(
    (targetMs: number): number => snapToGrid(targetMs, bpm, gridOffsetMs, snapMode, safeDuration),
    [snapMode, bpm, gridOffsetMs, safeDuration]
  );

  // Convert mouse X to time in milliseconds (may fall before 0 / after the end)
  const xToTimeMs = useCallback(
    (x: number, width: number): number => {
      const fraction = Math.max(0, Math.min(1, x / width));
      return effectiveOffset + fraction * visibleDurationMs;
    },
    [effectiveOffset, visibleDurationMs]
  );

  // Convert time in milliseconds to canvas X coordinate
  const timeMsToX = useCallback(
    (tMs: number, width: number): number => {
      const relTime = tMs - effectiveOffset;
      return (relTime / visibleDurationMs) * width;
    },
    [effectiveOffset, visibleDurationMs]
  );

  const beatPosition = getBeatPosition(positionMs, bpm, gridOffsetMs);
  const estimatedTitle = waveform?.isEstimated
    ? "Estimated preview waveform — decoded peaks from the audio file are not available yet."
    : "Detailed waveform.";

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = size;
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Carbon neutral base — very slight top-to-bottom shade keeps the peaks
    // from sitting on a dead-flat field without introducing a new palette.
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    if (isDarkTheme) {
      bg.addColorStop(0, "#1a1a1a");
      bg.addColorStop(1, "#141414");
    } else {
      bg.addColorStop(0, "#f8f8f8");
      bg.addColorStop(1, "#f0f0f0");
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    if (!waveform || waveform.peaks.length === 0) return;

    const centerY = height * 0.52;
    const maxWaveHeight = height * 0.36;

    // 1. Phrase region tints (kept quiet so the spectral waveform leads).
    if (waveform.phrases) {
      for (const phrase of waveform.phrases) {
        const x1 = timeMsToX(phrase.startMs, width);
        const x2 = timeMsToX(phrase.endMs, width);
        if (x2 < 0 || x1 > width) continue;

        const phraseWidth = Math.max(1, x2 - x1);
        let phraseBg = isDarkTheme ? "rgba(51,177,255,0.035)" : "rgba(0,114,195,0.025)";
        let phraseBorder = isDarkTheme ? "rgba(51,177,255,0.12)" : "rgba(0,114,195,0.10)";
        let labelColor = isDarkTheme ? "#a8a8a8" : "#6f6f6f";

        if (phrase.kind === "drop") {
          phraseBg = isDarkTheme ? "rgba(51,177,255,0.075)" : "rgba(0,114,195,0.06)";
          phraseBorder = isDarkTheme ? "rgba(51,177,255,0.24)" : "rgba(0,114,195,0.18)";
          labelColor = isDarkTheme ? "#33b1ff" : "#0072c3";
        } else if (phrase.kind === "break") {
          phraseBg = isDarkTheme ? "rgba(138,63,252,0.06)" : "rgba(138,63,252,0.04)";
          phraseBorder = isDarkTheme ? "rgba(138,63,252,0.20)" : "rgba(138,63,252,0.14)";
          labelColor = isDarkTheme ? "#be95ff" : "#6929c4";
        } else if (phrase.kind === "build") {
          phraseBg = isDarkTheme ? "rgba(241,194,27,0.055)" : "rgba(178,134,0,0.035)";
          phraseBorder = isDarkTheme ? "rgba(241,194,27,0.20)" : "rgba(178,134,0,0.14)";
          labelColor = isDarkTheme ? "#f1c21b" : "#b28600";
        }

        ctx.fillStyle = phraseBg;
        ctx.fillRect(x1, 0, phraseWidth, height);

        ctx.strokeStyle = phraseBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, height);
        ctx.stroke();

        // Phrase name sits in the top strip; cue flags may cover it locally.
        if (phraseWidth > 44 && x1 + 4 < width) {
          ctx.fillStyle = labelColor;
          ctx.font = "600 9px 'IBM Plex Mono', monospace";
          ctx.textAlign = "start";
          ctx.fillText(phrase.name.toUpperCase(), Math.max(x1 + 6, 6), 11);
        }
      }
    }

    // 2. Zero line.
    ctx.strokeStyle = isDarkTheme ? "rgba(244,244,244,0.07)" : "rgba(22,22,22,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // 3. Grid — pass one, under the peaks. Full-height bar lines only; the beat
    // ticks are short top/bottom marks and belong over the peaks.
    const beatMs = bpm > 40 ? (60 / bpm) * 1000 : 0;
    const beatPx = beatMs > 0 ? (beatMs / visibleDurationMs) * width : 0;
    const barPx = beatPx * 4;
    const firstBeatIndex = beatMs > 0 ? Math.floor((effectiveOffset - gridOffsetMs) / beatMs) : 0;
    const lastBeatIndex =
      beatMs > 0 ? Math.ceil((effectiveOffset + visibleDurationMs - gridOffsetMs) / beatMs) : -1;

    if (beatMs > 0 && barPx >= 2) {
      for (let b = firstBeatIndex; b <= lastBeatIndex; b++) {
        if (b % 4 !== 0) continue;
        const beatTime = b * beatMs + gridOffsetMs;
        if (beatTime < 0 || beatTime > safeDuration) continue;
        const x = timeMsToX(beatTime, width);
        if (x < -2 || x > width + 2) continue;

        ctx.strokeStyle = isDarkTheme ? "rgba(244,244,244,0.12)" : "rgba(22,22,22,0.09)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // 4. 3-band waveform. Draw order: body/highs (widest) → mids → bass core.
    const totalPeaks = waveform.peaks.length;
    const playedX = timeMsToX(positionMs, width);

    const palette = isDarkTheme
      ? {
          bodyPlayed: "#33b1ff",
          bodyUnplayed: "#0d4a63",
          midPlayed: "#42be65",
          midUnplayed: "#164d2e",
          lowPlayed: "#ff832b",
          lowUnplayed: "#6b3518",
        }
      : {
          bodyPlayed: "#0072c3",
          bodyUnplayed: "#9bc9ef",
          midPlayed: "#198038",
          midUnplayed: "#a7d8b6",
          lowPlayed: "#eb6200",
          lowUnplayed: "#f0bd96",
        };

    for (let x = 0; x < width; x++) {
      const tStart = xToTimeMs(x - 0.5, width);
      const tEnd = xToTimeMs(x + 0.5, width);
      if (tEnd < 0 || tStart > safeDuration) continue;

      const from = Math.max(0, tStart);
      const to = Math.min(safeDuration, tEnd);
      const i0 = Math.min(
        totalPeaks - 1,
        Math.max(0, Math.floor((from / safeDuration) * totalPeaks))
      );
      const i1 = Math.min(
        totalPeaks,
        Math.max(i0 + 1, Math.ceil((to / safeDuration) * totalPeaks))
      );
      const stride = Math.max(1, Math.floor((i1 - i0) / 24));

      let amp = 0;
      let low = 0;
      let mid = 0;
      for (let i = i0; i < i1; i += stride) {
        if (waveform.peaks[i]! > amp) amp = waveform.peaks[i]!;
        if (waveform.lowPeaks[i]! > low) low = waveform.lowPeaks[i]!;
        if (waveform.midPeaks[i]! > mid) mid = waveform.midPeaks[i]!;
      }

      // A hairline for silence keeps the timeline continuous.
      amp = Math.max(amp, 0.015);
      const bodyH = amp * maxWaveHeight;
      const midH = Math.min(amp, mid) * maxWaveHeight * 0.82;
      const lowH = Math.min(amp, low) * maxWaveHeight * 0.6;
      const isPlayed = x <= playedX;

      ctx.fillStyle = isPlayed ? palette.bodyPlayed : palette.bodyUnplayed;
      ctx.fillRect(x, centerY - bodyH, 1, bodyH * 2);
      ctx.fillStyle = isPlayed ? palette.midPlayed : palette.midUnplayed;
      ctx.fillRect(x, centerY - midH, 1, midH * 2);
      ctx.fillStyle = isPlayed ? palette.lowPlayed : palette.lowUnplayed;
      ctx.fillRect(x, centerY - lowH, 1, lowH * 2);
    }

    // 5. Grid — pass two, over the peaks: full bar lines, short beat ticks,
    // sparse bar numbers. Drawing after the waveform is what makes the grid
    // readable on top of dense drops.
    if (beatMs > 0) {
      const labelEvery =
        barPx >= 44 ? 1 : barPx >= 22 ? 2 : barPx >= 11 ? 4 : barPx >= 5.5 ? 8 : 16;
      const tickH = Math.max(4, Math.min(9, height * 0.075));

      for (let b = firstBeatIndex; b <= lastBeatIndex; b++) {
        const beatTime = b * beatMs + gridOffsetMs;
        if (beatTime < 0 || beatTime > safeDuration) continue;
        const x = timeMsToX(beatTime, width);
        if (x < -2 || x > width + 2) continue;

        const isBar = b % 4 === 0;
        if (isBar) {
          ctx.strokeStyle = isDarkTheme ? "rgba(244,244,244,0.26)" : "rgba(22,22,22,0.20)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();

          const barNumber = Math.floor(b / 4) + 1;
          if (barPx >= 4.5 && barNumber % labelEvery === 0 && x >= 0 && x <= width - 10) {
            ctx.fillStyle = isDarkTheme ? "rgba(244,244,244,0.55)" : "rgba(22,22,22,0.50)";
            ctx.font = "500 9px 'IBM Plex Mono', monospace";
            ctx.textAlign = "start";
            ctx.fillText(`${barNumber}`, x + 2, height - 2);
          }
        } else if (beatPx >= 3) {
          ctx.strokeStyle = isDarkTheme ? "rgba(244,244,244,0.24)" : "rgba(22,22,22,0.18)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, tickH);
          ctx.moveTo(x, height - tickH);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
    }

    // 6. Hot cues — vertical line plus a compact CDJ flag at the top.
    for (const cue of hotCues) {
      if (cue.positionMs === null) continue;
      const cueX = timeMsToX(cue.positionMs, width);
      if (cueX < -18 || cueX > width + 18) continue;

      ctx.strokeStyle = cue.colorHex;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cueX, 0);
      ctx.lineTo(cueX, height);
      ctx.stroke();

      ctx.fillStyle = cue.colorHex;
      ctx.fillRect(cueX, 4, 15, 14);
      ctx.beginPath();
      ctx.moveTo(cueX + 5.5, 18);
      ctx.lineTo(cueX + 9.5, 18);
      ctx.lineTo(cueX + 7.5, 21);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = CUE_TEXT_COLOR;
      ctx.font = "700 10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cue.letter, cueX + 7.5, 11.5);
    }

    // 7. Temporary CUE marker — Carbon Orange, dashed, stacked below cue flags.
    if (cuePositionMs !== null) {
      const cueX = timeMsToX(cuePositionMs, width);
      if (cueX >= -18 && cueX <= width + 18) {
        const cueOrange = isDarkTheme ? "#ff832b" : "#eb6200";
        ctx.strokeStyle = cueOrange;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(cueX, 0);
        ctx.lineTo(cueX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = cueOrange;
        ctx.fillRect(cueX - 17, 20, 34, 14);
        ctx.fillStyle = CUE_TEXT_COLOR;
        ctx.font = "700 9px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CUE", cueX, 27);
      }
    }

    // 8. High-contrast playhead at the reading head.
    if (playedX >= -6 && playedX <= width + 6) {
      ctx.shadowColor = isDarkTheme ? "rgba(51,177,255,0.55)" : "rgba(15,98,254,0.35)";
      ctx.shadowBlur = 7;
      ctx.strokeStyle = isDarkTheme ? "#f4f4f4" : "#0f62fe";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playedX, 0);
      ctx.lineTo(playedX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isDarkTheme ? "#33b1ff" : "#0f62fe";
      ctx.beginPath();
      ctx.moveTo(playedX - 5, 0);
      ctx.lineTo(playedX + 5, 0);
      ctx.lineTo(playedX, 7);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(playedX - 4, height);
      ctx.lineTo(playedX + 4, height);
      ctx.lineTo(playedX, height - 6);
      ctx.closePath();
      ctx.fill();
    }

    // 9. Hover cursor.
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

    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }, [
    waveform,
    positionMs,
    safeDuration,
    bpm,
    gridOffsetMs,
    effectiveOffset,
    visibleDurationMs,
    hotCues,
    cuePositionMs,
    isDarkTheme,
    isHovering,
    hoverX,
    size.width,
    size.height,
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
      onViewOffsetChange(Math.max(offsetMin, Math.min(effectiveOffset + panAmount, offsetMax)));
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

  const hoverRawMs =
    hoverX !== null && containerRef.current
      ? xToTimeMs(hoverX, containerRef.current.clientWidth)
      : null;
  // The centred window can show blank space before 0 / after the end; there is
  // no timecode to show there.
  const hoverTimeMs =
    hoverRawMs !== null && hoverRawMs >= 0 && hoverRawMs <= safeDuration
      ? applySnap(hoverRawMs)
      : null;

  const estimatedAria = waveform?.isEstimated ? ", estimated preview waveform" : "";

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
      className={`relative h-full w-full min-h-[90px] select-none bg-dj-bg ${
        isScrubbing ? "cursor-grabbing" : "cursor-crosshair"
      } overflow-hidden`}
      role="slider"
      aria-label="Detailed waveform scrubber"
      aria-valuemin={0}
      aria-valuemax={durationMs}
      aria-valuenow={positionMs}
      aria-valuetext={`${formatTimecode(positionMs, true)}${
        bpm > 0 ? `, ${formatBarBeat(positionMs, bpm, gridOffsetMs)}` : ""
      }${estimatedAria}`}
      tabIndex={0}
      title={`${estimatedTitle} Drag to scrub · scroll to zoom · Shift+wheel to pan.`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      {/* CDJ beat counter, pinned to the left of the waveform. The digit is the
          current beat; the four rectangles count 1–4. */}
      {bpm > 40 && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-sm border px-1.5 py-1 shadow-sm backdrop-blur-[2px] ${
            isDarkTheme ? "border-white/10 bg-black/45" : "border-black/10 bg-white/80"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div className="flex flex-col items-end leading-none">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-dj-text-muted">
                Bar
              </span>
              <span className="font-mono text-[10px] font-medium tabular-nums text-dj-text-secondary">
                {beatPosition.bar}
              </span>
            </div>
            <span
              aria-hidden="true"
              className={`h-6 w-px ${isDarkTheme ? "bg-white/15" : "bg-black/10"}`}
            />
            <span className="font-mono text-[17px] font-semibold leading-none tabular-nums text-dj-text">
              {beatPosition.beat}
            </span>
            {/* Four upright beat segments, side by side like a CDJ. The current
                beat is filled; the others stay as quiet outlined slots. */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((count) => (
                <span
                  key={count}
                  className={`h-4 w-[3px] rounded-[1px] transition-colors duration-75 ${
                    count === beatPosition.beat
                      ? "bg-dj-accent shadow-[0_0_4px_var(--color-dj-accent)]"
                      : isDarkTheme
                        ? "border border-white/20 bg-white/5"
                        : "border border-black/15 bg-black/5"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating hover timecode tooltip */}
      {isHovering && hoverX !== null && hoverTimeMs !== null && (
        <div
          className="pointer-events-none absolute top-2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-sm border border-dj-border bg-dj-elevated/95 px-1.5 py-0.5 font-mono text-[11px] font-medium text-dj-text shadow-md backdrop-blur-xs"
          style={{
            left: Math.max(40, Math.min(hoverX, (containerRef.current?.clientWidth || 300) - 40)),
          }}
        >
          <span className="font-semibold text-dj-accent">{formatTimecode(hoverTimeMs, true)}</span>
          {bpm > 0 && (
            <span className="text-[11px] text-dj-text-muted">
              {formatBarBeat(hoverTimeMs, bpm, gridOffsetMs)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
