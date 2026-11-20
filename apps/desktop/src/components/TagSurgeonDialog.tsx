import { useEffect, useState } from "react";
import { X } from "lucide-react";

import type { TagClusterReport, TagPreviewTrack } from "@dj-assistant/shared";

import { ModalShell } from "./ModalShell";
import { tagCluster, tagPreviewTracks } from "../services/api";
import {
  clusterHeading,
  edgeLabel,
  emptyReportMessage,
  hasFindings,
  ignoredTagsNote,
  memberLabel,
  moreAffectedNote,
  previewSampleIds,
  rewriteLabel,
  sampleSpellings,
  sampleTitle,
  scopeLabel,
} from "../lib/tag-surgeon";

/**
 * The Tag Surgeon's read-only surfaces: the duplicate-spelling report (T2.2.1),
 * each cluster's suggested canonical spelling with its preview (T2.2.2–T2.2.3),
 * and advisory whole-word prefix relations.
 *
 * There is deliberately no apply button — applying a rewrite is T2.2.4. A
 * dialog that only looks apply-shaped would promise a write this slice cannot
 * make. The preview names sample tracks and the spellings that would change;
 * it never changes a tag.
 *
 * Every label is a raw spelling the user typed; fold keys stay internal to the
 * engine. The wording rules live in `lib/tag-surgeon`, where they are unit
 * tested without a DOM.
 */
interface TagSurgeonDialogProps {
  /** The ids the scan covers, resolved by the caller from the selection. */
  trackIds: string[];
  /** Closes the dialog. */
  onClose: () => void;
}

export function TagSurgeonDialog({ trackIds, onClose }: TagSurgeonDialogProps) {
  const [report, setReport] = useState<TagClusterReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Map<string, TagPreviewTrack>>(new Map());
  const [sampleError, setSampleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    tagCluster({ trackIds })
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [trackIds]);

  // The preview's sample tracks, fetched once per report. A failed sample read
  // is shown as its own error; the counts above it come from the scan and stay.
  useEffect(() => {
    let cancelled = false;
    setSamples(new Map());
    setSampleError(null);
    if (!report) return;
    const ids = previewSampleIds(report);
    if (ids.length === 0) return;
    tagPreviewTracks({ trackIds: ids })
      .then((tracks) => {
        if (!cancelled) setSamples(new Map(tracks.map((track) => [track.trackId, track])));
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setSampleError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [report]);

  const ignoredNote = report ? ignoredTagsNote(report.ignoredTags) : null;

  return (
    <ModalShell
      onClose={onClose}
      ariaLabel="Tag Surgeon — duplicate spellings"
      panelClassName="w-[460px] max-w-full max-h-full overflow-y-auto bg-dj-panel border border-dj-border rounded-lg shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-dj-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dj-text">Tag Surgeon — duplicate spellings</p>
          <p className="text-[11px] text-dj-text-muted">{scopeLabel(trackIds.length)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-dj-hover text-dj-text-secondary transition"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        {error && (
          <p className="rounded-sm border border-dj-danger/30 bg-dj-danger/10 px-2 py-1.5 text-[11px] text-dj-danger">
            {error}
          </p>
        )}

        {!error && !report && <p className="text-xs text-dj-text-muted">Scanning tags…</p>}

        {sampleError && (
          <p className="rounded-sm border border-dj-danger/30 bg-dj-danger/10 px-2 py-1.5 text-[11px] text-dj-danger">
            Could not load sample tracks: {sampleError}
          </p>
        )}

        {report && !hasFindings(report) && (
          <p className="text-xs text-dj-text-secondary">{emptyReportMessage(trackIds.length)}</p>
        )}

        {report && report.clusters.length > 0 && (
          <ul className="space-y-2">
            {report.clusters.map((cluster) => (
              <li
                key={cluster.key}
                className="rounded-md border border-dj-border bg-dj-elevated px-2.5 py-2"
              >
                <p className="text-xs font-semibold text-dj-text break-words">
                  {clusterHeading(cluster)}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {cluster.members.map((member) => (
                    <li key={member.raw} className="text-[11px] text-dj-text-secondary break-words">
                      {memberLabel(member)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] font-medium text-dj-text-secondary break-words">
                  {rewriteLabel(cluster)}
                </p>
                {cluster.sampleTrackIds.length > 0 && (
                  <ul className="mt-1 space-y-1 border-t border-dj-border pt-1.5">
                    {cluster.sampleTrackIds.map((trackId) => {
                      const track = samples.get(trackId);
                      // A sample the scan named but the read no longer returns
                      // (removed meanwhile) is left out rather than invented.
                      if (!track) return null;
                      return (
                        <li key={trackId} className="text-[11px] text-dj-text-muted break-words">
                          <span className="text-dj-text-secondary">{sampleTitle(track)}</span>
                          <span className="block">
                            {sampleSpellings(track, cluster.canonical).join(" · ")}
                            {" → "}
                            <span className="text-dj-text-secondary">{cluster.canonical}</span>
                          </span>
                        </li>
                      );
                    })}
                    {moreAffectedNote(cluster) && (
                      <li className="text-[11px] text-dj-text-muted">
                        {moreAffectedNote(cluster)}
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        {report && report.prefixEdges.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
              Possibly related
            </p>
            <p className="mt-0.5 text-[11px] text-dj-text-muted">
              One tag starts with another as a whole word. Shown for review — nothing here is a
              proposed change.
            </p>
            <ul className="mt-1 space-y-1">
              {report.prefixEdges.map((edge) => (
                <li
                  key={`${edge.narrowerKey}→${edge.broaderKey}`}
                  className="text-[11px] text-dj-text-secondary"
                >
                  <span className="break-words">{edgeLabel(edge)}</span>
                  <span className="ml-1.5 text-dj-text-muted">
                    ({scopeLabel(edge.narrowerTracks)} · {scopeLabel(edge.broaderTracks)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ignoredNote && <p className="text-[11px] text-dj-text-muted">{ignoredNote}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-dj-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover"
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
}
