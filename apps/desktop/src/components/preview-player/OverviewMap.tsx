import { useRef, useEffect, useState } from "react";
import type { WaveformData, HotCueData } from "../../lib/waveform-generator";

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
  const maxOffset = Math.max(0, safeDuration - visibleDurationMs);
  const clampedOffset = Math.max(0, Math.min(viewOffsetMs, maxOffset));

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
    ctx.scale(dpr, dpr);
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

    // Draw miniature waveform bars
    const step = 2;
    for (let x = 0; x < width; x += step) {
      const peakIdx = Math.min(totalPeaks - 1, Math.max(0, Math.floor((x / width) * totalPeaks)));
      const amp = waveform.peaks[peakIdx] || 0.1;
      const h = amp * maxH;
      const isPlayed = x <= playedX;

      ctx.fillStyle = isPlayed ? playedColor : unplayedColor;
      ctx.fillRect(x, centerY - h, step - 0.5, h * 2);
    }

    // Draw Cues as miniature dots
    for (const cue of hotCues) {
      if (cue.positionMs === null) continue;
      const cueX = (cue.positionMs / safeDuration) * width;
      ctx.fillStyle = cue.colorHex;
      ctx.beginPath();
      ctx.arc(cueX, height - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (cuePositionMs !== null) {
      // Carbon Orange-40 (dark) / Orange-50 (light)
      const cueX = (cuePositionMs / safeDuration) * width;
      ctx.fillStyle = isDarkTheme ? "#ff832b" : "#eb6200";
      ctx.beginPath();
      ctx.arc(cueX, height - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Playhead on overview — Carbon white (dark) / Blue-60 (light)
    if (playedX >= 0 && playedX <= width) {
      ctx.strokeStyle = isDarkTheme ? "#f4f4f4" : "#0f62fe";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playedX, 0);
      ctx.lineTo(playedX, height);
      ctx.stroke();
    }
  }, [waveform, positionMs, safeDuration, hotCues, cuePositionMs, isDarkTheme]);

  // Window bounds in pixels (0 width → overlay simply stays off-screen)
  const windowLeftPx = (clampedOffset / safeDuration) * containerWidth;
  const windowWidthPx = Math.max(16, (visibleDurationMs / safeDuration) * containerWidth);

  // Dragging the zoom window
  const handleWindowMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setIsDraggingWindow(true);

    const startX = e.clientX;
    const initialOffset = clampedOffset;

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

  // Clicking on overview background jumps playhead and centers zoom window
  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const targetMs = (clickX / rect.width) * safeDuration;
    onSeek(targetMs);

    // Center zoomed view around click position
    onViewOffsetChange(targetMs - visibleDurationMs * 0.5);
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
          className={`absolute top-0 bottom-0 cursor-grab active:cursor-grabbing border border-dj-accent/60 bg-dj-accent/15 backdrop-blur-[1px] transition-colors hover:bg-dj-accent/25 ${
            isDraggingWindow ? "bg-dj-accent/30 border-dj-accent" : ""
          }`}
          style={{
            left: `${windowLeftPx}px`,
            width: `${windowWidthPx}px`,
          }}
          title="Drag to pan zoomed waveform"
        >
          {/* Subtle resize handles on edges */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-dj-accent/40" />
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-dj-accent/40" />
        </div>
      )}
    </div>
  );
}
