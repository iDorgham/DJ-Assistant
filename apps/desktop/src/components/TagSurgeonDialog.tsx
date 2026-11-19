import { useEffect, useState } from "react";
import { X } from "lucide-react";

import type { TagClusterReport } from "@dj-assistant/shared";

import { ModalShell } from "./ModalShell";
import { tagCluster } from "../services/api";
import {
  clusterHeading,
  edgeLabel,
  emptyReportMessage,
  hasFindings,
  ignoredTagsNote,
  memberLabel,
  scopeLabel,
} from "../lib/tag-surgeon";

/**
 * The Tag Surgeon's first surface (T2.2.1): a read-only report of duplicate
 * tag spellings in the selection, plus advisory whole-word prefix relations.
 *
 * There is deliberately no apply button — suggesting a canonical spelling is
 * T2.2.2, previewing it T2.2.3, applying it T2.2.4. A dialog that only looks
 * apply-shaped would promise a write this slice cannot make.
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
                <p className="mt-1 text-[11px] text-dj-text-muted">
                  {scopeLabel(cluster.distinctTrackCount)} affected
                </p>
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
