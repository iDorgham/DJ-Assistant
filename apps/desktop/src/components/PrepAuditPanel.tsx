import { useState } from "react";
import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";

import type { PrepAuditResponse, PrepCheckView } from "@dj-assistant/shared";

import {
  affectedNote,
  prepCheckDetail,
  prepScopeText,
  prepVerdictText,
  prepVerdictTone,
  type PrepTone,
} from "../lib/maintain";
import { DRILL_PAGE, DrillRow, LoadError, TrackLine, quietButtonClass } from "./MaintainParts";

const TONE_TEXT: Record<PrepTone, string> = {
  good: "text-dj-success",
  fair: "text-dj-warning",
  poor: "text-dj-danger",
  neutral: "text-dj-text-muted",
};

/** The icon a check row leads with: passed, blocker or warning. */
function CheckIcon({ check }: { check: PrepCheckView }) {
  if (check.failingTotal === 0) {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-dj-success" aria-label="Passed" />;
  }
  return check.severity === "blocker" ? (
    <OctagonAlert className="h-4 w-4 shrink-0 text-dj-danger" aria-label="Blocker" />
  ) : (
    <AlertTriangle className="h-4 w-4 shrink-0 text-dj-warning" aria-label="Warning" />
  );
}

interface PrepAuditPanelProps {
  audit: PrepAuditResponse | null;
  error: string | null;
  onRetry: () => void;
  onOpenTrack: (trackId: string) => void;
}

/**
 * Library › Maintain › Prep audit (T2.3.4): the pre-gig checklist over the
 * selected tracks, or the whole library. Blockers first, then warnings; a
 * passing check stays listed so the checklist shows what was checked.
 */
export function PrepAuditPanel({ audit, error, onRetry, onOpenTrack }: PrepAuditPanelProps) {
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [drillLimit, setDrillLimit] = useState(DRILL_PAGE);

  const renderCheck = (check: PrepCheckView) => {
    const expanded = openCheck === check.id;
    const canDrill = check.failing.length > 0;
    const note = affectedNote(Math.min(drillLimit, check.failing.length), check.failingTotal);
    return (
      <li key={check.id} className="rounded-md border border-dj-border bg-dj-elevated/40">
        <button
          type="button"
          onClick={() => {
            setOpenCheck(expanded ? null : check.id);
            setDrillLimit(DRILL_PAGE);
          }}
          disabled={!canDrill}
          aria-expanded={canDrill ? expanded : undefined}
          className="flex w-full items-center gap-3 px-3 py-2 text-left transition enabled:hover:bg-dj-hover"
        >
          <CheckIcon check={check} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-dj-text">{check.label}</p>
            <p className="truncate text-[11px] text-dj-text-muted">{prepCheckDetail(check)}</p>
          </div>
        </button>
        {expanded && (
          <div className="border-t border-dj-border px-3 py-2">
            <ul className="space-y-1.5">
              {check.failing.slice(0, drillLimit).map((track) => (
                <DrillRow key={track.id} onOpen={() => onOpenTrack(track.id)}>
                  <TrackLine track={track} />
                </DrillRow>
              ))}
            </ul>
            {check.failing.length > drillLimit && (
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

  // Blockers before warnings; the core keeps each group in a stable order.
  const ordered = audit
    ? [...audit.checks].sort(
        (a, b) => Number(a.severity !== "blocker") - Number(b.severity !== "blocker")
      )
    : [];

  return (
    <div className="space-y-3">
      {error && <LoadError message={`Could not run the prep audit: ${error}`} onRetry={onRetry} />}
      {!audit && !error && <p className="text-xs text-dj-text-muted">Auditing…</p>}
      {audit && (
        <>
          <div>
            <p
              className={`text-sm font-semibold ${TONE_TEXT[prepVerdictTone(audit.verdict)]}`}
              role="status"
            >
              {prepVerdictText(audit)}
            </p>
            <p className="text-[11px] text-dj-text-muted">Checked {prepScopeText(audit)}.</p>
          </div>
          {audit.verdict !== "empty" && <ul className="space-y-1.5">{ordered.map(renderCheck)}</ul>}
          <p className="text-[11px] text-dj-text-muted">
            Select the tracks you plan to play to audit just those. Energy flow and vocal clashes
            need a set order, so they are checked once sets arrive.
          </p>
        </>
      )}
    </div>
  );
}
