import { useState } from "react";
import type { AnalysisStatus, TrackDetail } from "@dj-assistant/shared";
import { RefreshCw } from "lucide-react";

import { formatBpm, formatDuration, formatKey } from "../../lib/library";
import { analyzeLibrary } from "../../services/api";

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  pending: "Pending",
  complete: "Complete",
  failed: "Failed",
  needs_review: "Needs review",
};

export function AnalysisTab({ track }: { track: TrackDetail }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const reanalyze = async () => {
    setBusy(true);
    setFailed(false);
    setMessage(null);
    try {
      const res = await analyzeLibrary({ trackIds: [track.id], force: true });
      setMessage(
        res.total > 0
          ? `Queued ${res.total} track${res.total === 1 ? "" : "s"} for analysis.`
          : "Nothing to analyse right now."
      );
    } catch (err) {
      console.error("Failed to queue analysis:", err);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {track.analysisStatus === "failed" && (
        <div className="rounded-md border border-dj-danger/30 bg-dj-danger/10 px-2.5 py-2 text-[11px] text-dj-danger">
          The last analysis failed. Re-analyze to try again.
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        <Fact label="Status" value={STATUS_LABEL[track.analysisStatus]} />
        <Fact label="Version" value={track.analysisVersion} mono />
        <Fact label="BPM" value={track.bpm != null ? formatBpm(track.bpm) : null} mono />
        <Fact label="Key" value={formatKey(track.keyCamelot, track.keyClassical)} mono />
        <Fact label="Duration" value={formatDuration(track.durationMs)} mono />
        <Fact
          label="Loudness"
          value={track.loudnessLufs != null ? `${track.loudnessLufs.toFixed(1)} LUFS` : null}
          mono
        />
        <Fact
          label="Vocal presence"
          value={
            track.vocalPresence == null ? null : track.vocalPresence ? "Vocal" : "Instrumental"
          }
        />
        <Fact
          label="Phrase confidence"
          value={
            track.phraseConfidence != null ? `${Math.round(track.phraseConfidence * 100)}%` : null
          }
          mono
        />
      </dl>

      <div className="rounded-md border border-dj-border bg-dj-elevated p-3">
        <p className="text-[11px] text-dj-text-muted">
          Waveform, beat grid and phrase markers render in the player (Stage 4). This panel reports
          the stored analysis values only.
        </p>
        <button
          type="button"
          onClick={reanalyze}
          disabled={busy}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dj-border bg-dj-panel px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Queueing…" : "Re-analyze"}
        </button>
        {message && <p className="mt-2 text-[11px] text-dj-success">{message}</p>}
        {failed && (
          <p className="mt-2 text-[11px] text-dj-danger">
            Couldn&apos;t queue the analysis. Try again.
          </p>
        )}
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const shown = value?.trim() || "—";
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-dj-text-muted">
        {label}
      </dt>
      <dd className={`truncate text-dj-text-secondary ${mono ? "font-mono" : ""}`} title={shown}>
        {shown}
      </dd>
    </div>
  );
}
