import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import type {
  DuplicateGroupView,
  HealthCategoryView,
  LibraryDuplicatesResponse,
  LibraryHealthResponse,
  LibraryVersionsResponse,
  PrepAuditResponse,
} from "@dj-assistant/shared";

import { ModalShell } from "./ModalShell";
import {
  DRILL_PAGE,
  DrillRow,
  LoadError,
  TrackLine,
  buttonClass,
  errorClass,
  quietButtonClass,
} from "./MaintainParts";
import { PrepAuditPanel } from "./PrepAuditPanel";
import {
  dismissDuplicateGroup,
  forgetDuplicateCopy,
  libraryDuplicates,
  libraryHealth,
  libraryVersions,
  prepAudit,
  revealInFileManager,
} from "../services/api";
import {
  MAINTAIN_TABS,
  affectedNote,
  categoryDetail,
  duplicatesSummary,
  formatDuration,
  formatQuality,
  healthSummary,
  keepConfirmLabel,
  reasonLabel,
  scoreText,
  scoreTone,
  suggestedKeeper,
  versionChipLabel,
  versionsSummary,
  type MaintainTab,
  type ScoreTone,
} from "../lib/maintain";
import { ReadGate, tabsToRefreshAfterWrite } from "../lib/read-gate";

/**
 * Library › Maintain: the Library Health Score (T2.3.3), the Prep Auditor
 * checklist (T2.3.4), duplicate review (T2.3.1) and version families (T2.3.2).
 *
 * Nothing here deletes. "Keep this one" hands the other copies to the
 * caller's soft remove, which is undoable from its toast and from the removed
 * view; "Keep both" hides the group until its membership changes; "Forget"
 * drops a skipped-copy record, never the file. Every track opens in the
 * shared Track panel.
 */
interface MaintainDialogProps {
  onClose: () => void;
  /** Opens the shared Track panel for a track id. */
  onOpenTrack: (trackId: string) => void;
  /** Soft-removes tracks; resolves true when the remove went through. */
  /** Soft-removes the tracks; `null` when it failed (the caller reported it). */
  onRemoveTracks: (trackIds: string[]) => Promise<MaintainRemoval | null>;
  /** Restores a removal made from this dialog; whether it worked. */
  onUndoRemove: (undoId: string) => Promise<boolean>;
  /** The library selection the Prep audit checks; null audits the library. */
  auditTrackIds?: string[] | null;
  initialTab?: MaintainTab;
}

const TONE_TEXT: Record<ScoreTone, string> = {
  good: "text-dj-success",
  fair: "text-dj-warning",
  poor: "text-dj-danger",
  neutral: "text-dj-text-muted",
};

const TONE_BAR: Record<ScoreTone, string> = {
  good: "bg-dj-success",
  fair: "bg-dj-warning",
  poor: "bg-dj-danger",
  neutral: "bg-dj-border",
};

const sectionHeading = "text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted";

function logUnexpected(err: unknown) {
  console.error("Maintain load failed unexpectedly:", err);
}

