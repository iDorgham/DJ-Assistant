import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import type { TagAlias, TagClusterReport, TagPreviewTrack } from "@dj-assistant/shared";

import { ModalShell } from "./ModalShell";
import {
  addTagAlias,
  listTagAliases,
  removeTagAlias,
  tagApplyRenames,
  tagCluster,
  tagPreviewTracks,
  undoTrackMetadata,
} from "../services/api";
import {
  aliasLabel,
  appliedLabel,
  clusterHeading,
  confirmLabel,
  edgeLabel,
  emptyReportMessage,
  hasFindings,
  ignoredTagsNote,
  memberLabel,
  moreAffectedNote,
  previewSampleIds,
  renamesFor,
  rewriteLabel,
  sampleSpellings,
  sampleTitle,
  scopeLabel,
  undoneLabel,
} from "../lib/tag-surgeon";

/**
 * The Tag Surgeon's surfaces: the duplicate-spelling report (T2.2.1), each
 * cluster's suggested canonical spelling with its preview (T2.2.2–T2.2.3),
 * advisory whole-word prefix relations, and the confirmed apply (T2.2.4).
 *
 * Applying is two steps: the cluster list names what will change, then a
 * confirm step applies exactly those spellings. The result keeps an undo
 * until the dialog closes; undo is the metadata undo, so a track edited again
 * since the apply is left as it is. Prefix relations stay advisory and are
 * never applied.
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
  /** Called after a rewrite or an undo, so the library view reloads. */
  onChanged?: () => void;
}

/** The latest apply, kept so its undo can be offered. */
interface AppliedChange {
  undoId: string;
  updated: number;
}

