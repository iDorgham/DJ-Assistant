import { summarizeTags } from "../lib/tags";

/**
 * Custom tag chips (T2.1.7, `docs/ui/01-DESIGN-SYSTEM.md` §3 "Tag chips").
 *
 * The chip treatment is fixed by the design system: `bg.elevated`,
 * `text.secondary`, `radius.sm`, a hairline border and compact padding. A
 * hover gets a subtle accent border, and a click either filters the library
 * by that tag or opens the editor — the caller decides which, by passing
 * `onSelect`.
 *
 * A cell has room for a couple of chips; the rest collapse into one `+N` chip
 * whose tooltip names them all, so a track with eight tags still renders one
 * tidy cell.
 */
interface TagChipsProps {
  /** The track's tags. An empty list renders the table's empty-cell dash. */
  tags: string[] | undefined;
  /** How many chips the cell shows before the `+N` overflow. */
  maxVisible?: number;
  /** Called with the clicked tag — usually "filter the library by this tag". */
  onSelect?: (tag: string) => void;
  /** Accessible name of the group. */
  label?: string;
}

const CHIP_CLASS =
  "inline-flex max-w-[9rem] items-center truncate rounded-sm border border-dj-border bg-dj-elevated px-1.5 py-0.5 text-[11px] text-dj-text-secondary transition";

export function TagChips({ tags, maxVisible = 2, onSelect, label = "Tags" }: TagChipsProps) {
  const all = tags ?? [];
  if (all.length === 0) {
    return <span className="text-dj-text-muted">—</span>;
  }

  const { visible, overflow } = summarizeTags(all, maxVisible);
  const hidden = overflow > 0 ? all.slice(maxVisible) : [];

  return (
    <div className="flex items-center gap-1 overflow-hidden" role="group" aria-label={label}>
      {visible.map((tag) =>
        onSelect ? (
          <button
            key={tag}
            type="button"
            onClick={(event) => {
              // The row underneath owns the click for selection; a chip click
              // must not also toggle the selection.
              event.stopPropagation();
              onSelect(tag);
            }}
            className={`${CHIP_CLASS} hover:border-dj-accent/50 hover:text-dj-accent focus:outline-hidden focus-visible:ring-1 focus-visible:ring-dj-accent`}
            title={`Filter by tag “${tag}”`}
            aria-label={`Filter by tag ${tag}`}
          >
            {tag}
          </button>
        ) : (
          <span key={tag} className={CHIP_CLASS} title={tag}>
            {tag}
          </span>
        )
      )}
      {overflow > 0 && (
        <span className={CHIP_CLASS} title={hidden.join(", ")} aria-label={`${overflow} more tags`}>
          +{overflow}
        </span>
      )}
    </div>
  );
}
