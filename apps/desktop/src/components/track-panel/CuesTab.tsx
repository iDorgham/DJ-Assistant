import type { CuePoint } from "@dj-assistant/shared";
import { Flag } from "lucide-react";

import { cueTitle, formatCueTime, formatCueType } from "../../lib/track-panel";

export function CuesTab({ cues }: { cues: CuePoint[] }) {
  if (cues.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Flag className="h-7 w-7 text-dj-text-muted" />
        <p className="text-xs font-semibold text-dj-text-secondary">No cues yet</p>
        <p className="max-w-[16rem] text-[11px] text-dj-text-muted">
          Cue editing arrives with the player. Stored hot cues, memory cues and loops appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[11px] text-dj-text-muted">
        {cues.length} cue{cues.length === 1 ? "" : "s"} stored for this track.
      </p>
      <ul className="space-y-1.5">
        {cues.map((cue) => (
          <li
            key={cue.id}
            className="flex items-center gap-2 rounded-md border border-dj-border bg-dj-elevated px-2.5 py-2"
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full border border-dj-border-strong"
              style={cue.colorHex ? { backgroundColor: cue.colorHex } : undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-dj-text">{cueTitle(cue)}</p>
              <p className="text-[11px] text-dj-text-muted">{formatCueType(cue.cueType)}</p>
            </div>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-dj-text-secondary">
              {formatCueTime(cue.positionMs)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-dj-text-muted">
        Cue editing is read-only here until the player owns cue writes.
      </p>
    </div>
  );
}
