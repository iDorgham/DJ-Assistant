/**
 * Request tokens for a tab read in the Maintain dialog.
 *
 * Every read takes a token and only the newest token may publish, so a read
 * that finishes after a write — or after a newer read — cannot put stale data
 * back on screen. Kept free of React so the ordering rules can be tested
 * directly; `useTabRead` in `MaintainDialog.tsx` drives it.
 */
import type { MaintainTab } from "./maintain.ts";

export class ReadGate {
  private latest = 0;
  private pending = false;

  /**
   * Starts a read and returns its token. With `join`, a read that is already
   * pending is reused instead (returns `null`): a tab switch mid-scan must not
   * start a second scan.
   */
  begin(join: boolean): number | null {
    if (join && this.pending) return null;
    this.latest += 1;
    this.pending = true;
    return this.latest;
  }

  /** Whether `token` belongs to the newest read — the only one that may publish. */
  isCurrent(token: number): boolean {
    return token === this.latest;
  }

  /** Marks `token`'s read finished; an orphaned token changes nothing. */
  settle(token: number): void {
    if (token === this.latest) this.pending = false;
  }

  /** Orphans any pending read, so its result is dropped when it arrives. */
  invalidate(): void {
    this.latest += 1;
    this.pending = false;
  }
}

/**
 * The reads a write must restart: Duplicates (the tab the writes come from)
 * and whichever tab is open now, so a tab switched to mid-write does not wait
 * on a read the write just orphaned.
 */
export function tabsToRefreshAfterWrite(activeTab: MaintainTab): MaintainTab[] {
  return activeTab === "duplicates" ? ["duplicates"] : ["duplicates", activeTab];
}