export function TagSurgeonDialog({ trackIds, onClose, onChanged }: TagSurgeonDialogProps) {
  const [report, setReport] = useState<TagClusterReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Map<string, TagPreviewTrack>>(new Map());
  const [sampleError, setSampleError] = useState<string | null>(null);
  // Bumped after a write, so the scan runs again on the new library state.
  const [scanRevision, setScanRevision] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedChange | null>(null);
  const [undoNote, setUndoNote] = useState<string | null>(null);
  const [aliases, setAliases] = useState<TagAlias[]>([]);
  const [aliasDraft, setAliasDraft] = useState("");
  const [canonicalDraft, setCanonicalDraft] = useState("");
  const [aliasBusy, setAliasBusy] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTagAliases()
      .then((list) => {
        if (!cancelled) setAliases(list);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setAliasError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
  }, [trackIds, scanRevision]);

  // The preview's sample tracks, fetched once per report. A failed sample read
  // is shown as its own error; the counts above it come from the scan and stay.
  // Each fetch takes a number; only the latest one may write, so a slow reply
  // for an earlier report cannot overwrite the current samples.
  const sampleRequest = useRef(0);
  useEffect(() => {
    const request = ++sampleRequest.current;
    setSamples(new Map());
    setSampleError(null);
    const ids = report ? previewSampleIds(report) : [];
    if (ids.length > 0) {
      tagPreviewTracks({ trackIds: ids })
        .then((tracks) => {
          if (request === sampleRequest.current) {
            setSamples(new Map(tracks.map((track) => [track.trackId, track])));
          }
        })
        .catch((cause: unknown) => {
          if (request === sampleRequest.current) {
            setSampleError(cause instanceof Error ? cause.message : String(cause));
          }
        });
    }
  }, [report]);

  async function applyRenames() {
    if (!report || busy) return;
    setBusy(true);
    setApplyError(null);
    try {
      const result = await tagApplyRenames({ trackIds, renames: renamesFor(report) });
      setApplied({ undoId: result.undoId, updated: result.updated });
      setUndoNote(null);
      setConfirming(false);
      onChanged?.();
      setScanRevision((revision) => revision + 1);
    } catch (cause) {
      setApplyError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function undoApply() {
    if (!applied?.undoId || busy) return;
    setBusy(true);
    setApplyError(null);
    try {
      const result = await undoTrackMetadata({ undoId: applied.undoId });
      setApplied(null);
      setUndoNote(undoneLabel(result.restored, result.skipped));
      onChanged?.();
      setScanRevision((revision) => revision + 1);
    } catch (cause) {
      setApplyError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function addAlias() {
    if (aliasBusy) return;
    setAliasBusy(true);
    setAliasError(null);
    try {
      const next = await addTagAlias({ alias: aliasDraft, canonical: canonicalDraft });
      setAliases(next);
      setAliasDraft("");
      setCanonicalDraft("");
    } catch (cause) {
      setAliasError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setAliasBusy(false);
    }
  }

  async function removeAlias(alias: string) {
    if (aliasBusy) return;
    setAliasBusy(true);
    setAliasError(null);
    try {
      setAliases(await removeTagAlias({ alias }));
    } catch (cause) {
      setAliasError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setAliasBusy(false);
    }
  }

  const ignoredNote = report ? ignoredTagsNote(report.ignoredTags) : null;
  const renameCount = report ? renamesFor(report).length : 0;

  // The render pieces below are separate values or functions, so no single
  // JSX tree nests past the depth the lint rule allows (JS-0415).
  const renderSample = (cluster: TagClusterReport["clusters"][number], trackId: string) => {
    const track = samples.get(trackId);
    // A sample the scan named but the read no longer returns (removed
    // meanwhile) is left out rather than invented.
    if (!track) return null;
    return (
      <li key={trackId} className="text-[11px] text-dj-text-muted break-words">
        <span className="text-dj-text-secondary">{sampleTitle(track)}</span>
        <span className="block">
          {sampleSpellings(
            track,
            cluster.canonical,
            cluster.members.map((member) => member.raw)
          ).join(" · ")}
          {" → "}
          <span className="text-dj-text-secondary">{cluster.canonical}</span>
        </span>
      </li>
    );
  };

  const renderCluster = (cluster: TagClusterReport["clusters"][number]) => (
    <li key={cluster.key} className="rounded-md border border-dj-border bg-dj-elevated px-2.5 py-2">
      <p className="text-xs font-semibold text-dj-text break-words">{clusterHeading(cluster)}</p>
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
          {cluster.sampleTrackIds.map((trackId) => renderSample(cluster, trackId))}
          {moreAffectedNote(cluster) && (
            <li className="text-[11px] text-dj-text-muted">{moreAffectedNote(cluster)}</li>
          )}
        </ul>
      )}
    </li>
  );

  const applyBlock = (
    <div className="rounded-md border border-dj-border px-2.5 py-2">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover disabled:opacity-50"
        >
          Apply these spellings…
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-dj-text-secondary">{confirmLabel(renameCount)}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applyRenames}
              disabled={busy}
              className="rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs font-medium text-dj-text transition hover:bg-dj-hover disabled:opacity-50"
            >
              {busy ? "Applying…" : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderPrefixBlock = (edges: TagClusterReport["prefixEdges"]) => (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
        Possibly related
      </p>
      <p className="mt-0.5 text-[11px] text-dj-text-muted">
        One tag starts with another as a whole word. Shown for review — nothing here is a proposed
        change.
      </p>
      <ul className="mt-1 space-y-1">
        {edges.map((edge) => (
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
  );

  const renderAliasRow = (item: TagAlias) => (
    <li
      key={item.alias}
      className="flex items-center justify-between gap-2 text-[11px] text-dj-text-secondary"
    >
      <span className="break-words">{aliasLabel(item)}</span>
      <button
        type="button"
        onClick={() => removeAlias(item.alias)}
        disabled={aliasBusy}
        className="shrink-0 rounded-md px-2 py-0.5 text-[11px] text-dj-text-muted transition hover:bg-dj-hover disabled:opacity-50"
      >
        Remove
      </button>
    </li>
  );

  const aliasesBlock = (
    <div className="border-t border-dj-border pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
        Aliases
      </p>
      <p className="mt-0.5 text-[11px] text-dj-text-muted">
        Tags saved with an alias take its canonical spelling from now on. Tracks already in the
        library are not changed.
      </p>
      {aliases.length > 0 && (
        <ul className="mt-1 space-y-1">{aliases.map((item) => renderAliasRow(item))}</ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          aria-label="Alias"
          placeholder="Alias, e.g. melodic h"
          value={aliasDraft}
          onChange={(event) => setAliasDraft(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-dj-border bg-dj-elevated px-2 py-1 text-xs text-dj-text"
        />
        <input
          aria-label="Saved as"
          placeholder="Saved as, e.g. melodic house"
          value={canonicalDraft}
          onChange={(event) => setCanonicalDraft(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-dj-border bg-dj-elevated px-2 py-1 text-xs text-dj-text"
        />
        <button
          type="button"
          onClick={addAlias}
          disabled={aliasBusy || !aliasDraft.trim() || !canonicalDraft.trim()}
          className="shrink-0 rounded-md border border-dj-border bg-dj-elevated px-3 py-1 text-xs text-dj-text-secondary transition hover:bg-dj-hover disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {aliasError && (
        <p className="mt-1.5 rounded-sm border border-dj-danger/30 bg-dj-danger/10 px-2 py-1.5 text-[11px] text-dj-danger">
          {aliasError}
        </p>
      )}
    </div>
  );

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
          <ul className="space-y-2">{report.clusters.map((cluster) => renderCluster(cluster))}</ul>
        )}

        {/* Hidden while an undo is open: a second apply would replace that undo
            offer and leave the first change reversible only from history. */}
        {report && report.clusters.length > 0 && !applied?.undoId && applyBlock}

        {applyError && (
          <p className="rounded-sm border border-dj-danger/30 bg-dj-danger/10 px-2 py-1.5 text-[11px] text-dj-danger">
            Could not change the tags: {applyError}
          </p>
        )}

        {applied && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-dj-text-secondary">
            <span>{appliedLabel(applied.updated)}</span>
            {applied.undoId && (
              <button
                type="button"
                onClick={undoApply}
                disabled={busy}
                className="shrink-0 rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1 text-xs text-dj-text-secondary transition hover:bg-dj-hover disabled:opacity-50"
              >
                Undo
              </button>
            )}
          </div>
        )}

        {undoNote && <p className="text-[11px] text-dj-text-secondary">{undoNote}</p>}

        {report && report.prefixEdges.length > 0 && renderPrefixBlock(report.prefixEdges)}

        {aliasesBlock}

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
