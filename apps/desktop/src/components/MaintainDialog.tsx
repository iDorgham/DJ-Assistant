import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import type {
  DuplicateGroupView,
  HealthCategoryView,
  LibraryDuplicatesResponse,
  LibraryHealthResponse,
  LibraryVersionsResponse,
  MaintainTrack,
} from "@dj-assistant/shared";

import { ModalShell } from "./ModalShell";
import {
  dismissDuplicateGroup,
  forgetDuplicateCopy,
  libraryDuplicates,
  libraryHealth,
  libraryVersions,
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

/**
 * Library › Maintain: the Library Health Score (T2.3.3), duplicate review
 * (T2.3.1) and version families (T2.3.2).
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
  onRemoveTracks: (trackIds: string[]) => Promise<boolean>;
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

/** Rows rendered per drill-down before "Show more". */
const DRILL_PAGE = 50;

const buttonClass =
  "shrink-0 rounded-md border border-dj-border bg-dj-elevated px-2 py-0.5 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover disabled:opacity-50";
const quietButtonClass =
  "shrink-0 rounded-md px-2 py-0.5 text-[11px] text-dj-text-muted transition hover:bg-dj-hover disabled:opacity-50";
const errorClass =
  "rounded-sm border border-dj-danger/30 bg-dj-danger/10 px-2 py-1.5 text-[11px] text-dj-danger";
const sectionHeading = "text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted";

/** A failed load with a way to try again without reopening the dialog. */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <p className={`${errorClass} flex-1`}>{message}</p>
      <button type="button" onClick={onRetry} className={buttonClass}>
        Retry
      </button>
    </div>
  );
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function MaintainDialog({
  onClose,
  onOpenTrack,
  onRemoveTracks,
  initialTab = "health",
}: MaintainDialogProps) {
  const [tab, setTab] = useState<MaintainTab>(initialTab);

  const [health, setHealth] = useState<LibraryHealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [drillLimit, setDrillLimit] = useState(DRILL_PAGE);

  const [duplicates, setDuplicates] = useState<LibraryDuplicatesResponse | null>(null);
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null);
  const [confirmKeep, setConfirmKeep] = useState<{ groupKey: string; keepId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [versions, setVersions] = useState<LibraryVersionsResponse | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  // One request per tab at a time: switching tabs while a scan is still
  // running must not start a second one.
  const inFlight = useRef<Record<MaintainTab, boolean>>({
    health: false,
    duplicates: false,
    versions: false,
  });

  const loadHealth = useCallback(async () => {
    if (inFlight.current.health) return;
    inFlight.current.health = true;
    setHealthError(null);
    try {
      setHealth(await libraryHealth());
    } catch (err) {
      setHealthError(errorText(err));
    } finally {
      inFlight.current.health = false;
    }
  }, []);

  const loadDuplicates = useCallback(async () => {
    if (inFlight.current.duplicates) return;
    inFlight.current.duplicates = true;
    setDuplicatesError(null);
    try {
      setDuplicates(await libraryDuplicates());
    } catch (err) {
      setDuplicatesError(errorText(err));
    } finally {
      inFlight.current.duplicates = false;
    }
  }, []);

  const loadVersions = useCallback(async () => {
    if (inFlight.current.versions) return;
    inFlight.current.versions = true;
    setVersionsError(null);
    try {
      setVersions(await libraryVersions());
    } catch (err) {
      setVersionsError(errorText(err));
    } finally {
      inFlight.current.versions = false;
    }
  }, []);

  // Each tab reloads every time it is shown: the health score checks files on
  // disk, so a result from an earlier visit can already be wrong. The previous
  // result stays on screen until the new one arrives.
  useEffect(() => {
    if (tab === "health") void loadHealth();
    if (tab === "duplicates") void loadDuplicates();
    if (tab === "versions") void loadVersions();
  }, [tab, loadHealth, loadDuplicates, loadVersions]);

  /** After a write every tab is stale; refetch the visible one, drop the rest. */
  const afterWrite = async () => {
    setHealth(null);
    setVersions(null);
    await loadDuplicates();
  };

  const keepOne = async (group: DuplicateGroupView, keepId: string) => {
    const others = group.tracks.filter((t) => t.id !== keepId).map((t) => t.id);
    if (others.length === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      if (await onRemoveTracks(others)) {
        setConfirmKeep(null);
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

  const trackLine = (track: MaintainTrack) => (
    <div className="min-w-0">
      <p className="truncate text-xs text-dj-text">
        {track.title || "Untitled"}
        <span className="text-dj-text-secondary"> — {track.artist || "Unknown artist"}</span>
      </p>
      <p className="truncate text-[11px] text-dj-text-muted" title={track.filePath}>
        {[formatDuration(track.durationMs), formatQuality(track), track.filePath]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );

  // --- Health ---------------------------------------------------------------

  const renderCategory = (category: HealthCategoryView) => {
    const tone = category.configured ? scoreTone(category.score) : "neutral";
    const expanded = openCategory === category.id;
    const canDrill = category.affected.length > 0;
    const note = affectedNote(category.affected.length, category.affectedTotal);
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
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-dj-text">
              {category.label}
              <span className="ml-1.5 text-[11px] font-normal text-dj-text-muted">
                {category.weight}%
              </span>
            </p>
            <p className="truncate text-[11px] text-dj-text-muted">{categoryDetail(category)}</p>
            <div className="mt-1 h-1 w-full rounded-full bg-dj-border/60">
              <div
                className={`h-1 rounded-full ${TONE_BAR[tone]}`}
                style={{ width: `${category.configured ? Math.round(category.score ?? 0) : 0}%` }}
              />
            </div>
          </div>
          <span className={`w-10 text-right text-sm font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
            {category.configured ? scoreText(category.score) : "–"}
          </span>
        </button>
        {expanded && (
          <div className="border-t border-dj-border px-3 py-2">
            <ul className="space-y-1.5">
              {category.affected.slice(0, drillLimit).map((track) => (
                <li key={track.id} className="flex items-center justify-between gap-2">
                  {trackLine(track)}
                  <button
                    type="button"
                    onClick={() => onOpenTrack(track.id)}
                    className={buttonClass}
                  >
                    Open
                  </button>
                </li>
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
              {trackLine(track)}
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
      ariaLabel="Maintain — library health, duplicates and versions"
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
        {tab === "duplicates" && duplicatesPanel}
        {tab === "versions" && versionsPanel}
      </div>
    </ModalShell>
  );
}
