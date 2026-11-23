import type { ReactNode } from "react";

import type { MaintainTrack } from "@dj-assistant/shared";

import { formatDuration, formatQuality } from "../lib/maintain";

/** Small pieces shared by the Maintain dialog's tabs. */

/** Rows rendered per drill-down before "Show more". */
export const DRILL_PAGE = 50;

export const buttonClass =
  "shrink-0 rounded-md border border-dj-border bg-dj-elevated px-2 py-0.5 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover disabled:opacity-50";
export const quietButtonClass =
  "shrink-0 rounded-md px-2 py-0.5 text-[11px] text-dj-text-muted transition hover:bg-dj-hover disabled:opacity-50";
export const errorClass =
  "rounded-sm border border-dj-danger/30 bg-dj-danger/10 px-2 py-1.5 text-[11px] text-dj-danger";

/** A track's title and artist, with its length, quality and path below. */
export function TrackLine({ track }: { track: MaintainTrack }) {
  return (
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
}

/** One track in a drill-down, with its Open button. */
export function DrillRow({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2">
      {children}
      <button type="button" onClick={onOpen} className={buttonClass}>
        Open
      </button>
    </li>
  );
}

/** A failed load with a way to try again without reopening the dialog. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <p className={`${errorClass} flex-1`}>{message}</p>
      <button type="button" onClick={onRetry} className={buttonClass}>
        Retry
      </button>
    </div>
  );
}
