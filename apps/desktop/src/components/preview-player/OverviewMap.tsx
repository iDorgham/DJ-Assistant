import { useRef, useEffect, useState } from "react";
import type { WaveformData, HotCueData } from "../../lib/waveform-generator";
import { formatTimecode } from "../../lib/waveform-generator";

interface OverviewMapProps {
  waveform: WaveformData | null;
  positionMs: number;
  durationMs: number;
  zoomLevel: number;
  viewOffsetMs: number;
  onViewOffsetChange: (offsetMs: number) => void;
  onSeek: (positionMs: number) => void;
  hotCues: HotCueData[];
  cuePositionMs: number | null;
  isDarkTheme?: boolean;
}

export function OverviewMap({
  waveform,
  positionMs,
  durationMs,
  zoomLevel,
  viewOffsetMs,
  onViewOffsetChange,
  onSeek,
  hotCues,
  cuePositionMs,
  isDarkTheme = true,
}: OverviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  // Track real width (ResizeObserver) — rendering-time ref reads go stale.
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const safeDuration = Math.max(durationMs || 180000, 1000);
  const visibleDurationMs = safeDuration / Math.max(1, zoomLevel);
  // The detailed waveform centres its window on the playhead, so viewOffsetMs
  // can be negative at the start / past the end. Clip the highlight window to
  // the real track content instead of clamping the offset as a start time.
  const viewStartMs = Math.max(0, Math.min(viewOffsetMs, safeDuration));
  const viewEndMs = Math.max(0, Math.min(viewOffsetMs + visibleDurationMs, safeDuration));

  // Render overview canvas
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!waveform || waveform.peaks.length === 0) {
      // Carbon: gray-90 dark / gray-10 light
      ctx.fillStyle = isDarkTheme ? "#262626" : "#f4f4f4";
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const centerY = height * 0.5;
    const maxH = height * 0.42;
    const totalPeaks = waveform.peaks.length;
    const playedX = (positionMs / safeDuration) * width;

    // IBM Carbon: Cyan-40 played / Teal-70 muted (dark), Cyan-60 played / Cyan-30 muted (light)
    const playedColor = isDarkTheme ? "#33b1ff" : "#0072c3";
    const unplayedColor = isDarkTheme ? "#005d5d" : "#82cfff";

    // Draw miniature waveform bars. Step 2 keeps the 16k source cheap while
    // still resolving the drop/break shape at overview width.
    const step = 2;
    for (let x = 0; x < width; x += step) {
      const peakIdx = Math.min(totalPeaks - 1, Math.max(0, Math.floor((x / width) * totalPeaks)));
      const amp = Math.max(waveform.peaks[peakIdx] || 0, 0.02);
      const h = amp * maxH;
      const isPlayed = x <= playedX;

      ctx.fillStyle = isPlayed ? playedColor : unplayedColor;
      ctx.fillRect(x, centerY - h, step - 0.5, h * 2);
    }

    // Cues as small full-height ticks, not floating dots — easier to hit and
    // read against the miniature waveform.
    for (const cue of hotCues) {
      if (cue.positionMs === null) continue;
      const cueX = (cue.positionMs / safeDuration) * width;
      ctx.fillStyle = cue.colorHex;
      ctx.fillRect(cueX - 1, height - 8, 2, 7);
      ctx.beginPath();
      ctx.arc(cueX, height - 2.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (cuePositionMs !== null) {
      // Carbon Orange-40 (dark) / Orange-50 (light)
      const cueX = (cuePositionMs / safeDuration) * width;
      ctx.fillStyle = isDarkTheme ? "#ff832b" : "#eb6200";
      ctx.fillRect(cueX - 1, height - 8, 2, 7);
      ctx.beginPath();
      ctx.arc(cueX, height - 2.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // The playhead is drawn as a DOM overlay above the zoom window (see below)
    // so it stays visible while the window tint sits over the canvas.
  }, [waveform, positionMs, safeDuration, hotCues, cuePositionMs, isDarkTheme, containerWidth]);

  // Window bounds in pixels (0 width → overlay simply stays off-screen)
  const windowLeftPx = (viewStartMs / safeDuration) * containerWidth;
  const windowWidthPx = Math.max(12, ((viewEndMs - viewStartMs) / safeDuration) * containerWidth);

  // Dragging the zoom window
  const handleWindowMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setIsDraggingWindow(true);

    const startX = e.clientX;
    const initialOffset = viewOffsetMs;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const deltaX = moveEvt.clientX - startX;
      const deltaMs = (deltaX / Math.max(1, containerWidth)) * safeDuration;
      onViewOffsetChange(initialOffset + deltaMs);
    };

    const onMouseUp = () => {
      setIsDraggingWindow(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Clicking on overview background jumps the playhead. The detailed waveform
  // re-centres itself when follow-playhead is on.
  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const targetMs = (clickX / rect.width) * safeDuration;
    onSeek(targetMs);
  };

  const handleWindowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = visibleDurationMs * (e.shiftKey ? 0.25 : 0.08);
    let nextOffset: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") nextOffset = viewOffsetMs - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") nextOffset = viewOffsetMs + step;
    else if (e.key === "Home") nextOffset = -visibleDurationMs / 2;
    else if (e.key === "End") nextOffset = safeDuration - visibleDurationMs / 2;

    if (nextOffset !== null) {
      e.preventDefault();
      e.stopPropagation();
      onViewOffsetChange(nextOffset);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleContainerMouseDown}
      className="relative w-full h-[22px] min-h-[20px] select-none cursor-pointer bg-dj-elevated border-y border-dj-border overflow-hidden"
      title="Overview map: click to jump playhead, drag highlight window to pan zoomed region"
      role="region"
      aria-label="Track overview map"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />

      {/* Visible Zoom Window Highlight */}
      {zoomLevel > 1.05 && (
        <div
          onMouseDown={handleWindowMouseDown}
          onKeyDown={handleWindowKeyDown}
          role="slider"
          aria-label="Zoom window position"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, safeDuration - visibleDurationMs)}
          aria-valuenow={Math.max(0, Math.min(viewStartMs, safeDuration - visibleDurationMs))}
          aria-valuetext={formatTimecode(viewStartMs, true)}
          tabIndex={0}
          className={`absolute top-0 bottom-0 cursor-grab active:cursor-grabbing border border-dj-accent/60 bg-dj-accent/15 backdrop-blur-[1px] transition-colors hover:bg-dj-accent/25 ${
            isDraggingWindow ? "bg-dj-accent/30 border-dj-accent" : ""
          }`}
          style={{
            left: `${windowLeftPx}px`,
            width: `${windowWidthPx}px`,
          }}
          title="Drag or use arrow keys to pan the zoomed waveform"
        >
          {/* Subtle resize handles on edges */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-dj-accent/40" />
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-dj-accent/40" />
        </div>
      )}
      {/* Playhead — always above the zoom-window tint so the current position
          is readable at a glance while the window pans. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 bottom-0 z-20 w-[2px] -translate-x-1/2 bg-dj-text shadow-[0_0_4px_rgba(0,0,0,0.45)]"
        style={{
          left: `${(Math.max(0, Math.min(positionMs, safeDuration)) / safeDuration) * 100}%`,
        }}
      >
        <div className="absolute -top-px left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-dj-text" />
      </div>
    </div>
  );
}
