import { useEffect, useState } from "react";
import type { TrackDetail, TrackSummary, SimilarTrackResult } from "@dj-assistant/shared";
import { Sparkles } from "lucide-react";

import {
  formatBpm,
  formatDuration,
  formatKey,
  formatMissingField,
  formatScore,
} from "../../lib/library";
import { fileFormatLabel, formatSampleRate } from "../../lib/track-panel";
import { findSimilarTracks, trackTagHealth } from "../../services/api";
import { TagChips } from "../TagChips";
import { PurchaseSection } from "./PurchaseSection";

interface OverviewTabProps {
  track: TrackDetail;
  onEditMetadata: () => void;
  onSelectTrack: (track: TrackSummary) => void;
  onSelectTag?: (tag: string) => void;
}

/**
 * Shows track metadata, tag gaps, purchase links, and up to eight similar library tracks.
 * Similar-track failures offer a retry; tag-health failures leave the gap list empty.
 * Selecting a similar track delegates to onSelectTrack.
 */
export function OverviewTab({
  track,
  onEditMetadata,
  onSelectTrack,
  onSelectTag,
}: OverviewTabProps) {
  const [similar, setSimilar] = useState<SimilarTrackResult[]>([]);
  const [similarLoading, setSimilarLoading] = useState(true);
  const [similarError, setSimilarError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [gaps, setGaps] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setSimilarLoading(true);
    setSimilarError(false);
    setGaps([]);
    findSimilarTracks({ trackId: track.id, limit: 8 })
      .then((res) => {
        if (!cancelled) setSimilar(res.results);
      })
      .catch((err) => {
        console.error("Failed to load similar tracks:", err);
        if (!cancelled) {
          setSimilar([]);
          setSimilarError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setSimilarLoading(false);
      });
    trackTagHealth({ trackIds: [track.id], limit: 1 })
      .then((res) => {
        if (!cancelled) setGaps(res.gaps[0]?.missing ?? []);
      })
      .catch((err) => {
        console.error("Failed to load tag gaps:", err);
        if (!cancelled) setGaps([]);
      });
    return () => {
      cancelled = true;
    };
  }, [track.id, retry]);

  return (
    <div className="space-y-5">
      {gaps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gaps.map((field) => (
            <span
              key={field}
              className="rounded-sm border border-dj-warning/20 bg-dj-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-dj-warning"
              title="Missing locally — online lookup is opt-in and never fetches audio"
            >
              missing: {formatMissingField(field)}
            </span>
          ))}
        </div>
      )}

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
          Details
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
          <Fact label="Album" value={track.album} />
          <Fact label="Label" value={track.label} />
          <Fact label="Year" value={track.year != null ? String(track.year) : null} />
          <Fact label="Genre" value={track.genre} />
          <Fact label="BPM" value={track.bpm != null ? formatBpm(track.bpm) : null} mono />
          <Fact label="Key" value={formatKey(track.keyCamelot, track.keyClassical)} mono />
          <Fact label="Energy" value={track.energy != null ? `${track.energy} / 10` : null} />
          <Fact
            label="Rating"
            value={track.userRating != null ? `${track.userRating} / 5` : null}
          />
          <Fact label="Duration" value={formatDuration(track.durationMs)} mono />
          <Fact label="Format" value={fileFormatLabel(track.format)} mono />
          <Fact label="Sample rate" value={formatSampleRate(track.sampleRate)} mono />
          <Fact
            label="Bit depth"
            value={track.bitDepth != null ? `${track.bitDepth} bit` : null}
            mono
          />
        </dl>
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
            Tags
          </p>
          <TagChips tags={track.tags} maxVisible={24} onSelect={onSelectTag} />
          <button
            type="button"
            onClick={onEditMetadata}
            className="mt-2 text-[11px] text-dj-accent underline decoration-dotted transition hover:text-dj-accent-strong"
          >
            Edit metadata and tags
          </button>
        </div>
        {track.comments && (
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
              Comment
            </p>
            <p className="whitespace-pre-wrap text-xs text-dj-text-secondary">{track.comments}</p>
          </div>
        )}
      </section>

      <section>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-dj-text-secondary">
          <Sparkles className="h-3.5 w-3.5 text-dj-accent" />
          <span>Similar tracks (local mix-compatibility)</span>
        </p>
        {similarLoading ? (
          <p className="mt-2 text-xs text-dj-text-muted">Scoring library…</p>
        ) : similarError ? (
          <p className="mt-2 text-xs text-dj-danger">
            Couldn&apos;t score similar tracks.{" "}
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="rounded-sm px-1 text-dj-accent underline underline-offset-2 transition hover:bg-dj-hover"
            >
              Retry
            </button>
          </p>
        ) : similar.length === 0 ? (
          <p className="mt-2 text-xs text-dj-text-muted">
            No comparable tracks yet — import more music with BPM and key tags.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {similar.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => onSelectTrack(result)}
                  className="w-full rounded-md border border-dj-border bg-dj-elevated p-2 text-left transition hover:bg-dj-hover"
                  title={result.reasons.join(" · ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-dj-text">
                      {result.title || "Untitled"}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-dj-accent">
                      {formatScore(result.score)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-dj-text-muted">
                      {result.artist || "Unknown Artist"}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-dj-text-muted">
                      {formatBpm(result.bpm)} · {formatKey(result.keyCamelot, result.keyClassical)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PurchaseSection track={track} />
    </div>
  );
}

/** Displays a labeled value, trimming whitespace and using "—" for missing or blank text. */
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
