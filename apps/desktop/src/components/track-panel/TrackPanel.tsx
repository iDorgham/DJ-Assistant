import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AnalysisStatus, TrackDetail, TrackSummary } from "@dj-assistant/shared";
import { AlertTriangle, ListMusic, Pencil, Play, X } from "lucide-react";

import { formatBpm, formatDuration, formatKey } from "../../lib/library";
import {
  movePanelTab,
  persistTrackPanelTab,
  readTrackPanelTab,
  TRACK_PANEL_TABS,
  type PanelTabKey,
  type TrackPanelTab,
} from "../../lib/track-panel";
import { getTrack } from "../../services/api";
import { ArtworkThumb } from "../ArtworkThumb";
import { AnalysisTab } from "./AnalysisTab";
import { CuesTab } from "./CuesTab";
import { FileTab } from "./FileTab";
import { OverviewTab } from "./OverviewTab";
import { TagsTab } from "./TagsTab";

const STATUS_META: Record<AnalysisStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "border-dj-warning/20 bg-dj-warning/10 text-dj-warning",
  },
  complete: {
    label: "Complete",
    className: "border-dj-success/20 bg-dj-success/10 text-dj-success",
  },
  failed: {
    label: "Failed",
    className: "border-dj-danger/20 bg-dj-danger/10 text-dj-danger",
  },
  needs_review: {
    label: "Needs review",
    className: "border-dj-accent/20 bg-dj-accent/10 text-dj-accent",
  },
};

interface TrackPanelProps {
  /** The inspected track. Opening the panel never changes what the dock plays. */
  track: TrackSummary;
  /** Number of tracks affected by rating and energy edits. */
  targetCount: number;
  /** Bumped when the library reloads after a write, scan or analysis. */
  refreshToken: number;
  onClose: () => void;
  onPlay: (track: TrackSummary) => void;
  onRate: (track: TrackSummary, rating: number | null) => void;
  onSetEnergy: (track: TrackSummary, energy: number | null) => void;
  onEditMetadata: (track: TrackSummary) => void;
  onSelectTrack: (track: TrackSummary) => void;
  onSelectTag?: (tag: string) => void;
}

/**
 * Shows details for the inspected track, reloading when its ID or refreshToken changes.
 * Remembers the active tab and focuses it on mount; detail read failures show a retry action.
 * Escape delegates closing to onClose, and playback and edits use the supplied callbacks.
 */