/** A category's score as a thin bar; empty when it is not configured. */
function ScoreBar({ tone, width }: { tone: ScoreTone; width: number }) {
  return (
    <div className="mt-1 h-1 w-full rounded-full bg-dj-border/60">
      <div className={`h-1 rounded-full ${TONE_BAR[tone]}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/** A Health category's name, weight, failing counts and score bar. */
function CategoryHeading({ category, tone }: { category: HealthCategoryView; tone: ScoreTone }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-dj-text">
        {category.label}
        <span className="ml-1.5 text-[11px] font-normal text-dj-text-muted">
          {category.weight}%
        </span>
      </p>
      <p className="truncate text-[11px] text-dj-text-muted">{categoryDetail(category)}</p>
      <ScoreBar tone={tone} width={category.configured ? Math.round(category.score ?? 0) : 0} />
    </div>
  );
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** What a "Keep this" removal returns, so the dialog can offer its own Undo. */
export interface MaintainRemoval {
  message: string;
  undoId: string | null;
}

/**
 * One tab's read, ordered by a `ReadGate` (`lib/read-gate.ts`, where the
 * ordering rules are tested): only the newest request publishes. `load` joins
 * a pending request — a tab switch mid-scan does not start a second one;
 * `reload` always starts a fresh request and orphans any pending one.
 */
function useTabRead<T>(fetch: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gate] = useState(() => new ReadGate());

  const run = useCallback(
    async (join: boolean) => {
      const request = gate.begin(join);
      if (request === null) return;
      setError(null);
      try {
        const result = await fetch();
        if (gate.isCurrent(request)) setData(result);
      } catch (err) {
        if (gate.isCurrent(request)) setError(errorText(err));
      } finally {
        gate.settle(request);
      }
    },
    [fetch, gate]
  );
  const load = useCallback(() => run(true), [run]);
  const reload = useCallback(() => run(false), [run]);
  /** Drops the cached result and orphans any pending request. */
  const reset = useCallback(() => {
    gate.invalidate();
    setData(null);
  }, [gate]);
  return { data, error, load, reload, reset };
}

export function MaintainDialog({
  onClose,
  onOpenTrack,
  onRemoveTracks,
  onUndoRemove,
  auditTrackIds = null,
  initialTab = "health",
}: MaintainDialogProps) {
  const [tab, setTab] = useState<MaintainTab>(initialTab);
  // Read by afterWrite, which runs after an await and so sees the tab the
  // user is on now, not the one it was created on.
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const healthRead = useTabRead<LibraryHealthResponse>(libraryHealth);
  const health = healthRead.data;
  const healthError = healthRead.error;
  const loadHealth = healthRead.load;
  const reloadHealth = healthRead.reload;
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [drillLimit, setDrillLimit] = useState(DRILL_PAGE);

  const duplicatesRead = useTabRead<LibraryDuplicatesResponse>(libraryDuplicates);
  const duplicates = duplicatesRead.data;
  const duplicatesError = duplicatesRead.error;
  const loadDuplicates = duplicatesRead.load;
  const [lastRemoval, setLastRemoval] = useState<MaintainRemoval | null>(null);
  const [confirmKeep, setConfirmKeep] = useState<{ groupKey: string; keepId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // The selection is fixed while the dialog is open (it is modal), so the
  // fetch keeps one identity for the dialog's lifetime.
  const [auditScope] = useState(() =>
    auditTrackIds && auditTrackIds.length > 0 ? [...auditTrackIds] : null
  );
  const fetchPrep = useCallback(() => prepAudit({ trackIds: auditScope }), [auditScope]);
  const prepRead = useTabRead<PrepAuditResponse>(fetchPrep);
  const reloadPrep = prepRead.reload;

  const versionsRead = useTabRead<LibraryVersionsResponse>(libraryVersions);
  const versions = versionsRead.data;
  const versionsError = versionsRead.error;
  const loadVersions = versionsRead.load;

  // Each tab reloads every time it is shown: the health score checks files on
  // disk, so a result from an earlier visit can already be wrong. The previous
  // result stays on screen until the new one arrives.
  useEffect(() => {
    // The loaders report their own errors in the tab, so nothing reaches
    // these handlers; they only keep a stray rejection out of the console.
    // Health always starts a fresh scan: one already running may have checked
    // the disk before a drive went away.
    if (tab === "health") reloadHealth().catch(logUnexpected);
    // The audit checks files on disk too, so it is always fresh.
    if (tab === "prep") reloadPrep().catch(logUnexpected);
    if (tab === "duplicates") loadDuplicates().catch(logUnexpected);
    if (tab === "versions") loadVersions().catch(logUnexpected);
  }, [tab, reloadHealth, reloadPrep, loadDuplicates, loadVersions]);

  /**
   * After a write every tab is stale. Cached results and pending reads are
   * dropped, and Duplicates plus whichever tab is open now start fresh reads —
   * a pending read would publish pre-write data, and a tab the user switched
   * to mid-write would otherwise wait on a read that was just orphaned.
   */
  const afterWrite = async () => {
    healthRead.reset();
    prepRead.reset();
    versionsRead.reset();
    const reads = {
      health: healthRead,
      prep: prepRead,
      duplicates: duplicatesRead,
      versions: versionsRead,
    };
    await Promise.all(tabsToRefreshAfterWrite(tabRef.current).map((t) => reads[t].reload()));
  };

  const undoRemoval = async (removal: MaintainRemoval) => {
    if (!removal.undoId) return;
    setBusy(true);
    setActionError(null);
    try {
      if (await onUndoRemove(removal.undoId)) {
        setLastRemoval(null);
        await afterWrite();
      }
    } finally {
      setBusy(false);
    }
  };

  const keepOne = async (group: DuplicateGroupView, keepId: string) => {
    const others = group.tracks.filter((t) => t.id !== keepId).map((t) => t.id);
    if (others.length === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      const removal = await onRemoveTracks(others);
      if (removal) {
        setConfirmKeep(null);
        // The app's Undo toast sits behind this dialog, so Undo lives here
        // too, for as long as the dialog stays open.
        setLastRemoval(removal);
        await afterWrite();
      }
    } finally {
      setBusy(false);
    }
  };

  const keepBoth = async (group: DuplicateGroupView) => {
    setBusy(true);
    setActionError(null);
    try {
      await dismissDuplicateGroup({ key: group.key });
      await afterWrite();
    } catch (err) {
      setActionError(`Could not keep both: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const forgetCopy = async (path: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await forgetDuplicateCopy({ path });
      await afterWrite();
    } catch (err) {
      setActionError(`Could not forget the copy: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const reveal = async (path: string) => {
    setActionError(null);
    try {
      // A missing file comes back as an error naming the path.
      await revealInFileManager({ path });
    } catch (err) {
      setActionError(`Could not open the file manager: ${errorText(err)}`);
    }
  };

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = MAINTAIN_TABS.findIndex((t) => t.id === tab);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = MAINTAIN_TABS[(index + step + MAINTAIN_TABS.length) % MAINTAIN_TABS.length];
    setTab(next.id);
    document.getElementById(`maintain-tab-${next.id}`)?.focus();
  };

  // --- Health ---------------------------------------------------------------

  const renderCategory = (category: HealthCategoryView) => {
    const tone = category.configured ? scoreTone(category.score) : "neutral";
    const expanded = openCategory === category.id;
    const canDrill = category.affected.length > 0;
    const note = affectedNote(
      Math.min(drillLimit, category.affected.length),
      category.affectedTotal
    );
    return (
      <li key={category.id} className="rounded-md border border-dj-border bg-dj-elevated/40">
        <button
          type="button"
          onClick={() => {
            setOpenCategory(expanded ? null : category.id);
            setDrillLimit(DRILL_PAGE);
          }}
          disabled={!canDrill}
          aria-expanded={canDrill ? expanded : undefined}
          className="flex w-full items-center gap-3 px-3 py-2 text-left transition enabled:hover:bg-dj-hover"
        >
          <CategoryHeading category={category} tone={tone} />
          <span className={`w-10 text-right text-sm font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
            {category.configured ? scoreText(category.score) : "–"}
          </span>
        </button>
        {expanded && (
          <div className="border-t border-dj-border px-3 py-2">
            <ul className="space-y-1.5">
              {category.affected.slice(0, drillLimit).map((track) => (
                <DrillRow key={track.id} onOpen={() => onOpenTrack(track.id)}>
                  <TrackLine track={track} />
                </DrillRow>
              ))}
            </ul>
            {category.affected.length > drillLimit && (
              <button
                type="button"
                onClick={() => setDrillLimit((n) => n + DRILL_PAGE)}
                className={`mt-1.5 ${quietButtonClass}`}
              >
                Show more
              </button>
            )}
            {note && <p className="mt-1 text-[11px] text-dj-text-muted">{note}</p>}
          </div>
        )}
      </li>
    );
  };

  const healthPanel = (
    <div className="space-y-3">
      {healthError && (
        <LoadError message={`Could not score the library: ${healthError}`} onRetry={loadHealth} />
      )}
      {!health && !healthError && <p className="text-xs text-dj-text-muted">Scoring library…</p>}
      {health && (
        <>
          <div className="flex items-center gap-4">
            <div
              className={`text-4xl font-semibold tabular-nums ${TONE_TEXT[scoreTone(health.score)]}`}
              aria-label={`Library Health Score ${scoreText(health.score)} out of 100`}
            >
              {scoreText(health.score)}
            </div>
            <p className="text-xs text-dj-text-secondary">
              {healthSummary(health.score, health.trackCount)}
            </p>
          </div>
          {health.categories.length > 0 && (
            <ul className="space-y-1.5">{health.categories.map(renderCategory)}</ul>
          )}
          <p className="text-[11px] text-dj-text-muted">
            Weights are fixed for v1. Categories not set up yet are left out of the score instead of
            counting for or against it.
          </p>
        </>
      )}
    </div>
  );

  // --- Duplicates -----------------------------------------------------------

  const renderGroup = (group: DuplicateGroupView) => {
    const keeper = suggestedKeeper(group.tracks);
    const confirming = confirmKeep?.groupKey === group.key ? confirmKeep : null;
    return (
      <li key={group.key} className="rounded-md border border-dj-border bg-dj-elevated/40 p-2">
        <p className="mb-1.5 text-[11px] text-dj-text-muted">{reasonLabel(group.reason)}</p>
        <ul className="space-y-1.5">
          {group.tracks.map((track) => (
            <li key={track.id} className="flex items-center justify-between gap-2">
              <TrackLine track={track} />
              <div className="flex shrink-0 items-center gap-1">
                {track.id === keeper && (
                  <span className="text-[10px] uppercase tracking-wider text-dj-accent">
                    Suggested
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenTrack(track.id)}
                  className={quietButtonClass}
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmKeep({ groupKey: group.key, keepId: track.id })}
                  disabled={busy}
                  className={buttonClass}
                >
                  Keep this
                </button>
              </div>
            </li>
          ))}
        </ul>
        {confirming ? (
          <div className="mt-2 rounded-md border border-dj-border bg-dj-panel p-2">
            <p className="text-[11px] text-dj-text-secondary">
              {keepConfirmLabel(group.tracks.length - 1)}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => keepOne(group, confirming.keepId)}
                disabled={busy}
                className={buttonClass}
              >
                {busy ? "Removing…" : "Remove others"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmKeep(null)}
                disabled={busy}
                className={quietButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => keepBoth(group)}
              disabled={busy}
              className={quietButtonClass}
              title="They are different versions or both wanted — stop flagging this group"
            >
              Keep both
            </button>
          </div>
        )}
      </li>
    );
  };

  const duplicatesPanel = (
    <div className="space-y-3">
      {duplicatesError && (
        <LoadError
          message={`Could not find duplicates: ${duplicatesError}`}
          onRetry={loadDuplicates}
        />
      )}
      {!duplicates && !duplicatesError && (
        <p className="text-xs text-dj-text-muted">Looking for duplicates…</p>
      )}
      {actionError && <p className={errorClass}>{actionError}</p>}
      {lastRemoval && (
        <div className="flex items-center gap-2 rounded-sm border border-dj-border bg-dj-elevated px-2 py-1.5">
          <p className="flex-1 text-[11px] text-dj-text-secondary" role="status">
            {lastRemoval.message}
          </p>
          {lastRemoval.undoId && (
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => {
                undoRemoval(lastRemoval).catch(logUnexpected);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
      {duplicates && (
        <>
          <p className="text-xs text-dj-text-secondary">
            {duplicatesSummary(
              duplicates.groups.length,
              duplicates.copies.length,
              duplicates.dismissedCount
            )}
          </p>
          {duplicates.groups.length > 0 && (
            <ul className="space-y-2">{duplicates.groups.map(renderGroup)}</ul>
          )}
          {duplicates.copies.length > 0 && (
            <div className="border-t border-dj-border pt-2">
              <p className={sectionHeading}>Skipped file copies</p>
              <p className="mt-0.5 text-[11px] text-dj-text-muted">
                Byte-identical files found at another path during a scan. They were not imported;
                the library track is listed next to each one.
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {duplicates.copies.map((copy) => (
                  <li key={copy.copyPath} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-dj-text" title={copy.copyPath}>
                        {copy.copyPath}
                      </p>
                      <p className="truncate text-[11px] text-dj-text-muted">
                        Same file as {copy.track.title || "Untitled"} —{" "}
                        {copy.track.artist || "Unknown artist"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => reveal(copy.copyPath)}
                        className={quietButtonClass}
                      >
                        Reveal
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTrack(copy.track.id)}
                        className={quietButtonClass}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => forgetCopy(copy.copyPath)}
                        disabled={busy}
                        className={buttonClass}
                        title="Stop listing this copy. The file is not touched."
                      >
                        Forget
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-dj-text-muted">
            Nothing is deleted. Removing a copy takes it out of the library only; the file stays on
            disk and Undo brings it back.
          </p>
        </>
      )}
    </div>
  );

  // --- Versions -------------------------------------------------------------

  const versionsPanel = (
    <div className="space-y-3">
      {versionsError && (
        <LoadError message={`Could not group versions: ${versionsError}`} onRetry={loadVersions} />
      )}
      {!versions && !versionsError && (
        <p className="text-xs text-dj-text-muted">Grouping versions…</p>
      )}
      {versions && (
        <>
          <p className="text-xs text-dj-text-secondary">
            {versionsSummary(versions.groups.length)}
          </p>
          {versions.groups.length > 0 && (
            <ul className="space-y-2">
              {versions.groups.map((group) => (
                <li
                  key={group.key}
                  className="rounded-md border border-dj-border bg-dj-elevated/40 p-2"
                >
                  <p className="truncate text-xs font-medium text-dj-text">
                    {group.baseTitle}
                    <span className="font-normal text-dj-text-secondary"> — {group.artist}</span>
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {group.members.map((member) => (
                      <li key={member.track.id} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-sm border border-dj-border px-1.5 py-px text-[10px] text-dj-text-secondary">
                            {versionChipLabel(member.kind, member.label)}
                          </span>
                          <span
                            className="truncate text-[11px] text-dj-text-muted"
                            title={member.track.filePath}
                          >
                            {[formatDuration(member.track.durationMs), formatQuality(member.track)]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenTrack(member.track.id)}
                          className={quietButtonClass}
                        >
                          Open
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-dj-text-muted">
            Versions are read from the title (“Opus (Extended Mix)”) or the mix name tag. Two copies
            of the same version are listed under Duplicates instead.
          </p>
        </>
      )}
    </div>
  );

  return (
    <ModalShell
      onClose={onClose}
      ariaLabel="Maintain — library health, prep audit, duplicates and versions"
      panelClassName="w-[640px] max-w-full max-h-full overflow-y-auto bg-dj-panel border border-dj-border rounded-lg shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-dj-border px-4 py-3">
        <p className="text-sm font-semibold text-dj-text">Maintain</p>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-dj-hover text-dj-text-secondary transition"
          title="Close (Esc)"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Maintain sections"
        onKeyDown={onTabKeyDown}
        className="flex gap-1 border-b border-dj-border px-4"
      >
        {MAINTAIN_TABS.map((item) => (
          <button
            key={item.id}
            id={`maintain-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`maintain-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 px-2 py-2 text-xs transition ${
              tab === item.id
                ? "border-dj-accent text-dj-text"
                : "border-transparent text-dj-text-secondary hover:text-dj-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id={`maintain-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`maintain-tab-${tab}`}
        className="px-4 py-3"
      >
        {tab === "health" && healthPanel}
        {tab === "prep" && (
          <PrepAuditPanel
            audit={prepRead.data}
            error={prepRead.error}
            onRetry={() => {
              reloadPrep().catch(logUnexpected);
            }}
            onOpenTrack={onOpenTrack}
          />
        )}
        {tab === "duplicates" && duplicatesPanel}
        {tab === "versions" && versionsPanel}
      </div>
    </ModalShell>
  );
}
