import type { TrackDetail } from "@dj-assistant/shared";
import { Pencil } from "lucide-react";

import { EnergyBars } from "../EnergyBars";
import { StarRating } from "../StarRating";
import { TagChips } from "../TagChips";

interface TagsTabProps {
  track: TrackDetail;
  onEditMetadata: () => void;
  onRate: (rating: number | null) => void;
  onSetEnergy: (energy: number | null) => void;
  onSelectTag?: (tag: string) => void;
}

export function TagsTab({ track, onEditMetadata, onRate, onSetEnergy, onSelectTag }: TagsTabProps) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
          Tags
        </h3>
        <TagChips tags={track.tags} maxVisible={24} onSelect={onSelectTag} />
        <p className="mt-2 text-[11px] text-dj-text-muted">
          Style, mood and set-position tags arrive with the Tag Surgeon (T2.2).
        </p>
      </section>

      <section className="space-y-2 text-xs">
        <Row label="Genre" value={track.genre} />
        <Row label="Label" value={track.label} />
        <Row label="Year" value={track.year != null ? String(track.year) : null} />
        <Row label="Comment" value={track.comments} multiline />
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
          Rating and energy
        </h3>
        <div className="space-y-3 rounded-md border border-dj-border bg-dj-elevated p-3">
          <div>
            <p className="mb-1 text-[11px] text-dj-text-muted">Rating</p>
            <StarRating
              value={track.userRating}
              onChange={onRate}
              label={`Rating for ${track.title || "Untitled"}`}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-dj-text-muted">Energy</p>
            <EnergyBars
              value={track.energy}
              onChange={onSetEnergy}
              label={`Energy for ${track.title || "Untitled"}`}
            />
          </div>
          <p className="text-[11px] text-dj-text-muted">
            Saves immediately. Undo is offered in the library.
          </p>
        </div>
      </section>

      <button
        type="button"
        onClick={onEditMetadata}
        className="inline-flex items-center gap-1.5 rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit metadata and tags
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  const shown = value?.trim();
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <span className="text-[11px] text-dj-text-muted">{label}</span>
      <span
        className={
          multiline
            ? "whitespace-pre-wrap break-words text-dj-text-secondary"
            : "truncate text-dj-text-secondary"
        }
        title={shown ?? undefined}
      >
        {shown || "—"}
      </span>
    </div>
  );
}
