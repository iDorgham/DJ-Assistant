/**
 * Row windowing for the Library table (Stage 2).
 *
 * The table fetches its rows in pages and renders only the slice around the
 * viewport, so a 30,000-track library never mounts 30,000 `<tr>` elements.
 * Spacer rows stand in for the rows above and below the window, which keeps
 * the scrollbar proportional to the full result set.
 */

/** `py-2.5` (10px) above and below a 16px line of text. */
export const DEFAULT_ROW_HEIGHT = 36;
/** A rating or energy widget: a 14px inline-flex control with an 18px line box. */
export const WIDGET_ROW_HEIGHT = 38;
/** A status or tag chip: an 11px line box with 4px padding and a 1px border. */
export const CHIP_ROW_HEIGHT = 41;
/** The 36px (`h-9`) artwork thumb inside a `py-1.5` (6px) cell. */
export const ARTWORK_ROW_HEIGHT = 48;
export const DEFAULT_OVERSCAN = 4;

/**
 * Natural height of each cell that is taller than a plain text line. Rows are
 * pinned to the tallest visible cell's height so every row in a given column
 * set has the exact pitch the spacer arithmetic assumes.
 */
const COLUMN_ROW_HEIGHTS: Partial<Record<string, number>> = {
  artwork: ARTWORK_ROW_HEIGHT,
  status: CHIP_ROW_HEIGHT,
  tags: CHIP_ROW_HEIGHT,
  format: CHIP_ROW_HEIGHT,
  rating: WIDGET_ROW_HEIGHT,
  energy: WIDGET_ROW_HEIGHT,
};

export interface VirtualWindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  rowCount: number;
  overscan?: number;
}

export interface VirtualWindow {
  /** First rendered row, inclusive. */
  start: number;
  /** Last rendered row, exclusive. */
  end: number;
  topPadding: number;
  bottomPadding: number;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** The tallest visible cell decides the row height. */
export function rowHeightForColumns(columns: readonly { id: string }[]): number {
  return columns.reduce(
    (height, column) => Math.max(height, COLUMN_ROW_HEIGHTS[column.id] ?? DEFAULT_ROW_HEIGHT),
    DEFAULT_ROW_HEIGHT
  );
}

export function virtualWindow({
  scrollTop,
  viewportHeight,
  rowHeight,
  rowCount,
  overscan,
}: VirtualWindowInput): VirtualWindow {
  const count = Math.max(0, Math.floor(finite(rowCount)));
  if (count === 0) {
    return { start: 0, end: 0, topPadding: 0, bottomPadding: 0 };
  }

  const height = finite(rowHeight) > 0 ? Math.floor(rowHeight) : DEFAULT_ROW_HEIGHT;
  const viewport = Math.max(0, finite(viewportHeight));
  const maxScrollTop = Math.max(0, count * height - viewport);
  const clampedScrollTop = Math.min(Math.max(0, finite(scrollTop)), maxScrollTop);
  const buffer = Math.max(0, Math.floor(finite(overscan ?? DEFAULT_OVERSCAN)));

  const firstVisible = Math.min(count - 1, Math.floor(clampedScrollTop / height));
  const visibleCount = Math.ceil(viewport / height);
  const start = Math.max(0, firstVisible - buffer);
  const end = Math.min(count, firstVisible + visibleCount + buffer);

  return {
    start,
    end,
    topPadding: start * height,
    bottomPadding: (count - end) * height,
  };
}

/**
 * True when the window is close enough to the loaded rows that the next
 * server page should be fetched. `end` is the exclusive window end.
 */
export function shouldLoadMore(
  end: number,
  loadedCount: number,
  total: number,
  threshold = 20
): boolean {
  const loaded = Math.max(0, Math.floor(finite(loadedCount)));
  const available = Math.max(0, Math.floor(finite(total)));
  if (available <= 0 || loaded >= available) return false;
  if (loaded === 0) return true;
  const remaining = loaded - Math.max(0, Math.floor(finite(end)));
  return remaining <= Math.max(0, Math.floor(finite(threshold)));
}