export function TrackPanel({
  track,
  targetCount,
  refreshToken,
  onClose,
  onPlay,
  onRate,
  onSetEnergy,
  onEditMetadata,
  onSelectTrack,
  onSelectTag,
}: TrackPanelProps) {
  const [tab, setTab] = useState<TrackPanelTab>(() => readTrackPanelTab());
  const [detail, setDetail] = useState<TrackDetail | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  const tabRefs = useRef<Partial<Record<TrackPanelTab, HTMLButtonElement | null>>>({});
  // The panel focuses its active tab once, on mount. A track change or a
  // background refresh must not pull the focus away from the user.
  const initialTabRef = useRef(tab);
  useEffect(() => {
    tabRefs.current[initialTabRef.current]?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    persistTrackPanelTab(tab);
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    getTrack({ trackId: track.id })
      .then((res) => {
        if (!cancelled) setDetail(res.track);
      })
      .catch((err) => {
        console.error("Failed to load track detail:", err);
        if (!cancelled) {
          setError(true);
          setDetail(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [track.id, refreshToken, retry]);

  // A detail for another track is never shown under the current header. While
  // the first read is in flight the body renders its skeleton instead.
  const activeDetail = detail?.id === track.id ? detail : null;
  const summary = activeDetail ?? track;
  const status = STATUS_META[summary.analysisStatus];

  /** Activates a tab and moves keyboard focus to its button. */
  const selectTab = (next: TrackPanelTab) => {
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  /** Handles wrapping arrow navigation and Home/End selection; leaves other keys untouched. */
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, id: TrackPanelTab) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    selectTab(movePanelTab(id, event.key as PanelTabKey));
  };

  /** Closes on Escape and stops it from reaching the window handler that closes other layers. */
  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    // The panel owns Escape while focus is inside it; the window-level handler
    // must not also close other layers behind it.
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <aside
      data-track-panel
      aria-label={`Track panel — ${summary.title || "Untitled"}`}
      onKeyDown={onPanelKeyDown}
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[92vw] flex-col border-l border-dj-border bg-dj-panel shadow-2xl shadow-black/50 sm:w-[420px]"
    >
      <header className="shrink-0 border-b border-dj-border p-4">
        <div className="flex items-start gap-3">
          <ArtworkThumb trackId={summary.id} hasArtwork={!!summary.artworkHash} large />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-dj-text">
                {summary.title || "Untitled"}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close track panel"
                title="Close (Esc)"
                className="rounded-md p-1.5 text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="truncate text-xs text-dj-text-secondary">
              {summary.artist || "Unknown Artist"}
            </p>
            {summary.album && (
              <p className="mt-0.5 truncate text-[11px] text-dj-text-muted">{summary.album}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${status.className}`}
              >
                {status.label}
              </span>
              <span className="font-mono text-[11px] text-dj-text-muted">
                {formatBpm(summary.bpm)} · {formatKey(summary.keyCamelot, summary.keyClassical)} ·{" "}
                {formatDuration(summary.durationMs)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Track panel sections"
        className="flex shrink-0 overflow-x-auto border-b border-dj-border bg-dj-bg/40 px-1"
      >
        {TRACK_PANEL_TABS.map((entry) => {
          const active = entry.id === tab;
          return (
            <button
              key={entry.id}
              ref={(element) => {
                tabRefs.current[entry.id] = element;
              }}
              type="button"
              role="tab"
              id={`track-panel-tab-${entry.id}`}
              aria-selected={active}
              aria-controls={`track-panel-panel-${entry.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => selectTab(entry.id)}
              onKeyDown={(event) => onTabKeyDown(event, entry.id)}
              className={`shrink-0 border-b-2 px-2.5 py-2 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dj-accent ${
                active
                  ? "border-dj-accent text-dj-text"
                  : "border-transparent text-dj-text-muted hover:text-dj-text-secondary"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        tabIndex={0}
        id={`track-panel-panel-${tab}`}
        aria-labelledby={`track-panel-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto p-4"
      >
        {error && !activeDetail ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <AlertTriangle className="h-6 w-6 text-dj-warning" />
            <p className="text-xs text-dj-text-secondary">
              Could not load this track&apos;s details.
            </p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
            >
              Retry
            </button>
          </div>
        ) : activeDetail ? (
          <>
            {tab === "overview" && (
              <OverviewTab
                track={activeDetail}
                onEditMetadata={() => onEditMetadata(activeDetail)}
                onSelectTrack={onSelectTrack}
                onSelectTag={onSelectTag}
              />
            )}
            {tab === "tags" && (
              <TagsTab
                track={activeDetail}
                targetCount={targetCount}
                onEditMetadata={() => onEditMetadata(activeDetail)}
                onRate={(rating) => onRate(activeDetail, rating)}
                onSetEnergy={(energy) => onSetEnergy(activeDetail, energy)}
                onSelectTag={onSelectTag}
              />
            )}
            {tab === "cues" && <CuesTab cues={activeDetail.cues} />}
            {tab === "analysis" && <AnalysisTab track={activeDetail} />}
            {tab === "playlists" && (
              <EmptyTab
                icon={ListMusic}
                title="No playlists yet"
                body="Playlist membership arrives with the Playlists workspace (Stage 5)."
              />
            )}
            {tab === "history" && (
              <EmptyTab
                title="No history yet"
                body="This track's import, tag, playlist and backup history is recorded when Maintain lands (Stage 6)."
              />
            )}
            {tab === "file" && <FileTab track={activeDetail} />}
          </>
        ) : (
          <div className="space-y-2" aria-label="Loading track details">
            <div className="h-3 w-2/3 animate-pulse rounded-sm bg-dj-elevated" />
            <div className="h-3 w-1/2 animate-pulse rounded-sm bg-dj-elevated" />
            <div className="h-3 w-3/4 animate-pulse rounded-sm bg-dj-elevated" />
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-dj-border p-3">
        <button
          type="button"
          onClick={() => onPlay(summary)}
          className="inline-flex items-center gap-1.5 rounded-md bg-dj-accent px-3 py-1.5 text-xs font-medium text-dj-on-accent transition hover:bg-dj-accent-strong"
          title="Load this track in the player"
        >
          <Play className="h-3.5 w-3.5" />
          Play
        </button>
        <button
          type="button"
          disabled
          title="Playlist membership arrives with the Playlists workspace (Stage 5)"
          className="inline-flex items-center gap-1.5 rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs text-dj-text-muted opacity-60"
        >
          <ListMusic className="h-3.5 w-3.5" />
          Add to playlist
        </button>
        <button
          type="button"
          onClick={() => onEditMetadata(summary)}
          className="inline-flex items-center gap-1.5 rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
          title="Edit the metadata and tags"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit metadata
        </button>
        <span className="ml-auto text-[11px] text-dj-text-muted">
          {activeDetail
            ? `${activeDetail.cues.length} cue${activeDetail.cues.length === 1 ? "" : "s"}`
            : ""}
        </span>
      </footer>
    </aside>
  );
}

/** Shows a placeholder for an unavailable panel section, with an optional icon. */
function EmptyTab({
  icon: Icon,
  title,
  body,
}: {
  icon?: typeof ListMusic;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      {Icon && <Icon className="h-7 w-7 text-dj-text-muted" />}
      <p className="text-xs font-semibold text-dj-text-secondary">{title}</p>
      <p className="max-w-[16rem] text-[11px] text-dj-text-muted">{body}</p>
    </div>
  );
}
