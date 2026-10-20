import { useRef, useEffect, useState } from "react";
import type { WaveformData, HotCueData } from "../../lib/waveform-generator";
import { formatTimecode } from "../../lib/waveform-generator";

interface CompactWaveformProps {
  waveform: WaveformData | null;
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
  hotCues: HotCueData[];
  cuePositionMs: number | null;
  isDarkTheme?: boolean;
}

export function CompactWaveform({
  waveform,
  positionMs,
  durationMs,
  onSeek,
  hotCues,
  cuePositionMs,
  isDarkTheme = true,
}: CompactWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const safeDuration = Math.max(durationMs || 180000, 1000);

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
    const maxH = height * 0.44;
    const totalPeaks = waveform.peaks.length;
    const playedX = (positionMs / safeDuration) * width;

    // IBM Carbon: Cyan-40 played / Teal-70 muted (dark), Cyan-60 played / Cyan-30 muted (light)
    const playedColor = isDarkTheme ? "#33b1ff" : "#0072c3";
    const unplayedColor = isDarkTheme ? "#005d5d" : "#82cfff";

    // Draw compact waveform
    const step = 2;
    for (let x = 0; x < width; x += step) {
      const peakIdx = Math.min(totalPeaks - 1, Math.max(0, Math.floor((x / width) * totalPeaks)));
      const amp = waveform.peaks[peakIdx] || 0.1;
      const h = amp * maxH;
      const isPlayed = x <= playedX;

      ctx.fillStyle = isPlayed ? playedColor : unplayedColor;
      ctx.fillRect(x, centerY - h, step - 0.5, h * 2);
    }

    // Hot cue dots
    for (const cue of hotCues) {
      if (cue.positionMs === null) continue;
      const cueX = (cue.positionMs / safeDuration) * width;
      ctx.fillStyle = cue.colorHex;
      ctx.beginPath();
      ctx.arc(cueX, height - 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (cuePositionMs !== null) {
      // IBM Carbon: Orange-40 (dark) / Orange-50 (light)
      const cueX = (cuePositionMs / safeDuration) * width;
      ctx.fillStyle = isDarkTheme ? "#ff832b" : "#eb6200";
      ctx.beginPath();
      ctx.arc(cueX, height - 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Playhead line — Carbon white (dark) / Blue-60 (light)
    if (playedX >= 0 && playedX <= width) {
      ctx.strokeStyle = isDarkTheme ? "#f4f4f4" : "#0f62fe";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playedX, 0);
      ctx.lineTo(playedX, height);
      ctx.stroke();

      // Top dot — Cyan-40 (dark) / Cyan-60 (light)
      ctx.fillStyle = isDarkTheme ? "#33b1ff" : "#0072c3";
      ctx.beginPath();
      ctx.arc(playedX, 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hover line — Carbon subtle overlay
    if (isHovering && hoverX !== null) {
      ctx.strokeStyle = isDarkTheme ? "rgba(244,244,244,0.35)" : "rgba(22,22,22,0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [waveform, positionMs, safeDuration, hotCues, cuePositionMs, isDarkTheme, isHovering, hoverX]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    onSeek((clickX / rect.width) * safeDuration);

    const onMouseMove = (moveEvt: MouseEvent) => {
      const curRect = containerRef.current?.getBoundingClientRect();
      if (!curRect) return;
      const x = moveEvt.clientX - curRect.left;
      onSeek(Math.max(0, Math.min(1, x / curRect.width)) * safeDuration);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverX(e.clientX - rect.left);
  };

  // Keyboard seeking (docs/ui/10): arrows seek ±2s (Shift ±10s), Home/End jump.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let nextMs: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      nextMs = positionMs - (e.shiftKey ? 10000 : 2000);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      nextMs = positionMs + (e.shiftKey ? 10000 : 2000);
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

  const hoverTimeMs =
    hoverX !== null && containerRef.current
      ? (hoverX / containerRef.current.clientWidth) * safeDuration
      : null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setHoverX(null);
      }}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
      className="relative flex-1 h-7 min-w-[140px] select-none cursor-crosshair rounded bg-dj-bg border border-dj-border overflow-hidden"
      role="slider"
      aria-label="Compact waveform preview"
      aria-valuemin={0}
      aria-valuemax={durationMs}
      aria-valuenow={positionMs}
      aria-valuetext={formatTimecode(positionMs, true)}
      tabIndex={0}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />

      {/* Floating Hover Time Tooltip */}
      {isHovering && hoverX !== null && hoverTimeMs !== null && (
        <div
          className="pointer-events-none absolute top-1 z-20 -translate-x-1/2 rounded bg-dj-elevated/95 px-1 py-0.5 font-mono text-[11px] font-semibold text-dj-text border border-dj-border shadow-xs backdrop-blur-xs"
          style={{
            left: Math.max(25, Math.min(hoverX, (containerRef.current?.clientWidth || 200) - 25)),
          }}
        >
          {formatTimecode(hoverTimeMs)}
        </div>
      )}
    </div>
  );
}
