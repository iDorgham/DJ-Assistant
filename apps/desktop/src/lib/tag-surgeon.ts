/**
 * Pure label helpers for the Tag Surgeon dialog (T2.2.1).
 *
 * Kept free of React and Tauri so the report→wording contract is testable with
 * `node --test`. The dialog renders raw spellings only — fold keys are internal
 * to the engine and never reach the user.
 */

import type {
  PrefixEdge,
  SpellingCluster,
  TagClusterReport,
  TagPreviewTrack,
} from "@dj-assistant/shared";

/** The scope subtitle: how many tracks the scan covered. */
export function scopeLabel(trackCount: number): string {
  return `${trackCount} track${trackCount === 1 ? "" : "s"}`;
}

/**
 * The spelling a cluster is titled as. The engine orders members by track
 * count desc then raw asc, so the first member is the representative — the
 * same rule the edge labels use.
 */
export function clusterHeading(cluster: SpellingCluster): string {
  return cluster.members[0].raw;
}

/** One spelling line inside a cluster: the raw text and its track count. */
export function memberLabel(member: SpellingCluster["members"][number]): string {
  return `${member.raw} ×${member.trackCount}`;
}

/**
 * A prefix relation phrased as a relation, not a proposal. The section title
 * ("Possibly related") carries the advisory framing; nothing here suggests a
 * change the read-only slice cannot make.
 */
export function edgeLabel(edge: PrefixEdge): string {
  return `${edge.narrowerLabel} ⊂ ${edge.broaderLabel}`;
}

/** The punctuation-only note, or null when there is nothing to report. */
export function ignoredTagsNote(count: number): string | null {
  if (count === 0) return null;
  return count === 1
    ? "1 tag is punctuation-only and was left alone"
    : `${count} tags are punctuation-only and were left alone`;
}

/** The empty state — an ordinary outcome, not an error. */
export function emptyReportMessage(trackCount: number): string {
  return trackCount === 1
    ? "No duplicate spellings in this track."
    : `No duplicate spellings in these ${trackCount} tracks.`;
}

/**
 * The preview's headline for a cluster (T2.2.3): how many tracks a rewrite
 * would touch and the spelling it would settle on. Shows no button; applying
 * is T2.2.4.
 */
export function rewriteLabel(cluster: SpellingCluster): string {
  return `${scopeLabel(cluster.rewriteTrackCount)} would change to "${cluster.canonical}"`;
}

/** The note for affected tracks the sample list does not name, or null. */
export function moreAffectedNote(cluster: SpellingCluster): string | null {
  const hidden = cluster.rewriteTrackCount - cluster.sampleTrackIds.length;
  if (hidden <= 0) return null;
  return `and ${hidden} more`;
}

/** The ids to fetch sample details for, across every cluster, without repeats. */
export function previewSampleIds(report: TagClusterReport): string[] {
  const seen = new Set<string>();
  for (const cluster of report.clusters) {
    for (const id of cluster.sampleTrackIds) seen.add(id);
  }
  return [...seen];
}

/** A sample track's title line: "Title — Artist". */
export function sampleTitle(track: TagPreviewTrack): string {
  return `${track.title} — ${track.artist}`;
}

/**
 * The spellings on a sample track that a rewrite would change: its tags other
 * than the canonical one, each once, in the order the track stores them.
 */
export function sampleSpellings(track: TagPreviewTrack, canonical: string): string[] {
  return [...new Set(track.tags)].filter((tag) => tag !== canonical);
}

/**
 * Whether the report has anything to show. Edges count on their own: the most
 * interesting finding sits between two singletons that appear in no cluster.
 * Ignored-only reports stay in the empty state, with the note below it.
 */
export function hasFindings(report: TagClusterReport): boolean {
  return report.clusters.length > 0 || report.prefixEdges.length > 0;
}
